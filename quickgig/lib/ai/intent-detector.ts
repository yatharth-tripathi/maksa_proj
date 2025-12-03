/**
 * Intent Detection System
 * Analyzes user requests to determine required agent capabilities
 */

import { COMMON_CAPABILITIES } from '@/lib/erc8004/types';

export interface DetectedIntent {
  capabilities: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedAgents: number;
  suggestedBudget: {
    min: number; // USD
    max: number;
  };
  description: string;
  requiresOrchestration: boolean;
}

export interface IntentAnalysis {
  intents: DetectedIntent[];
  totalEstimatedCost: {
    min: number;
    max: number;
  };
  recommendedApproach: string;
  breakdown: Array<{
    capability: string;
    reasoning: string;
    alternatives?: string[];
  }>;
}

/**
 * Analyze user message to detect required capabilities
 */
export async function detectIntent(userMessage: string): Promise<IntentAnalysis> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  const systemPrompt = `You are an expert at analyzing requests for the QUICKGIG autonomous agent platform.

Your task: Analyze user requests and identify what autonomous agents/capabilities are needed.

Available Capabilities:
${COMMON_CAPABILITIES.join(', ')}

Response Format (JSON):
{
  "intents": [{
    "capabilities": ["capability1", "capability2"],
    "complexity": "simple|moderate|complex",
    "estimatedAgents": 1-5,
    "suggestedBudget": { "min": 5, "max": 50 },
    "description": "Brief description",
    "requiresOrchestration": true/false
  }],
  "totalEstimatedCost": { "min": 5, "max": 50 },
  "recommendedApproach": "Sequential: logo first, then copy, then voice | Parallel: all at once",
  "breakdown": [{
    "capability": "logo-design",
    "reasoning": "Why this capability is needed",
    "alternatives": ["other options if any"]
  }]
}

Examples:
- "Design a logo" → {"capabilities": ["logo-design"], "complexity": "simple", "estimatedAgents": 1}
- "Create logo + tagline" → {"capabilities": ["logo-design", "copywriting"], "complexity": "moderate", "estimatedAgents": 2, "requiresOrchestration": true}
- "Full brand package: logo, website, social media" → {"capabilities": ["logo-design", "web-development", "graphic-design", "copywriting"], "complexity": "complex", "estimatedAgents": 4, "requiresOrchestration": true}

Be specific, realistic with pricing, and identify if multiple agents need coordination.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://quickgig.fun',
        'X-Title': 'QUICKGIG Intent Detector',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini', // Fast and cheap for intent detection
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3, // Low temperature for consistent analysis
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json();
    const analysisText = data.choices[0].message.content;
    const analysis: IntentAnalysis = JSON.parse(analysisText);

    // Validate and normalize
    return {
      ...analysis,
      intents: analysis.intents.map((intent) => ({
        ...intent,
        capabilities: intent.capabilities.filter((cap) =>
          COMMON_CAPABILITIES.includes(cap as typeof COMMON_CAPABILITIES[number])
        ),
      })),
    };
  } catch (error) {
    console.error('[Intent Detector] Error:', error);

    // Fallback: Simple keyword-based detection
    return detectIntentFallback(userMessage);
  }
}

/**
 * Fallback intent detection using keywords
 */
function detectIntentFallback(userMessage: string): IntentAnalysis {
  const message = userMessage.toLowerCase();
  const detectedCapabilities: string[] = [];

  // Simple keyword matching
  const keywords: Record<string, string[]> = {
    'logo-design': ['logo', 'brand mark', 'icon design'],
    'copywriting': ['copy', 'tagline', 'slogan', 'content', 'write'],
    'web-development': ['website', 'web app', 'landing page', 'site'],
    'graphic-design': ['graphic', 'visual', 'design', 'banner', 'poster'],
    'video-editing': ['video', 'edit', 'footage'],
    'social-media': ['social', 'twitter', 'instagram', 'facebook'],
    'translation': ['translate', 'translation', 'language'],
  };

  for (const [capability, terms] of Object.entries(keywords)) {
    if (terms.some((term) => message.includes(term))) {
      detectedCapabilities.push(capability);
    }
  }

  // Default to copywriting if nothing detected
  if (detectedCapabilities.length === 0) {
    detectedCapabilities.push('copywriting');
  }

  const estimatedAgents = detectedCapabilities.length;
  const basePrice = 10; // $10 per agent
  const complexity = estimatedAgents === 1 ? 'simple' : estimatedAgents <= 2 ? 'moderate' : 'complex';

  return {
    intents: [
      {
        capabilities: detectedCapabilities,
        complexity,
        estimatedAgents,
        suggestedBudget: {
          min: estimatedAgents * basePrice,
          max: estimatedAgents * basePrice * 3,
        },
        description: `Requires ${detectedCapabilities.join(', ')} capabilities`,
        requiresOrchestration: estimatedAgents > 1,
      },
    ],
    totalEstimatedCost: {
      min: estimatedAgents * basePrice,
      max: estimatedAgents * basePrice * 3,
    },
    recommendedApproach: estimatedAgents > 1 ? 'Sequential execution recommended' : 'Single agent execution',
    breakdown: detectedCapabilities.map((cap) => ({
      capability: cap,
      reasoning: `Detected from keywords in request`,
      alternatives: [],
    })),
  };
}

/**
 * Get recommended agents for capabilities
 * Returns agent IDs that match the required capabilities
 */
export function getRecommendedAgents(capabilities: string[]): {
  capability: string;
  agentQuery: {
    capabilities: string[];
    minTrustScore: number;
    sortBy: 'trust' | 'experience';
  };
}[] {
  return capabilities.map((capability) => ({
    capability,
    agentQuery: {
      capabilities: [capability],
      minTrustScore: 70, // Only show agents with 70+ trust score
      sortBy: 'trust' as const,
    },
  }));
}
