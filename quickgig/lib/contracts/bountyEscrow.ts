import { useReadContract, useWriteContract, useWatchContractEvent } from 'wagmi';
import BountyEscrowABI from './abis/BountyEscrow.json';
import { CONTRACTS } from './addresses';
import type { Address, Log, Abi } from 'viem';

/**
 * BountyEscrow Contract Hooks
 */

const BountyEscrowAbi = (BountyEscrowABI.abi || BountyEscrowABI) as Abi;

// READ HOOKS
export function useGetBounty(bountyId: bigint) {
  return useReadContract({
    address: CONTRACTS.BOUNTY_ESCROW,
    abi: BountyEscrowAbi,
    functionName: 'getBounty',
    args: [bountyId],
  });
}

export function useGetBid(bountyId: bigint, bidIndex: bigint) {
  return useReadContract({
    address: CONTRACTS.BOUNTY_ESCROW,
    abi: BountyEscrowAbi,
    functionName: 'getBid',
    args: [bountyId, bidIndex],
  });
}

export function useGetBidCount(bountyId: bigint) {
  return useReadContract({
    address: CONTRACTS.BOUNTY_ESCROW,
    abi: BountyEscrowAbi,
    functionName: 'getBidCount',
    args: [bountyId],
  });
}

export function useGetActiveBids(bountyId: bigint) {
  return useReadContract({
    address: CONTRACTS.BOUNTY_ESCROW,
    abi: BountyEscrowAbi,
    functionName: 'getActiveBids',
    args: [bountyId],
  });
}

export function useCanAutoReleaseBounty(bountyId: bigint) {
  return useReadContract({
    address: CONTRACTS.BOUNTY_ESCROW,
    abi: BountyEscrowAbi,
    functionName: 'canAutoRelease',
    args: [bountyId],
  });
}

// WRITE HOOKS
export function useCreateBounty() {
  const { writeContract, ...rest } = useWriteContract();

  const createBounty = (
    paymentToken: Address,
    escrowAmount: bigint,
    deadline: bigint,
    requirementsURI: string,
    useUMAArbitration: boolean = false
  ) => {
    return writeContract({
      address: CONTRACTS.BOUNTY_ESCROW,
      abi: BountyEscrowAbi,
      functionName: 'createBounty',
      args: [paymentToken, escrowAmount, deadline, requirementsURI, useUMAArbitration],
    });
  };

  return { createBounty, ...rest };
}

export function useSubmitBid() {
  const { writeContract, ...rest } = useWriteContract();

  const submitBid = (bountyId: bigint, bidAmount: bigint, proposalURI: string) => {
    return writeContract({
      address: CONTRACTS.BOUNTY_ESCROW,
      abi: BountyEscrowAbi,
      functionName: 'submitBid',
      args: [bountyId, bidAmount, proposalURI],
    });
  };

  return { submitBid, ...rest };
}

export function useAssignWorker() {
  const { writeContract, ...rest } = useWriteContract();

  const assignWorker = (bountyId: bigint, bidIndex: bigint) => {
    return writeContract({
      address: CONTRACTS.BOUNTY_ESCROW,
      abi: BountyEscrowAbi,
      functionName: 'assignWorker',
      args: [bountyId, bidIndex],
    });
  };

  return { assignWorker, ...rest };
}

export function useSubmitDeliverable() {
  const { writeContract, ...rest } = useWriteContract();

  const submitDeliverable = (bountyId: bigint, deliverableURI: string) => {
    return writeContract({
      address: CONTRACTS.BOUNTY_ESCROW,
      abi: BountyEscrowAbi,
      functionName: 'submitDeliverable',
      args: [bountyId, deliverableURI],
    });
  };

  return { submitDeliverable, ...rest };
}

export function useApproveDeliverable() {
  const { writeContract, ...rest } = useWriteContract();

  const approveDeliverable = (bountyId: bigint) => {
    return writeContract({
      address: CONTRACTS.BOUNTY_ESCROW,
      abi: BountyEscrowAbi,
      functionName: 'approveDeliverable',
      args: [bountyId],
    });
  };

  return { approveDeliverable, ...rest };
}

// EVENT WATCHING
export function useWatchBountyCreated(onLogs?: (logs: Log[]) => void) {
  return useWatchContractEvent({
    address: CONTRACTS.BOUNTY_ESCROW,
    abi: BountyEscrowAbi,
    eventName: 'BountyCreated',
    onLogs,
  });
}

export function useWatchBidSubmitted(onLogs?: (logs: Log[]) => void) {
  return useWatchContractEvent({
    address: CONTRACTS.BOUNTY_ESCROW,
    abi: BountyEscrowAbi,
    eventName: 'BidSubmitted',
    onLogs,
  });
}

// UMA-SPECIFIC WRITE HOOKS

/**
 * Dispute a deliverable using UMA Optimistic Oracle
 * @param bountyId The bounty identifier
 * @param claim Human-readable claim describing the dispute
 * @param evidenceURI IPFS URI of client's evidence
 * @param bond Bond amount for the assertion (in payment token)
 */
export function useDisputeDeliverableWithUMA() {
  const { writeContract, ...rest } = useWriteContract();

  const disputeDeliverableWithUMA = (
    bountyId: bigint,
    claim: string,
    evidenceURI: string,
    bond: bigint
  ) => {
    return writeContract({
      address: CONTRACTS.BOUNTY_ESCROW,
      abi: BountyEscrowAbi,
      functionName: 'disputeDeliverableWithUMA',
      args: [bountyId, claim, evidenceURI, bond],
    });
  };

  return { disputeDeliverableWithUMA, ...rest };
}

/**
 * Resolve UMA dispute based on Escalation Manager decision
 * @param bountyId The bounty identifier
 */
export function useResolveBountyUMADispute() {
  const { writeContract, ...rest } = useWriteContract();

  const resolveUMADispute = (bountyId: bigint) => {
    return writeContract({
      address: CONTRACTS.BOUNTY_ESCROW,
      abi: BountyEscrowAbi,
      functionName: 'resolveUMADispute',
      args: [bountyId],
    });
  };

  return { resolveUMADispute, ...rest };
}

/**
 * Settle UMA assertion on Optimistic Oracle V3
 * This finalizes the assertion after the challenge period
 */
export function useSettleAssertion() {
  const { writeContract, ...rest } = useWriteContract();

  const settleAssertion = (assertionId: `0x${string}`) => {
    // Try settleAndGetAssertionResult instead of settleAssertion
    return writeContract({
      address: CONTRACTS.OPTIMISTIC_ORACLE_V3,
      abi: [
        {
          inputs: [{ name: 'assertionId', type: 'bytes32' }],
          name: 'settleAndGetAssertionResult',
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ] as const,
      functionName: 'settleAndGetAssertionResult',
      args: [assertionId],
    });
  };

  return { settleAssertion, ...rest };
}

// UMA-SPECIFIC EVENT WATCHING

/**
 * Watch for UMA disputes created
 */
export function useWatchBountyUMADisputeCreated(onLogs?: (logs: Log[]) => void) {
  return useWatchContractEvent({
    address: CONTRACTS.BOUNTY_ESCROW,
    abi: BountyEscrowAbi,
    eventName: 'UMADisputeCreated',
    onLogs,
  });
}

/**
 * Watch for UMA disputes resolved
 */
export function useWatchBountyUMADisputeResolved(onLogs?: (logs: Log[]) => void) {
  return useWatchContractEvent({
    address: CONTRACTS.BOUNTY_ESCROW,
    abi: BountyEscrowAbi,
    eventName: 'UMADisputeResolved',
    onLogs,
  });
}
