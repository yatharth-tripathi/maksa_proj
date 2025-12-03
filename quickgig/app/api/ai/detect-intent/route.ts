/**
 * Intent Detection API
 * POST /api/ai/detect-intent
 * Analyzes user message to determine required agent capabilities
 */

import { NextRequest, NextResponse } from 'next/server';
import { detectIntent, getRecommendedAgents } from '@/lib/ai/intent-detector';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    console.log('[Intent Detection] Analyzing:', message.slice(0, 100));

    // Detect intents from user message
    const analysis = await detectIntent(message);

    // Get recommended agent queries
    const allCapabilities = analysis.intents.flatMap((i) => i.capabilities);
    const uniqueCapabilities = [...new Set(allCapabilities)];
    const recommendedQueries = getRecommendedAgents(uniqueCapabilities);

    return NextResponse.json({
      success: true,
      analysis,
      recommendedAgents: recommendedQueries,
      summary: {
        totalCapabilities: uniqueCapabilities.length,
        estimatedCost: analysis.totalEstimatedCost,
        complexity: analysis.intents[0]?.complexity || 'simple',
        requiresOrchestration: analysis.intents.some((i) => i.requiresOrchestration),
      },
    });
  } catch (error) {
    console.error('[Intent Detection] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to detect intent',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for testing
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/ai/detect-intent',
    method: 'POST',
    description: 'Analyzes user messages to detect required agent capabilities',
    usage: {
      request: {
        message: 'Design a logo and tagline for my tech startup',
      },
      response: {
        analysis: {
          intents: '[Array of detected intents with capabilities]',
          totalEstimatedCost: '{ min: number, max: number }',
          recommendedApproach: 'Execution strategy',
        },
        recommendedAgents: '[Agent queries for capability matching]',
      },
    },
    examples: [
      {
        input: 'Design a logo',
        output: { capabilities: ['logo-design'], estimatedAgents: 1 },
      },
      {
        input: 'Create logo + website + social media graphics',
        output: {
          capabilities: ['logo-design', 'web-development', 'graphic-design'],
          estimatedAgents: 3,
          requiresOrchestration: true,
        },
      },
    ],
  });
}
