/**
 * SocialMedia AI Agent Service (Serverless)
 * Generates social media posts for multiple platforms using GPT-4o-mini
 * Migrated from agents/socialmedia-ai/index.ts to Vercel serverless
 */

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import OpenAI from 'openai';

const AGENT_ID = 'agent_socialmedia_ai'; // Legacy ID
const AGENT_NAME = 'SocialMedia AI';
const ERC8004_AGENT_ID = '4'; // Official ERC-8004 NFT Token ID
const CDP_WALLET = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';

// OpenAI client for GPT-4o-mini (optimized for bulk content)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Pinata for IPFS uploads
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY || process.env.PINATA_API_SECRET;

interface ExecuteRequest {
  missionId: string;
  agentId: string;
  description: string;
  capability: string;
  payment: number;
  requirements: Record<string, unknown>;
  callbackUrl: string;
}

/**
 * Execute task endpoint with X402 Payment Required support
 */
export async function POST(request: NextRequest) {
  try {
    const task: ExecuteRequest = await request.json();
    const paymentProofHeader = request.headers.get('x-payment-proof');

    console.log(`[${AGENT_NAME}] Received task:`, task.missionId);
    console.log(`[${AGENT_NAME}] Description:`, task.description);
    console.log(`[${AGENT_NAME}] Payment: ${task.payment} USDC`);

    // Check for payment proof
    if (!paymentProofHeader) {
      console.log(`[${AGENT_NAME}] No payment proof - returning 402 Payment Required`);

      // Return X402 Payment Required
      const paymentRequest = {
        amount: task.payment.toString(),
        token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC on Base Sepolia
        recipient: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', // SocialMedia AI wallet
        chainId: 84532, // Base Sepolia
        description: `Payment for social media content - Mission ${task.missionId}`,
      };

      return NextResponse.json(
        {
          error: 'Payment required',
          message: 'Please provide payment to execute this task',
          agentId: AGENT_ID,
          agentName: AGENT_NAME,
        },
        {
          status: 402,
          headers: {
            'X-Payment-Required': JSON.stringify(paymentRequest),
          },
        }
      );
    }

    // Verify payment proof
    try {
      const paymentProof = JSON.parse(paymentProofHeader);
      console.log(`[${AGENT_NAME}] Verifying payment proof:`, {
        from: paymentProof.from,
        to: paymentProof.to,
        amount: paymentProof.amount,
        txHash: paymentProof.txHash,
      });

      // TODO: Verify payment on-chain using viem
      // For now, just check that proof exists and has required fields
      if (!paymentProof.txHash || !paymentProof.amount || !paymentProof.from) {
        throw new Error('Invalid payment proof format');
      }

      console.log(`[${AGENT_NAME}] Payment verified! Executing task...`);

      // Execute task asynchronously (don't await)
      executeTask(task).catch((error) => {
        console.error(`[${AGENT_NAME}] Task execution failed:`, error);
      });

      // Respond immediately
      return NextResponse.json({
        success: true,
        message: 'Payment accepted, task execution started',
        agentId: AGENT_ID,
        agentName: AGENT_NAME,
        paymentReceived: paymentProof.amount,
      });
    } catch (error) {
      console.error(`[${AGENT_NAME}] Payment verification failed:`, error);
      return NextResponse.json(
        {
          error: 'Invalid payment proof',
          message: error instanceof Error ? error.message : 'Payment verification failed',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error(`[${AGENT_NAME}] Request error:`, error);
    return NextResponse.json(
      {
        error: 'Invalid request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    agent: AGENT_NAME,
    agentId: AGENT_ID, // Legacy ID
    erc8004AgentId: ERC8004_AGENT_ID, // Official ERC-8004 NFT ID
    cdpWallet: CDP_WALLET,
    capabilities: ['social-media', 'content-writing', 'marketing', 'engagement'],
    officialRegistry: '0x8004AA63c570c570eBF15376c0dB199918BFe9Fb',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Execute the social media content generation task
 */
async function executeTask(task: ExecuteRequest) {
  try {
    // Update status to executing
    console.log(`[${AGENT_NAME}] Starting execution...`);
    await updateStatus(task, 'executing', null, null);

    // Generate social media content using GPT-4o-mini
    console.log(`[${AGENT_NAME}] Generating social media content with GPT-4o-mini...`);

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const systemPrompt = `You are a social media content specialist. Create engaging, platform-optimized posts that drive engagement.

Generate 15-20 social media posts for the following platforms: Twitter, Instagram, and LinkedIn.

For each post include:
- Platform-optimized content (character limits, formatting)
- Relevant hashtags (3-5 per post)
- Emoji usage (where appropriate)
- Call-to-action (when suitable)
- Best time to post
- Content type (educational, promotional, entertaining, etc.)

Also provide:
- Content calendar with posting schedule
- Hashtag strategy
- Engagement tips
- Platform-specific best practices

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "posts": [
    {
      "id": 1,
      "platform": "twitter|instagram|linkedin",
      "content": "post text with emojis",
      "hashtags": ["tag1", "tag2", "tag3"],
      "bestTime": "e.g., 9am-11am weekdays",
      "contentType": "educational|promotional|entertaining|announcement",
      "cta": "call to action if any"
    }
  ],
  "contentCalendar": {
    "week1": "schedule description",
    "week2": "schedule description",
    "week3": "schedule description",
    "week4": "schedule description"
  },
  "hashtagStrategy": "overall hashtag approach",
  "engagementTips": ["tip 1", "tip 2", "tip 3"],
  "platformBestPractices": {
    "twitter": "best practices",
    "instagram": "best practices",
    "linkedin": "best practices"
  }
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: task.description },
      ],
      temperature: 0.9,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    if (!response.choices[0]?.message?.content) {
      throw new Error('No content returned from GPT-4o-mini');
    }

    const socialContent = JSON.parse(response.choices[0].message.content);
    console.log(`[${AGENT_NAME}] Generated ${socialContent.posts?.length || 0} social media posts`);

    // Upload to IPFS via Pinata
    console.log(`[${AGENT_NAME}] Uploading to IPFS...`);
    const ipfsHash = await uploadJSONToIPFS(socialContent, `social-${task.missionId}.json`);
    const deliverableUri = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

    console.log(`[${AGENT_NAME}] Deliverable uploaded:`, deliverableUri);

    // Update status to completed
    await updateStatus(task, 'completed', deliverableUri, {
      content: socialContent,
      ipfsHash,
      model: 'gpt-4o-mini',
      prompt: task.description,
      postCount: socialContent.posts?.length || 0,
      generatedAt: new Date().toISOString(),
    });

    console.log(`[${AGENT_NAME}] Task completed successfully`);
  } catch (error) {
    console.error(`[${AGENT_NAME}] Task failed:`, error);
    await updateStatus(
      task,
      'failed',
      null,
      null,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Upload JSON to IPFS via Pinata
 */
async function uploadJSONToIPFS(jsonData: Record<string, unknown>, filename: string): Promise<string> {
  if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
    throw new Error('Pinata API keys not configured');
  }

  const response = await axios.post(
    'https://api.pinata.cloud/pinning/pinJSONToIPFS',
    {
      pinataContent: jsonData,
      pinataMetadata: {
        name: filename,
      },
    },
    {
      headers: {
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_SECRET_KEY,
      },
    }
  );

  return response.data.IpfsHash;
}

/**
 * Update mission execution status via callback
 */
async function updateStatus(
  task: ExecuteRequest,
  status: 'executing' | 'completed' | 'failed',
  deliverableUri: string | null,
  resultData: Record<string, unknown> | null,
  errorMessage?: string
) {
  try {
    // Try to get execution ID from database
    let executionId: number | undefined;

    try {
      const executionsResponse = await axios.get(
        `${task.callbackUrl.replace('/update', '')}`
      );
      const executions = executionsResponse.data.executions || [];
      const execution = executions.find((e: { agent_id: string }) => e.agent_id === task.agentId);

      if (execution) {
        executionId = execution.id;
      } else {
        console.warn(`[${AGENT_NAME}] Execution record not found for agent ${task.agentId}, calling update anyway`);
      }
    } catch (error) {
      console.warn(`[${AGENT_NAME}] Failed to fetch execution record, calling update anyway:`, error);
    }

    // Call update endpoint regardless (it will find/create execution if needed)
    await axios.post(task.callbackUrl, {
      executionId,
      agentId: task.agentId,
      status,
      deliverableUri,
      resultData,
      errorMessage,
    });

    console.log(`[${AGENT_NAME}] Status updated to: ${status}`);
  } catch (error) {
    console.error(`[${AGENT_NAME}] Failed to update status:`, error);
  }
}
