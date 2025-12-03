'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { useDisputeMilestoneWithUMA } from '@/lib/contracts/gigEscrow';
import { useDefaultBond } from '@/lib/contracts/umaEscalationManager';
import { useApproveToken, useTokenBalance } from '@/lib/contracts/erc20';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { toast } from 'sonner';

interface UMADisputeFormProps {
  gigId: bigint;
  milestoneIndex: bigint;
  paymentToken: `0x${string}`;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function UMADisputeForm({
  gigId,
  milestoneIndex,
  paymentToken,
  onSuccess,
  onCancel,
}: UMADisputeFormProps) {
  const { address } = useAccount();
  const [claim, setClaim] = useState('');
  const [evidenceURI, setEvidenceURI] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'input' | 'approving' | 'disputing'>('input');

  // Get default bond from escalation manager
  const { data: defaultBond } = useDefaultBond();
  const bondAmount = (defaultBond as bigint) || parseUnits('10', 6); // Default 10 USDC

  // Check user's token balance
  const { data: balance } = useTokenBalance(paymentToken, address);
  const userBalance = (balance as bigint) || 0n;
  const hasInsufficientBalance = userBalance < bondAmount;

  // Approval hooks
  const { approve, data: approveHash, isPending: isApproving } = useApproveToken();
  const { isSuccess: isApproved } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // Dispute hooks
  const { disputeMilestoneWithUMA, isPending: isDisputing } = useDisputeMilestoneWithUMA();

  // Watch for approval completion and trigger dispute
  useEffect(() => {
    if (isApproved && step === 'approving') {
      setStep('disputing');
      toast.success('Approval confirmed! Creating dispute...');

      try {
        disputeMilestoneWithUMA(
          gigId,
          milestoneIndex,
          claim,
          evidenceURI || 'ipfs://gig-milestone-dispute-evidence',
          bondAmount
        );
        toast.success('UMA dispute created! Challenge period has started.');
        onSuccess?.();
      } catch (error) {
        console.error('Dispute creation error:', error);
        toast.error(`Failed to create dispute: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsSubmitting(false);
        setStep('input');
      }
    }
  }, [isApproved, step, disputeMilestoneWithUMA, gigId, milestoneIndex, claim, evidenceURI, bondAmount, onSuccess]);

  const handleSubmit = async () => {
    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!claim.trim()) {
      toast.error('Please provide a dispute claim');
      return;
    }

    if (hasInsufficientBalance) {
      toast.error(`Insufficient balance in address ${address?.slice(0, 6)}...${address?.slice(-4)}. You need ${Number(bondAmount) / 1_000_000} USDC but have ${Number(userBalance) / 1_000_000} USDC. Please add USDC to THIS address (your Smart Wallet).`);
      return;
    }

    try {
      setIsSubmitting(true);
      setStep('approving');

      // Step 1: Approve bond tokens
      toast.info(`Approving ${Number(bondAmount) / 1_000_000} USDC bond from ${address?.slice(0, 6)}...${address?.slice(-4)}`);
      approve(paymentToken, CONTRACTS.GIG_ESCROW, bondAmount);

      // Note: useEffect will handle next step after approval confirms
    } catch (error) {
      console.error('Approval error:', error);
      toast.error(`Failed to approve: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsSubmitting(false);
      setStep('input');
    }
  };

  const isPending = isSubmitting || isApproving || isDisputing;

  return (
    <div className="border-2 border-black bg-white">
      {/* Header */}
      <div className="bg-black text-white p-4 border-b-2 border-black">
        <h3 className="font-black text-sm uppercase">CREATE UMA DISPUTE</h3>
        <p className="font-mono text-xs mt-1 opacity-80">
          Milestone {Number(milestoneIndex) + 1} - Optimistic Oracle Dispute
        </p>
      </div>

      <div className="p-6 space-y-4">
        {/* Balance Warning - Only if insufficient */}
        {hasInsufficientBalance && (
          <div className="bg-red-50 border-2 border-red-600 p-4">
            <p className="font-bold text-xs uppercase text-red-900 mb-1">⚠️ Insufficient Balance</p>
            <p className="font-mono text-xs text-red-800">
              Need {(Number(bondAmount) / 1_000_000).toFixed(2)} USDC, have {(Number(userBalance) / 1_000_000).toFixed(2)} USDC
            </p>
          </div>
        )}

        {/* Bond Info */}
        <div className="bg-yellow-50 border-2 border-yellow-600 p-4">
          <p className="font-bold text-xs uppercase tracking-wide mb-1">
            ⚠️ Bond Required:
          </p>
          <p className="font-black text-xl">
            ${(Number(bondAmount) / 1_000_000).toFixed(2)} USDC
          </p>
          <p className="font-mono text-xs mt-2 opacity-80">
            Bond will be returned if your claim is upheld. Lost if claim is proven false.
          </p>
        </div>

        {/* Claim */}
        <div>
          <label className="font-bold text-xs uppercase tracking-wide mb-2 block">
            DISPUTE CLAIM: <span className="text-red-600">*</span>
          </label>
          <textarea
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            placeholder="Describe why the milestone deliverable is unsatisfactory and should be disputed..."
            className="w-full h-32 border-2 border-black bg-white px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
            disabled={isPending}
          />
          <p className="font-mono text-xs mt-1 opacity-60">
            Be specific and factual. This will be publicly visible on-chain.
          </p>
        </div>

        {/* Evidence URI */}
        <div>
          <label className="font-bold text-xs uppercase tracking-wide mb-2 block">
            EVIDENCE URI (OPTIONAL):
          </label>
          <input
            type="text"
            value={evidenceURI}
            onChange={(e) => setEvidenceURI(e.target.value)}
            placeholder="ipfs://... or https://..."
            className="w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-black"
            disabled={isPending}
          />
          <p className="font-mono text-xs mt-1 opacity-60">
            Link to supporting evidence (IPFS, cloud storage, etc.)
          </p>
        </div>

        {/* Process Explanation */}
        <div className="border-2 border-black p-4">
          <p className="font-bold text-xs uppercase tracking-wide mb-2">
            How UMA Dispute Works:
          </p>
          <ol className="font-mono text-xs space-y-2">
            <li>1. Your claim is posted with {(Number(bondAmount) / 1_000_000).toFixed(0)} USDC bond</li>
            <li>2. Challenge period begins (2 hours on testnet)</li>
            <li>3. Worker can challenge with equal bond</li>
            <li>4. If challenged → UMA token holders vote</li>
            <li>5. Winner receives both bonds + resolution</li>
          </ol>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t-2 border-black">
          <Button
            onClick={handleSubmit}
            disabled={!claim.trim() || isPending}
            isLoading={isPending}
            className="flex-1"
          >
            {isPending ? 'PROCESSING...' : 'CREATE DISPUTE'}
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1"
          >
            CANCEL
          </Button>
        </div>
      </div>
    </div>
  );
}
