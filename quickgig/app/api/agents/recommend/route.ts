/**
 * Agent Recommendation API
 * POST /api/agents/recommend
 * Returns recommended agents for given capabilities
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  recommendAgents,
  recommendMultipleAgents,
  calculateTotalCost,
  type RecommendedAgent,
} from '@/lib/ai/agent-recommender';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { getAgentById } from '@/lib/erc8004/unified-discovery';

// Helper function to add timeout to promises
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), ms)
    ),
  ]);
}

// Mapping of database agent IDs to ERC-8004 NFT IDs
const AGENT_NFT_MAPPING: Record<string, string> = {
  'agent_1760886157698_lzy2czh83': '2', // LogoMaster AI
  'agent_1760886159008_0qns6xy6u': '3', // CopyWriter AI
  'agent_1760886159300_zitacvck8': '4', // SocialMedia AI
};

export async function POST(request: NextRequest) {
  try {
    const {
      capabilities,
      minScore = 70,
      limit = 5,
      sortBy = 'reputation',
    } = await request.json();

    if (!capabilities || !Array.isArray(capabilities) || capabilities.length === 0) {
      return NextResponse.json(
        { error: 'capabilities array is required' },
        { status: 400 }
      );
    }

    console.log('[Agent Recommend] Finding agents for:', capabilities);

    // Get recommendations for all capabilities
    const recommendations = await recommendMultipleAgents(capabilities, {
      minScore,
      limit,
    });

    // Convert Map to object for JSON response
    const recommendationsObj: Record<string, { capability: string; agents: RecommendedAgent[]; totalFound: number; filterCriteria: { minScore: number; sortBy: string } }> = {};
    const allAgents: RecommendedAgent[] = [];

    for (const [capability, recommendation] of recommendations.entries()) {
      recommendationsObj[capability] = recommendation;
      allAgents.push(...recommendation.agents);
    }

    // Calculate total cost
    const costEstimate = calculateTotalCost(allAgents);

    return NextResponse.json({
      success: true,
      capabilities,
      recommendations: recommendationsObj,
      summary: {
        totalCapabilities: capabilities.length,
        totalAgentsFound: allAgents.length,
        estimatedCost: costEstimate,
        filterCriteria: {
          minScore,
          sortBy,
          limit,
        },
      },
    });
  } catch (error) {
    console.error('[Agent Recommend] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get agent recommendations',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET single capability recommendations
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const capability = searchParams.get('capability');

    if (!capability) {
      return NextResponse.json({
        endpoint: '/api/agents/recommend',
        methods: {
          POST: 'Get recommendations for multiple capabilities',
          GET: 'Get recommendations for single capability (add ?capability=xxx)',
        },
        usage: {
          POST: {
            body: {
              capabilities: ['logo-design', 'copywriting'],
              minScore: 70,
              limit: 5,
              sortBy: 'reputation | price | speed',
            },
          },
          GET: '?capability=logo-design&minScore=80&limit=3',
        },
      });
    }

    const minScore = parseInt(searchParams.get('minScore') || '70');
    const limit = parseInt(searchParams.get('limit') || '5');
    const sortBy = (searchParams.get('sortBy') || 'reputation') as 'reputation' | 'price' | 'speed';

    const recommendation = await recommendAgents(capability, {
      minScore,
      limit,
      sortBy,
    });

    // Enhance with on-chain ERC-8004 data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let publicClient: any;
    let useOnChainData = true;

    try {
      const rpcUrl = process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;
      if (!rpcUrl) {
        console.warn('[Recommend] No RPC URL configured, using database data only');
        useOnChainData = false;
      } else {
        publicClient = createPublicClient({
          chain: baseSepolia,
          transport: http(rpcUrl),
        });
      }
    } catch (error) {
      console.error('[Recommend] Failed to create blockchain client:', error);
      useOnChainData = false;
    }

    const enhancedAgents = await Promise.all(
      recommendation.agents.map(async (agent) => {
        const nftId = AGENT_NFT_MAPPING[agent.agentId];

        // Helper to return DB data
        const returnDbData = () => ({
          ...agent,
          agentId: agent.agentId.toString(),
        });

        // If no NFT mapping or blockchain unavailable, return DB data only
        if (!nftId || !useOnChainData || !publicClient) {
          return returnDbData();
        }

        try {
          // Fetch on-chain data with 10-second timeout
          const onChainAgent = await withTimeout(
            getAgentById(publicClient, nftId),
            10000 // 10 second timeout
          );

          if (onChainAgent) {
            // Merge on-chain reputation with DB data
            // Calculate success rate from stars rating (stars/5 * 100)
            const successRate = Math.round((onChainAgent.reputation.rating / 5) * 100);

            return {
              ...agent,
              agentId: agent.agentId.toString(),
              name: onChainAgent.name || agent.name,
              reputation: {
                score: onChainAgent.reputation.averageScore,
                stars: onChainAgent.reputation.rating,
                reviewCount: onChainAgent.reputation.count,
                successRate: successRate, // Calculate from stars rating
              },
            };
          }
        } catch (error) {
          // Gracefully fallback to DB data on any error
          console.warn(`[Recommend] Blockchain unavailable for agent ${agent.agentId}, using DB data:`, error instanceof Error ? error.message : 'Unknown error');
        }

        // Fallback to DB data
        return returnDbData();
      })
    );

    // Convert BigInt agent IDs to strings for JSON serialization
    const serializedRecommendation = {
      ...recommendation,
      agents: enhancedAgents,
    };

    return NextResponse.json({
      success: true,
      ...serializedRecommendation,
    });
  } catch (error) {
    console.error('[Agent Recommend] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get recommendations',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
