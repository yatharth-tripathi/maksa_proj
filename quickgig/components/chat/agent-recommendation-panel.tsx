'use client';

import { useState } from 'react';
import { AgentCard } from '@/components/agents/agent-card';
import { Button } from '@/components/ui/button';
import type { RecommendedAgent } from '@/lib/ai/agent-recommender';
import { useChatStore } from '@/lib/store/chat';
import { toast } from 'sonner';

interface AgentRecommendationPanelProps {
  data: {
    analysis: {
      intents: Array<{
        capabilities: string[];
        complexity: string;
        estimatedAgents: number;
        suggestedBudget: { min: number; max: number };
      }>;
      totalEstimatedCost: { min: number; max: number };
    };
    recommendations: Record<string, { agents: RecommendedAgent[] }>;
    capabilities: string[];
  };
}

export function AgentRecommendationPanel({ data }: AgentRecommendationPanelProps) {
  const [selectedAgents, setSelectedAgents] = useState<Map<string, RecommendedAgent>>(new Map());
  const [isDeploying, setIsDeploying] = useState(false);
  const addMessage = useChatStore((state) => state.addMessage);
  const getMessages = useChatStore((state) => state.getMessages);

  const handleSelectAgent = (capability: string, agent: RecommendedAgent) => {
    const newSelection = new Map(selectedAgents);
    if (newSelection.get(capability)?.agentId === agent.agentId) {
      newSelection.delete(capability);
    } else {
      newSelection.set(capability, agent);
    }
    setSelectedAgents(newSelection);
  };

  const calculateTotalCost = () => {
    let total = 0;
    selectedAgents.forEach((agent) => {
      total += agent.pricing?.perTask || 0;
    });
    return total;
  };

  const handleDeployMission = async () => {
    if (selectedAgents.size === 0) {
      toast.error('Please select at least one agent');
      return;
    }

    setIsDeploying(true);

    try {
      // Get original user request from chat history
      const messages = getMessages();
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      const userRequest = lastUserMessage?.content || 'Complete the requested task';

      // Build requirements object from capabilities
      const requirements: Record<string, string> = {};
      selectedAgents.forEach((agent, capability) => {
        requirements[capability] = userRequest;
      });

      // Build agent list for deployment
      const agentList = Array.from(selectedAgents.entries()).map(([capability, agent]) => ({
        agentId: agent.agentId.toString(),
        name: agent.name,
        address: agent.address,
        capability,
        payment: agent.pricing?.perTask || 0,
      }));

      const totalBudget = calculateTotalCost();

      // Call mission deployment API
      const response = await fetch('/api/missions/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: userRequest,
          agents: agentList,
          totalBudget,
          clientAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', // TODO: Get from connected wallet
          orchestrationMode: agentList.length > 1 ? 'sequential' : 'sequential',
          requirements,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Deployment failed');
      }

      const result = await response.json();

      // Show success message with mission details
      addMessage({
        role: 'assistant',
        content: `## Mission Deployed Successfully! 🚀\n\n**Mission ID:** \`${result.mission.missionId}\`\n\n**Selected Agents:**\n${agentList.map(a => `- **${a.name}** (${a.capability}): $${a.payment}`).join('\n')}\n\n**Total Cost:** $${totalBudget}\n\n**Requirements:** [View on IPFS](${result.requirementsUrl})\n\n**Next Steps:**\n${result.nextSteps.map((s: string) => `- ${s}`).join('\n')}\n\nAgents have been notified and will begin work shortly. Track progress at \`/missions/${result.mission.missionId}\``,
        metadata: {
          action: {
            type: 'mission_deployed',
            data: {
              missionId: result.mission.missionId,
              agents: agentList,
              totalCost: totalBudget,
              requirementsUrl: result.requirementsUrl,
            },
          },
        },
      });

      toast.success(`Mission ${result.mission.missionId} deployed!`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to deploy mission: ${errorMessage}`);
      console.error('Mission deployment error:', error);

      addMessage({
        role: 'assistant',
        content: `## Deployment Failed\n\nError: ${errorMessage}\n\nPlease try again or contact support if the issue persists.`,
      });
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="border-2 border-black bg-white p-3 sm:p-4 md:p-6 mt-2 sm:mt-3">
      {/* Header */}
      <div className="mb-3 sm:mb-4 pb-2 sm:pb-3 border-b-2 border-black">
        <h3 className="font-bold text-xs sm:text-sm uppercase mb-1.5 sm:mb-2">RECOMMENDED AGENTS</h3>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 text-[10px] sm:text-xs font-mono">
          <span>Estimated: ${data.analysis.totalEstimatedCost.min} - ${data.analysis.totalEstimatedCost.max}</span>
          <span className="uppercase">{data.analysis.intents[0]?.complexity || 'moderate'} complexity</span>
        </div>
      </div>

      {/* Agents by capability */}
      {data.capabilities.map((capability) => {
        const recommendation = data.recommendations[capability];
        if (!recommendation || !recommendation.agents || recommendation.agents.length === 0) {
          return null;
        }

        return (
          <div key={capability} className="mb-3 sm:mb-4 last:mb-0">
            <h4 className="font-bold text-[10px] sm:text-xs uppercase mb-1.5 sm:mb-2 pb-1.5 sm:pb-2 border-b border-gray-300">
              {capability.replace(/-/g, ' ')}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              {recommendation.agents.map((agent) => (
                <AgentCard
                  key={agent.agentId.toString()}
                  agent={agent}
                  selected={selectedAgents.get(capability)?.agentId === agent.agentId}
                  onSelect={() => handleSelectAgent(capability, agent)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Summary & Deploy */}
      <div className="border-t-2 border-black pt-3 sm:pt-4 mt-3 sm:mt-4">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <div>
            <p className="font-mono text-[10px] sm:text-xs uppercase text-gray-600">Selected Agents</p>
            <p className="font-bold text-base sm:text-lg">
              {selectedAgents.size} / {data.capabilities.length}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] sm:text-xs uppercase text-gray-600">Total Cost</p>
            <p className="font-bold text-base sm:text-lg">${calculateTotalCost()}</p>
          </div>
        </div>

        <Button
          onClick={handleDeployMission}
          disabled={selectedAgents.size === 0 || isDeploying}
          className="w-full h-10 sm:h-11 md:h-12 text-[10px] sm:text-xs"
          size="lg"
        >
          {isDeploying
            ? 'DEPLOYING...'
            : selectedAgents.size === 0
            ? 'SELECT AGENTS TO DEPLOY'
            : `DEPLOY MISSION - $${calculateTotalCost()}`}
        </Button>
      </div>
    </div>
  );
}
