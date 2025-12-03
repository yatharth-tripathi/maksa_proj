'use client';

import { useState, useEffect } from 'react';
import { Loader, LoadingState } from '@/components/ui/loader';
import { useAccount } from 'wagmi';
import { useParams } from 'next/navigation';
import { useGetGig, useGetMilestone, useGetMilestoneCount } from '@/lib/contracts/gigEscrow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UMADisputeForm } from '@/components/gig/uma-dispute-form';
import { UMAResolutionDisplay } from '@/components/gig/uma-resolution-display';
import { Header } from '@/components/layout/header';

enum MilestoneStatus {
  Pending,
  Submitted,
  Approved,
  Disputed,
  AutoReleased,
  Resolved,
}

enum GigStatus {
  Active,
  Completed,
  Cancelled,
}

export default function GigDetailPage() {
  const params = useParams();
  const gigId = BigInt(params.id as string);
  const { address } = useAccount();

  const [showUMADispute, setShowUMADispute] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<number | null>(null);

  // Fetch gig data
  const { data: gigData, refetch: refetchGig } = useGetGig(gigId);
  const { data: milestoneCount } = useGetMilestoneCount(gigId);

  // Parse gig data (viem returns struct as object with named properties)
  const gig = gigData as unknown as {
    client: string;
    worker: string;
    paymentToken: string;
    totalAmount: bigint;
    releasedAmount: bigint;
    createdAt: bigint;
    status: number;
    milestones: Array<{
      description: string;
      amount: bigint;
      submittedAt: bigint;
      deliverableURI: string;
      status: number;
    }>;
    useUMAArbitration: boolean;
  } | undefined;

  const client = gig?.client;
  const worker = gig?.worker;
  const paymentToken = gig?.paymentToken;
  const totalAmount = gig?.totalAmount ?? 0n;
  const releasedAmount = gig?.releasedAmount ?? 0n;
  const createdAt = gig?.createdAt ?? 0n;
  const status = gig?.status ?? 0;
  const useUMAArbitration = gig?.useUMAArbitration ?? false;
  const milestones = gig?.milestones || [];

  const isClient = address === client;
  const isWorker = address === worker;

  const handleDisputeMilestone = (milestoneIndex: number) => {
    setSelectedMilestone(milestoneIndex);
    setShowUMADispute(true);
  };

  const handleDisputeSuccess = () => {
    setShowUMADispute(false);
    refetchGig();
  };

  if (!gig) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <LoadingState size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h1 className="font-black text-4xl uppercase">
              GIG #{gigId.toString()}
            </h1>
            <Badge variant={status === GigStatus.Active ? 'default' : 'outline'}>
              {GigStatus[status]}
            </Badge>
            {useUMAArbitration && (
              <Badge variant="outline" className="border-blue-600 text-blue-600">
                UMA ORACLE
              </Badge>
            )}
          </div>
          <p className="font-mono text-sm opacity-60">
            Arbitration: {useUMAArbitration ? 'UMA Optimistic Oracle' : 'Standard Disputes'}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="border-2 border-black p-6 bg-gray-50">
            <p className="font-mono text-xs uppercase opacity-60 mb-1">Total Value</p>
            <p className="font-black text-3xl">
              ${((Number(totalAmount) || 0) / 1_000_000).toFixed(2)}
            </p>
          </div>
          <div className="border-2 border-black p-6 bg-gray-50">
            <p className="font-mono text-xs uppercase opacity-60 mb-1">Released</p>
            <p className="font-black text-3xl">
              ${((Number(releasedAmount) || 0) / 1_000_000).toFixed(2)}
            </p>
          </div>
          <div className="border-2 border-black p-6 bg-gray-50">
            <p className="font-mono text-xs uppercase opacity-60 mb-1">Remaining</p>
            <p className="font-black text-3xl">
              ${((Number(totalAmount - releasedAmount) || 0) / 1_000_000).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="border-2 border-black p-6">
            <p className="font-mono text-xs uppercase opacity-60 mb-2">Client</p>
            <p className="font-mono text-sm font-bold mb-1">
              {client?.slice(0, 6)}...{client?.slice(-4)}
            </p>
            {isClient && (
              <Badge variant="default" className="mt-2">YOU</Badge>
            )}
          </div>
          <div className="border-2 border-black p-6">
            <p className="font-mono text-xs uppercase opacity-60 mb-2">Worker</p>
            <p className="font-mono text-sm font-bold mb-1">
              {worker?.slice(0, 6)}...{worker?.slice(-4)}
            </p>
            {isWorker && (
              <Badge variant="default" className="mt-2">YOU</Badge>
            )}
          </div>
        </div>

        {/* Milestones */}
        <div className="mb-8">
          <h2 className="font-black text-2xl uppercase mb-4">MILESTONES</h2>

          <div className="space-y-4">
            {milestoneCount ? (
              Array.from({ length: Number(milestoneCount) }).map((_, index) => (
                <MilestoneCard
                  key={index}
                  gigId={gigId}
                  milestoneIndex={index}
                  isClient={isClient}
                  isWorker={isWorker}
                  useUMAArbitration={useUMAArbitration}
                  paymentToken={paymentToken as `0x${string}`}
                  onDisputeClick={() => handleDisputeMilestone(index)}
                />
              ))
            ) : null}
          </div>
        </div>

        {/* UMA Dispute Form Modal */}
        {showUMADispute && selectedMilestone !== null && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="max-w-2xl w-full">
              <UMADisputeForm
                gigId={gigId}
                milestoneIndex={BigInt(selectedMilestone)}
                paymentToken={paymentToken as `0x${string}`}
                onSuccess={handleDisputeSuccess}
                onCancel={() => setShowUMADispute(false)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Milestone Card Component
function MilestoneCard({
  gigId,
  milestoneIndex,
  isClient,
  isWorker,
  useUMAArbitration,
  paymentToken,
  onDisputeClick,
}: {
  gigId: bigint;
  milestoneIndex: number;
  isClient: boolean;
  isWorker: boolean;
  useUMAArbitration: boolean;
  paymentToken: `0x${string}`;
  onDisputeClick: () => void;
}) {
  const { data: milestoneData } = useGetMilestone(gigId, BigInt(milestoneIndex));

  // Parse milestone data (viem returns struct as object with named properties)
  const milestone = milestoneData as unknown as {
    description: string;
    amount: bigint;
    submittedAt: bigint;
    deliverableURI: string;
    status: number;
  } | undefined;

  const description = milestone?.description;
  const amount = milestone?.amount;
  const status = milestone?.status as MilestoneStatus;
  const deliverableURI = milestone?.deliverableURI;

  const statusColors: Record<MilestoneStatus, string> = {
    [MilestoneStatus.Pending]: 'border-gray-400 bg-gray-50',
    [MilestoneStatus.Submitted]: 'border-blue-600 bg-blue-50',
    [MilestoneStatus.Approved]: 'border-green-600 bg-green-50',
    [MilestoneStatus.Disputed]: 'border-red-600 bg-red-50',
    [MilestoneStatus.AutoReleased]: 'border-purple-600 bg-purple-50',
    [MilestoneStatus.Resolved]: 'border-green-600 bg-green-50',
  };

  return (
    <div className={`border-2 ${statusColors[status]} p-6`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-black text-lg uppercase mb-1">
            MILESTONE {milestoneIndex + 1}
          </h3>
          <p className="font-mono text-sm mb-2">{description}</p>
          <Badge variant="outline">{MilestoneStatus[status]}</Badge>
        </div>
        <div className="text-right">
          <p className="font-mono text-xs opacity-60 mb-1">Amount</p>
          <p className="font-black text-2xl">
            ${((Number(amount) || 0) / 1_000_000).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Deliverable */}
      {deliverableURI && status !== MilestoneStatus.Pending && (
        <div className="mb-4 p-3 border-2 border-black bg-white">
          <p className="font-mono text-xs opacity-60 mb-1">Deliverable:</p>
          <a
            href={deliverableURI}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-sm text-blue-600 hover:underline break-all"
          >
            {deliverableURI}
          </a>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t-2 border-black">
        {status === MilestoneStatus.Pending && isWorker && (
          <Button size="sm">SUBMIT DELIVERABLE</Button>
        )}

        {status === MilestoneStatus.Submitted && isClient && (
          <>
            <Button size="sm">APPROVE</Button>
            {useUMAArbitration ? (
              <Button variant="outline" size="sm" onClick={onDisputeClick}>
                CREATE UMA DISPUTE
              </Button>
            ) : (
              <Button variant="outline" size="sm">
                DISPUTE
              </Button>
            )}
          </>
        )}

        {status === MilestoneStatus.Disputed && useUMAArbitration && (
          <UMAResolutionDisplay
            gigId={gigId}
            milestoneIndex={BigInt(milestoneIndex)}
            onResolved={() => {}}
          />
        )}
      </div>
    </div>
  );
}
