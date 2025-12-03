'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader, LoadingState } from '@/components/ui/loader';
import { useDiscoverByCapability, useGetAgent, useGetTrustScore, type AgentCard as AgentCardType } from '@/lib/erc8004/discovery';
import { COMMON_CAPABILITIES } from '@/lib/erc8004/types';
import { formatAddress } from '@/lib/utils';

interface AgentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAgent?: (agentId: string) => void;
}

export function AgentsModal({ isOpen, onClose, onSelectAgent }: AgentsModalProps) {
  const [selectedCapability, setSelectedCapability] = useState<string>('logo-design');
  const [filterType, setFilterType] = useState<'all' | 'ai' | 'human' | 'hybrid'>('all');

  const { data: agentIdsData, isLoading } = useDiscoverByCapability(selectedCapability);
  const agentIds = (agentIdsData as string[] | undefined) || [];

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-2 sm:inset-4 md:inset-8 lg:inset-16 xl:inset-24 z-50 overflow-hidden animate-in slide-in-from-bottom duration-300">
        <div className="h-full glass-card shadow-2xl flex flex-col" style={{ borderRadius: 0 }}>
          {/* Header */}
          <div className="border-b border-[rgba(147,51,234,0.15)] p-4 sm:p-5 md:p-6 lg:p-8 flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-foreground mb-0.5 sm:mb-1 mozilla-headline uppercase">
                Agent Network
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wide bricolage-grotesque">
                Find AI and human agents for any mission
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 md:hover:bg-[rgba(147,51,234,0.05)] flex items-center justify-center transition-colors text-muted-foreground md:hover:text-foreground"
              style={{ borderRadius: 0 }}
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8">
            {/* Capability Filters */}
            <div className="glass-card p-3 sm:p-4 md:p-6 mb-4 sm:mb-5 md:mb-6" style={{ borderRadius: 0 }}>
              <h3 className="text-xs sm:text-sm font-bold text-foreground mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2 uppercase tracking-wide bricolage-grotesque">
                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-[#9061FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Search by Capability
              </h3>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {COMMON_CAPABILITIES.slice(0, 12).map((capability) => (
                  <button
                    key={capability}
                    onClick={() => setSelectedCapability(capability)}
                    style={{ borderRadius: 0 }}
                    className={`px-2.5 py-1.5 sm:px-3 sm:py-2 md:px-4 text-[10px] sm:text-xs md:text-sm font-medium transition-all duration-200 uppercase tracking-wide bricolage-grotesque ${
                      selectedCapability === capability
                        ? 'bg-[#9061FF] text-white glow-purple'
                        : 'glass-card text-foreground md:hover:bg-white/90'
                    }`}
                  >
                    {capability.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Type Filters */}
            <div className="flex gap-2 sm:gap-3 mb-4 sm:mb-5 md:mb-6">
              <button
                onClick={() => setFilterType('all')}
                style={{ borderRadius: 0 }}
                className={`px-2.5 py-1.5 sm:px-3 sm:py-2 md:px-4 text-[10px] sm:text-xs md:text-sm font-medium transition-all duration-200 uppercase tracking-wide bricolage-grotesque ${
                  filterType === 'all' ? 'bg-[#9061FF] text-white glow-purple' : 'glass-card text-foreground md:hover:bg-white/90'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('ai')}
                style={{ borderRadius: 0 }}
                className={`px-2.5 py-1.5 sm:px-3 sm:py-2 md:px-4 text-[10px] sm:text-xs md:text-sm font-medium transition-all duration-200 uppercase tracking-wide bricolage-grotesque ${
                  filterType === 'ai' ? 'bg-[#9061FF] text-white glow-purple' : 'glass-card text-foreground md:hover:bg-white/90'
                }`}
              >
                AI Agents
              </button>
              <button
                onClick={() => setFilterType('human')}
                style={{ borderRadius: 0 }}
                className={`px-2.5 py-1.5 sm:px-3 sm:py-2 md:px-4 text-[10px] sm:text-xs md:text-sm font-medium transition-all duration-200 uppercase tracking-wide bricolage-grotesque ${
                  filterType === 'human' ? 'bg-[#9061FF] text-white glow-purple' : 'glass-card text-foreground md:hover:bg-white/90'
                }`}
              >
                Humans
              </button>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="glass-card p-8 sm:p-10 md:p-12 text-center" style={{ borderRadius: 0 }}>
                <LoadingState message="LOADING AGENTS" size="lg" />
              </div>
            )}

            {/* Empty State */}
            {!isLoading && (!agentIds || agentIds.length === 0) && (
              <div className="glass-card p-8 sm:p-10 md:p-12 text-center" style={{ borderRadius: 0 }}>
                <div className="mx-auto mb-4 sm:mb-5 md:mb-6 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-[rgba(147,51,234,0.05)] flex items-center justify-center" style={{ borderRadius: 0 }}>
                  <svg className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-foreground mb-1.5 sm:mb-2 mozilla-headline uppercase">
                  No Agents Available
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wide bricolage-grotesque">
                  No agents with &quot;{selectedCapability}&quot; skill on the network yet
                </p>
              </div>
            )}

            {/* Agent Grid */}
            {!isLoading && agentIds && agentIds.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {agentIds.slice(0, 12).map((agentId) => (
                  <AgentCard
                    key={agentId}
                    agentId={agentId}
                    onSelect={() => {
                      if (onSelectAgent) {
                        onSelectAgent(agentId);
                        onClose();
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="border-t border-[rgba(147,51,234,0.15)] p-3 sm:p-4 md:p-6 flex justify-between items-center">
            <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wide bricolage-grotesque">
              <span className="font-bold text-foreground">{agentIds?.length || 0}</span> agents on network
            </p>
            <Button onClick={onClose} variant="outline" className="text-[10px] sm:text-xs">
              Close
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Agent Card Component
 */
function AgentCard({ agentId, onSelect }: { agentId: string; onSelect?: () => void }) {
  const { data: agentData } = useGetAgent(agentId);
  const agent = agentData as AgentCardType | undefined;
  const { data: trustScoreData } = useGetTrustScore(agentId as `0x${string}`);
  const trustScore = trustScoreData as { overallScore: bigint } | undefined;

  if (!agent) {
    return (
      <div className="glass-card p-4 sm:p-5 md:p-6" style={{ borderRadius: 0 }}>
        <div className="flex justify-center">
          <Loader size="md" />
        </div>
      </div>
    );
  }

  const typeLabels = ['Human', 'AI', 'Hybrid'];
  const statusLabels = ['Active', 'Paused', 'Deactivated'];

  return (
    <div
      className="group glass-card md:hover:bg-white/90 md:hover:glow-purple transition-all duration-200 cursor-pointer overflow-hidden"
      style={{ borderRadius: 0 }}
      onClick={onSelect}
    >
      <div className="p-4 sm:p-5 md:p-6">
        {/* Header Badges */}
        <div className="flex justify-between items-start mb-3 sm:mb-4">
          <Badge variant={agent.agentType === 1 ? 'info' : 'default'} className="text-[10px] sm:text-xs">
            {typeLabels[agent.agentType]}
          </Badge>
          {agent.verified && (
            <Badge variant="success" className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs">
              <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Verified
            </Badge>
          )}
        </div>

        {/* Agent Name */}
        <h3 className="text-base sm:text-lg font-bold text-foreground mb-0.5 sm:mb-1 md:group-hover:text-[#9061FF] transition-colors mozilla-headline uppercase">
          Agent
        </h3>

        {/* Agent ID */}
        <p className="text-[10px] sm:text-xs font-mono text-muted-foreground mb-3 sm:mb-4">
          {formatAddress(agent.owner)}
        </p>

        {/* Capabilities */}
        <div className="mb-3 sm:mb-4">
          <p className="text-[10px] sm:text-xs font-medium text-foreground mb-1.5 sm:mb-2 uppercase tracking-wide bricolage-grotesque">
            Skills
          </p>
          <div className="flex flex-wrap gap-1 sm:gap-1.5">
            {agent.capabilities.slice(0, 3).map((cap, i) => (
              <Badge key={i} variant="default" className="text-[9px] sm:text-[10px]">
                {cap.replace('-', ' ')}
              </Badge>
            ))}
            {agent.capabilities.length > 3 && (
              <Badge variant="info" className="text-[9px] sm:text-[10px]">
                +{agent.capabilities.length - 3} more
              </Badge>
            )}
          </div>
        </div>

        {/* Trust Score */}
        {trustScore && (
          <div className="bg-[rgba(147,51,234,0.05)] border border-[rgba(147,51,234,0.2)] p-2 sm:p-2.5 md:p-3 mb-3 sm:mb-4" style={{ borderRadius: 0 }}>
            <div className="flex justify-between items-center">
              <span className="text-[10px] sm:text-xs font-medium text-foreground uppercase tracking-wide bricolage-grotesque">
                Reputation Score
              </span>
              <div className="flex items-baseline gap-0.5 sm:gap-1">
                <span className="text-lg sm:text-xl font-bold text-foreground mozilla-headline">
                  {(Number(trustScore.overallScore) / 100).toFixed(1)}
                </span>
                <span className="text-[10px] sm:text-xs text-muted-foreground">/100</span>
              </div>
            </div>
          </div>
        )}

        {/* Status */}
        <div className="flex justify-between items-center text-xs sm:text-sm pb-3 sm:pb-4 border-b border-[rgba(147,51,234,0.15)] mb-3 sm:mb-4">
          <span className="text-muted-foreground uppercase tracking-wide bricolage-grotesque">
            Status
          </span>
          <Badge variant={agent.status === 0 ? 'success' : 'default'} className="text-[10px] sm:text-xs">
            {statusLabels[agent.status]}
          </Badge>
        </div>

        {/* Select Button */}
        {onSelect && (
          <Button
            variant="primary"
            size="sm"
            className="w-full text-[10px] sm:text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          >
            Hire Agent →
          </Button>
        )}
      </div>
    </div>
  );
}

