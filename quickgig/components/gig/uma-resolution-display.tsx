'use client';

import { useEffect, useState } from 'react';
import { Loader, LoadingState } from '@/components/ui/loader';
import { Button } from '@/components/ui/button';
import { useGetResolution, useGetAssertionId, useGetDispute } from '@/lib/contracts/umaEscalationManager';
import { useResolveGigUMADispute } from '@/lib/contracts/gigEscrow';
import { toast } from 'sonner';
import type { Hex } from 'viem';

interface UMAResolutionDisplayProps {
  gigId: bigint;
  milestoneIndex: bigint;
  onResolved?: () => void;
}

export function UMAResolutionDisplay({ gigId, milestoneIndex, onResolved }: UMAResolutionDisplayProps) {
  const [isResolving, setIsResolving] = useState(false);

  // Note: For gigs, we need to track assertion IDs per milestone
  // This requires reading the umaAssertionIds mapping: umaAssertionIds[gigId][milestoneIndex]
  // For now, we'll use a simplified approach - you may need to add a getter function to the contract

  // Get assertion ID for this gig milestone (simplified - may need contract update)
  const { data: assertionId, refetch: refetchAssertionId } = useGetAssertionId(gigId);

  // Get resolution status
  const { data: resolutionData, refetch: refetchResolution } = useGetResolution(gigId);

  // Get dispute details
  const { data: disputeData, refetch: refetchDispute } = useGetDispute(
    (assertionId as Hex) || '0x0000000000000000000000000000000000000000000000000000000000000000'
  );

  // Resolve dispute hook
  const { resolveUMADispute, isPending: isResolvePending } = useResolveGigUMADispute();

  // Parse resolution data
  const resolution = resolutionData as [boolean, bigint, bigint] | undefined;
  const isResolved = resolution?.[0] || false;
  const clientBps = resolution?.[1] || 0n;
  const workerBps = resolution?.[2] || 0n;

  // Parse dispute data
  const dispute = disputeData as {
    bountyId: bigint;
    client: string;
    worker: string;
    amount: bigint;
    assertionId: Hex;
    resolved: boolean;
    clientWon: boolean;
  } | undefined;

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetchAssertionId();
      refetchResolution();
      refetchDispute();
    }, 10000);

    return () => clearInterval(interval);
  }, [refetchAssertionId, refetchResolution, refetchDispute]);

  const handleResolve = async () => {
    try {
      setIsResolving(true);
      toast.info('Settling UMA dispute...');
      await resolveUMADispute(gigId, milestoneIndex);
      toast.success('UMA dispute resolved and funds distributed!');
      onResolved?.();
    } catch (error) {
      console.error('Resolution error:', error);
      toast.error(`Failed to resolve: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsResolving(false);
    }
  };

  if (!assertionId || assertionId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    return null;
  }

  return (
    <div className="border-2 border-black bg-white">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 border-b-2 border-black">
        <h3 className="font-black text-sm uppercase">UMA DISPUTE STATUS</h3>
        <p className="font-mono text-xs mt-1 opacity-90">
          Milestone {Number(milestoneIndex) + 1} - Assertion ID: {(assertionId as string).slice(0, 10)}...{(assertionId as string).slice(-8)}
        </p>
      </div>

      <div className="p-6 space-y-4">
        {/* Current Status */}
        <div>
          <p className="font-bold text-xs uppercase tracking-wide mb-2 opacity-60">
            CURRENT STATUS:
          </p>
          <div className={`p-4 border-2 ${
            isResolved
              ? 'border-green-600 bg-green-50'
              : 'border-yellow-600 bg-yellow-50'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-black text-lg ${
                isResolved
                  ? 'border-green-600 bg-green-600 text-white'
                  : 'border-yellow-600 bg-yellow-600 text-white'
              }`}>
                {isResolved ? '✓' : '⏳'}
              </div>
              <div>
                <p className="font-black text-sm uppercase">
                  {isResolved ? 'RESOLVED' : 'CHALLENGE PERIOD ACTIVE'}
                </p>
                <p className="font-mono text-xs mt-1 opacity-80">
                  {isResolved
                    ? 'Dispute has been resolved by UMA'
                    : 'Waiting for challenge period to expire or challenge'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Resolution Details (if resolved) */}
        {isResolved && (
          <div className="border-2 border-black p-4">
            <p className="font-bold text-xs uppercase tracking-wide mb-3 opacity-60">
              RESOLUTION:
            </p>

            <div className="space-y-3">
              {/* Winner */}
              <div>
                <p className="font-mono text-xs opacity-60">Winner:</p>
                <p className="font-black text-lg">
                  {clientBps > workerBps ? 'CLIENT' : 'WORKER'}
                </p>
              </div>

              {/* Fund Distribution */}
              <div className="grid grid-cols-2 gap-4 pt-3 border-t-2 border-black">
                <div>
                  <p className="font-mono text-xs opacity-60">Client Share:</p>
                  <p className="font-black text-xl">{(Number(clientBps) / 100).toFixed(0)}%</p>
                </div>
                <div>
                  <p className="font-mono text-xs opacity-60">Worker Share:</p>
                  <p className="font-black text-xl">{(Number(workerBps) / 100).toFixed(0)}%</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dispute Details */}
        {dispute && (
          <div className="border-2 border-black p-4">
            <p className="font-bold text-xs uppercase tracking-wide mb-2 opacity-60">
              DISPUTE DETAILS:
            </p>
            <div className="space-y-2 font-mono text-xs">
              <div>
                <span className="opacity-60">Client: </span>
                <span className="font-bold">{dispute.client.slice(0, 6)}...{dispute.client.slice(-4)}</span>
              </div>
              <div>
                <span className="opacity-60">Worker: </span>
                <span className="font-bold">{dispute.worker.slice(0, 6)}...{dispute.worker.slice(-4)}</span>
              </div>
              <div>
                <span className="opacity-60">Amount: </span>
                <span className="font-bold">${(Number(dispute.amount) / 1_000_000).toFixed(2)} USDC</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        {isResolved && (
          <div className="pt-4 border-t-2 border-black">
            <Button
              onClick={handleResolve}
              disabled={isResolving || isResolvePending}
              isLoading={isResolving || isResolvePending}
              className="w-full"
            >
              {isResolving || isResolvePending ? 'SETTLING...' : 'SETTLE & DISTRIBUTE FUNDS'}
            </Button>
            <p className="font-mono text-xs mt-2 text-center opacity-60">
              This will distribute funds according to the UMA resolution
            </p>
          </div>
        )}

        {/* Waiting Message */}
        {!isResolved && (
          <div className="pt-4 border-t-2 border-black text-center">
            <Loader size="md" />
            <p className="font-mono text-xs opacity-60">
              Waiting for challenge period to expire or for worker to challenge...
              <br />
              Check back in a few hours or wait for notification
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
