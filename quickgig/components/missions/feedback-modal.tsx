'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/loader';

interface FeedbackModalProps {
  missionId: string;
  agentName: string;
  agentId: string; // ERC-8004 agent ID
  onSubmit: (rating: number, comment: string) => Promise<void>;
  onSkip: () => void;
}

export function FeedbackModal({ missionId, agentName, agentId, onSubmit, onSkip }: FeedbackModalProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      return; // Require at least 1 star
    }

    setIsSubmitting(true);
    try {
      await onSubmit(rating, comment);
    } finally {
      setIsSubmitting(false);
    }
  };

  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
      <div className="bg-white border-4 border-black p-6 sm:p-8 max-w-md w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-tight mb-2">
            RATE YOUR EXPERIENCE
          </h2>
          <p className="font-mono text-xs sm:text-sm text-black/60">
            How was your experience with <span className="font-bold">{agentName}</span>?
          </p>
        </div>

        {/* Star Rating */}
        <div className="mb-6">
          <div className="flex gap-2 justify-center mb-2">
            {stars.map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="text-4xl sm:text-5xl transition-all duration-200 hover:scale-110"
                disabled={isSubmitting}
              >
                {(hoveredRating >= star || rating >= star) ? '★' : '☆'}
              </button>
            ))}
          </div>
          <p className="text-center font-mono text-xs text-black/60">
            {rating === 0 && 'Click to rate'}
            {rating === 1 && 'Poor - Not satisfied'}
            {rating === 2 && 'Fair - Below expectations'}
            {rating === 3 && 'Good - Met expectations'}
            {rating === 4 && 'Very Good - Exceeded expectations'}
            {rating === 5 && 'Excellent - Outstanding!'}
          </p>
        </div>

        {/* Comment (Optional) */}
        <div className="mb-6">
          <label className="block font-mono text-xs uppercase mb-2 text-black/80">
            Feedback (Optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience..."
            className="w-full h-24 px-3 py-2 border-2 border-black font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black"
            disabled={isSubmitting}
            maxLength={500}
          />
          <p className="text-xs font-mono text-black/60 mt-1">
            {comment.length}/500 characters
          </p>
        </div>

        {/* Info */}
        <div className="mb-6 p-3 border-2 border-black/20 bg-black/5">
          <p className="font-mono text-xs text-black/80">
            [i] Your feedback will be stored on-chain via ERC-8004 Reputation Registry
          </p>
          <p className="font-mono text-xs text-black/60 mt-1">
            Agent ID: #{agentId}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={onSkip}
            variant="secondary"
            className="flex-1"
            disabled={isSubmitting}
          >
            SKIP
          </Button>
          <Button
            onClick={handleSubmit}
            className="flex-1"
            disabled={rating === 0 || isSubmitting}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <Loader size="sm" />
                SUBMITTING...
              </div>
            ) : (
              'SUBMIT RATING'
            )}
          </Button>
        </div>

        {/* On-chain notice */}
        <p className="text-center font-mono text-xs text-black/60 mt-4">
          This will create an on-chain transaction
        </p>
      </div>
    </div>
  );
}
