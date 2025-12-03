'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';
import {
  useGetDispute,
  useGetVotes,
  useGetEvidences,
  useHasVoted,
  useVote,
  useFinalizeIfExpired,
} from '@/lib/contracts/simpleArbitrator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Hex } from 'viem';

interface ArbitratorCaseCardProps {
  caseId: Hex;
}

export function ArbitratorCaseCard({ caseId }: ArbitratorCaseCardProps) {
  const { address } = useAccount();
  const [clientBps, setClientBps] = useState('5000'); // Default 50/50 split
  const [showVoteForm, setShowVoteForm] = useState(false);

  // Fetch case data
  const { data: dispute, refetch: refetchDispute } = useGetDispute(caseId);
  const { data: votesData, refetch: refetchVotes } = useGetVotes(caseId);
  const votes = votesData as Array<{ arbitrator: string; clientBps: bigint }> | undefined;
  const { data: evidencesData } = useGetEvidences(caseId);
  const evidences = evidencesData as Array<{ submitter: string; timestamp: bigint; ipfsURI: string }> | undefined;
  const { data: hasVotedData } = useHasVoted(caseId, address || '0x');
  const hasVoted = hasVotedData as boolean | undefined;

  // Write hooks
  const { vote, isPending: isVoting } = useVote();
  const { finalizeIfExpired, isPending: isFinalizing } = useFinalizeIfExpired();

  if (!dispute) {
    return (
      <Card>
        <div className="p-6">
          <p className="font-mono text-xs text-black opacity-60">Loading case...</p>
        </div>
      </Card>
    );
  }

  const [
    bountyId,
    escrowContract,
    client,
    worker,
    amount,
    reason,
    createdAt,
    votingDeadline,
    status,
    appealed,
    finalClientBps,
  ] = dispute as [bigint, string, string, string, bigint, string, bigint, bigint, number, boolean, bigint];

  // Calculate time remaining
  const now = Math.floor(Date.now() / 1000);
  const deadline = Number(votingDeadline);
  const timeRemaining = deadline - now;
  const daysRemaining = Math.floor(timeRemaining / 86400);
  const hoursRemaining = Math.floor((timeRemaining % 86400) / 3600);
  const isExpired = timeRemaining <= 0;

  // Status labels
  const statusLabels = ['ACTIVE', 'RESOLVED', 'APPEALED'];
  const statusLabel = statusLabels[Number(status)] || 'UNKNOWN';

  // Handle vote submission
  const handleVote = async () => {
    const bps = parseInt(clientBps);
    if (isNaN(bps) || bps < 0 || bps > 10000) {
      toast.error('Please enter a valid percentage (0-100)');
      return;
    }

    try {
      await vote(caseId, BigInt(bps));
      toast.success('Vote submitted!');
      setShowVoteForm(false);
      setTimeout(() => {
        refetchDispute();
        refetchVotes();
      }, 2000);
    } catch (error) {
      console.error('Vote error:', error);
      toast.error('Failed to submit vote');
    }
  };

  // Handle finalize
  const handleFinalize = async () => {
    try {
      await finalizeIfExpired(caseId);
      toast.success('Dispute finalized!');
      setTimeout(() => refetchDispute(), 2000);
    } catch (error) {
      console.error('Finalize error:', error);
      toast.error('Failed to finalize dispute');
    }
  };

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="border-b-2 border-black bg-black text-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-lg uppercase tracking-tight">
              Case #{caseId.slice(0, 10)}...
            </h3>
            <p className="font-mono text-xs opacity-80">
              Bounty #{bountyId.toString()}
            </p>
          </div>
          <Badge variant={status === 0 ? 'default' : status === 1 ? 'warning' : 'error'}>
            {statusLabel}
          </Badge>
        </div>
      </div>

      {/* Case Details */}
      <div className="p-6 space-y-6">
        {/* Parties */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="font-mono text-xs uppercase tracking-wide text-black opacity-60">
              Client
            </label>
            <p className="font-mono text-xs break-all">{client}</p>
          </div>
          <div>
            <label className="font-mono text-xs uppercase tracking-wide text-black opacity-60">
              Worker
            </label>
            <p className="font-mono text-xs break-all">{worker}</p>
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="font-mono text-xs uppercase tracking-wide text-black opacity-60">
            Amount in Dispute
          </label>
          <p className="font-bold text-2xl">{(Number(amount) / 1e6).toFixed(2)} USDC</p>
        </div>

        {/* Reason */}
        <div>
          <label className="font-mono text-xs uppercase tracking-wide text-black opacity-60">
            Dispute Reason
          </label>
          <p className="font-mono text-sm mt-1">{reason}</p>
        </div>

        {/* Deadline */}
        <div>
          <label className="font-mono text-xs uppercase tracking-wide text-black opacity-60">
            Voting Deadline
          </label>
          <p className="font-bold text-lg">
            {isExpired ? (
              <span className="text-red-600">EXPIRED</span>
            ) : (
              `${daysRemaining}d ${hoursRemaining}h remaining`
            )}
          </p>
          <p className="font-mono text-xs opacity-60">
            {new Date(deadline * 1000).toLocaleString()}
          </p>
        </div>

        {/* Evidence */}
        {evidences && Array.isArray(evidences) && evidences.length > 0 && (
          <div>
            <label className="font-mono text-xs uppercase tracking-wide text-black opacity-60 mb-2 block">
              Evidence ({evidences.length})
            </label>
            <div className="space-y-2">
              {evidences.map((evidence: { submitter: string; timestamp: bigint; ipfsURI: string }, idx: number) => (
                <div key={idx} className="border-2 border-black p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs opacity-60">
                      Submitted by: {evidence.submitter.slice(0, 10)}...
                    </span>
                    <span className="font-mono text-xs opacity-60">
                      {new Date(Number(evidence.timestamp) * 1000).toLocaleDateString()}
                    </span>
                  </div>
                  <a
                    href={evidence.ipfsURI.replace('ipfs://', 'https://ipfs.io/ipfs/')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-blue-600 hover:underline break-all"
                  >
                    {evidence.ipfsURI}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Votes */}
        {votes && Array.isArray(votes) && votes.length > 0 && (
          <div>
            <label className="font-mono text-xs uppercase tracking-wide text-black opacity-60 mb-2 block">
              Votes ({votes.length}/2 required)
            </label>
            <div className="space-y-2">
              {votes.map((vote: { arbitrator: string; clientBps: bigint }, idx: number) => {
                const clientPercent = Number(vote.clientBps) / 100;
                const workerPercent = 100 - clientPercent;
                return (
                  <div key={idx} className="border-2 border-black p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs">
                        Arbitrator: {vote.arbitrator.slice(0, 10)}...
                      </span>
                      <span className="font-bold">
                        {clientPercent}% Client / {workerPercent}% Worker
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Vote Form */}
        {status === 0 && !isExpired && !hasVoted && address && (
          <div className="border-2 border-black p-4 space-y-4">
            {!showVoteForm ? (
              <Button onClick={() => setShowVoteForm(true)} className="w-full">
                CAST YOUR VOTE
              </Button>
            ) : (
              <>
                <div>
                  <label className="font-mono text-xs uppercase tracking-wide text-black mb-2 block">
                    Client Percentage (0-100%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={Number(clientBps) / 100}
                    onChange={(e) => setClientBps((parseFloat(e.target.value) * 100).toString())}
                    className="w-full h-12 border-2 border-black bg-white px-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                  <p className="font-mono text-xs opacity-60 mt-1">
                    Worker will receive: {100 - Number(clientBps) / 100}%
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowVoteForm(false)}
                    className="flex-1 h-12 border-2 border-black bg-white text-black hover:bg-black hover:text-white transition-colors duration-200 font-bold text-xs uppercase"
                  >
                    CANCEL
                  </button>
                  <Button
                    onClick={handleVote}
                    disabled={isVoting}
                    isLoading={isVoting}
                    className="flex-1 h-12"
                  >
                    SUBMIT VOTE
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Already Voted */}
        {hasVoted && status === 0 && (
          <div className="border-2 border-green-600 bg-green-50 p-4">
            <p className="font-mono text-xs">
              ✓ You have already voted on this case
            </p>
          </div>
        )}

        {/* Finalize Button */}
        {status === 0 && isExpired && votes && Array.isArray(votes) && votes.length >= 2 && (
          <Button
            onClick={handleFinalize}
            disabled={isFinalizing}
            isLoading={isFinalizing}
            className="w-full"
          >
            FINALIZE DISPUTE
          </Button>
        )}

        {/* Resolved Result */}
        {status === 1 && (
          <div className="border-2 border-black bg-gray-100 p-4">
            <label className="font-mono text-xs uppercase tracking-wide text-black opacity-60 mb-2 block">
              Final Decision
            </label>
            <p className="font-bold text-xl">
              Client: {Number(finalClientBps) / 100}% | Worker: {(10000 - Number(finalClientBps)) / 100}%
            </p>
          </div>
        )}

        {/* Appeal Notice */}
        {appealed && (
          <div className="border-2 border-orange-600 bg-orange-50 p-4">
            <p className="font-mono text-xs">
              ⚠️ This case has been appealed and is under re-voting
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
