'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/ui/loader';
import type { RecommendedAgent } from '@/lib/ai/agent-recommender';
import { toast } from 'sonner';
import { useAccount } from 'wagmi';

interface MissionWizardProps {
  open: boolean;
  onClose: () => void;
  selectedAgents: Map<string, RecommendedAgent>;
  onSuccess?: () => void;
}

export function MissionWizard({ open, onClose, selectedAgents, onSuccess }: MissionWizardProps) {
  const { address } = useAccount();
  const [step, setStep] = useState<'details' | 'requirements' | 'review'>('details');
  const [missionTitle, setMissionTitle] = useState('');
  const [missionDescription, setMissionDescription] = useState('');
  const [requirements, setRequirements] = useState<Record<string, string>>({});
  const [orchestrationMode, setOrchestrationMode] = useState<'sequential' | 'parallel'>('sequential');
  const [isDeploying, setIsDeploying] = useState(false);

  const agents = Array.from(selectedAgents.values());
  const totalCost = agents.reduce((sum, agent) => sum + (agent.pricing?.perTask || 0), 0);

  const handleRequirementChange = (capability: string, value: string) => {
    setRequirements((prev) => ({ ...prev, [capability]: value }));
  };

  const handleDeploy = async () => {
    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!missionTitle.trim()) {
      toast.error('Please enter a mission title');
      return;
    }

    setIsDeploying(true);

    try {
      const response = await fetch('/api/missions/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: missionDescription || missionTitle,
          agents: agents.map((agent) => ({
            agentId: agent.agentId.toString(),
            capability: agent.capabilities[0],
            payment: agent.pricing?.perTask || 0,
          })),
          totalBudget: totalCost,
          clientAddress: address,
          orchestrationMode,
          requirements,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Mission deployed successfully!');
        onSuccess?.();
        onClose();
      } else {
        toast.error(data.message || 'Failed to deploy mission');
      }
    } catch (error) {
      console.error('Mission deployment error:', error);
      toast.error('Failed to deploy mission');
    } finally {
      setIsDeploying(false);
    }
  };

  const renderDetailsStep = () => (
    <div className="space-y-6">
      <div>
        <label className="font-bold text-xs uppercase tracking-wide mb-2 block">
          MISSION TITLE *
        </label>
        <input
          type="text"
          value={missionTitle}
          onChange={(e) => setMissionTitle(e.target.value)}
          placeholder="e.g., Brand Identity Package"
          className="w-full px-4 py-3 border-2 border-black font-mono text-sm"
        />
      </div>

      <div>
        <label className="font-bold text-xs uppercase tracking-wide mb-2 block">
          DESCRIPTION (Optional)
        </label>
        <textarea
          value={missionDescription}
          onChange={(e) => setMissionDescription(e.target.value)}
          placeholder="Describe what you need..."
          rows={4}
          className="w-full px-4 py-3 border-2 border-black font-mono text-sm resize-none"
        />
      </div>

      <div>
        <label className="font-bold text-xs uppercase tracking-wide mb-2 block">
          EXECUTION MODE
        </label>
        <div className="flex gap-3">
          <button
            onClick={() => setOrchestrationMode('sequential')}
            className={`flex-1 px-4 py-3 border-2 border-black font-mono text-xs uppercase transition-all ${
              orchestrationMode === 'sequential'
                ? 'bg-black text-white'
                : 'bg-white text-black hover:bg-black hover:text-white'
            }`}
          >
            SEQUENTIAL
            <div className="text-[10px] normal-case opacity-80 mt-1">
              Agents work one after another
            </div>
          </button>
          <button
            onClick={() => setOrchestrationMode('parallel')}
            className={`flex-1 px-4 py-3 border-2 border-black font-mono text-xs uppercase transition-all ${
              orchestrationMode === 'parallel'
                ? 'bg-black text-white'
                : 'bg-white text-black hover:bg-black hover:text-white'
            }`}
          >
            PARALLEL
            <div className="text-[10px] normal-case opacity-80 mt-1">
              All agents work simultaneously
            </div>
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" onClick={onClose}>
          CANCEL
        </Button>
        <Button onClick={() => setStep('requirements')}>
          NEXT: REQUIREMENTS
        </Button>
      </div>
    </div>
  );

  const renderRequirementsStep = () => {
    const capabilities = Array.from(
      new Set(agents.flatMap((agent) => agent.capabilities))
    );

    return (
      <div className="space-y-6">
        <p className="font-mono text-xs text-gray-600">
          Specify requirements for each capability
        </p>

        {capabilities.map((capability) => {
          const agentsForCapability = agents.filter((a) =>
            a.capabilities.includes(capability)
          );

          return (
            <div key={capability}>
              <label className="font-bold text-xs uppercase tracking-wide mb-2 block">
                {capability.replace('-', ' ')}
                <span className="ml-2 font-mono text-[10px] text-gray-500">
                  ({agentsForCapability.length} agent{agentsForCapability.length > 1 ? 's' : ''})
                </span>
              </label>
              <textarea
                value={requirements[capability] || ''}
                onChange={(e) => handleRequirementChange(capability, e.target.value)}
                placeholder={`Specific requirements for ${capability}...`}
                rows={3}
                className="w-full px-4 py-3 border-2 border-black font-mono text-sm resize-none"
              />
            </div>
          );
        })}

        <div className="flex justify-between gap-3 pt-4">
          <Button variant="outline" onClick={() => setStep('details')}>
            BACK
          </Button>
          <Button onClick={() => setStep('review')}>
            REVIEW & DEPLOY
          </Button>
        </div>
      </div>
    );
  };

  const renderReviewStep = () => (
    <div className="space-y-6">
      <div className="border-2 border-black p-4 bg-gray-50">
        <h3 className="font-bold text-xs uppercase tracking-wide mb-2">MISSION SUMMARY</h3>
        <p className="font-mono text-sm mb-1">{missionTitle}</p>
        {missionDescription && (
          <p className="font-mono text-xs text-gray-600">{missionDescription}</p>
        )}
      </div>

      <div className="border-2 border-black p-4">
        <h3 className="font-bold text-xs uppercase tracking-wide mb-3">
          SELECTED AGENTS ({agents.length})
        </h3>
        <div className="space-y-2">
          {agents.map((agent) => (
            <div
              key={agent.agentId.toString()}
              className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0"
            >
              <div>
                <div className="font-mono text-sm">{agent.name}</div>
                <div className="font-mono text-[10px] text-gray-500 uppercase">
                  {agent.capabilities.join(', ')}
                </div>
              </div>
              <div className="font-bold text-sm">${agent.pricing?.perTask || 0}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-2 border-black p-4 bg-black text-white">
        <div className="flex items-center justify-between">
          <span className="font-bold text-xs uppercase tracking-wide">TOTAL COST</span>
          <span className="font-black text-2xl">${totalCost}</span>
        </div>
        <div className="font-mono text-[10px] opacity-80 mt-1">
          Mode: {orchestrationMode.toUpperCase()}
        </div>
      </div>

      <div className="flex justify-between gap-3 pt-4">
        <Button variant="outline" onClick={() => setStep('requirements')} disabled={isDeploying}>
          BACK
        </Button>
        <Button onClick={handleDeploy} disabled={isDeploying} className="px-8">
          {isDeploying ? (
            <>
              <Loader size="sm" className="mr-2" />
              DEPLOYING...
            </>
          ) : (
            `DEPLOY MISSION - $${totalCost}`
          )}
        </Button>
      </div>
    </div>
  );

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="border-4 border-black bg-white max-w-2xl w-full my-8">
        {/* Header */}
        <div className="border-b-2 border-black p-6 bg-white">
          <h2 className="font-black text-2xl uppercase tracking-tight mb-3">
            CREATE MISSION
          </h2>
          <div className="flex gap-2">
            <Badge
              variant={step === 'details' ? 'default' : 'outline'}
              className="font-mono text-xs uppercase"
            >
              1. DETAILS
            </Badge>
            <Badge
              variant={step === 'requirements' ? 'default' : 'outline'}
              className="font-mono text-xs uppercase"
            >
              2. REQUIREMENTS
            </Badge>
            <Badge
              variant={step === 'review' ? 'default' : 'outline'}
              className="font-mono text-xs uppercase"
            >
              3. REVIEW
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'details' && renderDetailsStep()}
          {step === 'requirements' && renderRequirementsStep()}
          {step === 'review' && renderReviewStep()}
        </div>
      </div>
    </div>
  );
}
