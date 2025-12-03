'use client';

import { useState, useEffect } from 'react';
import { Loader, LoadingState } from '@/components/ui/loader';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import { useNextGigId, useGetGig } from '@/lib/contracts/gigEscrow';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/header';

interface Gig {
  id: number;
  client?: string;
  worker?: string;
  totalAmount?: number;
  status?: string;
  useUMAArbitration?: boolean;
  createdAt?: number;
  milestones?: unknown[];
  completedMilestones?: number;
}

export default function GigsPage() {
  const { address } = useAccount();
  const { data: nextGigId } = useNextGigId();
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const totalGigs = nextGigId ? Number(nextGigId) - 1 : 0;

  useEffect(() => {
    if (totalGigs > 0) {
      fetchGigs();
    } else {
      setIsLoading(false);
    }
  }, [totalGigs]);

  const fetchGigs = async () => {
    setIsLoading(true);
    try {
      // Fetch gigs directly by ID (0 to nextGigId-1)
      const gigsData = [];
      for (let i = 0; i < totalGigs; i++) {
        // We'll need to call useGetGig for each ID
        // For simplicity, we'll show the structure here
        gigsData.push({
          id: i,
          // Will be populated when we implement the actual fetching
        });
      }
      setGigs(gigsData);
    } catch (error) {
      console.error('Error fetching gigs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="container mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 md:py-12 max-w-6xl">
        {/* Header */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
            <h1 className="font-black text-2xl sm:text-3xl md:text-4xl lg:text-5xl uppercase">
              GIGS
            </h1>
            <Link href="/gigs/create">
              <button className="bg-black text-white px-4 py-2 sm:px-5 sm:py-2.5 md:px-6 md:py-3 border-2 border-black font-black uppercase md:hover:bg-white md:hover:text-black transition-colors text-[10px] sm:text-xs whitespace-nowrap">
                + CREATE GIG
              </button>
            </Link>
          </div>
          <p className="font-mono text-[10px] sm:text-xs md:text-sm opacity-60">
            Milestone-based work with escrow protection
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6 md:mb-8">
          <div className="border-2 border-black p-4 sm:p-5 md:p-6 bg-gray-50">
            <p className="font-mono text-[10px] sm:text-xs uppercase opacity-60 mb-1">Total Gigs</p>
            <p className="font-black text-2xl sm:text-3xl">{totalGigs}</p>
          </div>
          <div className="border-2 border-black p-4 sm:p-5 md:p-6 bg-gray-50">
            <p className="font-mono text-[10px] sm:text-xs uppercase opacity-60 mb-1">Your Gigs</p>
            <p className="font-black text-2xl sm:text-3xl">
              {address ? gigs.filter(g => g.client === address || g.worker === address).length : 0}
            </p>
          </div>
          <div className="border-2 border-black p-4 sm:p-5 md:p-6 bg-gray-50">
            <p className="font-mono text-[10px] sm:text-xs uppercase opacity-60 mb-1">Active</p>
            <p className="font-black text-2xl sm:text-3xl">
              {gigs.filter(g => g.status === 'Active').length}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 sm:mb-5 md:mb-6 flex gap-1.5 sm:gap-2 flex-wrap">
          <button className="px-3 py-1.5 sm:px-4 sm:py-2 border-2 border-black bg-black text-white font-bold uppercase text-[10px] sm:text-xs">
            ALL
          </button>
          <button className="px-3 py-1.5 sm:px-4 sm:py-2 border-2 border-black bg-white text-black font-bold uppercase text-[10px] sm:text-xs md:hover:bg-black md:hover:text-white transition-colors">
            ACTIVE
          </button>
          <button className="px-3 py-1.5 sm:px-4 sm:py-2 border-2 border-black bg-white text-black font-bold uppercase text-[10px] sm:text-xs md:hover:bg-black md:hover:text-white transition-colors">
            COMPLETED
          </button>
          <button className="px-3 py-1.5 sm:px-4 sm:py-2 border-2 border-black bg-white text-black font-bold uppercase text-[10px] sm:text-xs md:hover:bg-black md:hover:text-white transition-colors">
            YOUR GIGS
          </button>
        </div>

        {/* Gigs List */}
        {isLoading ? (
          <div className="border-2 border-black p-8 sm:p-10 md:p-12 text-center">
            <LoadingState size="lg" />
          </div>
        ) : totalGigs === 0 ? (
          <div className="border-2 border-black p-8 sm:p-10 md:p-12 text-center">
            <p className="font-black text-lg sm:text-xl uppercase mb-1.5 sm:mb-2">NO GIGS YET</p>
            <p className="font-mono text-[10px] sm:text-xs md:text-sm opacity-60 mb-4 sm:mb-5 md:mb-6">
              Be the first to create a milestone-based gig
            </p>
            <Link href="/gigs/create">
              <button className="bg-black text-white px-4 py-2 sm:px-5 sm:py-2.5 md:px-6 md:py-3 border-2 border-black font-black uppercase md:hover:bg-white md:hover:text-black transition-colors text-[10px] sm:text-xs">
                CREATE FIRST GIG
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {gigs.map((gig) => (
              <Link key={gig.id} href={`/gigs/${gig.id}`}>
                <div className="border-2 border-black bg-white md:hover:bg-gray-50 transition-colors p-4 sm:p-5 md:p-6">
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                        <h3 className="font-black text-base sm:text-lg">GIG #{gig.id}</h3>
                        <Badge variant={gig.status === 'Active' ? 'default' : 'outline'} className="text-[9px] sm:text-[10px]">
                          {gig.status}
                        </Badge>
                        {gig.useUMAArbitration && (
                          <Badge variant="outline" className="border-blue-600 text-blue-600 text-[9px] sm:text-[10px]">
                            UMA ORACLE
                          </Badge>
                        )}
                      </div>
                      <p className="font-mono text-[10px] sm:text-xs opacity-60">
                        Created {gig.createdAt ? new Date(gig.createdAt * 1000).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-mono text-[10px] sm:text-xs opacity-60 mb-1">Total Value</p>
                      <p className="font-black text-xl sm:text-2xl">
                        ${((gig.totalAmount || 0) / 1_000_000).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-3 sm:pt-4 border-t-2 border-black">
                    <div>
                      <p className="font-mono text-[10px] sm:text-xs opacity-60 mb-1">Client</p>
                      <p className="font-mono text-xs sm:text-sm font-bold">
                        {gig.client?.slice(0, 6)}...{gig.client?.slice(-4)}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] sm:text-xs opacity-60 mb-1">Worker</p>
                      <p className="font-mono text-xs sm:text-sm font-bold">
                        {gig.worker?.slice(0, 6)}...{gig.worker?.slice(-4)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t-2 border-black">
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-[10px] sm:text-xs opacity-60">
                        {gig.milestones?.length || 0} Milestones • {gig.completedMilestones || 0} Completed
                      </p>
                      <p className="font-mono text-[10px] sm:text-xs font-bold uppercase">
                        VIEW DETAILS →
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
