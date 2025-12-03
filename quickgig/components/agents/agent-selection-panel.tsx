'use client';

import { useState } from 'react';
import { AgentCard } from './agent-card';
import { Button } from '@/components/ui/button';
import type { RecommendedAgent } from '@/lib/ai/agent-recommender';

interface AgentSelectionPanelProps {
  capability: string;
  agents: RecommendedAgent[];
  onConfirmSelection: (selectedAgents: Map<string, RecommendedAgent>) => void;
  multiCapabilities?: Map<string, RecommendedAgent[]>; // For multi-agent missions
}

export function AgentSelectionPanel({
  capability,
  agents,
  onConfirmSelection,
  multiCapabilities,
}: AgentSelectionPanelProps) {
  const [selectedAgents, setSelectedAgents] = useState<Map<string, RecommendedAgent>>(
    new Map()
  );

  const handleSelectAgent = (cap: string, agent: RecommendedAgent) => {
    const newSelection = new Map(selectedAgents);
    newSelection.set(cap, agent);
    setSelectedAgents(newSelection);
  };

  const calculateTotalCost = () => {
    let total = 0;
    selectedAgents.forEach((agent) => {
      total += agent.pricing?.perTask || 0;
    });
    return total;
  };

  const isAllSelected = () => {
    if (multiCapabilities) {
      return selectedAgents.size === multiCapabilities.size;
    }
    return selectedAgents.size > 0;
  };

  if (multiCapabilities) {
    // Multi-capability mode
    return (
      <div className="border-2 border-black bg-white p-6">
        <h2 className="font-bold text-xl uppercase mb-4">SELECT AGENTS FOR YOUR MISSION</h2>

        {Array.from(multiCapabilities.entries()).map(([cap, agentList]) => (
          <div key={cap} className="mb-6">
            <h3 className="font-bold text-sm uppercase mb-3 border-b-2 border-black pb-2">
              {cap}
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agentList.map((agent) => (
                <AgentCard
                  key={agent.agentId.toString()}
                  agent={agent}
                  selected={selectedAgents.get(cap)?.agentId === agent.agentId}
                  onSelect={() => handleSelectAgent(cap, agent)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Summary & Confirm */}
        <div className="border-t-2 border-black pt-4 mt-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-mono text-xs uppercase mb-1">Total Selected</p>
              <p className="font-bold text-2xl">
                {selectedAgents.size} / {multiCapabilities.size} Agents
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-xs uppercase mb-1">Estimated Cost</p>
              <p className="font-bold text-2xl">${calculateTotalCost()}</p>
            </div>
          </div>

          <Button
            onClick={() => onConfirmSelection(selectedAgents)}
            disabled={!isAllSelected()}
            className="w-full h-12"
            size="lg"
          >
            {isAllSelected()
              ? `CONFIRM SELECTION - $${calculateTotalCost()}`
              : `SELECT AGENTS (${selectedAgents.size}/${multiCapabilities.size})`}
          </Button>
        </div>
      </div>
    );
  }

  // Single capability mode
  return (
    <div className="border-2 border-black bg-white p-6">
      <h2 className="font-bold text-xl uppercase mb-4">
        SELECT AGENT FOR {capability}
      </h2>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {agents.map((agent) => (
          <AgentCard
            key={agent.agentId.toString()}
            agent={agent}
            selected={selectedAgents.get(capability)?.agentId === agent.agentId}
            onSelect={() => handleSelectAgent(capability, agent)}
          />
        ))}
      </div>

      {selectedAgents.size > 0 && (
        <div className="border-t-2 border-black pt-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-mono text-xs uppercase">Selected Agent</p>
              <p className="font-bold">{selectedAgents.get(capability)?.name}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-xs uppercase">Cost</p>
              <p className="font-bold text-xl">${calculateTotalCost()}</p>
            </div>
          </div>

          <Button
            onClick={() => onConfirmSelection(selectedAgents)}
            className="w-full h-12"
            size="lg"
          >
            CONFIRM & DEPLOY MISSION
          </Button>
        </div>
      )}
    </div>
  );
}
