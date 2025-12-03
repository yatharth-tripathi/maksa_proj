'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader, LoadingState } from '@/components/ui/loader';
import { useAccount, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { useCreateBounty } from '@/lib/contracts/bountyEscrow';
import { useApproveToken, useTokenAllowance } from '@/lib/contracts/erc20';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { toast } from 'sonner';
import { useChatStore } from '@/lib/store/chat';
import { useRouter } from 'next/navigation';

interface BountyConfirmationProps {
  messageId: string;
  data: {
    description: string;
    amount: string;
    deadline: string;
    tags: string[];
    useUMAArbitration?: boolean;
    completed?: boolean;
  };
}

export function BountyConfirmation({ messageId, data }: BountyConfirmationProps) {
  const { address } = useAccount();
  const { addMessage, updateMessageMetadata } = useChatStore();
  const router = useRouter();
  const [step, setStep] = useState<'preview' | 'approving' | 'creating' | 'completed'>(
    data.completed ? 'completed' : 'preview'
  );
  const hasCompletedRef = useRef(false);

  const escrowAmount = parseUnits(data.amount, 6);

  // Approval hooks
  const { approve, data: approveHash, isPending: isApproving } = useApproveToken();
  const { isSuccess: isApproved } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // Create bounty hooks
  const { createBounty, data: createHash, isPending: isCreating, error: createError } = useCreateBounty();
  const { isSuccess: isCreated } = useWaitForTransactionReceipt({
    hash: createHash,
  });

  // Check allowance
  const { data: allowanceData, refetch: refetchAllowance } = useTokenAllowance(
    CONTRACTS.USDC,
    address,
    CONTRACTS.BOUNTY_ESCROW
  );
  const allowance = (allowanceData as bigint | undefined) || 0n;
  const needsApproval = !allowance || (escrowAmount > 0n && allowance < escrowAmount);

  // Handle approval
  const handleApprove = async () => {
    if (!address) {
      toast.error('Wallet connection required for mission deployment');
      return;
    }

    try {
      setStep('approving');
      toast.info('Approving USDC for escrow...');
      await approve(CONTRACTS.USDC, CONTRACTS.BOUNTY_ESCROW, escrowAmount);
    } catch (error) {
      toast.error(`Approval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStep('preview');
    }
  };

  // Handle create
  const handleCreate = useCallback(() => {
    if (!address) {
      toast.error('Wallet connection required for mission deployment');
      return;
    }

    const deadlineTimestamp = BigInt(Math.floor(Date.now() / 1000) + parseInt(data.deadline) * 24 * 60 * 60);
    const description = data.tags.length > 0
      ? `[${data.tags.join(', ')}] ${data.description}`
      : data.description;

    // Call createBounty - this will trigger the wallet popup
    createBounty(
      CONTRACTS.USDC,
      escrowAmount,
      deadlineTimestamp,
      description,
      data.useUMAArbitration || false
    );
  }, [address, data.deadline, data.tags, data.description, escrowAmount, createBounty, data.useUMAArbitration]);

  // Auto-transition after approval
  useEffect(() => {
    if (isApproved && step === 'approving') {
      toast.success('USDC approved! Deploying mission...');
      refetchAllowance();
      setStep('preview');
      setTimeout(() => handleCreate(), 1000);
    }
  }, [isApproved, step, handleCreate, refetchAllowance]);

  // Monitor transaction pending state
  useEffect(() => {
    if (isCreating && step !== 'creating') {
      setStep('creating');
      toast.info('Deploying mission to network. Sign transaction...');
    }
  }, [isCreating, step]);

  // Handle transaction errors
  useEffect(() => {
    if (createError && step === 'creating') {
      console.error('Transaction error:', createError);
      toast.error(`Transaction failed: ${createError.message}`);
      setStep('preview');
    }
  }, [createError, step]);

  // Handle successful creation
  useEffect(() => {
    if (isCreated && createHash && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      toast.success('Mission deployed! Agents can now discover and apply.');
      setStep('completed'); // Show completed state

      // Mark this confirmation message as completed in store
      updateMessageMetadata(messageId, {
        action: {
          type: 'bounty_confirmation',
          data: { ...data, completed: true },
        },
      });

      // Redirect to bounties page after 1.5 seconds
      setTimeout(() => {
        router.push('/bounties');
      }, 1500);
    }
  }, [isCreated, createHash, updateMessageMetadata, messageId, data, router]);

  const handleCancel = () => {
    addMessage({
      role: 'system',
      content: 'Mission deployment cancelled.',
    });
  };

  return (
    <div className="border-2 border-black bg-white max-w-2xl">
      {/* Preview */}
      <div className="bg-black text-white p-3 sm:p-4 border-b-2 border-black">
        <h3 className="font-black text-xs sm:text-sm uppercase">CONFIRM MISSION DEPLOYMENT</h3>
      </div>

      <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
        {/* Description */}
        <div>
          <p className="font-bold text-[10px] sm:text-xs uppercase tracking-wide mb-1 opacity-60">
            MISSION OBJECTIVE:
          </p>
          <p className="font-mono text-xs sm:text-sm">
            {data.description}
          </p>
        </div>

        {/* Amount */}
        <div className="border-t-2 border-black pt-3 sm:pt-4">
          <p className="font-bold text-[10px] sm:text-xs uppercase tracking-wide mb-1 opacity-60">
            REWARD:
          </p>
          <p className="font-black text-xl sm:text-2xl">
            ${data.amount} USDC
          </p>
        </div>

        {/* Deadline */}
        <div className="border-t-2 border-black pt-3 sm:pt-4">
          <p className="font-bold text-[10px] sm:text-xs uppercase tracking-wide mb-1 opacity-60">
            DEADLINE:
          </p>
          <p className="font-mono text-xs sm:text-sm">
            {data.deadline} days ({new Date(Date.now() + parseInt(data.deadline) * 24 * 60 * 60 * 1000).toLocaleDateString()})
          </p>
        </div>

        {/* Tags */}
        {data.tags.length > 0 && (
          <div className="border-t-2 border-black pt-3 sm:pt-4">
            <p className="font-bold text-[10px] sm:text-xs uppercase tracking-wide mb-1.5 sm:mb-2 opacity-60">
              TAGS:
            </p>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {data.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 sm:px-3 py-0.5 sm:py-1 border-2 border-black bg-black text-white font-mono text-[10px] sm:text-xs uppercase"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Arbitration Method */}
        <div className="border-t-2 border-black pt-3 sm:pt-4">
          <p className="font-bold text-[10px] sm:text-xs uppercase tracking-wide mb-1 opacity-60">
            DISPUTE RESOLUTION:
          </p>
          <p className="font-mono text-xs sm:text-sm">
            {data.useUMAArbitration ? (
              <span className="font-bold">UMA Optimistic Oracle</span>
            ) : (
              'Multi-sig Arbitration Panel'
            )}
          </p>
          <p className="font-mono text-[10px] sm:text-xs mt-1 opacity-70">
            {data.useUMAArbitration
              ? 'Decentralized resolution with challenge period'
              : 'Trusted arbitrators with 7-day voting period'}
          </p>
        </div>

        {/* Status */}
        {step === 'approving' && (
          <div className="border-2 border-black p-3 sm:p-4 bg-white text-center">
            <Loader size="md" />
            <p className="font-mono text-[10px] sm:text-xs uppercase tracking-wide">
              WAITING FOR APPROVAL...
            </p>
          </div>
        )}

        {step === 'creating' && (
          <div className="border-2 border-black p-3 sm:p-4 bg-white text-center">
            <Loader size="md" />
            <p className="font-mono text-[10px] sm:text-xs uppercase tracking-wide">
              DEPLOYING MISSION...
            </p>
          </div>
        )}

        {step === 'completed' && (
          <div className="border-2 border-black p-3 sm:p-4 bg-black text-white text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 flex items-center justify-center">
              <svg className="w-10 h-10 sm:w-12 sm:h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-black text-xs sm:text-sm uppercase tracking-wide">
              MISSION DEPLOYED
            </p>
            <p className="font-mono text-[10px] sm:text-xs mt-1.5 sm:mt-2 opacity-70">
              Live on network. Agents can now apply.
            </p>
          </div>
        )}

        {/* Buttons */}
        {step === 'preview' && (
          <div className="space-y-2 sm:space-y-3 pt-3 sm:pt-4 border-t-2 border-black">
            {needsApproval && (
              <Button
                onClick={handleApprove}
                disabled={isApproving}
                isLoading={isApproving}
                className="w-full h-10 sm:h-11 md:h-12 text-[10px] sm:text-xs"
              >
                {isApproving ? 'APPROVING...' : 'APPROVE USDC'}
              </Button>
            )}

            {!needsApproval && (
              <Button
                onClick={handleCreate}
                disabled={isCreating}
                isLoading={isCreating}
                className="w-full h-10 sm:h-11 md:h-12 text-[10px] sm:text-xs"
              >
                {isCreating ? 'DEPLOYING...' : 'DEPLOY MISSION'}
              </Button>
            )}

            <Button
              variant="outline"
              onClick={handleCancel}
              className="w-full h-10 sm:h-11 md:h-12 text-[10px] sm:text-xs"
            >
              CANCEL
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
