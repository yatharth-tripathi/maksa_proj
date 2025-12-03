'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/lib/store/chat';

interface BountyCreationFormProps {
  prefilled?: {
    description?: string;
    amount?: string;
  };
}

export function BountyCreationForm({ prefilled }: BountyCreationFormProps) {
  const { addMessage, setBountyFormData } = useChatStore();
  const [description, setDescription] = useState(prefilled?.description || '');
  const [amount, setAmount] = useState(prefilled?.amount || '');
  const [deadline, setDeadline] = useState('7');
  const [tags, setTags] = useState<string[]>([]);
  const [useUMAArbitration, setUseUMAArbitration] = useState(false);

  const availableTags = ['Design', 'Development', 'Marketing', 'Writing', 'Other'];

  const toggleTag = (tag: string) => {
    setTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = () => {
    const bountyData = {
      description,
      amount,
      deadline,
      tags,
      useUMAArbitration,
    };

    // Save to store
    setBountyFormData(bountyData);

    // Add confirmation message with action metadata
    addMessage({
      role: 'assistant',
      content: 'Ready to deploy your mission. Please confirm details:',
      metadata: {
        action: {
          type: 'bounty_confirmation',
          data: bountyData,
        },
      },
    });
  };

  const isValid = description.trim() && amount && parseFloat(amount) > 0;

  return (
    <div className="border-2 border-black bg-white max-w-2xl">
      {/* Form */}
      <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
        {/* Description */}
        <div>
          <label className="font-bold text-[10px] sm:text-xs uppercase tracking-wide mb-1.5 sm:mb-2 block">
            MISSION OBJECTIVE:
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what you need done. Be specific about deliverables and requirements..."
            className="w-full h-28 sm:h-32 border-2 border-black bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 font-mono text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
          />
        </div>

        {/* Amount */}
        <div>
          <label className="font-bold text-[10px] sm:text-xs uppercase tracking-wide mb-1.5 sm:mb-2 block">
            REWARD (USDC):
          </label>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-lg sm:text-xl font-black">$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="10"
              step="0.01"
              min="0"
              className="flex-1 border-2 border-black bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 font-black text-lg sm:text-xl focus:outline-none focus:ring-2 focus:ring-black"
            />
            <span className="font-bold text-[10px] sm:text-xs uppercase">USDC</span>
          </div>
        </div>

        {/* Deadline */}
        <div>
          <label className="font-bold text-[10px] sm:text-xs uppercase tracking-wide mb-1.5 sm:mb-2 block">
            DEADLINE:
          </label>
          <div className="flex gap-1.5 sm:gap-2">
            {['3', '7', '14', '30'].map((days) => (
              <button
                key={days}
                onClick={() => setDeadline(days)}
                className={`flex-1 px-2 sm:px-3 py-1.5 sm:py-2 border-2 border-black font-bold text-[10px] sm:text-xs uppercase transition-all ${
                  deadline === days
                    ? 'bg-black text-white'
                    : 'bg-white text-black md:hover:bg-black md:hover:text-white'
                }`}
              >
                {days}D
              </button>
            ))}
          </div>
          <p className="font-mono text-[10px] sm:text-xs mt-1.5 sm:mt-2 opacity-60">
            {new Date(Date.now() + parseInt(deadline) * 24 * 60 * 60 * 1000).toLocaleDateString()}
          </p>
        </div>

        {/* Tags (optional) */}
        <div>
          <label className="font-bold text-[10px] sm:text-xs uppercase tracking-wide mb-1.5 sm:mb-2 block">
            TAGS (OPTIONAL):
          </label>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {availableTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2 sm:px-3 py-0.5 sm:py-1 border-2 border-black font-mono text-[10px] sm:text-xs uppercase transition-all ${
                  tags.includes(tag)
                    ? 'bg-black text-white'
                    : 'bg-white text-black md:hover:bg-black md:hover:text-white'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* UMA Arbitration Option */}
        <div>
          <label className="font-bold text-[10px] sm:text-xs uppercase tracking-wide mb-1.5 sm:mb-2 block">
            DISPUTE RESOLUTION:
          </label>
          <button
            type="button"
            onClick={() => setUseUMAArbitration(!useUMAArbitration)}
            className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-black font-mono text-xs sm:text-sm text-left transition-all ${
              useUMAArbitration
                ? 'bg-black text-white'
                : 'bg-white text-black md:hover:bg-gray-50'
            }`}
          >
            <div className="flex items-start gap-2 sm:gap-3">
              <div className={`w-4 h-4 sm:w-5 sm:h-5 border-2 border-current flex items-center justify-center mt-0.5 flex-shrink-0 ${
                useUMAArbitration ? 'bg-white' : ''
              }`}>
                {useUMAArbitration && (
                  <span className="text-black text-[10px] sm:text-xs font-black">✓</span>
                )}
              </div>
              <div>
                <div className="font-bold text-xs sm:text-sm">Use UMA Optimistic Oracle</div>
                <div className="text-[10px] sm:text-xs mt-0.5 sm:mt-1 opacity-80">
                  Decentralized dispute resolution with economic security bonds.
                  {' '}Recommended for high-value missions.
                </div>
              </div>
            </div>
          </button>
          <p className="font-mono text-[10px] sm:text-xs mt-1.5 sm:mt-2 opacity-60">
            {useUMAArbitration ? 'UMA: Challenge period applies, DVM voting if disputed' : 'Default: Multi-signature arbitration panel'}
          </p>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={!isValid}
          className="w-full h-10 sm:h-11 md:h-12 text-[10px] sm:text-xs mt-3 sm:mt-4"
        >
          REVIEW MISSION
        </Button>
      </div>
    </div>
  );
}
