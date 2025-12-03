import { useReadContract, useWriteContract, useWatchContractEvent } from 'wagmi';
import GigEscrowABI from './abis/GigEscrow.json';
import { CONTRACTS } from './addresses';
import type { Address, Log, Abi } from 'viem';

/**
 * GigEscrow Contract Hooks
 * Type-safe React hooks for all GigEscrow contract interactions
 */

const GigEscrowAbi = GigEscrowABI as Abi;

// ============================================================================
// READ HOOKS
// ============================================================================

export function useGetGig(gigId: bigint) {
  return useReadContract({
    address: CONTRACTS.GIG_ESCROW,
    abi: GigEscrowAbi,
    functionName: 'getGig',
    args: [gigId],
  });
}

export function useGetMilestone(gigId: bigint, milestoneIndex: bigint) {
  return useReadContract({
    address: CONTRACTS.GIG_ESCROW,
    abi: GigEscrowAbi,
    functionName: 'getMilestone',
    args: [gigId, milestoneIndex],
  });
}

export function useGetMilestoneCount(gigId: bigint) {
  return useReadContract({
    address: CONTRACTS.GIG_ESCROW,
    abi: GigEscrowAbi,
    functionName: 'getMilestoneCount',
    args: [gigId],
  });
}

export function useCanAutoRelease(gigId: bigint, milestoneIndex: bigint) {
  return useReadContract({
    address: CONTRACTS.GIG_ESCROW,
    abi: GigEscrowAbi,
    functionName: 'canAutoRelease',
    args: [gigId, milestoneIndex],
  });
}

export function useNextGigId() {
  return useReadContract({
    address: CONTRACTS.GIG_ESCROW,
    abi: GigEscrowAbi,
    functionName: 'nextGigId',
  });
}

export function usePlatformFeeBps() {
  return useReadContract({
    address: CONTRACTS.GIG_ESCROW,
    abi: GigEscrowAbi,
    functionName: 'platformFeeBps',
  });
}

// ============================================================================
// WRITE HOOKS
// ============================================================================

export function useCreateGig() {
  const { writeContract, ...rest } = useWriteContract();

  const createGig = (
    worker: Address,
    paymentToken: Address,
    milestoneDescriptions: string[],
    milestoneAmounts: bigint[],
    useUMAArbitration: boolean = false
  ) => {
    return writeContract({
      address: CONTRACTS.GIG_ESCROW,
      abi: GigEscrowAbi,
      functionName: 'createGig',
      args: [worker, paymentToken, milestoneDescriptions, milestoneAmounts, useUMAArbitration],
    });
  };

  return { createGig, ...rest };
}

export function useSubmitMilestone() {
  const { writeContract, ...rest } = useWriteContract();

  const submitMilestone = (
    gigId: bigint,
    milestoneIndex: bigint,
    deliverableURI: string
  ) => {
    return writeContract({
      address: CONTRACTS.GIG_ESCROW,
      abi: GigEscrowAbi,
      functionName: 'submitMilestone',
      args: [gigId, milestoneIndex, deliverableURI],
    });
  };

  return { submitMilestone, ...rest };
}

export function useApproveMilestone() {
  const { writeContract, ...rest } = useWriteContract();

  const approveMilestone = (gigId: bigint, milestoneIndex: bigint) => {
    return writeContract({
      address: CONTRACTS.GIG_ESCROW,
      abi: GigEscrowAbi,
      functionName: 'approveMilestone',
      args: [gigId, milestoneIndex],
    });
  };

  return { approveMilestone, ...rest };
}

export function useAutoReleaseMilestone() {
  const { writeContract, ...rest } = useWriteContract();

  const autoReleaseMilestone = (gigId: bigint, milestoneIndex: bigint) => {
    return writeContract({
      address: CONTRACTS.GIG_ESCROW,
      abi: GigEscrowAbi,
      functionName: 'autoReleaseMilestone',
      args: [gigId, milestoneIndex],
    });
  };

  return { autoReleaseMilestone, ...rest };
}

export function useDisputeMilestone() {
  const { writeContract, ...rest } = useWriteContract();

  const disputeMilestone = (
    gigId: bigint,
    milestoneIndex: bigint,
    reason: string
  ) => {
    return writeContract({
      address: CONTRACTS.GIG_ESCROW,
      abi: GigEscrowAbi,
      functionName: 'disputeMilestone',
      args: [gigId, milestoneIndex, reason],
    });
  };

  return { disputeMilestone, ...rest };
}

export function useCancelGig() {
  const { writeContract, ...rest } = useWriteContract();

  const cancelGig = (gigId: bigint) => {
    return writeContract({
      address: CONTRACTS.GIG_ESCROW,
      abi: GigEscrowAbi,
      functionName: 'cancelGig',
      args: [gigId],
    });
  };

  return { cancelGig, ...rest };
}

// ============================================================================
// UMA DISPUTE HOOKS
// ============================================================================

export function useDisputeMilestoneWithUMA() {
  const { writeContract, ...rest } = useWriteContract();

  const disputeMilestoneWithUMA = (
    gigId: bigint,
    milestoneIndex: bigint,
    claim: string,
    evidenceURI: string,
    bond: bigint
  ) => {
    return writeContract({
      address: CONTRACTS.GIG_ESCROW,
      abi: GigEscrowAbi,
      functionName: 'disputeMilestoneWithUMA',
      args: [gigId, milestoneIndex, claim, evidenceURI, bond],
    });
  };

  return { disputeMilestoneWithUMA, ...rest };
}

export function useResolveGigUMADispute() {
  const { writeContract, ...rest } = useWriteContract();

  const resolveUMADispute = (gigId: bigint, milestoneIndex: bigint) => {
    return writeContract({
      address: CONTRACTS.GIG_ESCROW,
      abi: GigEscrowAbi,
      functionName: 'resolveUMADispute',
      args: [gigId, milestoneIndex],
    });
  };

  return { resolveUMADispute, ...rest };
}

// ============================================================================
// EVENT WATCHING
// ============================================================================

export function useWatchGigCreated(onLogs?: (logs: Log[]) => void) {
  return useWatchContractEvent({
    address: CONTRACTS.GIG_ESCROW,
    abi: GigEscrowAbi,
    eventName: 'GigCreated',
    onLogs,
  });
}

export function useWatchMilestoneSubmitted(onLogs?: (logs: Log[]) => void) {
  return useWatchContractEvent({
    address: CONTRACTS.GIG_ESCROW,
    abi: GigEscrowAbi,
    eventName: 'MilestoneSubmitted',
    onLogs,
  });
}

export function useWatchMilestoneApproved(onLogs?: (logs: Log[]) => void) {
  return useWatchContractEvent({
    address: CONTRACTS.GIG_ESCROW,
    abi: GigEscrowAbi,
    eventName: 'MilestoneApproved',
    onLogs,
  });
}

export function useWatchGigCompleted(onLogs?: (logs: Log[]) => void) {
  return useWatchContractEvent({
    address: CONTRACTS.GIG_ESCROW,
    abi: GigEscrowAbi,
    eventName: 'GigCompleted',
    onLogs,
  });
}

export function useWatchGigUMADisputeCreated(onLogs?: (logs: Log[]) => void) {
  return useWatchContractEvent({
    address: CONTRACTS.GIG_ESCROW,
    abi: GigEscrowAbi,
    eventName: 'UMADisputeCreated',
    onLogs,
  });
}

export function useWatchGigUMADisputeResolved(onLogs?: (logs: Log[]) => void) {
  return useWatchContractEvent({
    address: CONTRACTS.GIG_ESCROW,
    abi: GigEscrowAbi,
    eventName: 'UMADisputeResolved',
    onLogs,
  });
}
