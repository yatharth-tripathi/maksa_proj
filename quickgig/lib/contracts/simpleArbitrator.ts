import { useReadContract, useWriteContract, useWatchContractEvent } from 'wagmi';
import SimpleArbitratorABI from './abis/SimpleArbitrator.json';
import { CONTRACTS } from './addresses';
import type { Address, Log, Hex } from 'viem';

/**
 * SimpleArbitrator Contract Hooks
 * Multi-sig arbitration system for dispute resolution
 */

// READ HOOKS

/**
 * Get full dispute case details
 */
export function useGetDispute(caseId: Hex) {
  return useReadContract({
    address: CONTRACTS.SIMPLE_ARBITRATOR,
    abi: SimpleArbitratorABI.abi,
    functionName: 'getDispute',
    args: [caseId],
  });
}

/**
 * Get all votes for a case
 */
export function useGetVotes(caseId: Hex) {
  return useReadContract({
    address: CONTRACTS.SIMPLE_ARBITRATOR,
    abi: SimpleArbitratorABI.abi,
    functionName: 'getVotes',
    args: [caseId],
  });
}

/**
 * Get all evidences for a case
 */
export function useGetEvidences(caseId: Hex) {
  return useReadContract({
    address: CONTRACTS.SIMPLE_ARBITRATOR,
    abi: SimpleArbitratorABI.abi,
    functionName: 'getEvidences',
    args: [caseId],
  });
}

/**
 * Check if an arbitrator has voted on a case
 */
export function useHasVoted(caseId: Hex, arbitrator: Address) {
  return useReadContract({
    address: CONTRACTS.SIMPLE_ARBITRATOR,
    abi: SimpleArbitratorABI.abi,
    functionName: 'hasVoted',
    args: [caseId, arbitrator],
  });
}

/**
 * Check if an address is an authorized arbitrator
 */
export function useIsArbitrator(address: Address) {
  return useReadContract({
    address: CONTRACTS.SIMPLE_ARBITRATOR,
    abi: SimpleArbitratorABI.abi,
    functionName: 'arbitrators',
    args: [address],
  });
}

/**
 * Get the owner address
 */
export function useArbitratorOwner() {
  return useReadContract({
    address: CONTRACTS.SIMPLE_ARBITRATOR,
    abi: SimpleArbitratorABI.abi,
    functionName: 'owner',
  });
}

/**
 * Get dispute data directly from mapping
 */
export function useDisputeData(caseId: Hex) {
  return useReadContract({
    address: CONTRACTS.SIMPLE_ARBITRATOR,
    abi: SimpleArbitratorABI.abi,
    functionName: 'disputes',
    args: [caseId],
  });
}

// WRITE HOOKS

/**
 * Cast a vote on a dispute (arbitrator only)
 * @param clientBps Basis points to award client (0-10000)
 */
export function useVote() {
  const { writeContract, ...rest } = useWriteContract();

  const vote = (caseId: Hex, clientBps: bigint) => {
    return writeContract({
      address: CONTRACTS.SIMPLE_ARBITRATOR,
      abi: SimpleArbitratorABI.abi,
      functionName: 'vote',
      args: [caseId, clientBps],
    });
  };

  return { vote, ...rest };
}

/**
 * Submit additional evidence for a dispute
 */
export function useSubmitEvidence() {
  const { writeContract, ...rest } = useWriteContract();

  const submitEvidence = (caseId: Hex, evidenceURI: string) => {
    return writeContract({
      address: CONTRACTS.SIMPLE_ARBITRATOR,
      abi: SimpleArbitratorABI.abi,
      functionName: 'submitEvidence',
      args: [caseId, evidenceURI],
    });
  };

  return { submitEvidence, ...rest };
}

/**
 * Appeal a resolved dispute
 */
export function useAppealDispute() {
  const { writeContract, ...rest } = useWriteContract();

  const appealDispute = (caseId: Hex, appealReason: string, newEvidenceURI: string) => {
    return writeContract({
      address: CONTRACTS.SIMPLE_ARBITRATOR,
      abi: SimpleArbitratorABI.abi,
      functionName: 'appealDispute',
      args: [caseId, appealReason, newEvidenceURI],
    });
  };

  return { appealDispute, ...rest };
}

/**
 * Finalize dispute if voting period expired
 */
export function useFinalizeIfExpired() {
  const { writeContract, ...rest } = useWriteContract();

  const finalizeIfExpired = (caseId: Hex) => {
    return writeContract({
      address: CONTRACTS.SIMPLE_ARBITRATOR,
      abi: SimpleArbitratorABI.abi,
      functionName: 'finalizeIfExpired',
      args: [caseId],
    });
  };

  return { finalizeIfExpired, ...rest };
}

/**
 * Add a new arbitrator (owner only)
 */
export function useAddArbitrator() {
  const { writeContract, ...rest } = useWriteContract();

  const addArbitrator = (arbitrator: Address) => {
    return writeContract({
      address: CONTRACTS.SIMPLE_ARBITRATOR,
      abi: SimpleArbitratorABI.abi,
      functionName: 'addArbitrator',
      args: [arbitrator],
    });
  };

  return { addArbitrator, ...rest };
}

/**
 * Remove an arbitrator (owner only)
 */
export function useRemoveArbitrator() {
  const { writeContract, ...rest } = useWriteContract();

  const removeArbitrator = (arbitrator: Address) => {
    return writeContract({
      address: CONTRACTS.SIMPLE_ARBITRATOR,
      abi: SimpleArbitratorABI.abi,
      functionName: 'removeArbitrator',
      args: [arbitrator],
    });
  };

  return { removeArbitrator, ...rest };
}

// EVENT WATCHING

/**
 * Watch for new dispute cases
 */
export function useWatchDisputeCreated(onLogs?: (logs: Log[]) => void) {
  return useWatchContractEvent({
    address: CONTRACTS.SIMPLE_ARBITRATOR,
    abi: SimpleArbitratorABI.abi,
    eventName: 'DisputeCreated',
    onLogs,
  });
}

/**
 * Watch for votes cast
 */
export function useWatchVoteCast(onLogs?: (logs: Log[]) => void) {
  return useWatchContractEvent({
    address: CONTRACTS.SIMPLE_ARBITRATOR,
    abi: SimpleArbitratorABI.abi,
    eventName: 'VoteCast',
    onLogs,
  });
}

/**
 * Watch for disputes resolved
 */
export function useWatchDisputeResolved(onLogs?: (logs: Log[]) => void) {
  return useWatchContractEvent({
    address: CONTRACTS.SIMPLE_ARBITRATOR,
    abi: SimpleArbitratorABI.abi,
    eventName: 'DisputeResolved',
    onLogs,
  });
}

/**
 * Watch for disputes appealed
 */
export function useWatchDisputeAppealed(onLogs?: (logs: Log[]) => void) {
  return useWatchContractEvent({
    address: CONTRACTS.SIMPLE_ARBITRATOR,
    abi: SimpleArbitratorABI.abi,
    eventName: 'DisputeAppealed',
    onLogs,
  });
}

/**
 * Watch for evidence submissions
 */
export function useWatchEvidenceSubmitted(onLogs?: (logs: Log[]) => void) {
  return useWatchContractEvent({
    address: CONTRACTS.SIMPLE_ARBITRATOR,
    abi: SimpleArbitratorABI.abi,
    eventName: 'EvidenceSubmitted',
    onLogs,
  });
}
