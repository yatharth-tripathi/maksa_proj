/**
 * Agent Recommendation Engine
 * Queries Supabase agent_profiles table to find agents matching capabilities
 */

import type { Address } from 'viem';
import type { AgentDiscoveryQuery, AgentProfile } from '@/lib/erc8004/types';
import { getAgentsByCapability } from '@/lib/supabase/agents';

export interface RecommendedAgent {
  agentId: string;
  name: string;
  address: Address;
  capabilities: string[];
  reputation: {
    score: number; // 0-100
    stars: number; // 0-5
    reviewCount: number;
    successRate: number;
  };
  pricing?: {
    perMessage?: number;
    perTask?: number;
    hourlyRate?: number;
  };
  availability: 'available' | 'busy' | 'offline';
  estimatedCompletionTime?: string; // e.g., "2 hours", "1 day"
}

export interface AgentRecommendation {
  capability: string;
  agents: RecommendedAgent[];
  totalFound: number;
  filterCriteria: {
    minScore: number;
    sortBy: string;
  };
}

/**
 * Get agent recommendations for a capability
 */
export async function recommendAgents(
  capability: string,
  options: {
    minScore?: number;
    limit?: number;
    sortBy?: 'reputation' | 'price' | 'speed';
  } = {}
): Promise<AgentRecommendation> {
  const minScore = options.minScore !== undefined ? options.minScore : 70;
  const limit = options.limit !== undefined ? options.limit : 10;
  const sortBy = options.sortBy || 'reputation';

  try {
    // Query Supabase for agents with this capability
    console.log(`[Agent Recommender] Querying capability: "${capability}", minReputation: ${minScore}, limit: ${limit}`);
    const dbAgents = await getAgentsByCapability(capability, {
      minReputation: minScore,
      limit,
    });
    console.log(`[Agent Recommender] Found ${dbAgents.length} agents for capability "${capability}"`);
    if (dbAgents.length > 0) {
      console.log(`[Agent Recommender] Sample agent:`, JSON.stringify(dbAgents[0], null, 2));
    }

    // Transform database agents to RecommendedAgent format
    const agents: RecommendedAgent[] = dbAgents.map((agent) => {
      const stars = calculateStars(agent.reputation_score || 50);
      // Calculate success rate from stars rating (stars/5 * 100)
      const successRate = Math.round((stars / 5) * 100);

      return {
        agentId: agent.id,
        name: agent.name,
        address: agent.address as Address,
        capabilities: agent.capabilities,
        reputation: {
          score: agent.reputation_score || 50,
          stars,
          reviewCount: agent.total_missions || 0,
          successRate,
        },
        pricing: {
          perTask: agent.pricing_per_task,
        },
        availability: 'available', // TODO: Add real-time availability tracking
        estimatedCompletionTime: estimateCompletionTime(capability),
      };
    });

    // Sort agents
    const sorted = sortAgents(agents, sortBy);

    return {
      capability,
      agents: sorted,
      totalFound: sorted.length,
      filterCriteria: {
        minScore,
        sortBy,
      },
    };
  } catch (error) {
    console.error('[Agent Recommender] Error:', error);
    return {
      capability,
      agents: [],
      totalFound: 0,
      filterCriteria: { minScore, sortBy },
    };
  }
}

/**
 * Get multiple recommendations for different capabilities
 */
export async function recommendMultipleAgents(
  capabilities: string[],
  options?: {
    minScore?: number;
    limit?: number;
  }
): Promise<Map<string, AgentRecommendation>> {
  const recommendations = new Map<string, AgentRecommendation>();

  await Promise.all(
    capabilities.map(async (capability) => {
      const recommendation = await recommendAgents(capability, options);
      recommendations.set(capability, recommendation);
    })
  );

  return recommendations;
}

/**
 * Helper: Convert reputation score (0-100) to star rating (0-5)
 */
function calculateStars(score: number): number {
  return Math.round((score / 100) * 5 * 10) / 10; // Round to 1 decimal
}

/**
 * Helper: Estimate completion time based on capability
 */
function estimateCompletionTime(capability: string): string {
  const estimates: Record<string, string> = {
    'logo-design': '1-2 hours',
    'copywriting': '30 minutes - 1 hour',
    'web-development': '1-3 days',
    'video-editing': '4-8 hours',
    'graphic-design': '2-4 hours',
    'voice-over': '2-3 hours',
    'branding': '2-5 hours',
    'smart-contracts': '1-2 days',
  };

  return estimates[capability] || '1-2 hours';
}

/**
 * Helper: Sort agents by criteria
 */
function sortAgents(
  agents: RecommendedAgent[],
  sortBy: 'reputation' | 'price' | 'speed'
): RecommendedAgent[] {
  return [...agents].sort((a, b) => {
    if (sortBy === 'reputation') {
      return b.reputation.score - a.reputation.score;
    } else if (sortBy === 'price') {
      const aPrice = a.pricing?.perTask || 999999;
      const bPrice = b.pricing?.perTask || 999999;
      return aPrice - bPrice;
    }
    return 0;
  });
}

/**
 * Calculate total estimated cost for multiple agents
 */
export function calculateTotalCost(agents: RecommendedAgent[]): {
  min: number;
  max: number;
  breakdown: Array<{ agent: string; cost: number }>;
} {
  const breakdown = agents.map((agent) => ({
    agent: agent.name,
    cost: agent.pricing?.perTask || 0,
  }));

  const total = breakdown.reduce((sum, item) => sum + item.cost, 0);

  return {
    min: total * 0.8, // 20% discount for multiple agents
    max: total * 1.2, // Up to 20% premium for complex work
    breakdown,
  };
}
