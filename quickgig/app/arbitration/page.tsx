'use client';

import { useState, useEffect } from 'react';
import { useAccount, useBlockNumber, useReadContract } from 'wagmi';
import { useRouter } from 'next/navigation';
import { ArbitratorCaseCard } from '@/components/arbitration/ArbitratorCaseCard';
import { useIsArbitrator, useWatchDisputeCreated } from '@/lib/contracts/simpleArbitrator';
import { toast } from 'sonner';
import type { Hex } from 'viem';

export default function ArbitrationPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [caseIds, setCaseIds] = useState<Hex[]>([]);
  const [mounted, setMounted] = useState(false);

  // Check if user is an arbitrator
  const { data: isArbitrator, isLoading: checkingArbitrator } = useIsArbitrator(address || '0x');

  // Mount check for hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Access control
  useEffect(() => {
    if (mounted && !isConnected) {
      toast.error('Please connect your wallet');
      router.push('/');
    }
  }, [mounted, isConnected, router]);

  useEffect(() => {
    if (mounted && isConnected && !checkingArbitrator && !isArbitrator) {
      toast.error('Access denied: You are not an authorized arbitrator');
      router.push('/');
    }
  }, [mounted, isConnected, isArbitrator, checkingArbitrator, router]);

  // Watch for new disputes
  useWatchDisputeCreated((logs) => {
    logs.forEach((log) => {
      const typedLog = log as unknown as { args?: { caseId?: Hex } };
      const caseId = typedLog.args?.caseId;
      if (caseId && !caseIds.includes(caseId)) {
        setCaseIds((prev) => [...prev, caseId]);
        toast.success('New dispute case created!');
      }
    });
  });

  // Load initial cases from events (in production, use indexer or subgraph)
  // For MVP, we'll need to manually add case IDs or track them via events

  if (!mounted || checkingArbitrator) {
    return (
      <div className="min-h-screen bg-white">
        <div className="border-b-2 border-black">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <h1 className="font-black text-4xl uppercase tracking-tight">
              ARBITRATION DASHBOARD
            </h1>
            <p className="font-mono text-xs uppercase text-black opacity-60 mt-2">
              LOADING...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isConnected || !isArbitrator) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b-2 border-black">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-black text-4xl uppercase tracking-tight">
                ARBITRATION DASHBOARD
              </h1>
              <p className="font-mono text-xs uppercase text-black opacity-60 mt-2">
                Review and vote on dispute cases
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-xs uppercase text-black opacity-60">
                Arbitrator
              </p>
              <p className="font-mono text-xs">{address?.slice(0, 10)}...</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="border-2 border-black p-6">
            <p className="font-mono text-xs uppercase text-black opacity-60">
              Total Cases
            </p>
            <p className="font-black text-3xl mt-2">{caseIds.length}</p>
          </div>
          <div className="border-2 border-black p-6">
            <p className="font-mono text-xs uppercase text-black opacity-60">
              Your Role
            </p>
            <p className="font-bold text-xl mt-2">ARBITRATOR</p>
          </div>
          <div className="border-2 border-black p-6">
            <p className="font-mono text-xs uppercase text-black opacity-60">
              Voting Power
            </p>
            <p className="font-bold text-xl mt-2">1 of 3</p>
          </div>
        </div>

        {/* Cases */}
        <div>
          <h2 className="font-black text-2xl uppercase tracking-tight mb-6">
            ACTIVE CASES
          </h2>

          {caseIds.length === 0 ? (
            <div className="border-2 border-black p-12 text-center">
              <p className="font-mono text-sm text-black opacity-60">
                No dispute cases yet. Cases will appear here when disputes are created.
              </p>
              <p className="font-mono text-xs text-black opacity-40 mt-4">
                Note: In production, this would query past events or use an indexer to load all cases.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {caseIds.map((caseId) => (
                <ArbitratorCaseCard key={caseId} caseId={caseId} />
              ))}
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-12 border-2 border-black p-6 bg-gray-50">
          <h3 className="font-black text-lg uppercase mb-4">HOW ARBITRATION WORKS</h3>
          <ul className="space-y-2 font-mono text-xs">
            <li>• Cases require 2 of 3 arbitrators to vote for quorum</li>
            <li>• You have 7 days to cast your vote from case creation</li>
            <li>• Vote using basis points: 0-100% split between client and worker</li>
            <li>• Review all evidence before voting</li>
            <li>• The final decision is the average of all votes</li>
            <li>• Parties can appeal once with new evidence</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
