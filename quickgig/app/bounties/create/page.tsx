'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader, LoadingState } from '@/components/ui/loader';
import { useAccount, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { useCreateBounty } from '@/lib/contracts/bountyEscrow';
import { useApproveToken, useTokenAllowance } from '@/lib/contracts/erc20';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CreateBountyPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [deadlineDays, setDeadlineDays] = useState('7');
  const [step, setStep] = useState<'form' | 'approving' | 'creating'>('form');

  // Approval hooks
  const { approve, data: approveHash, isPending: isApproving } = useApproveToken();
  const { isSuccess: isApproved } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // Create bounty hooks
  const { createBounty, data: createHash, isPending: isCreating } = useCreateBounty();
  const { isSuccess: isCreated } = useWaitForTransactionReceipt({
    hash: createHash,
  });

  // Check allowance
  const escrowAmount = amount ? parseUnits(amount, 6) : 0n;
  const { data: allowanceData, refetch: refetchAllowance } = useTokenAllowance(
    CONTRACTS.USDC,
    address,
    CONTRACTS.BOUNTY_ESCROW
  );
  const allowance = (allowanceData as bigint | undefined) || 0n;
  const needsApproval = !allowance || (escrowAmount > 0n && allowance < escrowAmount);

  // Handle approval
  const handleApprove = async () => {
    if (!address || !escrowAmount) {
      toast.error('Please connect wallet and enter amount');
      return;
    }

    try {
      setStep('approving');
      toast.info('Approving USDC...');
      approve(CONTRACTS.USDC, CONTRACTS.BOUNTY_ESCROW, escrowAmount);
    } catch (error) {
      toast.error(`Approval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStep('form');
    }
  };

  // Handle create bounty
  const handleCreate = useCallback(async () => {
    if (!address || !description || !amount || !deadlineDays) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      setStep('creating');
      toast.info('Creating bounty...');

      const deadlineTimestamp = BigInt(Math.floor(Date.now() / 1000) + parseInt(deadlineDays) * 24 * 60 * 60);

      createBounty(
        CONTRACTS.USDC,
        escrowAmount,
        deadlineTimestamp,
        description
      );
    } catch (error) {
      toast.error(`Creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStep('form');
    }
  }, [address, description, amount, deadlineDays, escrowAmount, createBounty]);

  // Auto-transition after approval
  useEffect(() => {
    if (isApproved && step === 'approving') {
      toast.success('USDC approved! Now creating bounty...');
      refetchAllowance();
      setStep('form');
      setTimeout(() => handleCreate(), 1000);
    }
  }, [isApproved, step, refetchAllowance, handleCreate]);

  // Handle successful creation
  useEffect(() => {
    if (isCreated && createHash) {
      toast.success('Bounty created successfully!');
      setTimeout(() => {
        router.push('/bounties');
      }, 1500);
    }
  }, [isCreated, createHash, router]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-white p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="border-2 border-black p-12 bg-white text-center">
            <div className="w-16 h-16 border-2 border-black mx-auto mb-6 flex items-center justify-center">
              <div className="w-8 h-8 bg-black"></div>
            </div>
            <h2 className="font-black text-2xl uppercase tracking-tight mb-4">
              WALLET NOT CONNECTED
            </h2>
            <p className="font-mono text-sm mb-6">
              Please connect your wallet to create a bounty
            </p>
            <Link href="/bounties">
              <Button>GO BACK</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-2 border-black p-8 bg-white">
          <h1 className="font-black text-5xl uppercase tracking-tight text-black mb-2">
            CREATE BOUNTY
          </h1>
          <p className="font-mono text-xs uppercase tracking-wide opacity-60">
            POST A JOB · SET YOUR BUDGET · FIND TALENT
          </p>
        </div>

        {/* Form */}
        <div className="border-2 border-black bg-white">
          <div className="p-8 space-y-6">
            {/* Description */}
            <div>
              <label className="font-bold text-xs uppercase tracking-wide mb-2 block">
                BOUNTY DESCRIPTION / REQUIREMENTS:
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what you need done... Be specific about requirements, deliverables, and success criteria."
                className="w-full h-48 border-2 border-black bg-white px-4 py-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
                disabled={step !== 'form'}
              />
              <p className="font-mono text-xs mt-2 opacity-60">
                {description.length} characters
              </p>
            </div>

            {/* Amount */}
            <div>
              <label className="font-bold text-xs uppercase tracking-wide mb-2 block">
                BOUNTY AMOUNT (USDC):
              </label>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="100"
                  step="0.01"
                  min="0"
                  className="flex-1 border-2 border-black bg-white px-4 py-3 font-black text-2xl focus:outline-none focus:ring-2 focus:ring-black"
                  disabled={step !== 'form'}
                />
                <span className="font-bold text-xs uppercase tracking-wide">USDC</span>
              </div>
              <p className="font-mono text-xs mt-2 opacity-60">
                This amount will be held in escrow until work is approved
              </p>
            </div>

            {/* Deadline */}
            <div>
              <label className="font-bold text-xs uppercase tracking-wide mb-2 block">
                DEADLINE (DAYS FROM NOW):
              </label>
              <div className="flex gap-3">
                {['3', '7', '14', '30'].map((days) => (
                  <button
                    key={days}
                    onClick={() => setDeadlineDays(days)}
                    disabled={step !== 'form'}
                    className={`flex-1 px-4 py-3 border-2 border-black font-bold text-sm uppercase tracking-wide transition-all duration-300 ${
                      deadlineDays === days
                        ? 'bg-black text-white'
                        : 'bg-white text-black hover:bg-black hover:text-white'
                    }`}
                  >
                    {days}D
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <input
                  type="number"
                  value={deadlineDays}
                  onChange={(e) => setDeadlineDays(e.target.value)}
                  placeholder="Custom days"
                  min="1"
                  className="w-full border-2 border-black bg-white px-4 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  disabled={step !== 'form'}
                />
              </div>
              <p className="font-mono text-xs mt-2 opacity-60">
                Deadline: {new Date(Date.now() + parseInt(deadlineDays || '7') * 24 * 60 * 60 * 1000).toLocaleDateString()}
              </p>
            </div>

            {/* Info Box */}
            <div className="border-2 border-black p-4 bg-white">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 border-2 border-black flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 bg-black"></div>
                </div>
                <div>
                  <p className="font-mono text-xs leading-relaxed">
                    <strong>How it works:</strong> Your USDC will be locked in escrow. Workers submit bids.
                    You select the best bid and assign the work. Once completed and approved, payment is released.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-4 border-t-2 border-black">
              {step === 'approving' && (
                <div className="border-2 border-black p-4 bg-white text-center">
                  <Loader size="md" />
                  <p className="font-mono text-xs uppercase tracking-wide">
                    WAITING FOR APPROVAL CONFIRMATION...
                  </p>
                </div>
              )}

              {step === 'creating' && (
                <div className="border-2 border-black p-4 bg-white text-center">
                  <Loader size="md" />
                  <p className="font-mono text-xs uppercase tracking-wide">
                    CREATING BOUNTY...
                  </p>
                </div>
              )}

              {step === 'form' && needsApproval && (
                <Button
                  onClick={handleApprove}
                  disabled={!description || !amount || isApproving}
                  isLoading={isApproving}
                  className="w-full"
                >
                  {isApproving ? 'APPROVING USDC...' : 'APPROVE USDC'}
                </Button>
              )}

              {step === 'form' && !needsApproval && (
                <Button
                  onClick={handleCreate}
                  disabled={!description || !amount || isCreating}
                  isLoading={isCreating}
                  className="w-full"
                >
                  {isCreating ? 'CREATING BOUNTY...' : `CREATE BOUNTY FOR $${amount || '0'} USDC`}
                </Button>
              )}

              {step === 'form' && (
                <Link href="/bounties">
                  <Button variant="outline" className="w-full">
                    CANCEL
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
