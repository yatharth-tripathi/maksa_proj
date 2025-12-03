'use client';

import { use, useState, useEffect } from 'react';
import { Loader, LoadingState } from '@/components/ui/loader';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAccount, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import type { Address } from 'viem';
import { CONTRACTS } from '@/lib/contracts/addresses';
import {
  useGetBounty,
  useGetBidCount,
  useGetActiveBids,
  useSubmitBid,
  useAssignWorker,
  useSubmitDeliverable,
  useApproveDeliverable,
  useDisputeDeliverableWithUMA
} from '@/lib/contracts/bountyEscrow';
import { useOfficialReputation } from '@/lib/erc8004/official-discovery';
import { formatAddress, formatRelativeTime } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UMADisputeForm } from '@/components/bounty/uma-dispute-form';
import { UMAResolutionDisplay } from '@/components/bounty/uma-resolution-display';

interface BountyData {
  client: string;
  paymentToken: string;
  escrowAmount: bigint;
  status: number;
  assignedWorker: string;
  assignedBidAmount: bigint;
  createdAt: bigint;
  deadline: bigint;
  requirementsURI: string;
  submittedAt: bigint;
  deliverableURI: string;
  useUMAArbitration: boolean;
}

export default function BountyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { id } = use(params);
  const bountyId = BigInt(id);

  const [bidAmount, setBidAmount] = useState('');
  const [proposal, setProposal] = useState('');
  const [deliverable, setDeliverable] = useState('');
  const [selectedBidIndex, setSelectedBidIndex] = useState<bigint | null>(null);
  const [showUMADisputeModal, setShowUMADisputeModal] = useState(false);
  const [showDisputeStatusModal, setShowDisputeStatusModal] = useState(false);

  // Fetch bounty data
  const { data: bountyData, isLoading, refetch, error } = useGetBounty(bountyId);

  console.log('Bounty page state:', { bountyId: bountyId.toString(), bountyData, isLoading, error });

  // Parse bounty data from contract (viem returns struct as object with named properties)
  const bountyDataTyped = bountyData as unknown as BountyData | undefined;
  const bounty = bountyDataTyped && bountyDataTyped.client !== '0x0000000000000000000000000000000000000000' ? {
    client: bountyDataTyped.client as string,
    paymentToken: bountyDataTyped.paymentToken as string,
    escrowAmount: bountyDataTyped.escrowAmount as bigint,
    createdAt: bountyDataTyped.createdAt as bigint,
    deadline: bountyDataTyped.deadline as bigint,
    requirementsURI: bountyDataTyped.requirementsURI as string,
    status: bountyDataTyped.status as number,
    assignedWorker: bountyDataTyped.assignedWorker as string,
    assignedBidAmount: bountyDataTyped.assignedBidAmount as bigint,
    submittedAt: bountyDataTyped.submittedAt as bigint,
    deliverableURI: bountyDataTyped.deliverableURI as string,
    useUMAArbitration: bountyDataTyped.useUMAArbitration as boolean,
  } as BountyData : undefined;

  console.log('Parsed bounty:', bounty);
  const { data: bidCountData } = useGetBidCount(bountyId);
  const bidCount = bidCountData as bigint | undefined;
  const { data: activeBidsData } = useGetActiveBids(bountyId);
  const activeBids = (activeBidsData as Array<{ bidder: string; amount: bigint; proposalURI: string; bidTime: bigint; withdrawn: boolean }> | undefined) || [];

  // Contract interactions
  const { submitBid, data: bidHash, isPending: isBidding } = useSubmitBid();
  const { isSuccess: isBidSubmitted } = useWaitForTransactionReceipt({ hash: bidHash });

  const { assignWorker, data: assignHash, isPending: isAssigning } = useAssignWorker();
  const { isSuccess: isAssigned } = useWaitForTransactionReceipt({ hash: assignHash });

  const { submitDeliverable: submitDel, data: delHash, isPending: isSubmitting } = useSubmitDeliverable();
  const { isSuccess: isDeliverableSubmitted } = useWaitForTransactionReceipt({ hash: delHash });

  const { approveDeliverable: approveDel, data: approveHash, isPending: isApproving } = useApproveDeliverable();
  const { isSuccess: isApproved } = useWaitForTransactionReceipt({ hash: approveHash });

  const { disputeDeliverableWithUMA, data: disputeHash, isPending: isDisputing, error: disputeError } = useDisputeDeliverableWithUMA();
  const { isSuccess: isDisputeCreated } = useWaitForTransactionReceipt({ hash: disputeHash });

  const handleSubmitBid = async () => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!bidAmount || parseFloat(bidAmount) <= 0) {
      toast.error('Please enter a valid bid amount');
      return;
    }

    if (!proposal.trim()) {
      toast.error('Please enter a proposal');
      return;
    }

    try {
      const bidAmountWei = parseUnits(bidAmount, 6);
      toast.info('Submitting bid...');
      submitBid(bountyId, bidAmountWei, proposal);
    } catch (error) {
      toast.error(`Bid submission failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleAssignWorker = async (bidIndex: bigint) => {
    try {
      toast.info('Assigning worker...');
      assignWorker(bountyId, bidIndex);
    } catch (error) {
      toast.error(`Assignment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSubmitDeliverable = async () => {
    if (!deliverable.trim()) {
      toast.error('Please enter deliverable details');
      return;
    }

    try {
      toast.info('Submitting deliverable...');
      submitDel(bountyId, deliverable);
    } catch (error) {
      toast.error(`Submission failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleApprove = async () => {
    try {
      toast.info('Approving deliverable...');
      approveDel(bountyId);
    } catch (error) {
      toast.error(`Approval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  useEffect(() => {
    if (isBidSubmitted && bidHash) {
      toast.success('Bid submitted successfully!');
      setBidAmount('');
      setProposal('');
      refetch();
    }
  }, [isBidSubmitted, bidHash, refetch]);

  useEffect(() => {
    if (isAssigned && assignHash) {
      toast.success('Worker assigned successfully!');
      refetch();
    }
  }, [isAssigned, assignHash, refetch]);

  useEffect(() => {
    if (isDeliverableSubmitted && delHash) {
      toast.success('Deliverable submitted successfully!');
      setDeliverable('');
      refetch();
    }
  }, [isDeliverableSubmitted, delHash, refetch]);

  useEffect(() => {
    if (isApproved && approveHash) {
      toast.success('Deliverable approved! Payment released.');
      refetch();
    }
  }, [isApproved, approveHash, refetch]);

  useEffect(() => {
    if (isDisputeCreated && disputeHash) {
      toast.success('UMA dispute created successfully! Challenge period has started.');
      setShowUMADisputeModal(false);
      refetch();
    }
  }, [isDisputeCreated, disputeHash, refetch]);

  useEffect(() => {
    if (disputeError) {
      console.error('Dispute error:', disputeError);
      toast.error(`Dispute failed: ${disputeError.message || 'Transaction reverted'}`);
    }
  }, [disputeError]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <main className="flex-1 container mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 md:py-12">
          <div className="border-2 border-black p-8 sm:p-10 md:p-12 text-center bg-white">
            <LoadingState size="lg" />
          </div>
        </main>
      </div>
    );
  }

  if (!bounty) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <main className="flex-1 container mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 md:py-12">
          <div className="border-2 border-black p-8 sm:p-10 md:p-12 text-center bg-white">
            <div className="mx-auto mb-4 sm:mb-5 md:mb-6 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 border-2 border-black bg-black flex items-center justify-center">
              <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-white"></div>
            </div>
            <h2 className="font-black text-xl sm:text-2xl uppercase text-black mb-3 sm:mb-4">
              Bounty Not Found
            </h2>
            <Button onClick={() => router.push('/bounties')} size="lg" className="text-[10px] sm:text-xs">
              Browse All Bounties
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const amountUSDC = formatUnits(bounty.escrowAmount, 6);
  const now = BigInt(Math.floor(Date.now() / 1000));
  const timeRemaining = Number(bounty.deadline - now);
  const hoursRemaining = Math.floor(timeRemaining / 3600);
  const daysRemaining = Math.floor(hoursRemaining / 24);

  const statusLabels = ['Open', 'Assigned', 'Submitted', 'Completed', 'Disputed', 'Cancelled', 'Auto-Released'];
  const isOpen = bounty.status === 0;
  const isClient = address?.toLowerCase() === bounty.client.toLowerCase();
  const isAssignedWorker = address?.toLowerCase() === bounty.assignedWorker?.toLowerCase();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1 container mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 md:py-12">
        {/* Back Button */}
        <div className="mb-4 sm:mb-5 md:mb-6">
          <button
            onClick={() => router.push('/bounties')}
            className="font-mono text-[10px] sm:text-xs md:text-sm text-black md:hover:opacity-60 transition-opacity"
          >
            ← BACK TO BOUNTIES
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
          {/* Left Column: Bounty Details */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-5 md:space-y-6">
            {/* Bounty Info */}
            <div className="border-2 border-black p-4 sm:p-5 md:p-6 bg-white">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4 mb-4 sm:mb-5 md:mb-6">
                <Badge variant={isOpen ? 'default' : 'outline'} className="border-black text-[10px] sm:text-xs">
                  {statusLabels[bounty.status].toUpperCase()}
                </Badge>
                <div className="text-left sm:text-right">
                  <div className="font-black text-3xl sm:text-4xl">
                    ${amountUSDC}
                  </div>
                  <div className="font-mono text-[10px] sm:text-xs uppercase tracking-wide opacity-60">
                    USDC ESCROWED
                  </div>
                </div>
              </div>

              <h1 className="font-black text-2xl sm:text-3xl uppercase mb-3 sm:mb-4">
                BOUNTY #{bountyId.toString()}
              </h1>

              <div className="space-y-2 sm:space-y-3 border-t-2 border-black pt-3 sm:pt-4">
                <div className="flex justify-between">
                  <span className="font-bold text-xs uppercase tracking-wide opacity-60">
                    Arbitration:
                  </span>
                  <span className="font-mono text-sm">
                    {bounty.useUMAArbitration ? (
                      <Badge variant="default" className="bg-blue-600 border-blue-600">
                        UMA ORACLE
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-black">
                        MULTI-SIG
                      </Badge>
                    )}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="font-bold text-xs uppercase tracking-wide opacity-60">
                    Client:
                  </span>
                  <span className="font-mono text-sm">
                    {formatAddress(bounty.client)}
                    {isClient && <Badge variant="outline" className="ml-2 border-black">YOU</Badge>}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="font-bold text-xs uppercase tracking-wide opacity-60">
                    Created:
                  </span>
                  <span className="font-mono text-sm">
                    {formatRelativeTime(Number(bounty.createdAt))}
                  </span>
                </div>

                {isOpen && (
                  <div className="flex justify-between">
                    <span className="font-bold text-xs uppercase tracking-wide opacity-60">
                      Deadline:
                    </span>
                    <span className="font-mono text-sm">
                      {daysRemaining > 0 ? `${daysRemaining} days` : `${hoursRemaining} hours`} remaining
                    </span>
                  </div>
                )}

                {bounty.assignedWorker && bounty.assignedWorker !== '0x0000000000000000000000000000000000000000' && (
                  <div className="flex justify-between">
                    <span className="font-bold text-xs uppercase tracking-wide opacity-60">
                      Assigned to:
                    </span>
                    <span className="font-mono text-sm">
                      {formatAddress(bounty.assignedWorker)}
                      {isAssignedWorker && <Badge variant="default" className="ml-2">YOU</Badge>}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Requirements */}
            <div className="border-2 border-black bg-white">
              <div className="p-6 border-b-2 border-black">
                <h2 className="font-black text-lg uppercase">Requirements</h2>
              </div>
              <div className="p-6">
                <div className="border-2 border-black p-4 bg-white">
                  <p className="font-mono text-sm whitespace-pre-wrap">
                    {bounty.requirementsURI}
                  </p>
                </div>
              </div>
            </div>

            {/* Deliverable (if submitted) */}
            {bounty.status >= 2 && bounty.deliverableURI && (
              <div className="border-2 border-black bg-white">
                <div className="bg-black text-white p-6 border-b-2 border-black">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 border-2 border-white bg-white flex items-center justify-center">
                      <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="font-black text-lg uppercase">Submitted Deliverable</h2>
                      <p className="font-mono text-xs opacity-80">
                        {formatRelativeTime(Number(bounty.submittedAt))}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  {/* Deliverable Content */}
                  <div className="bg-gray-50 border-2 border-black p-6 mb-6 overflow-hidden">
                    <p className="font-mono text-sm whitespace-pre-wrap leading-relaxed break-words">
                      {bounty.deliverableURI}
                    </p>
                  </div>

                  {/* Client Approve Button (Standard Arbitration) */}
                  {isClient && bounty.status === 2 && !bounty.useUMAArbitration && (
                    <div className="border-t-2 border-black pt-6">
                      <Button
                        onClick={handleApprove}
                        disabled={isApproving}
                        className="w-full bg-green-500 hover:bg-green-600 border-2 border-black text-black font-black"
                      >
                        {isApproving ? 'APPROVING...' : 'APPROVE DELIVERABLE'}
                      </Button>
                    </div>
                  )}

                  {/* Client Actions for UMA Arbitration */}
                  {isClient && bounty.status === 2 && bounty.useUMAArbitration && (
                    <div className="border-t-2 border-black pt-6 flex gap-3">
                      <Button
                        onClick={handleApprove}
                        disabled={isApproving}
                        className="flex-1 bg-green-500 hover:bg-green-600 border-2 border-black text-black font-black"
                      >
                        {isApproving ? 'APPROVING...' : 'APPROVE'}
                      </Button>
                      <Button
                        onClick={() => setShowUMADisputeModal(true)}
                        disabled={isDisputing}
                        className="flex-1 bg-red-500 hover:bg-red-600 border-2 border-black text-white font-black"
                      >
                        {isDisputing ? 'CREATING...' : 'CREATE DISPUTE'}
                      </Button>
                    </div>
                  )}

                  {/* Dispute Status Button */}
                  {bounty.status === 4 && (
                    <div className="border-t-2 border-black pt-6">
                      <button
                        onClick={() => setShowDisputeStatusModal(true)}
                        className="w-full bg-yellow-100 border-2 border-black p-4 hover:bg-yellow-200 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-yellow-500 border-2 border-black flex items-center justify-center">
                              <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <p className="font-black text-sm uppercase">Dispute Active</p>
                              <p className="font-mono text-xs opacity-70">Click to view details</p>
                            </div>
                          </div>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Bids - For Clients */}
            {isClient && activeBids && activeBids.length > 0 && bounty.status === 0 && (
              <div className="border-2 border-black bg-white">
                <div className="p-6 border-b-2 border-black">
                  <h2 className="font-black text-lg uppercase">Bids Received ({activeBids.length})</h2>
                </div>
                <div className="p-6 space-y-3">
                  {activeBids.map((bid, index: number) => (
                    <BidCard
                      key={index}
                      bid={bid}
                      bidIndex={BigInt(index)}
                      onAssign={handleAssignWorker}
                      isAssigning={isAssigning}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Bids - For Everyone Else */}
            {!isClient && activeBids && activeBids.length > 0 && (
              <div className="border-2 border-black bg-white">
                <div className="p-6 border-b-2 border-black">
                  <h2 className="font-black text-lg uppercase">Bids ({activeBids.length})</h2>
                </div>
                <div className="p-6 space-y-3">
                  {activeBids.map((bid, index: number) => (
                    <div
                      key={index}
                      className="border-2 border-black p-4"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-mono text-sm">
                            {formatAddress(bid.bidder)}
                          </span>
                          {bid.bidder.toLowerCase() === address?.toLowerCase() && (
                            <Badge variant="outline" className="ml-2 border-black">YOUR BID</Badge>
                          )}
                        </div>
                        <div className="font-black text-xl">
                          ${formatUnits(bid.amount, 6)}
                        </div>
                      </div>
                      <p className="font-mono text-xs">
                        {bid.proposalURI.substring(0, 100)}
                        {bid.proposalURI.length > 100 && '...'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Actions */}
          <div className="space-y-6">
            {/* Worker Submit Deliverable */}
            {isAssignedWorker && bounty.status === 1 && (
              <div className="border-2 border-black bg-white">
                <div className="p-6 border-b-2 border-black">
                  <h2 className="font-black text-sm uppercase">Submit Deliverable</h2>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="font-mono text-xs uppercase tracking-wide block mb-2 opacity-60">
                      Deliverable Details / URL
                    </label>
                    <textarea
                      value={deliverable}
                      onChange={(e) => setDeliverable(e.target.value)}
                      placeholder="Describe your completed work or provide URL..."
                      className="w-full h-32 border-2 border-black bg-white px-4 py-3 font-mono text-sm focus:outline-none resize-none"
                    />
                  </div>

                  <Button
                    onClick={handleSubmitDeliverable}
                    disabled={!deliverable || isSubmitting}
                    className="w-full"
                  >
                    {isSubmitting ? 'SUBMITTING...' : 'SUBMIT WORK'}
                  </Button>
                </div>
              </div>
            )}

            {/* Submit Bid */}
            {isOpen && !isClient && isConnected && (
              <div className="border-2 border-black bg-white">
                <div className="p-6 border-b-2 border-black">
                  <h2 className="font-black text-sm uppercase">Submit Your Bid</h2>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="font-mono text-xs uppercase tracking-wide block mb-2 opacity-60">
                      Bid Amount (USDC)
                    </label>
                    <Input
                      type="number"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder="0.00"
                      max={amountUSDC}
                    />
                    <p className="font-mono text-xs opacity-60 mt-1">
                      Max: ${amountUSDC}
                    </p>
                  </div>

                  <div>
                    <label className="font-mono text-xs uppercase tracking-wide block mb-2 opacity-60">
                      Proposal
                    </label>
                    <textarea
                      value={proposal}
                      onChange={(e) => setProposal(e.target.value)}
                      placeholder="Explain how you'll complete this bounty..."
                      className="w-full h-32 border-2 border-black bg-white px-4 py-3 font-mono text-sm focus:outline-none resize-none"
                    />
                  </div>

                  <Button
                    onClick={handleSubmitBid}
                    disabled={!bidAmount || !proposal || isBidding}
                    className="w-full"
                  >
                    {isBidding ? 'SUBMITTING...' : 'SUBMIT BID'}
                  </Button>
                </div>
              </div>
            )}

            {/* Connect Wallet CTA */}
            {isOpen && !isClient && !isConnected && (
              <div className="border-2 border-black p-6 bg-white text-center">
                <p className="font-mono text-sm opacity-60">
                  Connect your wallet to submit a bid
                </p>
              </div>
            )}

            {/* Client Message */}
            {isClient && bounty.status === 0 && (
              <div className="border-2 border-black p-6 bg-white">
                <p className="font-mono text-sm">
                  This is your bounty. Select a bid above to assign a worker.
                </p>
              </div>
            )}

            {/* Quick Stats */}
            <div className="border-2 border-black bg-white">
              <div className="p-6 border-b-2 border-black">
                <h2 className="font-black text-sm uppercase">Quick Stats</h2>
              </div>
              <div className="p-6 space-y-3">
                <div className="flex justify-between">
                  <span className="font-mono text-xs uppercase tracking-wide opacity-60">
                    Bids Received
                  </span>
                  <span className="font-black text-sm">
                    {Number(bidCount || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-mono text-xs uppercase tracking-wide opacity-60">
                    Status
                  </span>
                  <span className="font-mono text-sm">
                    {statusLabels[bounty.status]}
                  </span>
                </div>
                {isOpen && (
                  <div className="flex justify-between">
                    <span className="font-mono text-xs uppercase tracking-wide opacity-60">
                      Time Left
                    </span>
                    <span className="font-mono text-sm">
                      {daysRemaining > 0 ? `${daysRemaining}d` : `${hoursRemaining}h`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* UMA Dispute Modal */}
      {showUMADisputeModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={() => setShowUMADisputeModal(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <UMADisputeForm
              bountyId={bountyId}
              paymentToken={bounty.paymentToken as `0x${string}`}
              onSuccess={() => {
                toast.success('UMA dispute created successfully!');
                setShowUMADisputeModal(false);
                refetch();
              }}
              onCancel={() => {
                setShowUMADisputeModal(false);
              }}
            />
          </div>
        </div>
      )}

      {/* UMA Dispute Status Modal */}
      {showDisputeStatusModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={() => setShowDisputeStatusModal(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <UMAResolutionDisplay
              bountyId={bountyId}
              onResolved={() => {
                toast.success('Bounty resolved!');
                setShowDisputeStatusModal(false);
                refetch();
              }}
              onClose={() => setShowDisputeStatusModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Bid Card Component with Official Reputation Display
 */
function BidCard({
  bid,
  bidIndex,
  onAssign,
  isAssigning,
}: {
  bid: { bidder: string; amount: bigint; proposalURI: string; bidTime: bigint; withdrawn: boolean };
  bidIndex: bigint;
  onAssign: (index: bigint) => void;
  isAssigning: boolean;
}) {
  const { data: officialRep } = useOfficialReputation(bid.bidder as Address);

  return (
    <div className="border-2 border-black p-4 bg-white">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm">{formatAddress(bid.bidder)}</span>
            {officialRep && officialRep.count > 0n && (
              <Badge variant="outline" className="border-black text-xs">
                ERC-8004
              </Badge>
            )}
          </div>
          {officialRep && officialRep.count > 0n && (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono opacity-60">Global:</span>
              <span className="font-bold">{officialRep.rating.toFixed(1)}/5 ★</span>
              <span className="font-mono opacity-60">({officialRep.count.toString()} reviews)</span>
            </div>
          )}
        </div>
        <div className="font-black text-xl">${formatUnits(bid.amount, 6)}</div>
      </div>
      <p className="font-mono text-xs mb-3 border-t-2 border-black pt-2">{bid.proposalURI}</p>
      <Button onClick={() => onAssign(bidIndex)} disabled={isAssigning} size="sm" className="w-full">
        {isAssigning ? 'ASSIGNING...' : 'SELECT THIS BID'}
      </Button>
    </div>
  );
}
