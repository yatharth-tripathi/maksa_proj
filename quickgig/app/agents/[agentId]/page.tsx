'use client';

import { use, useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loader';
import { formatAddress } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useAccount, usePublicClient } from 'wagmi';
import { toast } from 'sonner';
import type { Address } from 'viem';
import { getAgentById, type EnhancedAgentData } from '@/lib/erc8004/unified-discovery';

interface AgentProfile {
  id: string;
  name: string;
  address: Address;
  capabilities: string[];
  agent_type: 'ai' | 'human' | 'hybrid';
  reputation_score: number;
  success_rate: number;
  total_missions: number;
  pricing_per_task: number;
  bio?: string;
  avatar_url?: string;
  endpoint_url?: string;
  created_at: string;
}

export default function AgentProfilePage({ params }: { params: Promise<{ agentId: string }> }) {
  const router = useRouter();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { agentId } = use(params);
  const [agent, setAgent] = useState<EnhancedAgentData | null>(null);
  const [dbAgent, setDbAgent] = useState<AgentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [erc8004Id, setErc8004Id] = useState<string>('0');
  const [registrationTxHash, setRegistrationTxHash] = useState<string>('');

  useEffect(() => {
    async function fetchAgent() {
      try {
        setIsLoading(true);

        // First get DB agent to find ERC-8004 ID mapping
        const dbResponse = await fetch(`/api/agents/${agentId}`);
        if (dbResponse.ok) {
          const dbData = await dbResponse.json();
          setDbAgent(dbData);

          // Get ERC-8004 ID from mapping
          const mapping: Record<string, string> = {
            'agent_1760886157698_lzy2czh83': '2',
            'agent_1760886159008_0qns6xy6u': '3',
            'agent_1760886159300_zitacvck8': '4',
          };
          const nftId = mapping[agentId] || '0';
          setErc8004Id(nftId);

          // Now query blockchain for on-chain data
          if (publicClient && nftId !== '0') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const onChainAgent = await getAgentById(publicClient as any, nftId);
            if (onChainAgent) {
              setAgent(onChainAgent);

              // Query blockchain for registration transaction
              try {
                const IDENTITY_REGISTRY = '0x8004AA63c570c570eBF15376c0dB199918BFe9Fb' as const;
                const logs = await publicClient.getLogs({
                  address: IDENTITY_REGISTRY,
                  event: {
                    type: 'event',
                    name: 'Registered',
                    inputs: [
                      { name: 'agentId', type: 'uint256', indexed: true },
                      { name: 'tokenURI', type: 'string', indexed: false },
                      { name: 'owner', type: 'address', indexed: true },
                    ],
                  },
                  args: {
                    agentId: BigInt(nftId),
                  },
                  fromBlock: 0n,
                  toBlock: 'latest',
                });

                if (logs.length > 0) {
                  setRegistrationTxHash(logs[0].transactionHash);
                }
              } catch (err) {
                console.error('Failed to fetch registration transaction:', err);
              }
            } else {
              setError('Agent not found on-chain');
            }
          }
        } else {
          setError('Agent not found');
        }
      } catch (err) {
        setError('Failed to load agent');
        console.error('Error fetching agent:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAgent();
  }, [agentId, publicClient]);

  const handleHireAgent = () => {
    if (address && agent?.owner.toLowerCase() === address.toLowerCase()) {
      toast.error('Cannot hire your own agent');
      return;
    }
    router.push(`/chat?agent=${agentId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <main className="flex-1 container mx-auto px-8 py-12">
          <LoadingState message="Loading agent profile..." size="lg" />
        </main>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <main className="flex-1 container mx-auto px-8 py-12">
          <div className="border-2 border-black p-12 text-center bg-white">
            <div className="w-16 h-16 border-2 border-black mx-auto mb-6 flex items-center justify-center">
              <span className="text-4xl">X</span>
            </div>
            <h2 className="font-black text-2xl uppercase tracking-tight mb-4">
              AGENT NOT FOUND
            </h2>
            <p className="font-mono text-xs uppercase tracking-wide text-black/60 mb-6">
              This agent does not exist in the database
            </p>
            <Button onClick={() => router.push('/agents')}>
              BROWSE ALL AGENTS
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const agentTypeLabel = agent.agentType === 'ai' ? 'AI' : agent.agentType === 'human' ? 'HUMAN' : 'HYBRID';
  const statusColor = agent.reputation.averageScore >= 70 ? 'bg-green-500' : agent.reputation.averageScore >= 50 ? 'bg-yellow-500' : 'bg-gray-500';

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1 container mx-auto px-8 py-12">
        {/* Back Button */}
        <button
          onClick={() => router.push('/agents')}
          className="font-mono text-xs uppercase tracking-wide text-black/60 hover:text-black transition-colors mb-8"
        >
          ← BACK TO AGENTS
        </button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Agent Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Agent Header */}
            <div className="border-2 border-black p-8 bg-white">
              <div className="flex items-start gap-6 mb-6">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {dbAgent?.avatar_url ? (
                    <img
                      src={dbAgent.avatar_url}
                      alt={agent.name}
                      className="w-24 h-24 border-2 border-black object-cover"
                    />
                  ) : (
                    <div className="w-24 h-24 border-2 border-black bg-gray-100 flex items-center justify-center">
                      <div className="w-12 h-12 bg-black" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge className="bg-black text-white border-black">
                      {agentTypeLabel}
                    </Badge>
                    <div className="flex items-center gap-2 px-3 py-1 border-2 border-black">
                      <div className={`w-2 h-2 ${statusColor}`} />
                      <span className="font-mono text-xs uppercase">ACTIVE</span>
                    </div>
                  </div>

                  <h1 className="font-black text-4xl uppercase tracking-tight text-black mb-2">
                    {agent.name}
                  </h1>

                  <p className="font-mono text-xs text-black/60 mb-1">
                    ERC-8004 ID: #{erc8004Id}
                  </p>
                  <p className="font-mono text-xs text-black/60">
                    Wallet: {formatAddress(agent.owner)}
                  </p>
                </div>
              </div>

              {/* Bio */}
              {agent.description && (
                <div className="border-t-2 border-black pt-6">
                  <p className="font-mono text-sm leading-relaxed">
                    {agent.description}
                  </p>
                </div>
              )}
            </div>

            {/* Capabilities */}
            <div className="border-2 border-black p-6 bg-white">
              <h2 className="font-bold text-xs uppercase tracking-wide mb-4">
                CAPABILITIES
              </h2>
              <div className="flex flex-wrap gap-2">
                {agent.capabilities.map((capability) => (
                  <div
                    key={capability}
                    className="px-4 py-2 border-2 border-black bg-white font-mono text-xs uppercase"
                  >
                    {capability.replace(/-/g, ' ')}
                  </div>
                ))}
              </div>
            </div>

            {/* Reputation */}
            <div className="border-2 border-black p-6 bg-white">
              <h2 className="font-bold text-xs uppercase tracking-wide mb-6">
                REPUTATION & PERFORMANCE
              </h2>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="font-mono text-xs uppercase text-black/60 mb-2">
                    REPUTATION SCORE
                  </div>
                  <div className="font-black text-4xl">{agent.reputation.averageScore}</div>
                  <div className="font-mono text-xs text-black/60">out of 100 (on-chain)</div>
                </div>

                <div>
                  <div className="font-mono text-xs uppercase text-black/60 mb-2">
                    RATING
                  </div>
                  <div className="font-black text-4xl">{agent.reputation.rating.toFixed(1)}</div>
                  <div className="font-mono text-xs text-black/60">stars (★)</div>
                </div>

                <div>
                  <div className="font-mono text-xs uppercase text-black/60 mb-2">
                    TOTAL REVIEWS
                  </div>
                  <div className="font-black text-4xl">{agent.reputation.count}</div>
                  <div className="font-mono text-xs text-black/60">on-chain feedback</div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column - Actions & Stats */}
          <div className="space-y-6">
            {/* Pricing */}
            <div className="border-2 border-black p-6 bg-black text-white">
              <div className="font-mono text-xs uppercase tracking-wide mb-2">
                PRICING
              </div>
              <div className="font-black text-5xl mb-1">
                ${dbAgent?.pricing_per_task || agent.pricing?.perTask || 0}
              </div>
              <div className="font-mono text-xs opacity-60">
                PER TASK (USDC)
              </div>
            </div>

            {/* Quick Stats */}
            <div className="border-2 border-black p-6 bg-white">
              <h3 className="font-bold text-xs uppercase tracking-wide mb-4">
                QUICK STATS (ON-CHAIN)
              </h3>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs uppercase text-black/60">
                    AGENT TYPE
                  </span>
                  <span className="font-mono text-sm font-bold">
                    {agentTypeLabel}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs uppercase text-black/60">
                    CAPABILITIES
                  </span>
                  <span className="font-mono text-sm font-bold">
                    {agent.capabilities.length}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs uppercase text-black/60">
                    REPUTATION TIER
                  </span>
                  <span className="font-mono text-sm font-bold">
                    {agent.reputation.tier}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button
                className="w-full"
                onClick={handleHireAgent}
              >
                HIRE THIS AGENT
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push(`/bounties/create?agent=${agentId}`)}
              >
                CREATE BOUNTY
              </Button>
            </div>

            {/* ERC-8004 Registry Info */}
            <div className="border-2 border-black p-4 bg-white">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 bg-black" />
                <span className="font-mono text-xs uppercase font-bold">
                  ERC-8004 REGISTRY
                </span>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="font-mono text-xs text-black/60 mb-1">Agent NFT ID</p>
                  <p className="font-mono text-sm font-bold">#{erc8004Id}</p>
                </div>
                <div>
                  <p className="font-mono text-xs text-black/60 mb-1">Contract</p>
                  <p className="font-mono text-xs break-all">0x8004...e9Fb</p>
                </div>
                {registrationTxHash && (
                  <div>
                    <p className="font-mono text-xs text-black/60 mb-1">Registration Tx</p>
                    <p className="font-mono text-xs break-all">{registrationTxHash.slice(0, 10)}...{registrationTxHash.slice(-8)}</p>
                  </div>
                )}
                <div className="border-t border-black/20 pt-3 space-y-2">
                  <a
                    href={`https://sepolia.basescan.org/token/0x8004AA63c570c570eBF15376c0dB199918BFe9Fb?a=${erc8004Id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs text-black hover:underline w-full"
                  >
                    <span>View NFT on BaseScan</span>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                  {registrationTxHash && (
                    <a
                      href={`https://sepolia.basescan.org/tx/${registrationTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-xs text-black hover:underline w-full"
                    >
                      <span>View Registration Transaction</span>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
