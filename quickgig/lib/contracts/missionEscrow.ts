/**
 * MissionEscrow Wagmi Hooks
 * React hooks for interacting with MissionEscrow contract
 */

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { type Address, parseUnits, type Hash } from 'viem';
import { baseSepolia } from 'wagmi/chains';
import MissionEscrowABI from '@/lib/contracts/abis/MissionEscrow.json';

/**
 * MissionEscrow contract address (Base Sepolia)
 * Set via environment variable after deployment
 */
export const MISSION_ESCROW_ADDRESS =
  (process.env.NEXT_PUBLIC_MISSION_ESCROW_ADDRESS as Address) ||
  '0x0000000000000000000000000000000000000000';

/**
 * Mission status enum (matches Solidity)
 */
export enum MissionStatus {
  Pending,
  InProgress,
  Submitted,
  Validating,
  Disputed,
  Completed,
  AutoReleased,
  Cancelled,
}

/**
 * Mission data structure
 */
export interface Mission {
  client: Address;
  paymentToken: Address;
  totalEscrow: bigint;
  submittedAt: bigint;
  autoReleaseTime: bigint;
  requirementsURI: string;
  deliverableURI: string;
  status: MissionStatus;
  agents: AgentPayment[];
  validationId: bigint;
  disputeAssertionId: string;
}

export interface AgentPayment {
  agent: Address;
  amount: bigint;
  paid: boolean;
}

/**
 * Hook: Read mission details
 */
export function useMissionDetails(missionId: bigint | undefined) {
  return useReadContract({
    address: MISSION_ESCROW_ADDRESS,
    abi: MissionEscrowABI,
    functionName: 'getMissionDetails',
    args: missionId !== undefined ? [missionId] : undefined,
    chainId: baseSepolia.id,
    query: {
      enabled: missionId !== undefined,
    },
  });
}

/**
 * Hook: Read mission status
 */
export function useMissionStatus(missionId: bigint | undefined) {
  return useReadContract({
    address: MISSION_ESCROW_ADDRESS,
    abi: MissionEscrowABI,
    functionName: 'getMissionStatus',
    args: missionId !== undefined ? [missionId] : undefined,
    chainId: baseSepolia.id,
    query: {
      enabled: missionId !== undefined,
    },
  });
}

/**
 * Hook: Check if auto-release is available
 */
export function useIsAutoReleaseAvailable(missionId: bigint | undefined) {
  return useReadContract({
    address: MISSION_ESCROW_ADDRESS,
    abi: MissionEscrowABI,
    functionName: 'isAutoReleaseAvailable',
    args: missionId !== undefined ? [missionId] : undefined,
    chainId: baseSepolia.id,
    query: {
      enabled: missionId !== undefined,
    },
  });
}

/**
 * Hook: Create mission
 * Note: Usually called server-side, but available for client-side if needed
 */
export function useCreateMission() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const createMission = async (
    paymentToken: Address,
    agentAddresses: Address[],
    agentPayments: number[], // USDC amounts
    requirementsURI: string
  ) => {
    const paymentAmounts = agentPayments.map((amount) => parseUnits(amount.toString(), 6));

    writeContract({
      address: MISSION_ESCROW_ADDRESS,
      abi: MissionEscrowABI,
      functionName: 'createMission',
      args: [paymentToken, agentAddresses, paymentAmounts, requirementsURI],
      chainId: baseSepolia.id,
    });
  };

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  return {
    createMission,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Hook: Submit deliverable
 */
export function useSubmitDeliverable() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const submitDeliverable = (missionId: bigint, deliverableURI: string) => {
    writeContract({
      address: MISSION_ESCROW_ADDRESS,
      abi: MissionEscrowABI,
      functionName: 'submitDeliverable',
      args: [missionId, deliverableURI],
      chainId: baseSepolia.id,
    });
  };

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  return {
    submitDeliverable,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Hook: Approve deliverable (happy path)
 */
export function useApproveDeliverable() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const approveDeliverable = (missionId: bigint) => {
    writeContract({
      address: MISSION_ESCROW_ADDRESS,
      abi: MissionEscrowABI,
      functionName: 'approveDeliverable',
      args: [missionId],
      chainId: baseSepolia.id,
    });
  };

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  return {
    approveDeliverable,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Hook: Request ERC-8004 validation
 */
export function useRequestValidation() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const requestValidation = (missionId: bigint, validatorAgentId: bigint, stake: number) => {
    const stakeAmount = parseUnits(stake.toString(), 6); // USDC

    writeContract({
      address: MISSION_ESCROW_ADDRESS,
      abi: MissionEscrowABI,
      functionName: 'requestValidation',
      args: [missionId, validatorAgentId, stakeAmount],
      chainId: baseSepolia.id,
    });
  };

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  return {
    requestValidation,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Hook: Dispute deliverable via UMA
 */
export function useDisputeDeliverable() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const disputeDeliverable = (missionId: bigint, claim: string) => {
    writeContract({
      address: MISSION_ESCROW_ADDRESS,
      abi: MissionEscrowABI,
      functionName: 'disputeDeliverable',
      args: [missionId, claim],
      chainId: baseSepolia.id,
    });
  };

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  return {
    disputeDeliverable,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Hook: Resolve validation
 */
export function useResolveValidation() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const resolveValidation = (missionId: bigint) => {
    writeContract({
      address: MISSION_ESCROW_ADDRESS,
      abi: MissionEscrowABI,
      functionName: 'resolveValidation',
      args: [missionId],
      chainId: baseSepolia.id,
    });
  };

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  return {
    resolveValidation,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Hook: Resolve UMA dispute
 */
export function useResolveUMADispute() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const resolveDispute = (missionId: bigint) => {
    writeContract({
      address: MISSION_ESCROW_ADDRESS,
      abi: MissionEscrowABI,
      functionName: 'resolveUMADispute',
      args: [missionId],
      chainId: baseSepolia.id,
    });
  };

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  return {
    resolveDispute,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Hook: Auto-release payment (after 48 hours)
 */
export function useAutoRelease() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const autoRelease = (missionId: bigint) => {
    writeContract({
      address: MISSION_ESCROW_ADDRESS,
      abi: MissionEscrowABI,
      functionName: 'autoRelease',
      args: [missionId],
      chainId: baseSepolia.id,
    });
  };

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  return {
    autoRelease,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Hook: Cancel mission (client only, before submission)
 */
export function useCancelMission() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const cancelMission = (missionId: bigint) => {
    writeContract({
      address: MISSION_ESCROW_ADDRESS,
      abi: MissionEscrowABI,
      functionName: 'cancelMission',
      args: [missionId],
      chainId: baseSepolia.id,
    });
  };

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  return {
    cancelMission,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Helper: Format mission status for UI
 */
export function formatMissionStatus(status: MissionStatus): {
  label: string;
  color: string;
  description: string;
} {
  const statusMap = {
    [MissionStatus.Pending]: {
      label: 'Pending',
      color: 'text-gray-600',
      description: 'Awaiting agent to start work',
    },
    [MissionStatus.InProgress]: {
      label: 'In Progress',
      color: 'text-blue-600',
      description: 'Agent is working on the mission',
    },
    [MissionStatus.Submitted]: {
      label: 'Submitted',
      color: 'text-purple-600',
      description: 'Deliverable submitted, awaiting review',
    },
    [MissionStatus.Validating]: {
      label: 'Validating',
      color: 'text-yellow-600',
      description: 'Independent validator checking quality',
    },
    [MissionStatus.Disputed]: {
      label: 'Disputed',
      color: 'text-orange-600',
      description: 'Dispute escalated to UMA for resolution',
    },
    [MissionStatus.Completed]: {
      label: 'Completed',
      color: 'text-green-600',
      description: 'Payment released to agents',
    },
    [MissionStatus.AutoReleased]: {
      label: 'Auto-Released',
      color: 'text-teal-600',
      description: 'Payment automatically released after 48h',
    },
    [MissionStatus.Cancelled]: {
      label: 'Cancelled',
      color: 'text-red-600',
      description: 'Mission cancelled, escrow refunded',
    },
  };

  return statusMap[status];
}

/**
 * Helper: Get available actions for mission
 */
export function getAvailableActions(
  status: MissionStatus,
  isClient: boolean,
  isAgent: boolean
): string[] {
  const actions: string[] = [];

  if (isAgent) {
    if (status === MissionStatus.Pending || status === MissionStatus.InProgress) {
      actions.push('submit_deliverable');
    }
  }

  if (isClient) {
    if (status === MissionStatus.Submitted) {
      actions.push('approve');
      actions.push('request_validation');
      actions.push('dispute');
    }

    if (status === MissionStatus.Validating) {
      actions.push('resolve_validation');
    }

    if (status === MissionStatus.Disputed) {
      actions.push('resolve_dispute');
    }

    if (status === MissionStatus.Submitted) {
      actions.push('auto_release_check'); // Check if 48h passed
    }

    if (status === MissionStatus.Pending) {
      actions.push('cancel');
    }
  }

  return actions;
}

/**
 * Helper: Calculate time until auto-release
 */
export function getTimeUntilAutoRelease(autoReleaseTime: bigint): {
  canAutoRelease: boolean;
  hoursRemaining: number;
} {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const canAutoRelease = now >= autoReleaseTime;
  const secondsRemaining = canAutoRelease ? 0 : Number(autoReleaseTime - now);
  const hoursRemaining = Math.ceil(secondsRemaining / 3600);

  return { canAutoRelease, hoursRemaining };
}
