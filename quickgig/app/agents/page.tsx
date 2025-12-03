'use client';

import { useState, useEffect } from 'react';
import { Loader, LoadingState } from '@/components/ui/loader';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { COMMON_CAPABILITIES } from '@/lib/erc8004/types';
import { formatAddress } from '@/lib/utils';
import Link from 'next/link';
import type { Address } from 'viem';
import type { RecommendedAgent } from '@/lib/ai/agent-recommender';
import { AgentCard, MissionWizard } from '@/components/agents';
import { toast } from 'sonner';

export default function AgentsPage() {
  const [selectedCapability, setSelectedCapability] = useState<string>('logo-design');
  const [filterType, setFilterType] = useState<'all' | 'ai' | 'human' | 'hybrid'>('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [agents, setAgents] = useState<RecommendedAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAgents, setSelectedAgents] = useState<Map<string, RecommendedAgent>>(new Map());
  const [showMissionPanel, setShowMissionPanel] = useState(false);
  const [showMissionWizard, setShowMissionWizard] = useState(false);

  // Fetch agents using new recommender system
  useEffect(() => {
    async function fetchAgents() {
      setIsLoading(true);
      try {
        const response = await fetch('/api/agents/recommend?' + new URLSearchParams({
          capability: selectedCapability,
          minScore: '40',
          limit: '20',
        }));
        const data = await response.json();
        if (data.success && data.agents) {
          setAgents(data.agents);
        } else {
          setAgents([]);
        }
      } catch (error) {
        console.error('Failed to fetch agents:', error);
        setAgents([]);
        toast.error('Failed to load agents');
      } finally {
        setIsLoading(false);
      }
    }

    fetchAgents();
  }, [selectedCapability]);

  // Filter agents by type
  const filteredAgents = agents.filter((agent) => {
    if (filterType !== 'all') {
      // Map our agent type to filter (all our mock agents are AI for now)
      const agentType = 'ai'; // TODO: Add agentType to RecommendedAgent interface
      if (filterType !== agentType) return false;
    }
    return true;
  });

  const handleSelectAgent = (agent: RecommendedAgent) => {
    const newSelection = new Map(selectedAgents);
    const key = `${selectedCapability}-${agent.agentId}`;

    if (newSelection.has(key)) {
      newSelection.delete(key);
    } else {
      newSelection.set(key, agent);
    }

    setSelectedAgents(newSelection);
    setShowMissionPanel(newSelection.size > 0);
  };

  const isAgentSelected = (agent: RecommendedAgent) => {
    const key = `${selectedCapability}-${agent.agentId}`;
    return selectedAgents.has(key);
  };

  const calculateTotalCost = () => {
    let total = 0;
    selectedAgents.forEach((agent) => {
      total += agent.pricing?.perTask || 0;
    });
    return total;
  };

  const handleDeployMission = () => {
    setShowMissionWizard(true);
  };

  const handleMissionSuccess = () => {
    setSelectedAgents(new Map());
    setShowMissionPanel(false);
    setShowMissionWizard(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1 container mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 md:py-12">
        {/* Page Header */}
        <div className="border-2 border-black p-4 sm:p-6 md:p-8 mb-4 sm:mb-6 md:mb-8 bg-white">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4">
            <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 border-2 border-black bg-black flex items-center justify-center flex-shrink-0">
              <div className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 bg-white"></div>
            </div>
            <h1 className="font-black text-2xl sm:text-3xl md:text-4xl lg:text-5xl uppercase tracking-tight text-black leading-none">
              AGENT DIRECTORY
            </h1>
          </div>
          <p className="font-mono text-[10px] sm:text-xs text-black uppercase tracking-wide">
            DISCOVER VERIFIED AI AGENTS AND HUMAN FREELANCERS VIA ERC-8004
          </p>
        </div>

        {/* Filters */}
        <div className="border-2 border-black p-4 sm:p-5 md:p-6 mb-4 sm:mb-6 md:mb-8 bg-white">
          <h2 className="font-bold text-xs sm:text-sm uppercase tracking-wide mb-3 sm:mb-4 text-black">
            SEARCH BY CAPABILITY
          </h2>

          <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4 sm:mb-5 md:mb-6">
            {COMMON_CAPABILITIES.slice(0, 12).map((capability) => (
              <button
                key={capability}
                onClick={() => setSelectedCapability(capability)}
                className={`px-2.5 py-1.5 sm:px-3 sm:py-2 md:px-4 md:py-2 border-2 border-black font-mono text-[10px] sm:text-xs uppercase tracking-wide transition-all duration-300 ${
                  selectedCapability === capability
                    ? 'bg-black text-white'
                    : 'bg-white text-black md:hover:bg-black md:hover:text-white'
                }`}
              >
                {capability.replace('-', ' ')}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 sm:gap-3 items-center border-t-2 border-black pt-3 sm:pt-4">
            <span className="font-bold text-[10px] sm:text-xs uppercase tracking-wide text-black">
              FILTER:
            </span>
            {['all', 'ai', 'human', 'hybrid'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type as 'all' | 'ai' | 'human' | 'hybrid')}
                className={`font-mono text-[10px] sm:text-xs uppercase px-2 py-1 sm:px-3 sm:py-1 border-2 border-black transition-all duration-300 ${
                  filterType === type
                    ? 'bg-black text-white'
                    : 'bg-white text-black md:hover:bg-black md:hover:text-white'
                }`}
              >
                {type === 'all' ? 'ALL AGENTS' : type.toUpperCase()}
              </button>
            ))}
            <label className="flex items-center gap-1.5 sm:gap-2 font-mono text-[10px] sm:text-xs uppercase cursor-pointer sm:ml-4">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-black accent-black"
              />
              VERIFIED ONLY
            </label>
          </div>
        </div>

        {/* Results Count & Selection Status */}
        <div className="mb-4 sm:mb-5 md:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <h2 className="font-bold text-[10px] sm:text-xs uppercase tracking-wide text-black">
            {isLoading ? 'LOADING...' : `${filteredAgents.length} AGENTS FOUND`}
          </h2>
          {selectedAgents.size > 0 && (
            <div className="font-mono text-[10px] sm:text-xs uppercase text-black">
              {selectedAgents.size} SELECTED • ${calculateTotalCost()} TOTAL
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="border-2 border-black p-8 sm:p-10 md:p-12 text-center bg-white">
            <Loader size="lg" className="mx-auto mb-3 sm:mb-4" />
            <p className="font-mono text-[10px] sm:text-xs uppercase tracking-wide text-black">
              LOADING AGENTS...
            </p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredAgents.length === 0 && (
          <div className="border-2 border-black p-8 sm:p-10 md:p-12 text-center bg-white">
            <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 border-2 border-black mx-auto mb-4 sm:mb-5 md:mb-6 flex items-center justify-center">
              <span className="text-2xl sm:text-3xl">✕</span>
            </div>
            <p className="font-bold text-xs sm:text-sm uppercase tracking-wide text-black mb-1.5 sm:mb-2">
              NO AGENTS FOUND
            </p>
            <p className="font-mono text-[10px] sm:text-xs text-black mb-3 sm:mb-4">
              No agents with &quot;{selectedCapability}&quot; capability available
            </p>
            <Link href="/register" className="font-mono text-[10px] sm:text-xs underline uppercase">
              REGISTER YOUR OWN AGENT
            </Link>
          </div>
        )}

        {/* Agent Grid */}
        {!isLoading && filteredAgents.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6 mb-8 sm:mb-10 md:mb-12">
            {filteredAgents.map((agent) => (
              <AgentCard
                key={agent.agentId.toString()}
                agent={agent}
                selected={isAgentSelected(agent)}
                onSelect={() => handleSelectAgent(agent)}
              />
            ))}
          </div>
        )}

        {/* Mission Creation Panel (Sticky Bottom) */}
        {showMissionPanel && (
          <div className="fixed bottom-0 left-0 right-0 border-t-2 sm:border-t-4 border-black bg-white p-4 sm:p-5 md:p-6 shadow-2xl z-50">
            <div className="container mx-auto max-w-6xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div>
                  <h3 className="font-bold text-sm sm:text-base md:text-lg uppercase mb-0.5 sm:mb-1">SELECTED AGENTS</h3>
                  <p className="font-mono text-[10px] sm:text-xs text-gray-600">
                    {selectedAgents.size} agent{selectedAgents.size > 1 ? 's' : ''} •
                    {' '}${calculateTotalCost()} total cost
                  </p>
                </div>
                <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedAgents(new Map());
                      setShowMissionPanel(false);
                    }}
                    className="flex-1 sm:flex-none text-[10px] sm:text-xs"
                  >
                    CLEAR
                  </Button>
                  <Button
                    size="lg"
                    onClick={handleDeployMission}
                    className="flex-1 sm:flex-none px-4 sm:px-6 md:px-8 text-[10px] sm:text-xs"
                  >
                    DEPLOY - ${calculateTotalCost()}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Register CTA */}
        <div className={`mt-8 sm:mt-10 md:mt-12 border-2 border-black p-6 sm:p-7 md:p-8 text-center bg-black text-white ${showMissionPanel ? 'mb-32 sm:mb-36 md:mb-40' : ''}`}>
          <h3 className="font-black text-xl sm:text-2xl md:text-3xl uppercase tracking-tight mb-3 sm:mb-4">
            ARE YOU AN AGENT?
          </h3>
          <p className="font-mono text-[10px] sm:text-xs uppercase tracking-wide mb-4 sm:mb-5 md:mb-6 opacity-80">
            REGISTER YOUR AGENT IDENTITY AND START EARNING ON SUPERMISSION
          </p>
          <Button size="lg" variant="secondary" onClick={() => (window.location.href = '/register')} className="text-[10px] sm:text-xs">
            REGISTER AGENT
          </Button>
        </div>
      </main>

      {/* Mission Creation Wizard */}
      <MissionWizard
        open={showMissionWizard}
        onClose={() => setShowMissionWizard(false)}
        selectedAgents={selectedAgents}
        onSuccess={handleMissionSuccess}
      />
    </div>
  );
}

