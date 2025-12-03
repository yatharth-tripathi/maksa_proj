'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { useCreateGig } from '@/lib/contracts/gigEscrow';
import { useApproveToken } from '@/lib/contracts/erc20';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { toast } from 'sonner';
import type { Address } from 'viem';

interface Milestone {
  description: string;
  amount: string;
}

export function GigCreationForm({ onSuccess }: { onSuccess?: (gigId: bigint) => void }) {
  const { address } = useAccount();
  const [worker, setWorker] = useState('');
  const [paymentToken, setPaymentToken] = useState(CONTRACTS.USDC);
  const [milestones, setMilestones] = useState<Milestone[]>([
    { description: '', amount: '' },
  ]);
  const [useUMAArbitration, setUseUMAArbitration] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { createGig, isPending: isCreating } = useCreateGig();
  const { approve, isPending: isApproving } = useApproveToken();

  const addMilestone = () => {
    setMilestones([...milestones, { description: '', amount: '' }]);
  };

  const removeMilestone = (index: number) => {
    if (milestones.length > 1) {
      setMilestones(milestones.filter((_, i) => i !== index));
    }
  };

  const updateMilestone = (index: number, field: 'description' | 'amount', value: string) => {
    const updated = [...milestones];
    updated[index][field] = value;
    setMilestones(updated);
  };

  const totalAmount = milestones.reduce((sum, m) => {
    const amount = parseFloat(m.amount) || 0;
    return sum + amount;
  }, 0);

  const handleSubmit = async () => {
    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!worker || !worker.startsWith('0x')) {
      toast.error('Please enter a valid worker address');
      return;
    }

    if (milestones.some((m) => !m.description.trim() || !m.amount || parseFloat(m.amount) <= 0)) {
      toast.error('All milestones must have a description and amount > 0');
      return;
    }

    try {
      setIsSubmitting(true);

      // Parse amounts
      const descriptions = milestones.map((m) => m.description);
      const amounts = milestones.map((m) => parseUnits(m.amount, 6)); // Assuming USDC (6 decimals)
      const total = amounts.reduce((sum, amt) => sum + amt, 0n);

      // Step 1: Approve tokens
      toast.info(`Approving ${totalAmount} USDC...`);
      await approve(paymentToken as Address, CONTRACTS.GIG_ESCROW, total);

      // Wait for approval to process
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Step 2: Create gig
      toast.info('Creating gig on-chain...');
      const hash = await createGig(
        worker as Address,
        paymentToken as Address,
        descriptions,
        amounts,
        useUMAArbitration
      );

      toast.success('Gig created successfully!');

      // Extract gig ID from event logs (simplified - in production, parse transaction receipt)
      // For now, just call onSuccess callback
      onSuccess?.(0n); // You'd get the actual ID from event logs
    } catch (error) {
      console.error('Gig creation error:', error);
      toast.error(`Failed to create gig: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPending = isSubmitting || isApproving || isCreating;

  return (
    <div className="border-2 border-black bg-white">
      {/* Header */}
      <div className="bg-black text-white p-4 border-b-2 border-black">
        <h2 className="font-black text-lg uppercase">CREATE GIG</h2>
        <p className="font-mono text-xs mt-1 opacity-80">
          Milestone-based work with escrow protection
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Worker Address */}
        <div>
          <label className="font-bold text-xs uppercase tracking-wide mb-2 block">
            WORKER ADDRESS: <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={worker}
            onChange={(e) => setWorker(e.target.value)}
            placeholder="0x..."
            className="w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-black"
            disabled={isPending}
          />
        </div>

        {/* Milestones */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="font-bold text-xs uppercase tracking-wide">
              MILESTONES: <span className="text-red-600">*</span>
            </label>
            <Button
              onClick={addMilestone}
              variant="outline"
              size="sm"
              disabled={isPending}
            >
              + ADD MILESTONE
            </Button>
          </div>

          <div className="space-y-4">
            {milestones.map((milestone, index) => (
              <div key={index} className="border-2 border-black p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-black text-xs uppercase">Milestone {index + 1}</p>
                  {milestones.length > 1 && (
                    <button
                      onClick={() => removeMilestone(index)}
                      className="font-mono text-xs text-red-600 hover:underline"
                      disabled={isPending}
                    >
                      REMOVE
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="font-mono text-xs opacity-60 mb-1 block">
                      Description:
                    </label>
                    <input
                      type="text"
                      value={milestone.description}
                      onChange={(e) =>
                        updateMilestone(index, 'description', e.target.value)
                      }
                      placeholder="e.g., Design homepage mockup"
                      className="w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-black"
                      disabled={isPending}
                    />
                  </div>

                  <div>
                    <label className="font-mono text-xs opacity-60 mb-1 block">
                      Amount (USDC):
                    </label>
                    <input
                      type="number"
                      value={milestone.amount}
                      onChange={(e) => updateMilestone(index, 'amount', e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-black"
                      disabled={isPending}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="mt-4 p-4 bg-gray-100 border-2 border-black">
            <div className="flex items-center justify-between">
              <p className="font-black text-sm uppercase">Total Amount:</p>
              <p className="font-black text-xl">${totalAmount.toFixed(2)} USDC</p>
            </div>
          </div>
        </div>

        {/* UMA Arbitration Option */}
        <div className="border-2 border-black p-4">
          <div className="flex items-start gap-3">
            <button
              onClick={() => setUseUMAArbitration(!useUMAArbitration)}
              className={`w-5 h-5 border-2 border-black flex-shrink-0 mt-0.5 ${
                useUMAArbitration ? 'bg-black' : 'bg-white'
              }`}
              disabled={isPending}
            >
              {useUMAArbitration && (
                <div className="text-white text-xs font-black">✓</div>
              )}
            </button>
            <div>
              <p className="font-bold text-sm uppercase">
                Use UMA Optimistic Oracle for Disputes
              </p>
              <p className="font-mono text-xs mt-1 opacity-80">
                Decentralized dispute resolution with economic security bonds.
                Client must stake 10 USDC to dispute. Resolution in 2-48 hours.
              </p>
              {useUMAArbitration && (
                <div className="mt-2 p-2 bg-blue-50 border-2 border-blue-600">
                  <p className="font-mono text-xs text-blue-900">
                    ⚡ <strong>ENABLED:</strong> Disputes will be resolved by UMA&apos;s
                    decentralized oracle network with a 10 USDC bond requirement.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4 border-t-2 border-black">
          <Button
            onClick={handleSubmit}
            disabled={isPending || !worker || milestones.some(m => !m.description || !m.amount)}
            isLoading={isPending}
            className="w-full"
          >
            {isPending ? 'CREATING GIG...' : 'CREATE GIG'}
          </Button>
          <p className="font-mono text-xs mt-2 text-center opacity-60">
            Funds will be escrowed until milestones are approved
          </p>
        </div>
      </div>
    </div>
  );
}
