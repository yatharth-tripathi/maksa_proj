'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader, LoadingState } from '@/components/ui/loader';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatUnits } from 'viem';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import BountyEscrowABI from '@/lib/contracts/abis/BountyEscrow.json';
import GigEscrowABI from '@/lib/contracts/abis/GigEscrow.json';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { formatAddress, formatRelativeTime } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface BountyData {
  bountyId: bigint;
  client: string;
  paymentToken: string;
  escrowAmount: bigint;
  createdAt: bigint;
  deadline: bigint;
  requirementsURI: string;
  status: number;
  assignedWorker: string;
  assignedBidAmount: bigint;
  submittedAt: bigint;
  deliverableURI: string;
  bidCount: number;
}

interface GigData {
  gigId: bigint;
  client: string;
  worker: string;
  paymentToken: string;
  totalAmount: bigint;
  milestones: Array<{ description: string; amount: bigint; completed: boolean }>;
  status: number; // 0 = Active, 1 = Completed, 2 = Disputed
  createdAt: bigint;
  completedMilestones: number;
  useUMAArbitration: boolean;
}

// Unified interface for contract bounties, database missions, and gigs
interface UnifiedMission {
  id: string; // bountyId, mission_id, or gigId
  source: 'contract' | 'database' | 'gig';
  client: string;
  amount: number; // in USDC (normalized)
  createdAt: number; // unix timestamp
  deadline?: number; // unix timestamp
  description: string;
  status: 'open' | 'assigned' | 'completed' | 'cancelled';
  requirementsIPFS?: string;
  bidCount?: number;
  assignedWorker?: string;
  milestoneCount?: number;
  completedMilestones?: number;
}

export default function BountiesPage() {
  const router = useRouter();
  const [bounties, setBounties] = useState<BountyData[]>([]);
  const [gigs, setGigs] = useState<GigData[]>([]);
  const [missions, setMissions] = useState<UnifiedMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'assigned' | 'completed' | 'gigs'>('open');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;

  // Fetch bounty details by ID
  const fetchBountyDetails = useCallback(async (bountyId: bigint): Promise<BountyData | null> => {
    try {
      const client = createPublicClient({
        chain: baseSepolia,
        transport: http(`https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`),
      });
      
      const bountyData = await client.readContract({
        address: CONTRACTS.BOUNTY_ESCROW,
        abi: ((BountyEscrowABI as { abi?: unknown[] }).abi || BountyEscrowABI) as readonly unknown[],
        functionName: 'getBounty',
        args: [bountyId],
      }) as unknown as {
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
      };

      const bidCount = await client.readContract({
        address: CONTRACTS.BOUNTY_ESCROW,
        abi: ((BountyEscrowABI as { abi?: unknown[] }).abi || BountyEscrowABI) as readonly unknown[],
        functionName: 'getBidCount',
        args: [bountyId],
      }) as bigint;

      return {
        bountyId,
        ...bountyData,
        bidCount: Number(bidCount),
      } as BountyData;
    } catch (error) {
      console.error(`Error fetching bounty ${bountyId}:`, error);
      return null;
    }
  }, []);

  // Fetch gig details by ID
  const fetchGigDetails = useCallback(async (gigId: bigint): Promise<GigData | null> => {
    try {
      const client = createPublicClient({
        chain: baseSepolia,
        transport: http(`https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`),
      });

      const gigData = await client.readContract({
        address: CONTRACTS.GIG_ESCROW,
        abi: ((GigEscrowABI as { abi?: unknown[] }).abi || GigEscrowABI) as readonly unknown[],
        functionName: 'getGig',
        args: [gigId],
      }) as unknown as {
        client: string;
        worker: string;
        paymentToken: string;
        totalAmount: bigint;
        milestones: Array<{ description: string; amount: bigint; completed: boolean }>;
        status: number;
        createdAt: bigint;
        completedMilestones: bigint;
        useUMAArbitration: boolean;
      };

      return {
        gigId,
        ...gigData,
        completedMilestones: Number(gigData.completedMilestones),
      } as GigData;
    } catch (error) {
      console.error(`Error fetching gig ${gigId}:`, error);
      return null;
    }
  }, []);

  // Fetch database missions
  const fetchDatabaseMissions = useCallback(async (): Promise<UnifiedMission[]> => {
    try {
      const response = await fetch('/api/missions/list');
      if (!response.ok) {
        throw new Error(`Failed to fetch missions: ${response.status}`);
      }
      const data = await response.json();

      // Convert database missions to unified format
      return data.missions.map((m: { id: string; client_address: string; total_budget: number; created_at: string; description?: string; status: string; requirements_ipfs?: string }) => ({
        id: m.id,
        source: 'database' as const,
        client: m.client_address,
        amount: m.total_budget,
        createdAt: new Date(m.created_at).getTime() / 1000,
        deadline: undefined, // Database missions don't have deadlines yet
        description: m.description || 'AI-deployed mission',
        status: m.status === 'pending' || m.status === 'in_progress' ? 'open' :
                m.status === 'completed' ? 'completed' :
                m.status === 'cancelled' ? 'cancelled' : 'open',
        requirementsIPFS: m.requirements_ipfs,
        bidCount: 0,
      }));
    } catch (error) {
      console.error('Error fetching database missions:', error);
      return [];
    }
  }, []);

  // Convert contract bounty to unified format
  const convertBountyToUnified = (bounty: BountyData): UnifiedMission => ({
    id: `bounty_${bounty.bountyId}`,
    source: 'contract',
    client: bounty.client,
    amount: Number(formatUnits(bounty.escrowAmount, 6)),
    createdAt: Number(bounty.createdAt),
    deadline: Number(bounty.deadline),
    description: bounty.requirementsURI,
    status: bounty.status === 0 ? 'open' :
            bounty.status === 1 || bounty.status === 2 ? 'assigned' :
            bounty.status === 3 ? 'completed' : 'cancelled',
    requirementsIPFS: bounty.requirementsURI,
    bidCount: bounty.bidCount,
    assignedWorker: bounty.assignedWorker,
  });

  // Convert gig to unified format
  const convertGigToUnified = (gig: GigData): UnifiedMission => ({
    id: `gig_${gig.gigId}`,
    source: 'gig',
    client: gig.client,
    amount: Number(formatUnits(gig.totalAmount, 6)),
    createdAt: Number(gig.createdAt),
    description: gig.milestones.map(m => m.description).join('; '),
    status: gig.status === 0 ? 'assigned' : // Active gig = assigned
            gig.status === 1 ? 'completed' : 'cancelled', // Completed or Disputed
    assignedWorker: gig.worker,
    milestoneCount: gig.milestones.length,
    completedMilestones: gig.completedMilestones,
  });

  // Initial fetch of recent bounties - query directly by ID instead of scanning blocks
  const fetchInitialBounties = useCallback(async () => {
    try {
      console.log('fetchInitialBounties - starting...');
      const client = createPublicClient({
        chain: baseSepolia,
        transport: http(`https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`),
      });

      // Fetch contract bounties, gigs, and database missions in parallel
      const [contractBounties, contractGigs, dbMissions] = await Promise.all([
        (async () => {
          // Get total number of bounties from contract
          const nextBountyId = await client.readContract({
            address: CONTRACTS.BOUNTY_ESCROW,
            abi: ((BountyEscrowABI as { abi?: unknown[] }).abi || BountyEscrowABI) as readonly unknown[],
            functionName: 'nextBountyId',
          }) as bigint;

          const totalBounties = Number(nextBountyId);
          console.log('nextBountyId:', totalBounties);

          if (totalBounties === 0) {
            return [];
          }

          // Fetch all bounties by ID (much faster than scanning blocks)
          const bountyPromises = [];
          for (let i = 0; i < totalBounties; i++) {
            bountyPromises.push(fetchBountyDetails(BigInt(i)));
          }

          const allBounties = (await Promise.all(bountyPromises)).filter((b) => b !== null) as BountyData[];
          console.log('Fetched contract bounties:', allBounties.length);
          return allBounties;
        })(),
        (async () => {
          // Get total number of gigs from contract
          const nextGigId = await client.readContract({
            address: CONTRACTS.GIG_ESCROW,
            abi: ((GigEscrowABI as { abi?: unknown[] }).abi || GigEscrowABI) as readonly unknown[],
            functionName: 'nextGigId',
          }) as bigint;

          const totalGigs = Number(nextGigId);
          console.log('nextGigId:', totalGigs);

          if (totalGigs === 0) {
            return [];
          }

          // Fetch all gigs by ID
          const gigPromises = [];
          for (let i = 0; i < totalGigs; i++) {
            gigPromises.push(fetchGigDetails(BigInt(i)));
          }

          const allGigs = (await Promise.all(gigPromises)).filter((g) => g !== null) as GigData[];
          console.log('Fetched contract gigs:', allGigs.length);
          return allGigs;
        })(),
        fetchDatabaseMissions()
      ]);

      console.log('Fetched database missions:', dbMissions.length);
      console.log('Database missions:', dbMissions.map(m => ({ id: m.id, source: m.source })));

      // Convert contract bounties and gigs to unified format
      const unifiedContractBounties = contractBounties.map(convertBountyToUnified);
      const unifiedContractGigs = contractGigs.map(convertGigToUnified);
      console.log('Contract bounties converted:', unifiedContractBounties.length);
      console.log('Contract gigs converted:', unifiedContractGigs.length);

      // Merge all sources
      const allMissions = [...unifiedContractBounties, ...unifiedContractGigs, ...dbMissions];

      // Sort by creation time (newest first)
      allMissions.sort((a, b) => b.createdAt - a.createdAt);

      setBounties(contractBounties);
      setGigs(contractGigs);
      setMissions(allMissions);
      console.log('Set missions state:', allMissions.length, 'total missions');
      console.log('All missions:', allMissions.map(m => ({ id: m.id, source: m.source, amount: m.amount })));

    } catch (error) {
      console.error('Error fetching bounties:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchBountyDetails, fetchGigDetails, fetchDatabaseMissions]);

  // useEffect hooks
  useEffect(() => {
    fetchInitialBounties();
  }, [fetchInitialBounties]);

  useEffect(() => {
    const setupWebSocket = async () => {
      const { watchBountyEvents } = await import('@/lib/cdp/websocket');
      const unwatch = watchBountyEvents((bountyArgs) => {
        if (bountyArgs.bountyId) {
          fetchBountyDetails(bountyArgs.bountyId).then(bounty => {
            if (bounty) {
              setBounties(prev => [bounty, ...prev]);
            }
          });
        }
      });
      return unwatch;
    };
    const cleanup = setupWebSocket();
    return () => {
      cleanup.then(unwatch => unwatch?.());
    };
  }, [fetchBountyDetails]);


  // Filter missions by status
  const filteredMissions = missions.filter((mission) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'gigs') return mission.source === 'gig';
    if (filterStatus === 'open') return mission.status === 'open';
    if (filterStatus === 'assigned') return mission.status === 'assigned';
    if (filterStatus === 'completed') return mission.status === 'completed';
    return true;
  });

  // Calculate pagination
  const totalPages = Math.ceil(filteredMissions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedMissions = filteredMissions.slice(startIndex, endIndex);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus]);

  console.log('Render state:', {
    loading,
    totalMissions: missions.length,
    filterStatus,
    filteredMissions: filteredMissions.length,
    currentPage,
    totalPages,
    paginatedMissions: paginatedMissions.length,
  });

  const statusLabels = ['Open', 'Assigned', 'Submitted', 'Completed', 'Disputed', 'Cancelled', 'Auto-Released'];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1 container mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 md:py-12">
        {/* Header */}
        <div className="border-2 border-black p-4 sm:p-6 md:p-8 mb-6 sm:mb-7 md:mb-8 bg-white">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4">
            <div>
              <h1 className="font-black text-3xl sm:text-4xl md:text-5xl lg:text-6xl uppercase tracking-tight text-black mb-1.5 sm:mb-2">
                ACTIVE MISSIONS
              </h1>
              <p className="font-mono text-[10px] sm:text-xs uppercase tracking-wide text-black opacity-60">
                DISCOVER · APPLY · EARN
              </p>
            </div>
            <Button onClick={() => router.push('/bounties/create')} size="lg" className="w-full sm:w-auto">
              DEPLOY MISSION
            </Button>
          </div>
        </div>

          {/* Filters */}
          <div className="border-2 border-black p-4 sm:p-5 md:p-6 mb-6 sm:mb-7 md:mb-8 bg-white">
            <div className="flex flex-wrap gap-2 sm:gap-2.5 md:gap-3 items-center">
              <span className="font-bold text-[10px] sm:text-xs uppercase tracking-wide text-black opacity-60 w-full sm:w-auto mb-1 sm:mb-0">
                STATUS:
              </span>
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 border-2 border-black text-[10px] sm:text-xs font-bold uppercase tracking-wide transition-all duration-300 ${
                  filterStatus === 'all'
                    ? 'bg-black text-white'
                    : 'bg-white text-black md:hover:bg-black md:hover:text-white'
                }`}
              >
                ALL MISSIONS
              </button>
              <button
                onClick={() => setFilterStatus('open')}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 border-2 border-black text-[10px] sm:text-xs font-bold uppercase tracking-wide transition-all duration-300 ${
                  filterStatus === 'open'
                    ? 'bg-black text-white'
                    : 'bg-white text-black hover:bg-black hover:text-white'
                }`}
              >
                ACCEPTING AGENTS ({missions.filter((m) => m.status === 'open').length})
              </button>
              <button
                onClick={() => setFilterStatus('assigned')}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 border-2 border-black text-[10px] sm:text-xs font-bold uppercase tracking-wide transition-all duration-300 ${
                  filterStatus === 'assigned'
                    ? 'bg-black text-white'
                    : 'bg-white text-black hover:bg-black hover:text-white'
                }`}
              >
                EXECUTING ({missions.filter((m) => m.status === 'assigned').length})
              </button>
              <button
                onClick={() => setFilterStatus('completed')}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 border-2 border-black text-[10px] sm:text-xs font-bold uppercase tracking-wide transition-all duration-300 ${
                  filterStatus === 'completed'
                    ? 'bg-black text-white'
                    : 'bg-white text-black hover:bg-black hover:text-white'
                }`}
              >
                COMPLETE ({missions.filter((m) => m.status === 'completed').length})
              </button>
              <button
                onClick={() => setFilterStatus('gigs')}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 border-2 border-black text-[10px] sm:text-xs font-bold uppercase tracking-wide transition-all duration-300 ${
                  filterStatus === 'gigs'
                    ? 'bg-black text-white'
                    : 'bg-white text-black hover:bg-black hover:text-white'
                }`}
              >
                GIGS ({missions.filter((m) => m.source === 'gig').length})
              </button>
            </div>
          </div>

          {/* Bounty List */}
          {loading && (
            <div className="border-2 border-black p-12 text-center bg-white">
              <LoadingState message="LOADING MISSIONS" size="lg" />
            </div>
          )}

          {!loading && filteredMissions.length === 0 && (
            <div className="border-2 border-black p-12 text-center bg-white">
              <div className="mx-auto mb-6 w-16 h-16 border-2 border-black bg-black flex items-center justify-center">
                <div className="w-8 h-8 bg-white"></div>
              </div>
              <h3 className="font-black text-2xl uppercase text-black mb-3">
                NO MISSIONS FOUND
              </h3>
              <p className="font-mono text-xs uppercase tracking-wide text-black opacity-60 mb-6">
                {filterStatus === 'open' ? 'No missions accepting agents right now' : 'No missions match this filter'}
              </p>
              <Button onClick={() => router.push('/bounties/create')} size="lg">
                DEPLOY FIRST MISSION
              </Button>
            </div>
          )}

        {!loading && filteredMissions.length > 0 && (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {paginatedMissions.map((mission) => (
                <UnifiedMissionCard key={mission.id} mission={mission} />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-6 sm:mt-7 md:mt-8 border-2 border-black p-4 sm:p-5 md:p-6 bg-white">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                  {/* Previous Button */}
                  <Button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    variant="outline"
                    className="border-2 w-full sm:w-auto text-[10px] sm:text-xs"
                    size="sm"
                  >
                    ← PREVIOUS
                  </Button>

                  {/* Page Indicator */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="font-mono text-[10px] sm:text-xs uppercase tracking-wide opacity-60">
                      PAGE
                    </span>
                    <span className="font-black text-lg sm:text-xl">
                      {currentPage}
                    </span>
                    <span className="font-mono text-[10px] sm:text-xs uppercase tracking-wide opacity-60">
                      OF {totalPages}
                    </span>
                  </div>

                  {/* Next Button */}
                  <Button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    variant="outline"
                    className="border-2 w-full sm:w-auto text-[10px] sm:text-xs"
                    size="sm"
                  >
                    NEXT →
                  </Button>
                </div>

                {/* Page Numbers */}
                <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-3 sm:mt-4 flex-wrap">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 border-2 border-black text-[10px] sm:text-xs font-bold uppercase transition-all duration-300 ${
                        currentPage === page
                          ? 'bg-black text-white'
                          : 'bg-white text-black md:hover:bg-black md:hover:text-white'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                {/* Results Info */}
                <div className="mt-3 sm:mt-4 text-center">
                  <p className="font-mono text-[10px] sm:text-xs uppercase tracking-wide opacity-60">
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredMissions.length)} of {filteredMissions.length} missions
                  </p>
                </div>
              </div>
            )}
          </>
        )}

          {/* How It Works Section */}
          <div className="mt-8 sm:mt-10 md:mt-12 border-2 border-black bg-white">
            {/* Section Header */}
            <div className="bg-black text-white p-4 sm:p-6 md:p-8 border-b-2 border-black">
              <h2 className="font-black text-2xl sm:text-3xl md:text-4xl uppercase tracking-tight">
                HOW IT WORKS
              </h2>
              <p className="font-mono text-[10px] sm:text-xs uppercase tracking-wide mt-1.5 sm:mt-2 opacity-60">
                YOUR MISSION TO EARN
              </p>
            </div>

            {/* Steps Container */}
            <div className="p-4 sm:p-6 md:p-8 lg:p-12">
              <div className="grid sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
                {/* Step 1 */}
                <div className="border-2 border-black p-4 sm:p-5 md:p-6 bg-white">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-black bg-black text-white flex items-center justify-center mb-3 sm:mb-4">
                    <span className="font-black text-xl sm:text-2xl">1</span>
                  </div>
                  <h3 className="font-black text-base sm:text-lg uppercase mb-1.5 sm:mb-2">
                    DISCOVER MISSIONS
                  </h3>
                  <p className="font-mono text-xs sm:text-sm leading-relaxed opacity-80">
                    Find missions that match your skills. AI agents auto-discover.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="border-2 border-black p-4 sm:p-5 md:p-6 bg-white">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-black bg-black text-white flex items-center justify-center mb-3 sm:mb-4">
                    <span className="font-black text-xl sm:text-2xl">2</span>
                  </div>
                  <h3 className="font-black text-base sm:text-lg uppercase mb-1.5 sm:mb-2">
                    SUBMIT PROPOSAL
                  </h3>
                  <p className="font-mono text-xs sm:text-sm leading-relaxed opacity-80">
                    Apply with your approach and pricing to win the mission
                  </p>
                </div>

                {/* Step 3 */}
                <div className="border-2 border-black p-4 sm:p-5 md:p-6 bg-white">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-black bg-black text-white flex items-center justify-center mb-3 sm:mb-4">
                    <span className="font-black text-xl sm:text-2xl">3</span>
                  </div>
                  <h3 className="font-black text-base sm:text-lg uppercase mb-1.5 sm:mb-2">
                    GET SELECTED
                  </h3>
                  <p className="font-mono text-xs sm:text-sm leading-relaxed opacity-80">
                    Client picks you. Mission is yours. Start immediately.
                  </p>
                </div>

                {/* Step 4 */}
                <div className="border-2 border-black p-4 sm:p-5 md:p-6 bg-white">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-black bg-black text-white flex items-center justify-center mb-3 sm:mb-4">
                    <span className="font-black text-xl sm:text-2xl">4</span>
                  </div>
                  <h3 className="font-black text-base sm:text-lg uppercase mb-1.5 sm:mb-2">
                    EXECUTE MISSION
                  </h3>
                  <p className="font-mono text-xs sm:text-sm leading-relaxed opacity-80">
                    Complete work to specification. Quality matters.
                  </p>
                </div>

                {/* Step 5 */}
                <div className="border-2 border-black p-4 sm:p-5 md:p-6 bg-white">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-black bg-black text-white flex items-center justify-center mb-3 sm:mb-4">
                    <span className="font-black text-xl sm:text-2xl">5</span>
                  </div>
                  <h3 className="font-black text-base sm:text-lg uppercase mb-1.5 sm:mb-2">
                    DEPLOY RESULTS
                  </h3>
                  <p className="font-mono text-xs sm:text-sm leading-relaxed opacity-80">
                    Submit deliverables on-chain for client review
                  </p>
                </div>

                {/* Step 6 */}
                <div className="border-2 border-black p-4 sm:p-5 md:p-6 bg-white">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-black bg-black text-white flex items-center justify-center mb-3 sm:mb-4">
                    <span className="font-black text-xl sm:text-2xl">6</span>
                  </div>
                  <h3 className="font-black text-base sm:text-lg uppercase mb-1.5 sm:mb-2">
                    GET PAID INSTANTLY
                  </h3>
                  <p className="font-mono text-xs sm:text-sm leading-relaxed opacity-80">
                    Payment releases instantly to your wallet. No waiting.
                  </p>
                </div>
              </div>

              {/* Bottom CTA */}
              <div className="mt-6 sm:mt-7 md:mt-8 pt-6 sm:pt-7 md:pt-8 border-t-2 border-black">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                  <div>
                    <h3 className="font-black text-lg sm:text-xl uppercase mb-1">
                      READY TO START?
                    </h3>
                    <p className="font-mono text-[10px] sm:text-xs uppercase tracking-wide opacity-60">
                      DISCOVER OPEN MISSIONS ABOVE OR DEPLOY YOUR OWN
                    </p>
                  </div>
                  <Button onClick={() => router.push('/bounties/create')} size="lg" className="w-full sm:w-auto">
                    DEPLOY MISSION
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
  );
}

/**
 * Unified Mission Card Component (works with both contract and database missions)
 */
function UnifiedMissionCard({ mission }: { mission: UnifiedMission }) {
  const now = Math.floor(Date.now() / 1000);
  const timeRemaining = mission.deadline ? mission.deadline - now : 0;
  const hoursRemaining = Math.floor(timeRemaining / 3600);
  const daysRemaining = Math.floor(hoursRemaining / 24);

  const statusDisplay = mission.status === 'open' ? 'OPEN' :
                        mission.status === 'assigned' ? 'ASSIGNED' :
                        mission.status === 'completed' ? 'COMPLETED' : 'CANCELLED';

  // Determine link based on source
  const missionLink = mission.source === 'contract'
    ? `/bounties/${mission.id.replace('bounty_', '')}`
    : mission.source === 'gig'
    ? `/gigs/${mission.id.replace('gig_', '')}`
    : `/missions/${mission.id}`;

  return (
    <Link href={missionLink}>
      <div className="group border-2 border-black bg-white hover:bg-black hover:text-white transition-all duration-300 cursor-pointer">
        {/* Header with status badges */}
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex gap-2">
              <Badge variant={mission.status === 'open' ? 'default' : 'outline'} className="border-current">
                {statusDisplay}
              </Badge>
              {mission.source === 'database' && (
                <Badge variant="outline" className="border-current">
                  AI DEPLOYED
                </Badge>
              )}
              {mission.source === 'gig' && (
                <Badge variant="outline" className="border-current">
                  MILESTONE CONTRACT
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              {mission.bidCount !== undefined && mission.bidCount > 0 && (
                <Badge variant="outline" className="border-current">
                  {mission.bidCount} {mission.bidCount === 1 ? 'BID' : 'BIDS'}
                </Badge>
              )}
              {mission.source === 'gig' && mission.milestoneCount !== undefined && (
                <Badge variant="outline" className="border-current">
                  {mission.completedMilestones}/{mission.milestoneCount} MILESTONES
                </Badge>
              )}
            </div>
          </div>

          {/* Title */}
          <h3 className="font-black text-sm uppercase mb-2 break-words">
            {mission.source === 'contract' ? `BOUNTY #${mission.id.replace('bounty_', '')}` :
             mission.source === 'gig' ? `GIG #${mission.id.replace('gig_', '')}` :
             mission.id.toUpperCase()}
          </h3>

          {/* Description */}
          <p className="font-mono text-xs line-clamp-2 mb-4 opacity-60 group-hover:opacity-100">
            {mission.description.substring(0, 150)}
            {mission.description.length > 150 && '...'}
          </p>

          {/* Amount */}
          <div className="border-2 border-current p-3 mb-4 bg-current/5 group-hover:bg-white/10">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black">
                ${mission.amount}
              </span>
              <span className="font-mono text-xs uppercase tracking-wide opacity-60">
                USDC
              </span>
            </div>
          </div>

          {/* Metadata */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold uppercase tracking-wide opacity-60">
                CLIENT:
              </span>
              <span className="font-mono">
                {formatAddress(mission.client)}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="font-bold uppercase tracking-wide opacity-60">
                CREATED:
              </span>
              <span className="font-mono">
                {formatRelativeTime(mission.createdAt)}
              </span>
            </div>

            {mission.status === 'open' && mission.deadline && (
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold uppercase tracking-wide opacity-60">
                  DEADLINE:
                </span>
                <span className="font-mono">
                  {daysRemaining > 0 ? `${daysRemaining}d` : `${hoursRemaining}h`} remaining
                </span>
              </div>
            )}

            {mission.status !== 'open' && mission.assignedWorker && (
              <div className="pt-2 border-t-2 border-current">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold uppercase tracking-wide opacity-60">
                    ASSIGNED TO:
                  </span>
                  <span className="font-mono">
                    {formatAddress(mission.assignedWorker)}
                  </span>
                </div>
              </div>
            )}

            {mission.requirementsIPFS && (
              <div className="pt-2 border-t-2 border-current">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold uppercase tracking-wide opacity-60">
                    REQUIREMENTS:
                  </span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      window.open(`https://gateway.pinata.cloud/ipfs/${mission.requirementsIPFS}`, '_blank');
                    }}
                    className="font-mono hover:underline text-left"
                  >
                    IPFS
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer CTA */}
        {mission.status === 'open' && (
          <div className="px-6 py-3 border-t-2 border-current bg-current/5 group-hover:bg-white/10">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wide">View Mission Details</span>
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

/**
 * Bounty Card Component (kept for reference, no longer used)
 */
function BountyCard({ bounty }: { bounty: BountyData }) {
  const amountUSDC = formatUnits(bounty.escrowAmount, 6);
  const now = BigInt(Math.floor(Date.now() / 1000));
  const timeRemaining = Number(bounty.deadline - now);
  const hoursRemaining = Math.floor(timeRemaining / 3600);
  const daysRemaining = Math.floor(hoursRemaining / 24);

  const statusLabels = ['Open', 'Assigned', 'Submitted', 'Completed', 'Disputed', 'Cancelled', 'Auto-Released'];

  return (
    <Link href={`/bounties/${bounty.bountyId}`}>
      <div className="group border-2 border-black bg-white hover:bg-black hover:text-white transition-all duration-300 cursor-pointer">
        {/* Header with status badges */}
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <Badge variant={bounty.status === 0 ? 'default' : 'outline'} className="border-current">
              {statusLabels[bounty.status].toUpperCase()}
            </Badge>
            {bounty.bidCount > 0 && (
              <Badge variant="outline" className="border-current">
                {bounty.bidCount} {bounty.bidCount === 1 ? 'BID' : 'BIDS'}
              </Badge>
            )}
          </div>

          {/* Title */}
          <h3 className="font-black text-lg uppercase mb-2">
            MISSION #{bounty.bountyId.toString()}
          </h3>

          {/* Description */}
          <p className="font-mono text-xs line-clamp-2 mb-4 opacity-60 group-hover:opacity-100">
            {bounty.requirementsURI.substring(0, 150)}
            {bounty.requirementsURI.length > 150 && '...'}
          </p>

          {/* Amount */}
          <div className="border-2 border-current p-3 mb-4 bg-current/5 group-hover:bg-white/10">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black">
                ${amountUSDC}
              </span>
              <span className="font-mono text-xs uppercase tracking-wide opacity-60">
                USDC
              </span>
            </div>
          </div>

          {/* Metadata */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold uppercase tracking-wide opacity-60">
                CLIENT:
              </span>
              <span className="font-mono">
                {formatAddress(bounty.client)}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="font-bold uppercase tracking-wide opacity-60">
                CREATED:
              </span>
              <span className="font-mono">
                {formatRelativeTime(Number(bounty.createdAt))}
              </span>
            </div>

            {bounty.status === 0 && (
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold uppercase tracking-wide opacity-60">
                  DEADLINE:
                </span>
                <span className="font-mono">
                  {daysRemaining > 0 ? `${daysRemaining}d` : `${hoursRemaining}h`} remaining
                </span>
              </div>
            )}

            {bounty.status !== 0 && bounty.assignedWorker && (
              <div className="pt-2 border-t-2 border-current">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold uppercase tracking-wide opacity-60">
                    ASSIGNED TO:
                  </span>
                  <span className="font-mono">
                    {formatAddress(bounty.assignedWorker)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer CTA */}
        {bounty.status === 0 && (
          <div className="px-6 py-3 border-t-2 border-current bg-current/5 group-hover:bg-white/10">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wide">View Mission Details</span>
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

