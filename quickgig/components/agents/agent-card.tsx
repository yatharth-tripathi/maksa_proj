'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { RecommendedAgent } from '@/lib/ai/agent-recommender';

interface AgentCardProps {
  agent: RecommendedAgent;
  onSelect: (agent: RecommendedAgent) => void;
  selected?: boolean;
}

export function AgentCard({ agent, onSelect, selected = false }: AgentCardProps) {
  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div
      className={`border-2 border-black p-4 transition-all duration-200 ${
        selected ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'
      }`}
    >
      {/* Agent Name & Status */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-sm uppercase tracking-wide">{agent.name}</h3>
          <p className="font-mono text-xs opacity-70 mt-1">{formatAddress(agent.address)}</p>
        </div>
        <Badge
          variant={agent.availability === 'available' ? 'default' : 'warning'}
          className={`text-xs uppercase ${
            agent.availability === 'available' ? 'bg-green-500' : 'bg-yellow-500'
          } text-white border-0`}
        >
          {agent.availability}
        </Badge>
      </div>

      {/* Reputation */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1">
          <span className="text-yellow-500 text-sm">★</span>
          <span className="font-bold text-sm">{agent.reputation.stars.toFixed(1)}</span>
        </div>
        <span className="text-xs opacity-70">
          ({agent.reputation.reviewCount} reviews)
        </span>
        <span className="text-xs font-bold">
          {agent.reputation.score}/100
        </span>
      </div>

      {/* Capabilities */}
      <div className="flex flex-wrap gap-1 mb-3">
        {agent.capabilities.map((cap) => (
          <Badge
            key={cap}
            variant="outline"
            className={`text-xs uppercase border ${
              selected ? 'border-white text-white' : 'border-black'
            }`}
          >
            {cap}
          </Badge>
        ))}
      </div>

      {/* Pricing & Time */}
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-xs">
          {agent.pricing?.perTask && (
            <span className="font-bold">${agent.pricing.perTask}/task</span>
          )}
          {agent.pricing?.perMessage && (
            <span className="font-bold">${agent.pricing.perMessage}/msg</span>
          )}
          {agent.pricing?.hourlyRate && (
            <span className="font-bold">${agent.pricing.hourlyRate}/hr</span>
          )}
        </div>
        {agent.estimatedCompletionTime && (
          <span className="text-xs opacity-70">~{agent.estimatedCompletionTime}</span>
        )}
      </div>

      {/* Success Rate */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-mono opacity-70">Success Rate</span>
          <span className="font-bold">{agent.reputation.successRate}%</span>
        </div>
        <div className="w-full bg-gray-200 h-1.5 border border-black">
          <div
            className={`h-full ${selected ? 'bg-white' : 'bg-black'}`}
            style={{ width: `${agent.reputation.successRate}%` }}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Link
          href={`/agents/${agent.agentId}`}
          className="flex-1"
        >
          <Button
            variant="outline"
            className={`w-full text-xs ${
              selected
                ? 'border-white text-white hover:bg-white/10'
                : 'border-black text-black hover:bg-gray-100'
            }`}
          >
            VIEW PROFILE
          </Button>
        </Link>
        <Button
          onClick={() => onSelect(agent)}
          className={`flex-1 text-xs ${
            selected
              ? 'bg-white text-black hover:bg-gray-200'
              : 'bg-black text-white hover:bg-gray-800'
          }`}
          variant={selected ? 'outline' : 'primary'}
        >
          {selected ? 'SELECTED' : 'SELECT'}
        </Button>
      </div>
    </div>
  );
}
