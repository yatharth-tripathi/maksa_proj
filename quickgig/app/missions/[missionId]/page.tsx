'use client';

import { use, useState, useEffect } from 'react';
import { LoadingState } from '@/components/ui/loader';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatAddress, formatRelativeTime } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';
import { parseUnits, type Address } from 'viem';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { FeedbackModal } from '@/components/missions/feedback-modal';
import { ValidationRequestModal } from '@/components/missions/validation-request-modal';
import { DisputeModal } from '@/components/missions/dispute-modal';
import {
  useApproveDeliverable,
  useDisputeDeliverable,
  useMissionStatus,
  MissionStatus,
  formatMissionStatus,
  getTimeUntilAutoRelease,
} from '@/lib/contracts/missionEscrow';

interface Mission {
  id: string;
  client_address: string;
  description?: string;
  total_budget: number;
  orchestration_mode: 'sequential' | 'parallel';
  status: 'pending' | 'in_progress' | 'submitted' | 'validating' | 'disputing' | 'completed' | 'failed' | 'cancelled' | 'funded' | 'approved' | 'auto_released';
  escrow_tx_hash?: string;
  escrow_contract_id?: number;
  deliverable_uri?: string;
  submitted_at?: string;
  auto_release_time?: string;
  validation_id?: number;
  validation_status?: 'pending' | 'approved' | 'rejected' | 'none';
  dispute_assertion_id?: string;
  dispute_status?: 'pending' | 'resolved' | 'none';
  requirements_ipfs?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

interface MissionAgent {
  id: number;
  mission_id: string;
  agent_id: string;
  capability: string;
  payment_amount: number;
  requirements?: string;
  position?: number;
  created_at: string;
}

interface MissionExecution {
  id: number;
  mission_id: string;
  agent_id: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result_data?: Record<string, unknown>;
  deliverable_uri?: string;
  tx_hash?: string;
  paid_amount?: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

interface AgentProfile {
  id: string;
  name: string;
  address: string;
  capabilities: string[];
  agent_type: 'ai' | 'human';
  reputation_score: number;
  avatar_url?: string;
}

const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address;

const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export default function MissionDetailPage({ params }: { params: Promise<{ missionId: string }> }) {
  const router = useRouter();
  const { missionId } = use(params);
  const { address: walletAddress, isConnected } = useAccount();

  const [mission, setMission] = useState<Mission | null>(null);
  const [agents, setAgents] = useState<MissionAgent[]>([]);
  const [executions, setExecutions] = useState<MissionExecution[]>([]);
  const [agentProfiles, setAgentProfiles] = useState<Record<string, AgentProfile>>({});
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [pendingTxType, setPendingTxType] = useState<'payment' | 'feedback' | null>(null);

  const { writeContract, data: txHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Escrow hooks
  const { approveDeliverable, isPending: isApproving } = useApproveDeliverable();
  const { disputeDeliverable, isPending: isDisputing } = useDisputeDeliverable();

  useEffect(() => {
    async function fetchMissionDetails() {
      try {
        setLoading(true);

        // Fetch mission details
        const missionRes = await fetch(`/api/missions/${missionId}`);
        if (!missionRes.ok) {
          throw new Error(`Mission not found: ${missionRes.status}`);
        }
        const missionData = await missionRes.json();

        setMission(missionData.mission);
        setAgents(missionData.agents || []);
        setExecutions(missionData.executions || []);

        // Fetch agent profiles
        const profiles: Record<string, AgentProfile> = {};
        for (const agent of missionData.agents || []) {
          const agentRes = await fetch(`/api/agents/${agent.agent_id}`);
          if (agentRes.ok) {
            const agentProfile = await agentRes.json();
            profiles[agent.agent_id] = agentProfile;
          }
        }
        setAgentProfiles(profiles);

      } catch (error) {
        console.error('Error fetching mission:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchMissionDetails();
  }, [missionId]);

  // Trigger execution with client payment
  const handleTriggerExecution = async () => {
    if (!isConnected || !walletAddress) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!mission) return;

    try {
      setTriggering(true);
      toast.info('Triggering mission execution...');

      // Call API to trigger execution (this will return 402 Payment Required)
      const response = await fetch(`/api/missions/${missionId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.status === 402) {
        // Parse payment requirement
        const paymentRequired = response.headers.get('X-Payment-Required');
        if (!paymentRequired) {
          throw new Error('Payment required but no payment details provided');
        }

        const paymentDetails = JSON.parse(paymentRequired);
        const agentAddress = paymentDetails.recipient as Address;
        const amount = BigInt(paymentDetails.amount);

        toast.info(`Payment required: ${Number(amount) / 1e6} USDC`);

        // Execute USDC payment
        setPendingTxType('payment'); // Track that this is a payment transaction

        writeContract({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [agentAddress, amount],
        });

      } else if (response.ok) {
        const data = await response.json();
        toast.success('Execution started!');
        // Refresh mission details
        setTimeout(() => window.location.reload(), 2000);
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to trigger execution');
      }
    } catch (error) {
      console.error('Trigger execution error:', error);
      setPendingTxType(null); // Clear on error
      toast.error(error instanceof Error ? error.message : 'Failed to trigger execution');
    } finally {
      setTriggering(false);
    }
  };

  // Handle payment confirmation
  useEffect(() => {
    if (isConfirmed && txHash && pendingTxType === 'payment') {
      toast.success('Payment confirmed!');
      setPendingTxType(null);

      // Retry execution with payment proof
      const retryWithProof = async () => {
        try {
          const paymentProof = {
            from: walletAddress,
            to: agents[0]?.agent_id, // First agent
            amount: (agents[0]?.payment_amount * 1e6).toString(),
            token: USDC_ADDRESS,
            txHash,
            blockNumber: '0', // Block number from receipt
            timestamp: Math.floor(Date.now() / 1000),
          };

          const response = await fetch(`/api/missions/${missionId}/execute`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Payment-Proof': JSON.stringify(paymentProof),
            },
          });

          if (response.ok) {
            toast.success('Mission execution started!');
            setTimeout(() => window.location.reload(), 2000);
          } else {
            const error = await response.json();
            toast.error(error.message || 'Failed to start execution');
          }
        } catch (error) {
          console.error('Retry with proof error:', error);
          toast.error('Failed to start execution after payment');
        }
      };

      retryWithProof();
    }
  }, [isConfirmed, txHash, walletAddress, missionId, agents, pendingTxType]);

  // Handle feedback confirmation
  useEffect(() => {
    if (isConfirmed && txHash && pendingTxType === 'feedback') {
      toast.success('Feedback confirmed on-chain!');
      setPendingTxType(null);
    }
  }, [isConfirmed, txHash, pendingTxType]);

  // Handle feedback submission
  const handleSubmitFeedback = async (rating: number, comment: string) => {
    if (!agents || agents.length === 0) {
      toast.error('No agent found for this mission');
      return;
    }

    if (!walletAddress || !isConnected) {
      toast.error('Please connect your wallet to submit feedback');
      return;
    }

    const firstAgent = agents[0]; // For now, rate the first agent
    const agentProfile = agentProfiles[firstAgent.agent_id];

    if (!agentProfile) {
      toast.error('Agent profile not found');
      return;
    }

    // Map database agent ID to ERC-8004 NFT token ID
    const agentIdMapping: Record<string, string> = {
      'agent_1760886157698_lzy2czh83': '2', // LogoMaster AI
      'agent_1760886159008_0qns6xy6u': '3', // CopyWriter AI
      'agent_1760886159300_zitacvck8': '4', // SocialMedia AI
    };

    const erc8004AgentId = agentIdMapping[firstAgent.agent_id];
    if (!erc8004AgentId) {
      toast.error('Agent not registered in ERC-8004 registry');
      console.error('No ERC-8004 mapping for agent:', firstAgent.agent_id);
      return;
    }

    try {
      // Step 1: Generate feedbackAuth signature from agent
      toast.info('Generating feedback authorization...');
      console.log('[Feedback] Generating auth for:', {
        agentId: erc8004AgentId,
        clientAddress: walletAddress,
      });

      const authResponse = await fetch('/api/reputation/generate-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: erc8004AgentId,
          clientAddress: walletAddress,
          indexLimit: 10, // Allow up to 10 feedback submissions
          expiryHours: 24, // Valid for 24 hours
        }),
      });

      if (!authResponse.ok) {
        const error = await authResponse.json();
        throw new Error(error.error || 'Failed to generate feedback authorization');
      }

      const authResult = await authResponse.json();
      const feedbackAuth = authResult.feedbackAuth as `0x${string}`;

      console.log('[Feedback] Generated feedbackAuth:', {
        feedbackAuth,
        byteLength: authResult.metadata.byteLength,
        expiry: authResult.metadata.expiryDate,
      });

      // Step 2: Prepare feedback transaction
      const response = await fetch('/api/reputation/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: erc8004AgentId, // ERC-8004 NFT token ID (2, 3, or 4)
          rating,
          comment,
          userAddress: walletAddress,
          missionId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to prepare feedback');
      }

      const result = await response.json();
      const contractData = result.contractCall;

      // Step 3: Submit on-chain to ERC-8004 Reputation Registry
      const REPUTATION_REGISTRY = '0x8004bd8daB57f14Ed299135749a5CB5c42d341BF' as const;

      const ReputationABI = [
        {
          name: 'giveFeedback',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'agentId', type: 'uint256' },
            { name: 'score', type: 'uint8' },
            { name: 'tag1', type: 'bytes32' },
            { name: 'tag2', type: 'bytes32' },
            { name: 'feedbackUri', type: 'string' },
            { name: 'feedbackHash', type: 'bytes32' },
            { name: 'feedbackAuth', type: 'bytes' },
          ],
          outputs: [],
        },
      ] as const;

      toast.info('Please sign the transaction to submit feedback on-chain...');

      // Execute blockchain transaction with generated feedbackAuth
      try {
        setPendingTxType('feedback'); // Track that this is a feedback transaction

        writeContract({
          address: REPUTATION_REGISTRY,
          abi: ReputationABI,
          functionName: 'giveFeedback',
          args: [
            BigInt(contractData.args.agentId),
            contractData.args.score,
            contractData.args.tag1 as `0x${string}`,
            contractData.args.tag2 as `0x${string}`,
            contractData.args.feedbackUri || '',
            contractData.args.feedbackHash as `0x${string}`,
            feedbackAuth, // Use generated auth with agent signature
          ],
        });

        // Transaction submitted - wagmi will handle confirmation
        toast.success('Feedback transaction submitted! Waiting for confirmation...');
        setHasRated(true);
        setShowFeedbackModal(false);
      } catch (writeError) {
        console.error('[Feedback] Transaction error:', writeError);
        setPendingTxType(null); // Clear on error
        toast.error(writeError instanceof Error ? writeError.message : 'Transaction failed');
        throw writeError;
      }
    } catch (error) {
      console.error('Feedback submission error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit feedback');
      throw error; // Re-throw so modal can handle it
    }
  };

  // Handle approve deliverable
  const handleApproveDeliverable = async () => {
    if (!mission || !mission.escrow_contract_id) {
      toast.error('Mission escrow not found');
      return;
    }

    try {
      approveDeliverable(BigInt(mission.escrow_contract_id));
      toast.success('Approving deliverable...');
    } catch (error) {
      console.error('Approve error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to approve deliverable');
    }
  };

  // Handle validation request
  const handleRequestValidation = async (validatorAgentId: string, stake: number) => {
    if (!mission || !mission.deliverable_uri) {
      toast.error('No deliverable found');
      return;
    }

    try {
      const response = await fetch(`/api/missions/${missionId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ validatorAgentId, stake }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to request validation');
      }

      const result = await response.json();
      toast.success('Validation requested successfully!');
      toast.info(`Validation ID: ${result.validationId}`);

      setShowValidationModal(false);

      // Refresh mission
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      console.error('Validation request error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to request validation');
      throw error;
    }
  };

  // Handle dispute submission
  const handleSubmitDispute = async (claim: string) => {
    if (!mission || !mission.escrow_contract_id) {
      toast.error('Mission escrow not found');
      return;
    }

    try {
      disputeDeliverable(BigInt(mission.escrow_contract_id), claim);
      toast.success('Submitting dispute to UMA...');
      setShowDisputeModal(false);

      // Refresh mission after a delay
      setTimeout(() => window.location.reload(), 3000);
    } catch (error) {
      console.error('Dispute error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit dispute');
      throw error;
    }
  };

  // Check if client can take actions
  const isClient =
    walletAddress &&
    mission &&
    walletAddress.toLowerCase() === mission.client_address.toLowerCase();

  // Get deliverable URI from executions
  const deliverableURI =
    mission?.deliverable_uri ||
    executions.find((e) => e.deliverable_uri)?.deliverable_uri ||
    '';

  // Check if mission has been submitted
  const isSubmitted = mission?.status === 'submitted' || mission?.status === 'in_progress';

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <LoadingState message="Loading mission details..." size="lg" />
        </main>
      </div>
    );
  }

  if (!mission) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <main className="flex-1 container mx-auto px-8 py-12">
          <div className="border-2 border-black p-12 text-center bg-white">
            <h3 className="font-black text-2xl uppercase text-black mb-3">
              MISSION NOT FOUND
            </h3>
            <p className="font-mono text-xs uppercase tracking-wide text-black opacity-60 mb-6">
              The mission you&apos;re looking for doesn&apos;t exist
            </p>
            <Button onClick={() => router.push('/bounties')}>
              BACK TO MISSIONS
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Smart status detection: check execution completion even if DB status is stale
  const allExecutionsComplete = executions.length > 0 && executions.every(
    (e) => e.status === 'completed' || e.status === 'failed'
  );
  const anyExecutionFailed = executions.some((e) => e.status === 'failed');

  // Determine actual mission status (execution-based if available, fallback to DB)
  const actualStatus = allExecutionsComplete
    ? (anyExecutionFailed ? 'failed' : 'completed')
    : mission.status;

  const statusDisplay = actualStatus === 'pending' || actualStatus === 'in_progress' ? 'OPEN' :
                        actualStatus === 'completed' ? 'COMPLETED' :
                        actualStatus === 'cancelled' ? 'CANCELLED' : 'FAILED';

  const statusVariant = actualStatus === 'pending' || actualStatus === 'in_progress' ? 'default' : 'outline';

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1 container mx-auto px-8 py-12">
        {/* Header */}
        <div className="border-2 border-black p-8 mb-8 bg-white">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Badge variant={statusVariant} className="border-black">
                {statusDisplay}
              </Badge>
              <Badge variant="outline" className="border-black">
                AI DEPLOYED
              </Badge>
            </div>
            <h1 className="font-black text-4xl md:text-5xl uppercase tracking-tight text-black break-words">
              {missionId}
            </h1>
            {mission.description && (
              <p className="font-mono text-sm text-black/80">
                {mission.description}
              </p>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Mission Details */}
            <div className="border-2 border-black p-6 bg-white">
              <h2 className="font-black text-xl uppercase mb-4 pb-3 border-b-2 border-black">
                MISSION DETAILS
              </h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-bold text-xs uppercase tracking-wide opacity-60 mb-1">
                      TOTAL BUDGET
                    </div>
                    <div className="text-2xl font-black">
                      ${mission.total_budget} <span className="text-sm opacity-60">USDC</span>
                    </div>
                  </div>
                  <div>
                    <div className="font-bold text-xs uppercase tracking-wide opacity-60 mb-1">
                      MODE
                    </div>
                    <div className="text-sm font-mono uppercase">
                      {mission.orchestration_mode}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="font-bold text-xs uppercase tracking-wide opacity-60 mb-1">
                    CLIENT
                  </div>
                  <div className="font-mono text-sm">
                    {formatAddress(mission.client_address)}
                  </div>
                </div>

                <div>
                  <div className="font-bold text-xs uppercase tracking-wide opacity-60 mb-1">
                    CREATED
                  </div>
                  <div className="font-mono text-sm">
                    {formatRelativeTime(new Date(mission.created_at).getTime() / 1000)}
                  </div>
                </div>

                {mission.requirements_ipfs && (
                  <div>
                    <div className="font-bold text-xs uppercase tracking-wide opacity-60 mb-1">
                      REQUIREMENTS
                    </div>
                    <a
                      href={`https://gateway.pinata.cloud/ipfs/${mission.requirements_ipfs}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm hover:underline"
                    >
                      View on IPFS →
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Assigned Agents */}
            <div className="border-2 border-black p-6 bg-white">
              <h2 className="font-black text-xl uppercase mb-4 pb-3 border-b-2 border-black">
                ASSIGNED AGENTS ({agents.length})
              </h2>

              {agents.length === 0 ? (
                <p className="font-mono text-xs uppercase text-black/60">
                  No agents assigned yet
                </p>
              ) : (
                <div className="space-y-4">
                  {agents.map((agent, idx) => {
                    const profile = agentProfiles[agent.agent_id];
                    const execution = executions.find(e => e.agent_id === agent.agent_id);

                    return (
                      <div key={agent.id} className="border-2 border-black p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-bold text-sm uppercase">
                              {profile?.name || agent.agent_id}
                            </h3>
                            <p className="font-mono text-xs text-black/60">
                              {agent.capability}
                            </p>
                          </div>
                          <Badge variant="outline" className="border-black">
                            ${agent.payment_amount}
                          </Badge>
                        </div>

                        {execution && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-bold uppercase opacity-60">STATUS:</span>
                            <span className="font-mono uppercase">
                              {execution.status}
                            </span>
                          </div>
                        )}

                        {execution?.deliverable_uri && (
                          <div className="mt-2">
                            <a
                              href={execution.deliverable_uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-mono hover:underline"
                            >
                              View Deliverable →
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Actions */}
            <div className="border-2 border-black p-6 bg-white">
              <h2 className="font-black text-lg uppercase mb-4 pb-3 border-b-2 border-black">
                ACTIONS
              </h2>

              <div className="space-y-3">
                {/* Escrow Actions for Clients */}
                {isClient && mission.status === 'submitted' && deliverableURI && (
                  <>
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={handleApproveDeliverable}
                      disabled={isApproving}
                    >
                      {isApproving ? 'APPROVING...' : '✅ APPROVE & RELEASE PAYMENT'}
                    </Button>

                    <Button
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      onClick={() => setShowValidationModal(true)}
                    >
                      🔍 REQUEST VALIDATION
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full border-orange-600 text-orange-600 hover:bg-orange-50"
                      onClick={() => setShowDisputeModal(true)}
                    >
                      ⚖️ DISPUTE DELIVERABLE
                    </Button>

                    <div className="p-3 border-2 border-black bg-yellow-50">
                      <p className="font-mono text-xs text-center leading-relaxed">
                        Review deliverable. Approve to release payment, request validation for quality
                        check, or dispute if issues found.
                      </p>
                    </div>
                  </>
                )}

                {/* Auto-release info */}
                {isClient && mission.status === 'submitted' && mission.auto_release_time && (
                  <div className="p-3 border-2 border-black bg-blue-50">
                    <p className="font-mono text-xs text-center">
                      ⏰ Auto-release in{' '}
                      {getTimeUntilAutoRelease(BigInt(new Date(mission.auto_release_time).getTime() / 1000)).hoursRemaining}h
                      <br />
                      (if no action taken)
                    </p>
                  </div>
                )}

                {/* Validation status */}
                {mission.validation_status && mission.validation_status !== 'none' && (
                  <div className="p-3 border-2 border-black bg-purple-50">
                    <p className="font-mono text-xs text-center">
                      🔍 Validation: {mission.validation_status.toUpperCase()}
                    </p>
                  </div>
                )}

                {/* Dispute status */}
                {mission.dispute_status && mission.dispute_status !== 'none' && (
                  <div className="p-3 border-2 border-black bg-orange-50">
                    <p className="font-mono text-xs text-center">
                      ⚖️ Dispute: {mission.dispute_status.toUpperCase()}
                    </p>
                  </div>
                )}

                {/* Legacy trigger execution */}
                {mission.status === 'pending' && (
                  <Button
                    className="w-full"
                    onClick={handleTriggerExecution}
                    disabled={triggering || isConfirming || !isConnected}
                  >
                    {triggering || isConfirming ? 'PROCESSING...' : 'TRIGGER EXECUTION'}
                  </Button>
                )}

                {/* Rating for completed missions */}
                {(actualStatus === 'completed' || mission.status === 'approved' || mission.status === 'auto_released') && !hasRated && (
                  <Button
                    className="w-full"
                    onClick={() => setShowFeedbackModal(true)}
                  >
                    ⭐ RATE AGENT
                  </Button>
                )}

                {hasRated && (
                  <div className="p-3 border-2 border-black bg-green-50">
                    <p className="font-mono text-xs text-center">
                      ✅ Thanks for your feedback!
                    </p>
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/bounties')}
                >
                  BACK TO MISSIONS
                </Button>
              </div>

              {mission.status === 'pending' && !isConnected && (
                <p className="mt-3 font-mono text-xs text-black/60">
                  Connect wallet to trigger execution
                </p>
              )}

              {mission.status === 'pending' && isConnected && (
                <p className="mt-3 font-mono text-xs text-black/60">
                  Pay agents directly if orchestrator unavailable
                </p>
              )}
            </div>

            {/* Status Timeline */}
            <div className="border-2 border-black p-6 bg-white">
              <h2 className="font-black text-lg uppercase mb-4 pb-3 border-b-2 border-black">
                TIMELINE
              </h2>

              <div className="space-y-4 font-mono text-xs">
                <div>
                  <div className="font-bold uppercase opacity-60 mb-1">CREATED</div>
                  <div>{new Date(mission.created_at).toLocaleString()}</div>
                </div>

                {mission.started_at && (
                  <div>
                    <div className="font-bold uppercase opacity-60 mb-1">STARTED</div>
                    <div>{new Date(mission.started_at).toLocaleString()}</div>
                  </div>
                )}

                {mission.completed_at && (
                  <div>
                    <div className="font-bold uppercase opacity-60 mb-1">COMPLETED</div>
                    <div>{new Date(mission.completed_at).toLocaleString()}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Feedback Modal */}
      {showFeedbackModal && agents.length > 0 && agentProfiles[agents[0].agent_id] && (
        <FeedbackModal
          missionId={missionId}
          agentName={agentProfiles[agents[0].agent_id].name}
          agentId={agents[0].agent_id}
          onSubmit={handleSubmitFeedback}
          onSkip={() => setShowFeedbackModal(false)}
        />
      )}

      {/* Validation Request Modal */}
      {showValidationModal && deliverableURI && (
        <ValidationRequestModal
          missionId={missionId}
          deliverableURI={deliverableURI}
          onSubmit={handleRequestValidation}
          onCancel={() => setShowValidationModal(false)}
        />
      )}

      {/* Dispute Modal */}
      {showDisputeModal && deliverableURI && agents.length > 0 && (
        <DisputeModal
          missionId={missionId}
          deliverableURI={deliverableURI}
          agentName={agentProfiles[agents[0]?.agent_id]?.name || 'Agent'}
          totalAmount={mission?.total_budget || 0}
          onSubmit={handleSubmitDispute}
          onCancel={() => setShowDisputeModal(false)}
        />
      )}
    </div>
  );
}
