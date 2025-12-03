'use client';

import { useState } from 'react';
import { useChatStore } from '@/lib/store/chat';
import { toast } from 'sonner';

interface MissionModePanelProps {
  data: {
    originalMessage: string;
  };
}

export function MissionModePanel({ data }: MissionModePanelProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const addMessage = useChatStore((state) => state.addMessage);
  const getCurrentSession = useChatStore((state) => state.getCurrentSession);

  const handleAIMatching = async () => {
    setIsProcessing(true);
    try {
      // Call agent recommendation endpoint
      const session = getCurrentSession();
      if (!session) {
        toast.error('Session not found');
        return;
      }

      // Send request to get agent recommendations
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `[AI_AGENT_MATCHING] ${data.originalMessage}`,
          sessionId: session.id,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();

      // Parse action response
      let messageContent = result.message;
      const messageMetadata: {
        action?: { type: string; data?: Record<string, unknown> };
      } = {};

      try {
        const parsed = JSON.parse(result.message);
        if (parsed.action) {
          messageContent = parsed.message;
          messageMetadata.action = parsed.action;
        }
      } catch {
        // Not JSON, use as regular message
      }

      // Add assistant response with agent recommendations
      addMessage({
        role: 'assistant',
        content: messageContent,
        metadata: messageMetadata,
      });
    } catch (error) {
      toast.error(`Failed to get agent recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('AI matching error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenBounty = () => {
    // Trigger bounty form
    addMessage({
      role: 'assistant',
      content: 'Ready to deploy your mission! Fill in the details below:',
      metadata: {
        action: {
          type: 'bounty_form',
          data: {
            prefilled: {
              description: data.originalMessage,
            },
          },
        },
      },
    });
  };

  const handleMilestoneContract = () => {
    // Trigger milestone contract form
    addMessage({
      role: 'assistant',
      content: 'Let\'s create a milestone-based contract with escrow protection:',
      metadata: {
        action: {
          type: 'gig_form',
          data: {
            prefilled: {
              description: data.originalMessage,
            },
          },
        },
      },
    });
  };

  return (
    <div className="border-2 border-black bg-white p-3 sm:p-4 md:p-6 mt-2 sm:mt-3">
      <h3 className="font-bold text-xs sm:text-sm uppercase mb-3 sm:mb-4 pb-2 sm:pb-3 border-b-2 border-black">
        CHOOSE DEPLOYMENT MODE
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
        {/* AI Agent Matching */}
        <button
          onClick={handleAIMatching}
          disabled={isProcessing}
          className="group border-2 border-black p-4 sm:p-5 md:p-6 text-left transition-all duration-200 md:hover:bg-black md:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {/* AI Agent Icon */}
          <div className="mb-3 sm:mb-4 w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12">
            <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
              <rect x="14" y="8" width="20" height="24" stroke="currentColor" strokeWidth="2" fill="none" />
              <circle cx="20" cy="16" r="2" fill="currentColor" />
              <circle cx="28" cy="16" r="2" fill="currentColor" />
              <path d="M18 24 L24 26 L30 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <rect x="10" y="32" width="8" height="8" stroke="currentColor" strokeWidth="2" fill="none" />
              <rect x="30" y="32" width="8" height="8" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M14 32 L14 28 L20 28" stroke="currentColor" strokeWidth="2" />
              <path d="M34 32 L34 28 L28 28" stroke="currentColor" strokeWidth="2" />
              <rect x="20" y="4" width="8" height="4" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M24 8 L24 4" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <h4 className="font-bold text-sm sm:text-base mb-1.5 sm:mb-2 uppercase leading-tight">AI Agent Matching</h4>
          <p className="text-xs sm:text-sm font-mono opacity-80 mb-3 sm:mb-4">
            I&apos;ll analyze your requirements, find the best agents, and deploy your mission instantly.
          </p>
          <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold uppercase">
            <span>Select Agents</span>
            <span className="transition-transform md:group-hover:translate-x-1">→</span>
          </div>
        </button>

        {/* Open Bounty */}
        <button
          onClick={handleOpenBounty}
          disabled={isProcessing}
          className="group border-2 border-black p-4 sm:p-5 md:p-6 text-left transition-all duration-200 md:hover:bg-black md:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {/* Broadcast Icon */}
          <div className="mb-3 sm:mb-4 w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12">
            <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
              <circle cx="24" cy="24" r="4" fill="currentColor" />
              <path d="M16 16 L8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M32 16 L40 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M16 32 L8 40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M32 32 L40 40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="24" cy="24" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
              <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="4 4" />
              <path d="M12 24 L6 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M36 24 L42 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M24 12 L24 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M24 36 L24 42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h4 className="font-bold text-sm sm:text-base mb-1.5 sm:mb-2 uppercase leading-tight">Open Bounty</h4>
          <p className="text-xs sm:text-sm font-mono opacity-80 mb-3 sm:mb-4">
            Post your mission publicly. Agents discover it, submit bids, and you choose the best one.
          </p>
          <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold uppercase">
            <span>Post Mission</span>
            <span className="transition-transform md:group-hover:translate-x-1">→</span>
          </div>
        </button>

        {/* Milestone Contract */}
        <button
          onClick={handleMilestoneContract}
          disabled={isProcessing}
          className="group border-2 border-black p-4 sm:p-5 md:p-6 text-left transition-all duration-200 md:hover:bg-black md:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {/* Milestone/Steps Icon */}
          <div className="mb-3 sm:mb-4 w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12">
            <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
              <rect x="6" y="6" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" />
              <rect x="6" y="24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" />
              <rect x="24" y="6" width="18" height="6" stroke="currentColor" strokeWidth="2" fill="none" />
              <rect x="24" y="14" width="18" height="6" stroke="currentColor" strokeWidth="2" fill="none" />
              <rect x="24" y="24" width="18" height="6" stroke="currentColor" strokeWidth="2" fill="none" />
              <rect x="24" y="32" width="18" height="6" stroke="currentColor" strokeWidth="2" fill="none" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
              <circle cx="12" cy="30" r="2" fill="currentColor" />
              <path d="M18 12 L24 12" stroke="currentColor" strokeWidth="2" />
              <path d="M18 30 L24 30" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <h4 className="font-bold text-sm sm:text-base mb-1.5 sm:mb-2 uppercase leading-tight">Milestone Contract</h4>
          <p className="text-xs sm:text-sm font-mono opacity-80 mb-3 sm:mb-4">
            Create a multi-stage contract with milestone-based payments and escrow protection.
          </p>
          <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold uppercase">
            <span>Setup Milestones</span>
            <span className="transition-transform md:group-hover:translate-x-1">→</span>
          </div>
        </button>
      </div>

      <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-300">
        <p className="text-[10px] sm:text-xs font-mono text-gray-600 leading-relaxed">
          <span className="font-bold">AI Matching:</span> Fast deployment, I pick the best agents.{' '}
          <span className="font-bold">Open Bounty:</span> You review bids and choose.{' '}
          <span className="font-bold">Milestone Contract:</span> Multi-stage work with payment checkpoints.
        </p>
      </div>
    </div>
  );
}
