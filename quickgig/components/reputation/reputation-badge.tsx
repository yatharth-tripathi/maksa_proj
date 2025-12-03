/**
 * QUICKGIG Reputation Badge
 * Displays cross-platform reputation from official ERC-8004 singletons
 */

'use client';

import { useState, useEffect } from 'react';
import { Loader, LoadingState } from '@/components/ui/loader';
import { Badge } from '@/components/ui/badge';
import type { Address } from 'viem';
import { useAgentExists, useAgentReputation, useScoreToStars } from '@/lib/erc8004/official-hooks';

export interface ReputationBadgeProps {
  agentId?: bigint;
  workerAddress?: Address;
  className?: string;
}

/**
 * Simple inline reputation badge
 * Shows score and review count
 */
export function ReputationBadge({ agentId, className = '' }: ReputationBadgeProps) {
  const [mounted, setMounted] = useState(false);
  const { exists } = useAgentExists(agentId);
  const { reputation, isLoading } = useAgentReputation(agentId);
  const stars = useScoreToStars(reputation?.averageScore);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isLoading) {
    return (
      <div className={`flex items-center ${className}`}>
        <Loader size="sm" />
      </div>
    );
  }

  if (!exists || !reputation) {
    return null;
  }

  return (
    <Badge
      variant="default"
      className={`bg-gradient-to-r from-purple-600 to-blue-600 text-white ${className}`}
    >
      {reputation.averageScore}/100
      {stars && ` (${stars.toFixed(1)}★)`}
      {reputation.count > 0n && ` • ${reputation.count.toString()} reviews`}
    </Badge>
  );
}

/**
 * Detailed reputation display
 * Shows full stats
 */
export function ReputationDetails({ agentId }: { agentId?: bigint }) {
  const [mounted, setMounted] = useState(false);
  const { exists } = useAgentExists(agentId);
  const { reputation, isLoading } = useAgentReputation(agentId);
  const stars = useScoreToStars(reputation?.averageScore);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !exists || !reputation) return null;

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading reputation...</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="text-2xl font-bold text-purple-600">{reputation.averageScore}/100</div>
        {stars && (
          <div className="text-yellow-500 text-lg">
            {'★'.repeat(Math.floor(stars))}
            {'☆'.repeat(5 - Math.floor(stars))}
          </div>
        )}
      </div>
      <div className="text-sm text-gray-600">
        <span className="font-semibold">{reputation.count.toString()}</span> reviews •{' '}
        <span className="font-semibold">{reputation.clients.length}</span> clients
      </div>
    </div>
  );
}
