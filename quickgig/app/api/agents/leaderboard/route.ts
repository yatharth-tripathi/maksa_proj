/**
 * Agent Leaderboard API
 * GET /api/agents/leaderboard
 * Returns all agents sorted by reputation score (fetches real on-chain ERC-8004 data)
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
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

export async function GET() {
  try {
    // Fetch all agents from database
    const { data: agents, error } = await supabaseAdmin
      .from('agent_profiles')
      .select('*')
      .order('reputation_score', { ascending: false });

    if (error) {
      console.error('[Leaderboard] Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch agents' },
        { status: 500 }
      );
    }

    // Transform to include ERC-8004 agent ID
    // For existing agents, we have a mapping:
    // LogoMaster AI → ID 2
    // CopyWriter AI → ID 3
    // SocialMedia AI → ID 4
    const agentIdMapping: Record<string, string> = {
      'agent_1760886157698_lzy2czh83': '2', // LogoMaster
      'agent_1760886159008_0qns6xy6u': '3', // CopyWriter
      'agent_1760886159300_zitacvck8': '4', // SocialMedia
    };

    // Create blockchain client to fetch on-chain reputation data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let publicClient: any;
    let useOnChainData = true;

    try {
      const rpcUrl = process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;
      if (!rpcUrl) {
        console.warn('[Leaderboard] No RPC URL configured, using database data only');
        useOnChainData = false;
      } else {
        publicClient = createPublicClient({
          chain: baseSepolia,
          transport: http(rpcUrl),
        });
      }
    } catch (error) {
      console.error('[Leaderboard] Failed to create blockchain client:', error);
      useOnChainData = false;
    }

    // Fetch on-chain data for each agent
    const agentsWithReputation = await Promise.all(
      agents.map(async (agent) => {
        const nftId = agentIdMapping[agent.id];

        // Helper to return DB data
        const returnDbData = () => ({
          agentId: agent.id,
          erc8004AgentId: nftId || '0',
          name: agent.name,
          address: agent.address,
          capabilities: agent.capabilities || [],
          agentType: agent.agent_type || 'ai',
          reputationScore: agent.reputation_score || 50,
          totalReviews: agent.total_missions || 0,
          avatarUrl: agent.avatar_url,
        });

        // If no NFT mapping or blockchain unavailable, use DB data only
        if (!nftId || !useOnChainData || !publicClient) {
          return returnDbData();
        }

        try {
          // Fetch real on-chain ERC-8004 data with 10-second timeout
          const onChainAgent = await withTimeout(
            getAgentById(publicClient, nftId),
            10000 // 10 second timeout
          );

          if (onChainAgent) {
            // Use on-chain reputation data
            return {
              agentId: agent.id,
              erc8004AgentId: nftId,
              name: onChainAgent.name || agent.name,
              address: agent.address,
              capabilities: agent.capabilities || [],
              agentType: agent.agent_type || 'ai',
              reputationScore: onChainAgent.reputation.averageScore, // Real on-chain score
              totalReviews: onChainAgent.reputation.count, // Real on-chain review count
              avatarUrl: agent.avatar_url,
            };
          }
        } catch (error) {
          // Gracefully fallback to DB data on any error
          console.warn(`[Leaderboard] Blockchain unavailable for agent ${agent.id}, using DB data:`, error instanceof Error ? error.message : 'Unknown error');
        }

        // Fallback to DB data if on-chain fetch fails
        return returnDbData();
      })
    );

    // Sort by on-chain reputation score
    agentsWithReputation.sort((a, b) => b.reputationScore - a.reputationScore);

    return NextResponse.json({
      success: true,
      agents: agentsWithReputation,
      count: agentsWithReputation.length,
    });
  } catch (error) {
    console.error('[Leaderboard] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
