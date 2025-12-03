'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSubmitFeedback } from '@/lib/erc8004/official-hooks';
import { useLookupAgentId } from '@/lib/erc8004/official-discovery';
import { toast } from 'sonner';
import type { Address } from 'viem';

interface RatingModalProps {
  workerAddress: Address;
  workerName?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RatingModal({
  workerAddress,
  workerName,
  onClose,
  onSuccess,
}: RatingModalProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedbackUri, setFeedbackUri] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { submitFeedback, isReady } = useSubmitFeedback();
  const { agentId, isLoading: isLoadingAgentId, hasAgentId } = useLookupAgentId(workerAddress);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    if (!isReady) {
      toast.error('Wallet not connected or client not ready');
      return;
    }

    if (!hasAgentId || !agentId) {
      toast.error('Worker has not registered in official ERC-8004 registry');
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert rating (1-5 stars) to score (0-100)
      const score = rating * 20;

      toast.info('Submitting rating to blockchain...');

      await submitFeedback(agentId, score, feedbackUri || undefined);

      toast.success('Rating submitted successfully!');

      if (onSuccess) {
        onSuccess();
      }

      onClose();
    } catch (error) {
      console.error('Failed to submit rating:', error);
      toast.error(`Failed to submit rating: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const stars = [1, 2, 3, 4, 5];
  const displayRating = hoveredRating || rating;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="border-4 border-black bg-white max-w-md w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b-4 border-black bg-black text-white p-3 sm:p-4 flex-shrink-0">
          <h2 className="font-black text-base sm:text-lg md:text-xl uppercase tracking-tight">
            RATE WORKER
          </h2>
          {workerName && (
            <p className="font-mono text-[10px] sm:text-xs opacity-80 mt-0.5 sm:mt-1">
              {workerName}
            </p>
          )}
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-5 md:space-y-6 overflow-y-auto flex-1">
          {/* Star Rating */}
          <div>
            <label className="font-bold text-[10px] sm:text-xs uppercase tracking-wide text-black block mb-2 sm:mb-3">
              YOUR RATING
            </label>
            <div className="flex items-center gap-1 sm:gap-2 justify-center mb-1.5 sm:mb-2">
              {stars.map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="text-4xl sm:text-5xl transition-all duration-200 md:hover:scale-110"
                  disabled={isSubmitting}
                >
                  {star <= displayRating ? '★' : '☆'}
                </button>
              ))}
            </div>
            <p className="text-center font-mono text-[10px] sm:text-xs opacity-60">
              {rating === 0 && 'Click to rate'}
              {rating === 1 && '1 star - Poor'}
              {rating === 2 && '2 stars - Fair'}
              {rating === 3 && '3 stars - Good'}
              {rating === 4 && '4 stars - Very Good'}
              {rating === 5 && '5 stars - Excellent'}
            </p>
          </div>

          {/* Feedback URI (Optional) */}
          <div>
            <label className="font-bold text-[10px] sm:text-xs uppercase tracking-wide text-black block mb-1.5 sm:mb-2">
              FEEDBACK LINK (OPTIONAL)
            </label>
            <Input
              value={feedbackUri}
              onChange={(e) => setFeedbackUri(e.target.value)}
              placeholder="https://... or ipfs://..."
              disabled={isSubmitting}
              className="text-[10px] sm:text-xs"
            />
            <p className="font-mono text-[10px] sm:text-xs opacity-60 mt-1.5 sm:mt-2">
              Link to detailed review (IPFS, GitHub, etc.)
            </p>
          </div>

          {/* Info Box */}
          {isLoadingAgentId && (
            <div className="border-2 border-black p-3 sm:p-4 bg-white">
              <p className="font-mono text-[10px] sm:text-xs text-black">
                <span className="font-bold">[...] LOOKING UP AGENT ID...</span>
              </p>
            </div>
          )}

          {!isLoadingAgentId && !hasAgentId && (
            <div className="border-2 border-black p-3 sm:p-4 bg-white">
              <p className="font-mono text-[10px] sm:text-xs text-black">
                <span className="font-bold">[!] WORKER NOT REGISTERED:</span> This worker has not registered in the official ERC-8004 registry. You cannot submit a cross-platform rating for them.
              </p>
            </div>
          )}

          {!isLoadingAgentId && hasAgentId && (
            <div className="border-2 border-black p-3 sm:p-4 bg-white">
              <p className="font-mono text-[10px] sm:text-xs text-black">
                <span className="font-bold">[i] ON-CHAIN RATING:</span> This rating will be permanently recorded in the official ERC-8004 reputation registry and will be visible across all platforms.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="border-t-4 border-black p-3 sm:p-4 flex gap-2 sm:gap-3 flex-shrink-0">
          <Button
            onClick={onClose}
            variant="outline"
            disabled={isSubmitting}
            className="flex-1 h-10 sm:h-11 md:h-12 text-[10px] sm:text-xs"
          >
            CANCEL
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || rating === 0 || !isReady || isLoadingAgentId || !hasAgentId}
            isLoading={isSubmitting}
            className="flex-1 h-10 sm:h-11 md:h-12 text-[10px] sm:text-xs"
          >
            {isSubmitting ? 'SUBMITTING...' : isLoadingAgentId ? 'LOADING...' : 'SUBMIT RATING'}
          </Button>
        </div>
      </div>
    </div>
  );
}
