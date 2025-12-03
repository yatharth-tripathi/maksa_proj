'use client';

import { useEffect, useState } from 'react';
import { Loader, LoadingState } from '@/components/ui/loader';
import { Button } from '@/components/ui/button';
import { useGetResolution, useGetAssertionId, useGetDispute } from '@/lib/contracts/umaEscalationManager';
import { useResolveBountyUMADispute, useSettleAssertion } from '@/lib/contracts/bountyEscrow';
import { toast } from 'sonner';
import type { Hex } from 'viem';
import { useReadContract } from 'wagmi';
import { CONTRACTS } from '@/lib/contracts/addresses';

interface UMAResolutionDisplayProps {
  bountyId: bigint;
  onResolved?: () => void;
  onClose?: () => void;
}

// Minimal ABI for UMA Oracle getAssertion
const ORACLE_ABI = [
  {
    inputs: [{ name: 'assertionId', type: 'bytes32' }],
    name: 'getAssertion',
    outputs: [
      {
        components: [
          {
            components: [
              { name: 'arbitrateViaEscalationManager', type: 'bool' },
              { name: 'discardOracle', type: 'bool' },
              { name: 'validateDisputers', type: 'bool' },
              { name: 'assertingCaller', type: 'address' },
              { name: 'escalationManager', type: 'address' }
            ],
            name: 'escalationManagerSettings',
            type: 'tuple'
          },
          { name: 'asserter', type: 'address' },
          { name: 'assertionTime', type: 'uint64' },
          { name: 'settled', type: 'bool' },
          { name: 'currency', type: 'address' },
          { name: 'expirationTime', type: 'uint64' },
          { name: 'settlementResolution', type: 'bool' },
          { name: 'domainId', type: 'bytes32' },
          { name: 'identifier', type: 'bytes32' },
          { name: 'bond', type: 'uint256' },
          { name: 'callbackRecipient', type: 'address' },
          { name: 'disputer', type: 'address' }
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export function UMAResolutionDisplay({ bountyId, onResolved, onClose }: UMAResolutionDisplayProps) {
  const [isResolving, setIsResolving] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);

  // Get assertion ID for this bounty
  const { data: assertionId, refetch: refetchAssertionId } = useGetAssertionId(bountyId);

  // Get assertion details from UMA Oracle
  const { data: assertionData } = useReadContract({
    address: CONTRACTS.OPTIMISTIC_ORACLE_V3,
    abi: ORACLE_ABI,
    functionName: 'getAssertion',
    args: assertionId ? [assertionId as Hex] : undefined,
    query: {
      enabled: !!assertionId && assertionId !== '0x0000000000000000000000000000000000000000000000000000000000000000',
    },
  });

  // Get resolution status
  const { data: resolutionData, refetch: refetchResolution } = useGetResolution(bountyId);

  // Get dispute details
  const { data: disputeData, refetch: refetchDispute } = useGetDispute(
    (assertionId as Hex) || '0x0000000000000000000000000000000000000000000000000000000000000000'
  );

  // Resolve dispute hook
  const { resolveUMADispute, isPending: isResolvePending } = useResolveBountyUMADispute();

  // Settle assertion hook
  const { settleAssertion, isPending: isSettlePending } = useSettleAssertion();

  // Parse assertion data to get settled status
  const assertion = assertionData as {
    settled: boolean;
    expirationTime: bigint;
    disputer: string;
  } | undefined;
  const isSettled = assertion?.settled || false;
  const isDisputed = !!(assertion?.disputer && assertion.disputer !== '0x0000000000000000000000000000000000000000');

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

  // Copy assertion ID to clipboard
  const handleCopyAssertionId = () => {
    if (assertionId) {
      navigator.clipboard.writeText(assertionId as string);
      toast.success('Assertion ID copied!');
    }
  };

  // Calculate time remaining in challenge period - updates every second
  useEffect(() => {
    if (isResolved) {
      setTimeRemaining('');
      setIsExpired(false);
      return;
    }

    const updateTimer = () => {
      if (!assertionData) {
        setTimeRemaining('~2 hours');
        setIsExpired(false);
        return;
      }

      try {
        // Parse assertion data - UMA returns object with named properties
        const assertion = assertionData as {
          settled: boolean;
          expirationTime: bigint;
          disputer: string;
        } | undefined;

        if (!assertion || !assertion.expirationTime) {
          setTimeRemaining('~2 hours');
          setIsExpired(false);
          return;
        }

        const expirationTime = Number(assertion.expirationTime);
        const now = Math.floor(Date.now() / 1000); // Current time in seconds
        const secondsRemaining = expirationTime - now;

        // Add 30-second buffer to ensure blockchain time has definitely passed
        const SAFETY_BUFFER = 30;

        if (secondsRemaining <= -SAFETY_BUFFER) {
          setIsExpired(true);
          setTimeRemaining('Ready to settle');
          return;
        } else if (secondsRemaining <= 0) {
          setIsExpired(false);
          setTimeRemaining(`Finalizing... ${Math.abs(secondsRemaining)}s`);
          return;
        }

        // Not expired yet
        setIsExpired(false);

        // Format as "Xh Ym Zs" or "Ym Zs" or "Zs"
        const hours = Math.floor(secondsRemaining / 3600);
        const minutes = Math.floor((secondsRemaining % 3600) / 60);
        const seconds = secondsRemaining % 60;

        let formatted = '';
        if (hours > 0) {
          formatted = `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
          formatted = `${minutes}m ${seconds}s`;
        } else {
          formatted = `${seconds}s`;
        }

        setTimeRemaining(formatted);
      } catch (error) {
        console.error('Error parsing assertion data:', error);
        setTimeRemaining('~2 hours');
        setIsExpired(false);
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000); // Update every second
    return () => clearInterval(timer);
  }, [isResolved, assertionData]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetchAssertionId();
      refetchResolution();
      refetchDispute();
    }, 10000);

    return () => clearInterval(interval);
  }, [refetchAssertionId, refetchResolution, refetchDispute]);

  const handleSettle = async () => {
    if (!assertionId) {
      toast.error('No assertion ID found');
      return;
    }

    if (!assertion) {
      toast.error('Assertion data not loaded');
      return;
    }

    // Validate assertion can be settled
    if (assertion.settled) {
      toast.error('Assertion already settled');
      return;
    }

    // Check if disputed
    if (assertion.disputer && assertion.disputer !== '0x0000000000000000000000000000000000000000') {
      toast.error('Assertion was challenged! Waiting for UMA DVM to resolve. Cannot settle directly.');
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const expirationTime = Number(assertion.expirationTime);
    const SAFETY_BUFFER = 30; // 30 seconds after expiration

    const secondsRemaining = expirationTime - now;

    if (secondsRemaining > -SAFETY_BUFFER) {
      const waitTime = Math.max(0, secondsRemaining + SAFETY_BUFFER);
      toast.error(`Please wait ${waitTime} more seconds before settling to ensure blockchain time has passed.`);
      return;
    }

    try {
      setIsSettling(true);
      toast.info('Settling assertion on UMA Oracle...');
      console.log('Settling assertion:', {
        assertionId,
        bountyId,
        expirationTime: new Date(expirationTime * 1000).toISOString(),
        now: new Date(now * 1000).toISOString(),
        settled: assertion.settled,
        dispute: dispute,
      });

      // Don't await - let the transaction be sent and show success/failure properly
      settleAssertion(assertionId as `0x${string}`);

      // The success/failure will be shown by wagmi hooks
      // We'll refetch after some time
      setTimeout(() => {
        refetchResolution();
        refetchDispute();
      }, 5000);
    } catch (error) {
      console.error('Settlement error:', error);
      toast.error(`Settlement failed: ${error instanceof Error ? error.message : String(error)}`);
      setIsSettling(false);
    }
  };

  const handleResolve = async () => {
    try {
      setIsResolving(true);
      toast.info('Distributing funds based on UMA resolution...');
      await resolveUMADispute(bountyId);
      toast.success('Funds distributed successfully!');
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
    <div className="border-2 border-black bg-white max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 border-b-2 border-black">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="font-black text-sm uppercase">UMA DISPUTE STATUS</h3>
            <button
              onClick={handleCopyAssertionId}
              className="font-mono text-xs mt-1 opacity-90 hover:opacity-100 transition-opacity flex items-center gap-1 group"
              title="Click to copy"
            >
              <span>Assertion ID: {(assertionId as string).slice(0, 10)}...{(assertionId as string).slice(-8)}</span>
              <svg className="w-3 h-3 opacity-60 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Info Icon */}
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="w-8 h-8 border-2 border-white hover:bg-white hover:text-blue-600 transition-colors flex items-center justify-center"
              title="How it works"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="w-8 h-8 border-2 border-white hover:bg-white hover:text-blue-600 transition-colors flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Info Dropdown */}
        {showInfo && (
          <div className="mt-4 border-2 border-white p-3 bg-blue-600">
            <p className="font-mono text-xs leading-relaxed mb-2">
              <span className="font-bold text-white">How UMA Disputes Work:</span>
            </p>
            <ul className="font-mono text-xs space-y-1 opacity-90">
              <li>• <span className="font-bold">Step 1:</span> 2-hour challenge period (current)</li>
              <li>• <span className="font-bold">Step 2:</span> Click SETTLE when timer hits 0</li>
              <li>• <span className="font-bold">Step 3:</span> Click DISTRIBUTE FUNDS when resolved</li>
              <li>• If challenged → UMA votes to decide</li>
              <li>• Otherwise → Client&apos;s claim accepted</li>
            </ul>
          </div>
        )}

        {/* UMA Oracle Link */}
        <a
          href="https://sepolia.basescan.org/address/0x0F7fC5E6482f096380db6158f978167b57388deE#readContract"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 bg-white text-blue-600 px-3 py-2 border-2 border-white hover:bg-blue-50 transition-colors font-mono text-xs font-bold"
          title="View UMA Oracle contract - use assertion ID to query"
        >
          VIEW UMA ORACLE CONTRACT
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
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
              : isExpired && !isSettled
              ? 'border-orange-600 bg-orange-50'
              : 'border-yellow-600 bg-yellow-50'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-black text-lg ${
                isResolved
                  ? 'border-green-600 bg-green-600 text-white'
                  : isExpired && !isSettled
                  ? 'border-orange-600 bg-orange-600 text-white'
                  : 'border-yellow-600 bg-yellow-600 text-white'
              }`}>
                {isResolved ? '✓' : isExpired && !isSettled ? '⚡' : '⏳'}
              </div>
              <div>
                <p className="font-black text-sm uppercase">
                  {isResolved
                    ? 'RESOLVED'
                    : isExpired && !isSettled
                    ? 'READY TO SETTLE'
                    : 'CHALLENGE PERIOD ACTIVE'}
                </p>
                <p className="font-mono text-xs mt-1 opacity-80">
                  {isResolved
                    ? 'Dispute resolved by UMA'
                    : isExpired && !isSettled
                    ? 'No challenges received - Click SETTLE below'
                    : timeRemaining
                    ? `Ends in: ${timeRemaining}`
                    : 'Loading...'}
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

        {/* Settlement Button (when expired but not settled) */}
        {isExpired && !isSettled && !isResolved && assertion && (
          <div className="pt-4 border-t-2 border-black">
            {isDisputed ? (
              <>
                <div className="w-full bg-red-500 border-2 border-black p-4 text-white text-center">
                  <p className="font-black text-sm uppercase">⚠️ ASSERTION CHALLENGED</p>
                  <p className="font-mono text-xs mt-2">
                    This assertion was disputed by someone. Waiting for UMA DVM vote (48-72 hours).
                  </p>
                </div>
              </>
            ) : (
              <>
                <Button
                  onClick={handleSettle}
                  disabled={isSettling || isSettlePending || !assertion || assertion.settled || isDisputed}
                  isLoading={isSettling || isSettlePending}
                  className="w-full bg-orange-500 hover:bg-orange-600 border-2 border-black text-white"
                >
                  {isSettling || isSettlePending ? 'SETTLING...' : 'SETTLE ASSERTION'}
                </Button>
                <p className="font-mono text-xs mt-2 text-center opacity-60">
                  Challenge period ended with no challenges. Click to finalize the assertion.
                </p>
              </>
            )}
            <div className="font-mono text-xs mt-2 text-center opacity-40 space-y-1">
              <p>Debug: Expired={isExpired ? 'Yes' : 'No'}, Settled={assertion.settled ? 'Yes' : 'No'}</p>
              <p>Disputed: {isDisputed ? 'YES - Waiting for DVM' : 'No'}</p>
              <p>Disputer: {assertion.disputer?.slice(0, 10) || 'None'}</p>
              <p>Assertion ID: {(assertionId as string | undefined)?.slice(0, 20)}...</p>
              <p>Dispute registered: {dispute?.bountyId ? 'Yes' : 'No'}</p>
              <p>Dispute resolved in manager: {dispute?.resolved ? 'Yes' : 'No'}</p>
              <p>Expiry: {new Date(Number(assertion.expirationTime) * 1000).toLocaleString()}</p>
              <p>Time since expiry: {Math.floor(Date.now() / 1000 - Number(assertion.expirationTime))}s ago</p>
            </div>
          </div>
        )}

        {/* Distribution Button (when resolved) */}
        {isResolved && (
          <div className="pt-4 border-t-2 border-black">
            <Button
              onClick={handleResolve}
              disabled={isResolving || isResolvePending}
              isLoading={isResolving || isResolvePending}
              className="w-full bg-green-500 hover:bg-green-600 border-2 border-black text-white"
            >
              {isResolving || isResolvePending ? 'DISTRIBUTING...' : 'SETTLE & DISTRIBUTE FUNDS'}
            </Button>
            <p className="font-mono text-xs mt-2 text-center opacity-60">
              This will distribute funds according to the UMA resolution
            </p>
          </div>
        )}

        {/* Waiting Message (during active challenge period) */}
        {!isExpired && !isResolved && (
          <div className="pt-4 border-t-2 border-black text-center">
            <Loader size="md" />
            <p className="font-mono text-xs opacity-60">
              No action needed from you
              <br />
              {timeRemaining
                ? `Auto-resolves in ${timeRemaining} if no challenges`
                : 'Waiting for challenge period...'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
