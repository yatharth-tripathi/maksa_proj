'use client';

import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { toast } from 'sonner';
import BountyEscrowABI from '@/lib/contracts/abis/BountyEscrow.json';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DisputeModalProps {
  bountyId: bigint;
  workerAddress: string;
  amount: bigint;
  onClose: () => void;
  onSuccess?: () => void;
}

export function DisputeModal({
  bountyId,
  workerAddress,
  amount,
  onClose,
  onSuccess,
}: DisputeModalProps) {
  const [reason, setReason] = useState('');
  const [evidenceURI, setEvidenceURI] = useState('');
  const { address, isConnected } = useAccount();

  const { data: hash, writeContract, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Debug logging
  useEffect(() => {
    console.log('[DisputeModal] State:', {
      isPending,
      isConfirming,
      isSuccess,
      hasHash: !!hash,
      hasError: !!error,
      isConnected,
      address
    });
  }, [isPending, isConfirming, isSuccess, hash, error, isConnected, address]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Handle transaction result
  useEffect(() => {
    if (isSuccess) {
      toast.success('Dispute created successfully! Arbitrators will review your case.');
      onSuccess?.();
      onClose();
    }
  }, [isSuccess, onSuccess, onClose]);

  useEffect(() => {
    if (error) {
      console.error('[DisputeModal] Error state:', error);
      toast.error(`Failed to create dispute: ${error.message}`);
      // Auto-reset after showing error so user can retry
      setTimeout(() => reset(), 3000);
    }
  }, [error, reset]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation checks
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!reason.trim()) {
      toast.error('Please provide a dispute reason');
      return;
    }

    if (!evidenceURI.trim()) {
      toast.error('Please provide evidence URI (IPFS link)');
      return;
    }

    if (!CONTRACTS.BOUNTY_ESCROW) {
      toast.error('Contract address not configured');
      console.error('[DisputeModal] BOUNTY_ESCROW address is missing');
      return;
    }

    console.log('[DisputeModal] Submitting dispute:', {
      bountyId: bountyId.toString(),
      reason,
      evidenceURI,
      contractAddress: CONTRACTS.BOUNTY_ESCROW,
      connectedAddress: address,
    });

    // Reset any previous errors
    reset();

    // Call writeContract
    writeContract(
      {
        address: CONTRACTS.BOUNTY_ESCROW,
        abi: BountyEscrowABI.abi,
        functionName: 'disputeDeliverable',
        args: [bountyId, reason, evidenceURI],
      },
      {
        onSuccess: (hash) => {
          console.log('[DisputeModal] Transaction hash:', hash);
          toast.success('Transaction submitted! Waiting for confirmation...');
        },
        onError: (err) => {
          console.error('[DisputeModal] Transaction error:', err);
          toast.error(`Failed: ${err.message}`);
        },
      }
    );
  };

  const isLoading = isPending || isConfirming;

  // Button text based on state
  const getButtonText = () => {
    if (isPending) return 'WAITING FOR SIGNATURE...';
    if (isConfirming) return 'CONFIRMING...';
    return 'CREATE DISPUTE';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="border-4 border-black bg-white max-w-lg w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b-4 border-black bg-black text-white p-3 sm:p-4 flex-shrink-0">
          <h2 className="font-black text-base sm:text-lg md:text-xl uppercase tracking-tight">
            Create Dispute
          </h2>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-5 md:space-y-6 overflow-y-auto flex-1">
          {/* Bounty Info */}
          <div className="space-y-2 sm:space-y-3">
            <div>
              <label className="font-mono text-[10px] sm:text-xs uppercase tracking-wide text-black opacity-60">
                Bounty ID
              </label>
              <p className="font-bold text-base sm:text-lg">#{bountyId.toString()}</p>
            </div>
            <div>
              <label className="font-mono text-[10px] sm:text-xs uppercase tracking-wide text-black opacity-60">
                Worker
              </label>
              <p className="font-mono text-[10px] sm:text-xs break-all">{workerAddress}</p>
            </div>
            <div>
              <label className="font-mono text-[10px] sm:text-xs uppercase tracking-wide text-black opacity-60">
                Amount in Dispute
              </label>
              <p className="font-bold text-base sm:text-lg">{(Number(amount) / 1e6).toFixed(2)} USDC</p>
            </div>
          </div>

          <div className="h-px bg-black opacity-20" />

          {/* Dispute Reason */}
          <div className="space-y-1.5 sm:space-y-2">
            <label className="font-mono text-[10px] sm:text-xs uppercase tracking-wide text-black">
              Dispute Reason *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="DESCRIBE THE ISSUE WITH THE DELIVERABLE..."
              className="w-full min-h-[100px] sm:min-h-[120px] resize-none border-2 border-black bg-white px-3 sm:px-4 py-2 sm:py-3 font-mono text-[10px] sm:text-xs text-black placeholder:text-black placeholder:opacity-30 focus:outline-none focus:ring-2 focus:ring-black"
              required
            />
          </div>

          {/* Evidence URI */}
          <div className="space-y-1.5 sm:space-y-2">
            <label className="font-mono text-[10px] sm:text-xs uppercase tracking-wide text-black">
              Evidence URI (IPFS) *
            </label>
            <Input
              value={evidenceURI}
              onChange={(e) => setEvidenceURI(e.target.value)}
              placeholder="ipfs://..."
              className="font-mono text-[10px] sm:text-xs"
              required
            />
            <p className="font-mono text-[10px] sm:text-xs text-black opacity-60">
              Upload screenshots/docs to IPFS (e.g., via Pinata) and paste the link
            </p>
          </div>

          {/* Warning */}
          <div className="border-2 border-black bg-yellow-100 p-3 sm:p-4">
            <p className="font-mono text-[10px] sm:text-xs text-black">
              <strong>⚠️ IMPORTANT:</strong> Creating a dispute will freeze funds and send the case to arbitrators.
              They will review evidence from both parties and decide the outcome (7-day voting period).
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 sm:gap-3 pt-1 sm:pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 h-10 sm:h-11 md:h-12 border-2 border-black bg-white text-black md:hover:bg-black md:hover:text-white transition-colors duration-200 font-bold text-[10px] sm:text-xs uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
            >
              CANCEL
            </button>
            <Button
              type="submit"
              disabled={isLoading || !reason.trim() || !evidenceURI.trim() || !isConnected}
              isLoading={isLoading}
              className="flex-1 h-10 sm:h-11 md:h-12 text-[10px] sm:text-xs"
            >
              {getButtonText()}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
