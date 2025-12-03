'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface GigCreationFormProps {
  prefilled?: {
    description?: string;
  };
}

interface Milestone {
  description: string;
  amount: string;
}

export function GigCreationForm({ prefilled }: GigCreationFormProps) {
  const router = useRouter();
  const [workerAddress, setWorkerAddress] = useState('');
  const [milestones, setMilestones] = useState<Milestone[]>([
    { description: prefilled?.description || '', amount: '' },
  ]);

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

  const handleNavigateToFull = () => {
    // Navigate to the full gig creation page
    router.push('/gigs/create');
  };

  const isValid = workerAddress.trim().startsWith('0x') &&
                  milestones.every(m => m.description.trim() && m.amount && parseFloat(m.amount) > 0);

  return (
    <div className="border-2 border-black bg-white max-w-2xl">
      {/* Header */}
      <div className="bg-black text-white p-3 sm:p-4 border-b-2 border-black">
        <h3 className="font-black text-sm sm:text-base uppercase">
          MILESTONE CONTRACT
        </h3>
        <p className="font-mono text-[10px] sm:text-xs mt-0.5 sm:mt-1 opacity-80">
          Create multi-stage work with escrow protection
        </p>
      </div>

      <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
        {/* Worker Address */}
        <div>
          <label className="font-bold text-[10px] sm:text-xs uppercase tracking-wide mb-1.5 sm:mb-2 block">
            WORKER ADDRESS: <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={workerAddress}
            onChange={(e) => setWorkerAddress(e.target.value)}
            placeholder="0x..."
            className="w-full border-2 border-black bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 font-mono text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
          <p className="font-mono text-[10px] sm:text-xs mt-1 opacity-60">
            Ethereum address of the worker who will complete the milestones
          </p>
        </div>

        {/* Milestones */}
        <div>
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <label className="font-bold text-[10px] sm:text-xs uppercase tracking-wide">
              MILESTONES: <span className="text-red-600">*</span>
            </label>
            <Button
              onClick={addMilestone}
              variant="outline"
              size="sm"
              className="h-8 sm:h-9 text-[10px] sm:text-xs px-2 sm:px-3"
            >
              + ADD
            </Button>
          </div>

          <div className="space-y-2 sm:space-y-3">
            {milestones.map((milestone, index) => (
              <div key={index} className="border-2 border-black p-3 sm:p-4 bg-gray-50">
                <div className="flex items-start justify-between mb-1.5 sm:mb-2">
                  <span className="font-bold text-[10px] sm:text-xs uppercase">
                    Milestone {index + 1}
                  </span>
                  {milestones.length > 1 && (
                    <button
                      onClick={() => removeMilestone(index)}
                      className="text-[10px] sm:text-xs font-bold uppercase text-red-600 md:hover:underline"
                    >
                      REMOVE
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  value={milestone.description}
                  onChange={(e) => updateMilestone(index, 'description', e.target.value)}
                  placeholder="Milestone description..."
                  className="w-full border-2 border-black bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 font-mono text-xs sm:text-sm mb-1.5 sm:mb-2 focus:outline-none focus:ring-2 focus:ring-black"
                />

                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-base sm:text-lg font-black">$</span>
                  <input
                    type="number"
                    value={milestone.amount}
                    onChange={(e) => updateMilestone(index, 'amount', e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="flex-1 border-2 border-black bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 font-black text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-black"
                  />
                  <span className="font-bold text-[10px] sm:text-xs uppercase">USDC</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Total Amount */}
        <div className="border-2 border-black p-3 sm:p-4 bg-black text-white">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[10px] sm:text-xs uppercase tracking-wide">
              TOTAL CONTRACT VALUE:
            </span>
            <span className="font-black text-xl sm:text-2xl">
              ${totalAmount.toFixed(2)} USDC
            </span>
          </div>
        </div>

        {/* Info Box */}
        <div className="border-2 border-black p-3 sm:p-4 bg-white">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-black flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-black"></div>
            </div>
            <div>
              <p className="font-mono text-[10px] sm:text-xs leading-relaxed">
                <strong>How it works:</strong> Your USDC is locked in escrow. Worker completes each milestone,
                you approve, and payment is released stage by stage. UMA arbitration optional for disputes.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
          <Button
            onClick={handleNavigateToFull}
            className="flex-1 h-10 sm:h-11 md:h-12 text-[10px] sm:text-xs"
          >
            CONTINUE TO FULL FORM
          </Button>
          <Link href="/gigs" className="flex-1">
            <Button variant="outline" className="w-full h-10 sm:h-11 md:h-12 text-[10px] sm:text-xs">
              VIEW EXISTING CONTRACTS
            </Button>
          </Link>
        </div>

        <p className="text-[10px] sm:text-xs font-mono opacity-60 text-center">
          Complete the full form to deploy your milestone contract on-chain
        </p>
      </div>
    </div>
  );
}
