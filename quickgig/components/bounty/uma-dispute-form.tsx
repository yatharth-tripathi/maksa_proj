'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { useDisputeDeliverableWithUMA } from '@/lib/contracts/bountyEscrow';
import { useDefaultBond } from '@/lib/contracts/umaEscalationManager';
import { useApproveToken, useTokenBalance } from '@/lib/contracts/erc20';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { toast } from 'sonner';

interface UMADisputeFormProps {
  bountyId: bigint;
  paymentToken: `0x${string}`;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function UMADisputeForm({
  bountyId,
  paymentToken,
  onSuccess,
  onCancel,
}: UMADisputeFormProps) {
  const { address, isConnected } = useAccount();
  const [claim, setClaim] = useState('');
  const [evidenceURI, setEvidenceURI] = useState('');
  const [showInfo, setShowInfo] = useState(false);
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
  const { disputeDeliverableWithUMA, isPending: isDisputing, data: disputeHash, error: disputeError } = useDisputeDeliverableWithUMA();
  const { isSuccess: isDisputeSuccess, isLoading: isDisputeConfirming } = useWaitForTransactionReceipt({
    hash: disputeHash,
  });

  // Debug logging
  useEffect(() => {
    console.log('[UMADispute] State:', {
      step,
      isApproving,
      isDisputing,
      isDisputeConfirming,
      isDisputeSuccess,
      hasDisputeHash: !!disputeHash,
      hasDisputeError: !!disputeError,
    });
  }, [step, isApproving, isDisputing, isDisputeConfirming, isDisputeSuccess, disputeHash, disputeError]);

  // Watch for approval completion and trigger dispute
  useEffect(() => {
    if (isApproved && step === 'approving') {
      setStep('disputing');
      toast.success('Bond approved! Creating dispute...');

      console.log('[UMADispute] Creating dispute with params:', {
        bountyId: bountyId.toString(),
        claim,
        evidenceURI: evidenceURI || 'ipfs://dispute-evidence',
        bondAmount: bondAmount.toString(),
        contractAddress: CONTRACTS.BOUNTY_ESCROW,
      });

      try {
        disputeDeliverableWithUMA(
          bountyId,
          claim,
          evidenceURI || 'ipfs://dispute-evidence',
          bondAmount
        );
        console.log('[UMADispute] Dispute transaction sent to wallet');
      } catch (err) {
        console.error('[UMADispute] Failed to send dispute transaction:', err);
        toast.error(`Failed to create dispute: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setStep('input');
      }
    }
  }, [isApproved, step, disputeDeliverableWithUMA, bountyId, claim, evidenceURI, bondAmount]);

  // Watch for dispute success
  useEffect(() => {
    if (isDisputeSuccess) {
      console.log('[UMADispute] Dispute created successfully');
      toast.success('Dispute created! Challenge period begins now.');
      setStep('input');
      onSuccess?.();
    }
  }, [isDisputeSuccess, onSuccess]);

  // Watch for dispute error
  useEffect(() => {
    if (disputeError) {
      console.error('[UMADispute] Dispute error:', disputeError);
      toast.error(`Dispute failed: ${disputeError.message}`);
      setStep('input');
    }
  }, [disputeError]);

  // Safety timeout: Reset if stuck in disputing for > 60 seconds
  useEffect(() => {
    if (step === 'disputing' && !disputeHash && !isDisputing) {
      console.warn('[UMADispute] Stuck in disputing state without hash or pending status');
      const timeout = setTimeout(() => {
        console.error('[UMADispute] Timeout - resetting to input state');
        toast.error('Transaction timed out. Please try again.');
        setStep('input');
      }, 60000); // 60 seconds

      return () => clearTimeout(timeout);
    }
  }, [step, disputeHash, isDisputing]);

  const handleSubmit = () => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!claim.trim()) {
      toast.error('Please provide a dispute claim');
      return;
    }

    if (hasInsufficientBalance) {
      toast.error(`Insufficient balance. You need ${Number(bondAmount) / 1_000_000} USDC but have ${Number(userBalance) / 1_000_000} USDC`);
      return;
    }

    console.log('[UMADispute] Starting approval for bond:', bondAmount.toString());
    setStep('approving');

    // Step 1: Approve bond tokens
    toast.info(`Approving ${Number(bondAmount) / 1_000_000} USDC bond...`);
    approve(paymentToken, CONTRACTS.BOUNTY_ESCROW, bondAmount);

    // Note: useEffect will handle next step after approval confirms
  };

  const isPending = isApproving || isDisputing;

  // Get button text based on current step
  const getButtonText = () => {
    if (step === 'approving') return 'APPROVING BOND...';
    if (step === 'disputing') return 'CREATING DISPUTE...';
    return 'SUBMIT DISPUTE';
  };

  return (
    <div className="border-2 border-black bg-white max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-black text-white p-4 border-b-2 border-black">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border-2 border-white bg-white flex items-center justify-center">
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="font-black text-base uppercase">Create Dispute</h3>
          </div>

          {/* Info Icon */}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="w-8 h-8 border-2 border-white hover:bg-white hover:text-black transition-colors flex items-center justify-center"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>

        {/* Info Dropdown */}
        {showInfo && (
          <div className="mt-4 border-2 border-white p-3 bg-black">
            <p className="font-mono text-xs leading-relaxed mb-2">
              <span className="font-bold text-white">How UMA Disputes Work:</span>
            </p>
            <ul className="font-mono text-xs space-y-1 opacity-90">
              <li>• Post ${(Number(bondAmount) / 1_000_000).toFixed(0)} USDC bond</li>
              <li>• 2-hour challenge period begins</li>
              <li>• Community can challenge if false</li>
              <li>• Bond returned if claim upheld</li>
              <li>• Automated, decentralized resolution</li>
            </ul>
          </div>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Balance Warning - Only if insufficient */}
        {hasInsufficientBalance && (
          <div className="bg-red-50 border-2 border-red-600 p-3">
            <p className="font-bold text-xs uppercase text-red-900 mb-1">⚠️ Insufficient Balance</p>
            <p className="font-mono text-xs text-red-800">
              Need {(Number(bondAmount) / 1_000_000).toFixed(2)} USDC, have {(Number(userBalance) / 1_000_000).toFixed(2)} USDC
            </p>
          </div>
        )}

        {/* Bond Amount */}
        <div className="flex items-center justify-between p-3 bg-gray-50 border-2 border-black">
          <span className="font-mono text-xs uppercase">Bond Required</span>
          <span className="font-black text-lg">${(Number(bondAmount) / 1_000_000).toFixed(0)} USDC</span>
        </div>

        {/* Claim */}
        <div>
          <label className="font-bold text-xs uppercase tracking-wide mb-2 block">
            Reason <span className="text-red-600">*</span>
          </label>
          <textarea
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            placeholder="Why are you disputing?"
            className="w-full h-20 border-2 border-black bg-white px-3 py-2 font-mono text-sm focus:outline-none resize-none"
            disabled={isPending}
          />
        </div>

        {/* Evidence URI */}
        <div>
          <label className="font-bold text-xs uppercase tracking-wide mb-2 block">
            Evidence (Optional)
          </label>
          <input
            type="text"
            value={evidenceURI}
            onChange={(e) => setEvidenceURI(e.target.value)}
            placeholder="ipfs:// or https://"
            className="w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm focus:outline-none"
            disabled={isPending}
          />
        </div>

        {/* Stuck Warning */}
        {step === 'disputing' && isDisputing && !disputeHash && (
          <div className="border-2 border-yellow-600 bg-yellow-50 p-3">
            <p className="font-mono text-xs text-yellow-900">
              <strong>⏳ Waiting for wallet...</strong> If your wallet didn't open, check for popups or click Retry.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleSubmit}
            disabled={!claim.trim() || isPending || !isConnected}
            isLoading={isPending}
            className="flex-1 bg-red-500 hover:bg-red-600 border-2 border-black text-white"
          >
            {getButtonText()}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              console.log('[UMADispute] User cancelled');
              setStep('input');
              onCancel?.();
            }}
            disabled={false}
            className="flex-1"
          >
            {step === 'disputing' && isDisputing ? 'RETRY' : 'CANCEL'}
          </Button>
        </div>
      </div>
    </div>
  );
}
