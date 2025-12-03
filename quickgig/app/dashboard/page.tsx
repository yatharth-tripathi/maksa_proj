'use client';

import { useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/header';
import { useGetBounty, useGetBidCount, useGetBid } from '@/lib/contracts/bountyEscrow';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Tab = 'bounties' | 'bids' | 'work';

// Type definitions for wagmi hook returns
type BountyData = { client: string; paymentToken: string; escrowAmount: bigint; status: number; assignedWorker: string; createdAt: bigint; deadline: bigint; requirementsURI: string } | undefined;
type BidData = { bidder: string; amount: bigint; proposalURI: string; bidTime: bigint; withdrawn: boolean } | undefined;

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>('bounties');

  // For demo purposes, we'll check bounties 0-19
  // In production, you'd have a subgraph or indexer
  const bountyIds = Array.from({ length: 20 }, (_, i) => BigInt(i));

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-white p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="border-2 border-black p-12 bg-white text-center">
            <div className="w-16 h-16 border-2 border-black mx-auto mb-6 flex items-center justify-center">
              <div className="w-8 h-8 bg-black"></div>
            </div>
            <h2 className="font-black text-2xl uppercase tracking-tight mb-4">
              WALLET NOT CONNECTED
            </h2>
            <p className="font-mono text-sm mb-6">
              Please connect your wallet to view your dashboard
            </p>
            <Link href="/">
              <Button>GO HOME</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'bounties', label: 'MY BOUNTIES' },
    { id: 'bids', label: 'MY BIDS' },
    { id: 'work', label: 'MY WORK' },
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6 lg:p-8 space-y-6 sm:space-y-7 md:space-y-8">
        {/* Header */}
        <div className="border-2 border-black p-4 sm:p-6 md:p-8 bg-white">
          <h1 className="font-black text-3xl sm:text-4xl md:text-5xl lg:text-6xl uppercase tracking-tight text-black mb-1.5 sm:mb-2">
            DASHBOARD
          </h1>
          <p className="font-mono text-xs sm:text-sm uppercase tracking-wide opacity-60">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
        </div>

        {/* Tabs */}
        <div className="border-2 border-black bg-white">
          <div className="flex border-b-2 border-black">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-3 py-3 sm:px-4 sm:py-3.5 md:px-6 md:py-4 font-black text-[11px] sm:text-xs md:text-sm uppercase tracking-wide transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-black text-white'
                    : 'bg-white text-black md:hover:bg-black md:hover:text-white border-r-2 last:border-r-0 border-black'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-5 md:p-6">
            {activeTab === 'bounties' && <MyBounties address={address!} bountyIds={bountyIds} />}
            {activeTab === 'bids' && <MyBids address={address!} bountyIds={bountyIds} />}
            {activeTab === 'work' && <MyWork address={address!} bountyIds={bountyIds} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function MyBounties({ address, bountyIds }: { address: string; bountyIds: bigint[] }) {
  const router = useRouter();

  // Call all hooks at top level (unrolled - React requires static hook calls)
  const bounty0 = useGetBounty(bountyIds[0]);
  const bounty1 = useGetBounty(bountyIds[1]);
  const bounty2 = useGetBounty(bountyIds[2]);
  const bounty3 = useGetBounty(bountyIds[3]);
  const bounty4 = useGetBounty(bountyIds[4]);
  const bounty5 = useGetBounty(bountyIds[5]);
  const bounty6 = useGetBounty(bountyIds[6]);
  const bounty7 = useGetBounty(bountyIds[7]);
  const bounty8 = useGetBounty(bountyIds[8]);
  const bounty9 = useGetBounty(bountyIds[9]);
  const bounty10 = useGetBounty(bountyIds[10]);
  const bounty11 = useGetBounty(bountyIds[11]);
  const bounty12 = useGetBounty(bountyIds[12]);
  const bounty13 = useGetBounty(bountyIds[13]);
  const bounty14 = useGetBounty(bountyIds[14]);
  const bounty15 = useGetBounty(bountyIds[15]);
  const bounty16 = useGetBounty(bountyIds[16]);
  const bounty17 = useGetBounty(bountyIds[17]);
  const bounty18 = useGetBounty(bountyIds[18]);
  const bounty19 = useGetBounty(bountyIds[19]);

  // Type for bounty data
  type BountyData = { client: string; paymentToken: string; escrowAmount: bigint; status: number; assignedWorker: string; createdAt: bigint; deadline: bigint; requirementsURI: string } | undefined;

  // Combine results
  const bountyResults = [
    { id: bountyIds[0], data: bounty0.data as BountyData },
    { id: bountyIds[1], data: bounty1.data as BountyData },
    { id: bountyIds[2], data: bounty2.data as BountyData },
    { id: bountyIds[3], data: bounty3.data as BountyData },
    { id: bountyIds[4], data: bounty4.data as BountyData },
    { id: bountyIds[5], data: bounty5.data as BountyData },
    { id: bountyIds[6], data: bounty6.data as BountyData },
    { id: bountyIds[7], data: bounty7.data as BountyData },
    { id: bountyIds[8], data: bounty8.data as BountyData },
    { id: bountyIds[9], data: bounty9.data as BountyData },
    { id: bountyIds[10], data: bounty10.data as BountyData },
    { id: bountyIds[11], data: bounty11.data as BountyData },
    { id: bountyIds[12], data: bounty12.data as BountyData },
    { id: bountyIds[13], data: bounty13.data as BountyData },
    { id: bountyIds[14], data: bounty14.data as BountyData },
    { id: bountyIds[15], data: bounty15.data as BountyData },
    { id: bountyIds[16], data: bounty16.data as BountyData },
    { id: bountyIds[17], data: bounty17.data as BountyData },
    { id: bountyIds[18], data: bounty18.data as BountyData },
    { id: bountyIds[19], data: bounty19.data as BountyData },
  ];

  // Filter for user's bounties using useMemo
  const myBounties = useMemo(() =>
    bountyResults
      .filter((result) => result.data && result.data.client.toLowerCase() === address.toLowerCase())
      .map((result) => ({ ...result.data, bountyId: result.id })),
    [bountyResults, address]
  );

  if (myBounties.length === 0) {
    return (
      <div className="border-2 border-black p-8 bg-white text-center">
        <p className="font-mono text-sm uppercase tracking-wide opacity-60">
          NO BOUNTIES CREATED YET
        </p>
        <Link href="/bounties">
          <Button className="mt-4">CREATE A BOUNTY</Button>
        </Link>
      </div>
    );
  }

  const statusMap = ['OPEN', 'IN PROGRESS', 'DELIVERED', 'COMPLETED', 'CANCELLED'];

  return (
    <div className="space-y-4">
      {myBounties.map((bounty) => {
        const amountUSDC = bounty.escrowAmount ? formatUnits(bounty.escrowAmount, 6) : '0';
        return (
          <div
            key={bounty.bountyId.toString()}
            className="group border-2 border-black bg-white hover:bg-black hover:text-white transition-all duration-300 cursor-pointer"
            onClick={() => router.push(`/bounties/${bounty.bountyId.toString()}`)}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-black text-lg uppercase mb-1">
                    BOUNTY #{bounty.bountyId.toString()}
                  </h3>
                  <p className="font-mono text-xs uppercase opacity-60">
                    STATUS: {bounty.status !== undefined ? statusMap[bounty.status] : 'UNKNOWN'}
                  </p>
                </div>
                <div className="border-2 border-current px-4 py-2 bg-current/5 group-hover:bg-white/10">
                  <span className="text-xl font-black">${amountUSDC}</span>
                </div>
              </div>
              <p className="font-mono text-sm line-clamp-2">
                {bounty.requirementsURI}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MyBids({ address, bountyIds }: { address: string; bountyIds: bigint[] }) {
  const router = useRouter();

  // Call all hooks at top level - 20 bounties
  const bounty0 = useGetBounty(bountyIds[0]);
  const bounty1 = useGetBounty(bountyIds[1]);
  const bounty2 = useGetBounty(bountyIds[2]);
  const bounty3 = useGetBounty(bountyIds[3]);
  const bounty4 = useGetBounty(bountyIds[4]);
  const bounty5 = useGetBounty(bountyIds[5]);
  const bounty6 = useGetBounty(bountyIds[6]);
  const bounty7 = useGetBounty(bountyIds[7]);
  const bounty8 = useGetBounty(bountyIds[8]);
  const bounty9 = useGetBounty(bountyIds[9]);
  const bounty10 = useGetBounty(bountyIds[10]);
  const bounty11 = useGetBounty(bountyIds[11]);
  const bounty12 = useGetBounty(bountyIds[12]);
  const bounty13 = useGetBounty(bountyIds[13]);
  const bounty14 = useGetBounty(bountyIds[14]);
  const bounty15 = useGetBounty(bountyIds[15]);
  const bounty16 = useGetBounty(bountyIds[16]);
  const bounty17 = useGetBounty(bountyIds[17]);
  const bounty18 = useGetBounty(bountyIds[18]);
  const bounty19 = useGetBounty(bountyIds[19]);

  // Call hooks for first 2 bids per bounty (40 total bid calls - keeping it reasonable)
  // In production, use subgraph indexing instead
  const bid0_0 = useGetBid(bountyIds[0], 0n);
  const bid0_1 = useGetBid(bountyIds[0], 1n);
  const bid1_0 = useGetBid(bountyIds[1], 0n);
  const bid1_1 = useGetBid(bountyIds[1], 1n);
  const bid2_0 = useGetBid(bountyIds[2], 0n);
  const bid2_1 = useGetBid(bountyIds[2], 1n);
  const bid3_0 = useGetBid(bountyIds[3], 0n);
  const bid3_1 = useGetBid(bountyIds[3], 1n);
  const bid4_0 = useGetBid(bountyIds[4], 0n);
  const bid4_1 = useGetBid(bountyIds[4], 1n);
  const bid5_0 = useGetBid(bountyIds[5], 0n);
  const bid5_1 = useGetBid(bountyIds[5], 1n);
  const bid6_0 = useGetBid(bountyIds[6], 0n);
  const bid6_1 = useGetBid(bountyIds[6], 1n);
  const bid7_0 = useGetBid(bountyIds[7], 0n);
  const bid7_1 = useGetBid(bountyIds[7], 1n);
  const bid8_0 = useGetBid(bountyIds[8], 0n);
  const bid8_1 = useGetBid(bountyIds[8], 1n);
  const bid9_0 = useGetBid(bountyIds[9], 0n);
  const bid9_1 = useGetBid(bountyIds[9], 1n);
  const bid10_0 = useGetBid(bountyIds[10], 0n);
  const bid10_1 = useGetBid(bountyIds[10], 1n);
  const bid11_0 = useGetBid(bountyIds[11], 0n);
  const bid11_1 = useGetBid(bountyIds[11], 1n);
  const bid12_0 = useGetBid(bountyIds[12], 0n);
  const bid12_1 = useGetBid(bountyIds[12], 1n);
  const bid13_0 = useGetBid(bountyIds[13], 0n);
  const bid13_1 = useGetBid(bountyIds[13], 1n);
  const bid14_0 = useGetBid(bountyIds[14], 0n);
  const bid14_1 = useGetBid(bountyIds[14], 1n);
  const bid15_0 = useGetBid(bountyIds[15], 0n);
  const bid15_1 = useGetBid(bountyIds[15], 1n);
  const bid16_0 = useGetBid(bountyIds[16], 0n);
  const bid16_1 = useGetBid(bountyIds[16], 1n);
  const bid17_0 = useGetBid(bountyIds[17], 0n);
  const bid17_1 = useGetBid(bountyIds[17], 1n);
  const bid18_0 = useGetBid(bountyIds[18], 0n);
  const bid18_1 = useGetBid(bountyIds[18], 1n);
  const bid19_0 = useGetBid(bountyIds[19], 0n);
  const bid19_1 = useGetBid(bountyIds[19], 1n);

  // Type for bid data
  type BidData = { bidder: string; amount: bigint; proposalURI: string; bidTime: bigint; withdrawn: boolean } | undefined;

  // Combine all bid data
  const allBidsData = [
    { bountyId: bountyIds[0], bidIndex: 0, bid: bid0_0.data as BidData, bounty: bounty0.data as BountyData },
    { bountyId: bountyIds[0], bidIndex: 1, bid: bid0_1.data as BidData, bounty: bounty0.data as BountyData },
    { bountyId: bountyIds[1], bidIndex: 0, bid: bid1_0.data as BidData, bounty: bounty1.data as BountyData },
    { bountyId: bountyIds[1], bidIndex: 1, bid: bid1_1.data as BidData, bounty: bounty1.data as BountyData },
    { bountyId: bountyIds[2], bidIndex: 0, bid: bid2_0.data as BidData, bounty: bounty2.data as BountyData },
    { bountyId: bountyIds[2], bidIndex: 1, bid: bid2_1.data as BidData, bounty: bounty2.data as BountyData },
    { bountyId: bountyIds[3], bidIndex: 0, bid: bid3_0.data as BidData, bounty: bounty3.data as BountyData },
    { bountyId: bountyIds[3], bidIndex: 1, bid: bid3_1.data as BidData, bounty: bounty3.data as BountyData },
    { bountyId: bountyIds[4], bidIndex: 0, bid: bid4_0.data as BidData, bounty: bounty4.data as BountyData },
    { bountyId: bountyIds[4], bidIndex: 1, bid: bid4_1.data as BidData, bounty: bounty4.data as BountyData },
    { bountyId: bountyIds[5], bidIndex: 0, bid: bid5_0.data as BidData, bounty: bounty5.data as BountyData },
    { bountyId: bountyIds[5], bidIndex: 1, bid: bid5_1.data as BidData, bounty: bounty5.data as BountyData },
    { bountyId: bountyIds[6], bidIndex: 0, bid: bid6_0.data as BidData, bounty: bounty6.data as BountyData },
    { bountyId: bountyIds[6], bidIndex: 1, bid: bid6_1.data as BidData, bounty: bounty6.data as BountyData },
    { bountyId: bountyIds[7], bidIndex: 0, bid: bid7_0.data as BidData, bounty: bounty7.data as BountyData },
    { bountyId: bountyIds[7], bidIndex: 1, bid: bid7_1.data as BidData, bounty: bounty7.data as BountyData },
    { bountyId: bountyIds[8], bidIndex: 0, bid: bid8_0.data as BidData, bounty: bounty8.data as BountyData },
    { bountyId: bountyIds[8], bidIndex: 1, bid: bid8_1.data as BidData, bounty: bounty8.data as BountyData },
    { bountyId: bountyIds[9], bidIndex: 0, bid: bid9_0.data as BidData, bounty: bounty9.data as BountyData },
    { bountyId: bountyIds[9], bidIndex: 1, bid: bid9_1.data as BidData, bounty: bounty9.data as BountyData },
    { bountyId: bountyIds[10], bidIndex: 0, bid: bid10_0.data as BidData, bounty: bounty10.data as BountyData },
    { bountyId: bountyIds[10], bidIndex: 1, bid: bid10_1.data as BidData, bounty: bounty10.data as BountyData },
    { bountyId: bountyIds[11], bidIndex: 0, bid: bid11_0.data as BidData, bounty: bounty11.data as BountyData },
    { bountyId: bountyIds[11], bidIndex: 1, bid: bid11_1.data as BidData, bounty: bounty11.data as BountyData },
    { bountyId: bountyIds[12], bidIndex: 0, bid: bid12_0.data as BidData, bounty: bounty12.data as BountyData },
    { bountyId: bountyIds[12], bidIndex: 1, bid: bid12_1.data as BidData, bounty: bounty12.data as BountyData },
    { bountyId: bountyIds[13], bidIndex: 0, bid: bid13_0.data as BidData, bounty: bounty13.data as BountyData },
    { bountyId: bountyIds[13], bidIndex: 1, bid: bid13_1.data as BidData, bounty: bounty13.data as BountyData },
    { bountyId: bountyIds[14], bidIndex: 0, bid: bid14_0.data as BidData, bounty: bounty14.data as BountyData },
    { bountyId: bountyIds[14], bidIndex: 1, bid: bid14_1.data as BidData, bounty: bounty14.data as BountyData },
    { bountyId: bountyIds[15], bidIndex: 0, bid: bid15_0.data as BidData, bounty: bounty15.data as BountyData },
    { bountyId: bountyIds[15], bidIndex: 1, bid: bid15_1.data as BidData, bounty: bounty15.data as BountyData },
    { bountyId: bountyIds[16], bidIndex: 0, bid: bid16_0.data as BidData, bounty: bounty16.data as BountyData },
    { bountyId: bountyIds[16], bidIndex: 1, bid: bid16_1.data as BidData, bounty: bounty16.data as BountyData },
    { bountyId: bountyIds[17], bidIndex: 0, bid: bid17_0.data as BidData, bounty: bounty17.data as BountyData },
    { bountyId: bountyIds[17], bidIndex: 1, bid: bid17_1.data as BidData, bounty: bounty17.data as BountyData },
    { bountyId: bountyIds[18], bidIndex: 0, bid: bid18_0.data as BidData, bounty: bounty18.data as BountyData },
    { bountyId: bountyIds[18], bidIndex: 1, bid: bid18_1.data as BidData, bounty: bounty18.data as BountyData },
    { bountyId: bountyIds[19], bidIndex: 0, bid: bid19_0.data as BidData, bounty: bounty19.data as BountyData },
    { bountyId: bountyIds[19], bidIndex: 1, bid: bid19_1.data as BidData, bounty: bounty19.data as BountyData },
  ];

  // Filter for user's bids using useMemo
  const myBids = useMemo(() =>
    allBidsData.filter(
      (item) => {
        const bid = item.bid as BidData;
        const bounty = item.bounty as BountyData;
        return bid && bounty && bid.bidder && bid.bidder.toLowerCase() === address.toLowerCase();
      }
    ),
    [allBidsData, address]
  );

  if (myBids.length === 0) {
    return (
      <div className="border-2 border-black p-8 bg-white text-center">
        <p className="font-mono text-sm uppercase tracking-wide opacity-60">
          NO BIDS SUBMITTED YET
        </p>
        <Link href="/bounties">
          <Button className="mt-4">BROWSE BOUNTIES</Button>
        </Link>
      </div>
    );
  }

  const statusMap = ['OPEN', 'IN PROGRESS', 'DELIVERED', 'COMPLETED', 'CANCELLED'];

  return (
    <div className="space-y-4">
      {myBids.map((item, index) => {
        const amountUSDC = item.bid?.amount ? formatUnits(item.bid.amount, 6) : '0';
        const bountyAmountUSDC = item.bounty?.escrowAmount ? formatUnits(item.bounty.escrowAmount, 6) : '0';
        return (
          <div
            key={index}
            className="group border-2 border-black bg-white hover:bg-black hover:text-white transition-all duration-300 cursor-pointer"
            onClick={() => router.push(`/bounties/${item.bountyId.toString()}`)}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-black text-lg uppercase mb-1">
                    BID ON BOUNTY #{item.bountyId.toString()}
                  </h3>
                  <p className="font-mono text-xs uppercase opacity-60">
                    STATUS: {statusMap[item.bounty?.status || 0]}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="border-2 border-current px-4 py-2 bg-current/5 group-hover:bg-white/10">
                    <span className="text-sm font-bold uppercase">MY BID</span>
                    <span className="text-xl font-black ml-2">${amountUSDC}</span>
                  </div>
                  <p className="font-mono text-xs uppercase text-right opacity-60">
                    BOUNTY: ${bountyAmountUSDC}
                  </p>
                </div>
              </div>
              <p className="font-mono text-sm line-clamp-2">
                {item.bid?.proposalURI || 'N/A'}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MyWork({ address, bountyIds }: { address: string; bountyIds: bigint[] }) {
  const router = useRouter();

  // Call all hooks at top level (unrolled - React requires static hook calls)
  const bounty0 = useGetBounty(bountyIds[0]);
  const bounty1 = useGetBounty(bountyIds[1]);
  const bounty2 = useGetBounty(bountyIds[2]);
  const bounty3 = useGetBounty(bountyIds[3]);
  const bounty4 = useGetBounty(bountyIds[4]);
  const bounty5 = useGetBounty(bountyIds[5]);
  const bounty6 = useGetBounty(bountyIds[6]);
  const bounty7 = useGetBounty(bountyIds[7]);
  const bounty8 = useGetBounty(bountyIds[8]);
  const bounty9 = useGetBounty(bountyIds[9]);
  const bounty10 = useGetBounty(bountyIds[10]);
  const bounty11 = useGetBounty(bountyIds[11]);
  const bounty12 = useGetBounty(bountyIds[12]);
  const bounty13 = useGetBounty(bountyIds[13]);
  const bounty14 = useGetBounty(bountyIds[14]);
  const bounty15 = useGetBounty(bountyIds[15]);
  const bounty16 = useGetBounty(bountyIds[16]);
  const bounty17 = useGetBounty(bountyIds[17]);
  const bounty18 = useGetBounty(bountyIds[18]);
  const bounty19 = useGetBounty(bountyIds[19]);

  // Type for bounty data
  type BountyData = { client: string; paymentToken: string; escrowAmount: bigint; status: number; assignedWorker: string; createdAt: bigint; deadline: bigint; requirementsURI: string } | undefined;

  // Combine results
  const bountyResults = [
    { id: bountyIds[0], data: bounty0.data as BountyData },
    { id: bountyIds[1], data: bounty1.data as BountyData },
    { id: bountyIds[2], data: bounty2.data as BountyData },
    { id: bountyIds[3], data: bounty3.data as BountyData },
    { id: bountyIds[4], data: bounty4.data as BountyData },
    { id: bountyIds[5], data: bounty5.data as BountyData },
    { id: bountyIds[6], data: bounty6.data as BountyData },
    { id: bountyIds[7], data: bounty7.data as BountyData },
    { id: bountyIds[8], data: bounty8.data as BountyData },
    { id: bountyIds[9], data: bounty9.data as BountyData },
    { id: bountyIds[10], data: bounty10.data as BountyData },
    { id: bountyIds[11], data: bounty11.data as BountyData },
    { id: bountyIds[12], data: bounty12.data as BountyData },
    { id: bountyIds[13], data: bounty13.data as BountyData },
    { id: bountyIds[14], data: bounty14.data as BountyData },
    { id: bountyIds[15], data: bounty15.data as BountyData },
    { id: bountyIds[16], data: bounty16.data as BountyData },
    { id: bountyIds[17], data: bounty17.data as BountyData },
    { id: bountyIds[18], data: bounty18.data as BountyData },
    { id: bountyIds[19], data: bounty19.data as BountyData },
  ];

  // Filter for assigned work using useMemo
  const myWork = useMemo(() =>
    bountyResults
      .filter((result) => result.data && result.data.assignedWorker.toLowerCase() === address.toLowerCase())
      .map((result) => ({ ...result.data, bountyId: result.id })),
    [bountyResults, address]
  );

  if (myWork.length === 0) {
    return (
      <div className="border-2 border-black p-8 bg-white text-center">
        <p className="font-mono text-sm uppercase tracking-wide opacity-60">
          NO WORK ASSIGNED YET
        </p>
        <Link href="/bounties">
          <Button className="mt-4">FIND WORK</Button>
        </Link>
      </div>
    );
  }

  const statusMap = ['OPEN', 'IN PROGRESS', 'DELIVERED', 'COMPLETED', 'CANCELLED'];

  return (
    <div className="space-y-4">
      {myWork.map((bounty) => {
        const amountUSDC = bounty.escrowAmount ? formatUnits(bounty.escrowAmount, 6) : '0';
        return (
          <div
            key={bounty.bountyId.toString()}
            className="group border-2 border-black bg-white hover:bg-black hover:text-white transition-all duration-300 cursor-pointer"
            onClick={() => router.push(`/bounties/${bounty.bountyId.toString()}`)}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-black text-lg uppercase mb-1">
                    BOUNTY #{bounty.bountyId.toString()}
                  </h3>
                  <p className="font-mono text-xs uppercase opacity-60">
                    STATUS: {bounty.status !== undefined ? statusMap[bounty.status] : 'UNKNOWN'}
                  </p>
                </div>
                <div className="border-2 border-current px-4 py-2 bg-current/5 group-hover:bg-white/10">
                  <span className="text-xl font-black">${amountUSDC}</span>
                </div>
              </div>
              <p className="font-mono text-sm line-clamp-2">
                {bounty.requirementsURI}
              </p>
              {bounty.status === 1 && (
                <div className="mt-4 border-t-2 border-current pt-4">
                  <p className="font-mono text-xs uppercase font-bold">
                    [!] ACTION REQUIRED: SUBMIT DELIVERABLE
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
