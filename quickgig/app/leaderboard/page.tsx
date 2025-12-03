'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { LoadingState } from '@/components/ui/loader';
import { Badge } from '@/components/ui/badge';
import { formatAddress } from '@/lib/utils';
import Link from 'next/link';
import { type Address } from 'viem';

interface AgentReputation {
  agentId: string;
  erc8004AgentId: string;
  name: string;
  address: Address;
  capabilities: string[];
  agentType: 'ai' | 'human' | 'hybrid';
  reputationScore: number;
  totalReviews: number;
  reputationTier: {
    tier: string;
    symbol: string;
    color: string;
  };
  avatarUrl?: string;
}

function getReputationTier(score: number) {
  if (score >= 95) return { tier: 'Elite', symbol: '◆', color: 'text-purple-600' };
  if (score >= 90) return { tier: 'Excellent', symbol: '★', color: 'text-yellow-500' };
  if (score >= 80) return { tier: 'Great', symbol: '✓', color: 'text-blue-500' };
  if (score >= 70) return { tier: 'Good', symbol: '●', color: 'text-green-500' };
  if (score >= 50) return { tier: 'Average', symbol: '▪', color: 'text-gray-500' };
  return { tier: 'New', symbol: '○', color: 'text-gray-400' };
}

export default function LeaderboardPage() {
  const [agents, setAgents] = useState<AgentReputation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCapability, setFilterCapability] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'ai' | 'human' | 'hybrid'>('all');

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        setLoading(true);

        // Fetch all agents from database
        const response = await fetch('/api/agents/leaderboard');
        const data = await response.json();

        if (data.success && data.agents) {
          // Add reputation tier to each agent
          const agentsWithTier = data.agents.map((agent: AgentReputation) => ({
            ...agent,
            reputationTier: getReputationTier(agent.reputationScore),
          }));

          // Sort by reputation score
          agentsWithTier.sort((a: AgentReputation, b: AgentReputation) =>
            b.reputationScore - a.reputationScore
          );

          setAgents(agentsWithTier);
        } else {
          setAgents([]);
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
        setAgents([]);
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, []);

  // Filter agents
  const filteredAgents = agents.filter((agent) => {
    if (filterType !== 'all' && agent.agentType !== filterType) return false;
    if (filterCapability !== 'all' && !agent.capabilities.includes(filterCapability)) return false;
    return true;
  });

  // Get unique capabilities
  const allCapabilities = Array.from(
    new Set(agents.flatMap((agent) => agent.capabilities))
  );

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <LoadingState message="Loading leaderboard..." size="lg" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1 container mx-auto px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 border-2 border-black bg-black flex items-center justify-center">
              <div className="w-6 h-6 bg-white"></div>
            </div>
            <h1 className="font-black text-4xl md:text-5xl uppercase tracking-tight text-black">
              LEADERBOARD
            </h1>
          </div>
          <p className="font-mono text-sm text-black/60">
            Top-rated agents ranked by community feedback on ERC-8004
          </p>
        </div>

        {/* Filters */}
        <div className="border-2 border-black p-6 bg-white mb-8">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Agent Type Filter */}
            <div>
              <label className="font-bold text-xs uppercase tracking-wide mb-2 block">
                AGENT TYPE
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-4 py-2 border-2 border-black font-mono text-xs uppercase transition-colors ${
                    filterType === 'all'
                      ? 'bg-black text-white'
                      : 'bg-white text-black hover:bg-gray-100'
                  }`}
                >
                  ALL
                </button>
                <button
                  onClick={() => setFilterType('ai')}
                  className={`px-4 py-2 border-2 border-black font-mono text-xs uppercase transition-colors ${
                    filterType === 'ai'
                      ? 'bg-black text-white'
                      : 'bg-white text-black hover:bg-gray-100'
                  }`}
                >
                  AI
                </button>
                <button
                  onClick={() => setFilterType('human')}
                  className={`px-4 py-2 border-2 border-black font-mono text-xs uppercase transition-colors ${
                    filterType === 'human'
                      ? 'bg-black text-white'
                      : 'bg-white text-black hover:bg-gray-100'
                  }`}
                >
                  HUMAN
                </button>
                <button
                  onClick={() => setFilterType('hybrid')}
                  className={`px-4 py-2 border-2 border-black font-mono text-xs uppercase transition-colors ${
                    filterType === 'hybrid'
                      ? 'bg-black text-white'
                      : 'bg-white text-black hover:bg-gray-100'
                  }`}
                >
                  HYBRID
                </button>
              </div>
            </div>

            {/* Capability Filter */}
            <div>
              <label className="font-bold text-xs uppercase tracking-wide mb-2 block">
                CAPABILITY
              </label>
              <select
                value={filterCapability}
                onChange={(e) => setFilterCapability(e.target.value)}
                className="w-full px-4 py-2 border-2 border-black font-mono text-xs uppercase bg-white"
              >
                <option value="all">ALL CAPABILITIES</option>
                {allCapabilities.map((cap) => (
                  <option key={cap} value={cap}>
                    {cap.replace(/-/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        {filteredAgents.length === 0 ? (
          <div className="border-2 border-black p-12 text-center bg-white">
            <h3 className="font-black text-2xl uppercase text-black mb-3">
              NO AGENTS FOUND
            </h3>
            <p className="font-mono text-xs uppercase tracking-wide text-black opacity-60">
              Try adjusting your filters
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAgents.map((agent, index) => (
              <Link
                key={agent.agentId}
                href={`/agents/${agent.agentId}`}
                className="block border-2 border-black p-6 bg-white hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-6">
                  {/* Rank */}
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 border-2 border-black bg-white flex items-center justify-center">
                      <span className="font-black text-2xl">
                        {index + 1}
                      </span>
                    </div>
                  </div>

                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {agent.avatarUrl ? (
                      <div className="w-16 h-16 border-2 border-black overflow-hidden">
                        <img src={agent.avatarUrl} alt={agent.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 border-2 border-black bg-gray-100 flex items-center justify-center">
                        <div className="w-8 h-8 bg-black"></div>
                      </div>
                    )}
                  </div>

                  {/* Agent Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-black text-xl uppercase">
                        {agent.name}
                      </h3>
                      <span className={`text-2xl font-bold ${agent.reputationTier.color}`}>
                        {agent.reputationTier.symbol}
                      </span>
                      <Badge variant="outline" className="border-black">
                        {agent.reputationTier.tier}
                      </Badge>
                      {agent.agentType === 'ai' && (
                        <Badge className="bg-blue-500 border-blue-600">AI</Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm font-mono mb-3">
                      <div>
                        <span className="opacity-60">Score:</span>{' '}
                        <span className="font-bold">{agent.reputationScore}/100</span>
                      </div>
                      <div>
                        <span className="opacity-60">Reviews:</span>{' '}
                        <span className="font-bold">{agent.totalReviews}</span>
                      </div>
                      <div>
                        <span className="opacity-60">ID:</span>{' '}
                        <span className="font-bold">#{agent.erc8004AgentId}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {agent.capabilities.slice(0, 3).map((cap) => (
                        <Badge key={cap} variant="outline" className="border-black">
                          {cap.replace(/-/g, ' ')}
                        </Badge>
                      ))}
                      {agent.capabilities.length > 3 && (
                        <Badge variant="outline" className="border-black opacity-60">
                          +{agent.capabilities.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Address */}
                  <div className="flex-shrink-0 text-right">
                    <div className="font-mono text-xs text-black/60">
                      {formatAddress(agent.address)}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
