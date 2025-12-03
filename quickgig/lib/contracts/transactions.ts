/**
 * OnchainKit Transaction Call Builders
 * Helper functions to build transaction calls for OnchainKit Transaction component
 */

import type { Address } from 'viem';
import { encodeFunctionData } from 'viem';
import { CONTRACTS } from './addresses';
import BountyEscrowABI from './abis/BountyEscrow.json';
import GigEscrowABI from './abis/GigEscrow.json';
import { ERC20_ABI } from './erc20';

// Define Call type locally
type Call = {
  to: Address;
  data?: `0x${string}`;
  value?: bigint;
};

/**
 * Build calls for creating a bounty
 * Includes approve + createBounty in a single transaction
 */
export function buildCreateBountyCalls(
  paymentToken: Address,
  amount: bigint,
  deadline: bigint,
  requirements: string
): Call[] {
  return [
    // 1. Approve USDC to BountyEscrow
    {
      to: paymentToken,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACTS.BOUNTY_ESCROW, amount],
      }),
    },
    // 2. Create Bounty
    {
      to: CONTRACTS.BOUNTY_ESCROW,
      data: encodeFunctionData({
        abi: BountyEscrowABI.abi,
        functionName: 'createBounty',
        args: [paymentToken, amount, deadline, requirements],
      }),
    },
  ];
}

/**
 * Build calls for submitting a bid on a bounty
 */
export function buildSubmitBidCalls(
  bountyId: bigint,
  bidAmount: bigint,
  proposalURI: string
): Call[] {
  return [
    {
      to: CONTRACTS.BOUNTY_ESCROW,
      data: encodeFunctionData({
        abi: BountyEscrowABI.abi,
        functionName: 'submitBid',
        args: [bountyId, bidAmount, proposalURI],
      }),
    },
  ];
}

/**
 * Build calls for assigning a worker to a bounty
 */
export function buildAssignWorkerCalls(
  bountyId: bigint,
  bidIndex: bigint
): Call[] {
  return [
    {
      to: CONTRACTS.BOUNTY_ESCROW,
      data: encodeFunctionData({
        abi: BountyEscrowABI.abi,
        functionName: 'assignWorker',
        args: [bountyId, bidIndex],
      }),
    },
  ];
}

/**
 * Build calls for submitting a deliverable
 */
export function buildSubmitDeliverableCalls(
  bountyId: bigint,
  deliverableURI: string
): Call[] {
  return [
    {
      to: CONTRACTS.BOUNTY_ESCROW,
      data: encodeFunctionData({
        abi: BountyEscrowABI.abi,
        functionName: 'submitDeliverable',
        args: [bountyId, deliverableURI],
      }),
    },
  ];
}

/**
 * Build calls for approving a deliverable
 */
export function buildApproveDeliverableCalls(
  bountyId: bigint
): Call[] {
  return [
    {
      to: CONTRACTS.BOUNTY_ESCROW,
      data: encodeFunctionData({
        abi: BountyEscrowABI.abi,
        functionName: 'approveDeliverable',
        args: [bountyId],
      }),
    },
  ];
}

/**
 * Build calls for creating a gig
 * Includes approve + createGig in a single transaction
 */
export function buildCreateGigCalls(
  worker: Address,
  paymentToken: Address,
  milestoneDescriptions: string[],
  milestoneAmounts: bigint[]
): Call[] {
  const totalAmount = milestoneAmounts.reduce((sum, amount) => sum + amount, 0n);
  
  return [
    // 1. Approve USDC to GigEscrow
    {
      to: paymentToken,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACTS.GIG_ESCROW, totalAmount],
      }),
    },
    // 2. Create Gig
    {
      to: CONTRACTS.GIG_ESCROW,
      data: encodeFunctionData({
        abi: GigEscrowABI,
        functionName: 'createGig',
        args: [worker, paymentToken, milestoneDescriptions, milestoneAmounts],
      }),
    },
  ];
}

/**
 * Build calls for submitting a milestone
 */
export function buildSubmitMilestoneCalls(
  gigId: bigint,
  milestoneIndex: bigint,
  deliverableURI: string
): Call[] {
  return [
    {
      to: CONTRACTS.GIG_ESCROW,
      data: encodeFunctionData({
        abi: GigEscrowABI,
        functionName: 'submitMilestone',
        args: [gigId, milestoneIndex, deliverableURI],
      }),
    },
  ];
}

/**
 * Build calls for approving a milestone
 */
export function buildApproveMilestoneCalls(
  gigId: bigint,
  milestoneIndex: bigint
): Call[] {
  return [
    {
      to: CONTRACTS.GIG_ESCROW,
      data: encodeFunctionData({
        abi: GigEscrowABI,
        functionName: 'approveMilestone',
        args: [gigId, milestoneIndex],
      }),
    },
  ];
}

