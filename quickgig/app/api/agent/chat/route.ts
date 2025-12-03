/**
 * AI Agent Payment Endpoint (X402 Protocol)
 * Returns 402 Payment Required if payment not provided
 * Processes request if valid payment proof supplied
 */

import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { parseUnits } from 'viem';
import { verifyPaymentProof, createPaymentProof } from '@/lib/x402/middleware';
import type { X402PaymentRequest, X402PaymentProof } from '@/lib/x402/types';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { createSession, getSession, updateSession } from '@/lib/storage/in-memory-chat';

// OpenAI client for premium models (GPT-4o, etc)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// OpenRouter client for economic models (fallback)
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || '',
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || '',
    'X-Title': process.env.NEXT_PUBLIC_SITE_NAME || '',
  },
});

// Agent wallet address (REQUIRED - validate on startup)
const AGENT_WALLET = process.env.AGENT_WALLET_ADDRESS;

if (!AGENT_WALLET || AGENT_WALLET === '0x0000000000000000000000000000000000000000') {
  throw new Error('AGENT_WALLET_ADDRESS environment variable is required and must not be null address');
}

// Pricing: $0.01 per message, $0.10 per session (30 messages)
const PRICE_PER_MESSAGE = parseUnits('0.01', 6); // USDC has 6 decimals
const PRICE_PER_SESSION = parseUnits('0.10', 6); // 30 messages

export async function POST(request: NextRequest) {
  try {
    const { message, agentId = 'quickgig-ai-agent', sessionId } = await request.json();

    console.log('[Agent Chat] Request:', { agentId, sessionId, hasMessage: !!message });

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Check for payment proof in headers
    const paymentProofHeader = request.headers.get('X-Payment-Proof');
    console.log('[Agent Chat] Has payment proof:', !!paymentProofHeader);

    // Check if session has remaining messages
    const session = sessionId ? await getSession(sessionId) : null;
    console.log('[Agent Chat] Session lookup:', {
      sessionId,
      found: !!session,
      messagesRemaining: session?.messages_remaining,
      expiresAt: session?.expires_at,
    });
    const hasSession = session && session.messages_remaining > 0 && new Date(session.expires_at) > new Date();

    // If no session and no payment proof, return 402
    if (!hasSession && !paymentProofHeader) {
      const paymentRequest: X402PaymentRequest = {
        amount: PRICE_PER_SESSION.toString(),
        token: CONTRACTS.USDC,
        recipient: AGENT_WALLET as `0x${string}`,
        chainId: 84532, // Base Sepolia
        description: `Mission planning session with ${agentId} (30 messages)`,
      };

      return new NextResponse(
        JSON.stringify({
          error: 'Payment required',
          message: `Mission planning session: $0.10 for 30 messages`,
          agentId,
        }),
        {
          status: 402,
          headers: {
            'Content-Type': 'application/json',
            'X-Payment-Required': JSON.stringify(paymentRequest),
          },
        }
      );
    }

    // Verify payment proof if provided
    if (paymentProofHeader && !hasSession) {
      try {
        const proof: X402PaymentProof = JSON.parse(paymentProofHeader);
        console.log('[Agent Chat] Payment proof parsed:', { from: proof.from, to: proof.to, amount: proof.amount });

        // Verify payment on-chain
        console.log('[Agent Chat] Verifying payment proof...');
        const isValid = await verifyPaymentProof(proof);
        console.log('[Agent Chat] Payment verification result:', isValid);

        if (!isValid) {
          console.error('[Agent Chat] Payment proof verification failed');
          return NextResponse.json(
            { error: 'Invalid payment proof' },
            { status: 400 }
          );
        }

        // Create new session in Supabase
        const newSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        await createSession({
          session_id: newSessionId,
          user_address: proof.from,
          agent_id: agentId,
          messages_remaining: 30,
          total_paid: proof.amount,
          expires_at: expiresAt,
        });

        // Decrement message count
        await updateSession(newSessionId, { messages_remaining: 29 });

        // Process AI request
        try {
          const aiResponse = await processAIRequest(message, agentId);

          return NextResponse.json({
            message: aiResponse,
            sessionId: newSessionId,
            messagesRemaining: 29,
            paid: true,
          });
        } catch (aiError) {
          return NextResponse.json(
            { error: aiError instanceof Error ? aiError.message : 'AI service error' },
            { status: 503 }
          );
        }
      } catch (error) {
        return NextResponse.json(
          { error: 'Failed to verify payment proof' },
          { status: 400 }
        );
      }
    }

    // Use existing session
    if (hasSession && session) {
      // Decrement message count in database
      const newCount = session.messages_remaining - 1;
      await updateSession(sessionId!, { messages_remaining: newCount });

      // Process AI request
      try {
        const aiResponse = await processAIRequest(message, agentId);

        return NextResponse.json({
          message: aiResponse,
          sessionId,
          messagesRemaining: newCount,
          paid: false, // Using existing session
        });
      } catch (aiError) {
        return NextResponse.json(
          { error: aiError instanceof Error ? aiError.message : 'AI service error' },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Invalid request state' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Agent chat error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * Process AI request using OpenAI GPT-4o (premium model)
 */
async function processAIRequest(message: string, agentId: string): Promise<string> {
  // Check for mission creation intent (bounty/gig creation, not agent-based)
  const missionKeywords = /\b(create|new|post|generate|make|want to create|i want a|put up a?|deploy)\s+(a\s+)?(bounty|gig|job|task|mission)\b/i;
  const isMissionIntent = missionKeywords.test(message);

  if (isMissionIntent) {
    // Extract potential details from message
    const amountMatch = message.match(/\$(\d+(?:\.\d{1,2})?)/);
    const amount = amountMatch ? amountMatch[1] : null;

    // RETURN IMMEDIATELY - don't fall through to GPT
    return JSON.stringify({
      message: "Ready to deploy your mission! Fill in the details below:",
      action: {
        type: 'bounty_form',
        prefilled: {
          description: message.replace(missionKeywords, '').trim(),
          amount: amount,
        },
      },
    });
  }

  // Check for AI agent matching mode (triggered by user selection)
  if (message.startsWith('[AI_AGENT_MATCHING]')) {
    const actualMessage = message.replace('[AI_AGENT_MATCHING]', '').trim();

    try {
      const { detectIntent } = await import('@/lib/ai/intent-detector');
      const { recommendMultipleAgents } = await import('@/lib/ai/agent-recommender');

      console.log('[AI Agent Matching] Analyzing message:', actualMessage);

      const analysis = await detectIntent(actualMessage);
      console.log('[AI Agent Matching] Intent analysis:', JSON.stringify(analysis, null, 2));

      const capabilities = analysis.intents.flatMap((i) => i.capabilities);
      const uniqueCapabilities = [...new Set(capabilities)];
      console.log('[AI Agent Matching] Unique capabilities:', uniqueCapabilities);

      if (uniqueCapabilities.length > 0) {
        // Get agent recommendations
        console.log('[AI Agent Matching] Fetching agents with minScore: 0, limit: 3');
        const recommendations = await recommendMultipleAgents(uniqueCapabilities, {
          minScore: 0,
          limit: 3,
        });

        console.log('[AI Agent Matching] Recommendations received:', recommendations.size, 'capabilities');

        // Convert Map to object
        const recommendationsObj: Record<string, { capability: string; agents: unknown[]; totalFound: number; filterCriteria: { minScore: number; sortBy: string } }> = {};
        for (const [capability, recommendation] of recommendations.entries()) {
          console.log(`[AI Agent Matching] Capability "${capability}": ${recommendation.agents.length} agents found`);
          recommendationsObj[capability] = recommendation;
        }

        // RETURN IMMEDIATELY
        return JSON.stringify({
          message: `I found **${uniqueCapabilities.length} type(s) of agents** for your request:\n\n${uniqueCapabilities.map(c => `- **${c}**`).join('\n')}\n\nSelect agents below to deploy your mission:`,
          action: {
            type: 'agent_recommendation',
            data: {
              analysis,
              recommendations: recommendationsObj,
              capabilities: uniqueCapabilities,
            },
          },
        });
      } else {
        return JSON.stringify({
          message: `I couldn't identify specific agent capabilities from your request. Could you be more specific about what you need?`,
          action: {
            type: 'error',
            data: {
              error: 'No capabilities detected',
            },
          },
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[AI Agent Matching] Intent detection failed:', errorMessage, error);

      return JSON.stringify({
        message: `I encountered an error analyzing your request.\n\n**Error:** ${errorMessage}\n\nPlease try rephrasing your mission.`,
        action: {
          type: 'error',
          data: {
            error: errorMessage,
          },
        },
      });
    }
  }

  // Check for agent service request intent (AI economy integration)
  // Flexible regex: matches "create ... logo" with any words in between
  const serviceKeywords = /\b(design|create|make|build|develop|write|generate|code|edit)\b.*?\b(logo|website|app|copy|content|video|graphic|tagline|slogan|brand|landing page|banner)\b/i;
  const isServiceIntent = serviceKeywords.test(message);

  if (isServiceIntent) {
    // Offer mission mode selection: AI matching or open bounty
    // RETURN IMMEDIATELY - don't fall through to GPT
    return JSON.stringify({
      message: `Perfect! I can help you deploy this mission. Choose your deployment mode:`,
      action: {
        type: 'mission_mode_selection',
        data: {
          originalMessage: message,
        },
      },
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return `Mock response from ${agentId}: I received your message "${message}". This is a demo response.`;
  }

  try {
    // Use GPT-4o-mini for fast, cost-effective responses
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are ${agentId}, an AI assistant for QUICKGIG - an autonomous agent network.

CORE PURPOSE: Help users deploy missions and find autonomous agents for tasks like:
- Logo design, graphic design, branding
- Copywriting, content writing, taglines
- Social media posts, marketing content
- Web development, coding, apps
- Video editing, animations
- And any other creative or technical work

VALID USER REQUESTS (do NOT redirect these):
- "I need a logo design" → Help them deploy a mission
- "Create a website" → Help them find agents
- "Write copy for my product" → Assist with mission planning
- Any request for creative/technical work → This is what QUICKGIG is for!

ONLY REDIRECT if user asks about:
- Unrelated topics (weather, sports, personal advice, general knowledge)
- Then say: "I'm designed for QUICKGIG. Ask about deploying missions, finding agents, or how autonomous agents work."

This is PAID via X402 micropayments - be extremely concise and valuable.

RESPONSE STYLE (CRITICAL):
- Keep responses SHORT - 2-3 sentences max for simple questions
- Use plain conversational text, not essays
- NO headings (##) unless absolutely necessary
- NO bullet lists unless listing 3+ items
- NO emojis
- Sound human and direct

EXAMPLES:

Bad (too long):
"## How Missions Work

Missions on QUICKGIG are deployed through smart contracts:

1. **Create Mission**
   - Write requirements
   - Set USDC amount
   - Choose deadline

2. **Deploy**
   - Funds lock in escrow
   - Agents discover and apply

Your mission goes live immediately."

Good (concise):
"Missions are simple: describe what you need, set a USDC reward and deadline. Funds lock in escrow. Agents discover and apply automatically. Want to deploy one?"

Bad:
"Let me explain the payment system in detail..."

Good:
"Payments use USDC in smart contract escrow. Released when work is approved. Want to try it?"

Keep it SHORT. Be helpful, not verbose.`,
        },
        {
          role: 'user',
          content: message,
        },
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    return completion.choices[0].message.content || 'I apologize, I could not generate a response.';
  } catch (error) {
    console.error('OpenAI API error:', error);

    // Fallback to OpenRouter if OpenAI fails
    console.log('[Agent Chat] Falling back to OpenRouter...');
    try {
      const completion = await openrouter.chat.completions.create({
        model: 'openai/gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are ${agentId}, an AI assistant for QUICKGIG - an autonomous agent network.

CORE PURPOSE: Help users deploy missions and find autonomous agents for tasks like:
- Logo design, graphic design, branding
- Copywriting, content writing, taglines
- Social media posts, marketing content
- Web development, coding, apps
- Video editing, animations
- And any other creative or technical work

VALID USER REQUESTS (do NOT redirect these):
- "I need a logo design" → Help them deploy a mission
- "Create a website" → Help them find agents
- "Write copy for my product" → Assist with mission planning
- Any request for creative/technical work → This is what QUICKGIG is for!

ONLY REDIRECT if user asks about unrelated topics (weather, sports, personal advice, general knowledge).

This is PAID via X402 micropayments - be extremely concise and valuable.

RESPONSE STYLE (CRITICAL):
- Keep responses SHORT - 2-3 sentences max for simple questions
- Use plain conversational text, not essays
- NO headings (##) unless absolutely necessary
- NO bullet lists unless listing 3+ items
- NO emojis
- Sound human and direct

Keep it SHORT. Be helpful, not verbose.`,
          },
          {
            role: 'user',
            content: message,
          },
        ],
        max_tokens: 300,
        temperature: 0.7,
      });

      return completion.choices[0].message.content || 'I apologize, I could not generate a response.';
    } catch (fallbackError) {
      console.error('[Agent Chat] OpenRouter fallback error:', fallbackError);
      throw new Error(`AI service unavailable: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
    }
  }
}

/**
 * Get session info
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
  }

  const session = await getSession(sessionId);

  if (!session || new Date(session.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
  }

  return NextResponse.json({
    sessionId: session.session_id,
    messagesRemaining: session.messages_remaining,
    expiresAt: session.expires_at,
  });
}

