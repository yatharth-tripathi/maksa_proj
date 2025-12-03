import { useReadContract, useWriteContract, useWatchContractEvent } from 'wagmi';
import QuickGigEscalationManagerABI from './abis/QuickGigEscalationManager.json';
import { CONTRACTS } from './addresses';
import type { Address, Log, Hex } from 'viem';

/**
 * QuickGigEscalationManager Contract Hooks
 * UMA Optimistic Oracle V3 escalation manager for QuickGig disputes
 */

// READ HOOKS

/**
 * Get dispute details by assertion ID
 */
export function useGetDispute(assertionId: Hex) {
  return useReadContract({
    address: CONTRACTS.UMA_ESCALATION_MANAGER,
    abi: QuickGigEscalationManagerABI.abi,
    functionName: 'getDispute',
    args: [assertionId],
  });
}

/**
 * Get assertion policy for a given assertion ID
 */
export function useGetAssertionPolicy(assertionId: Hex) {
  return useReadContract({
    address: CONTRACTS.UMA_ESCALATION_MANAGER,
    abi: QuickGigEscalationManagerABI.abi,
    functionName: 'getAssertionPolicy',
    args: [assertionId],
  });
}

/**
 * Get resolution for a bounty
 * Returns (resolved: bool, clientBps: uint256, workerBps: uint256)
 */
export function useGetResolution(bountyId: bigint) {
  return useReadContract({
    address: CONTRACTS.UMA_ESCALATION_MANAGER,
    abi: QuickGigEscalationManagerABI.abi,
    functionName: 'getResolution',
    args: [bountyId],
  });
}

/**
 * Get assertion ID for a bounty
 */
export function useGetAssertionId(bountyId: bigint) {
  return useReadContract({
    address: CONTRACTS.UMA_ESCALATION_MANAGER,
    abi: QuickGigEscalationManagerABI.abi,
    functionName: 'getAssertionId',
    args: [bountyId],
  });
}

/**
 * Check if an address is an authorized disputer
 */
export function useIsAuthorizedDisputer(address: Address) {
  return useReadContract({
    address: CONTRACTS.UMA_ESCALATION_MANAGER,
    abi: QuickGigEscalationManagerABI.abi,
    functionName: 'isAuthorizedDisputer',
    args: [address],
  });
}

/**
 * Get default bond amount
 */
export function useDefaultBond() {
  return useReadContract({
    address: CONTRACTS.UMA_ESCALATION_MANAGER,
    abi: QuickGigEscalationManagerABI.abi,
    functionName: 'defaultBond',
  });
}

/**
 * Get liveness period (in seconds)
 */
export function useLivenessPeriod() {
  return useReadContract({
    address: CONTRACTS.UMA_ESCALATION_MANAGER,
    abi: QuickGigEscalationManagerABI.abi,
    functionName: 'livenessPeriod',
  });
}

/**
 * Get owner address
 */
export function useEscalationManagerOwner() {
  return useReadContract({
    address: CONTRACTS.UMA_ESCALATION_MANAGER,
    abi: QuickGigEscalationManagerABI.abi,
    functionName: 'owner',
  });
}

/**
 * Get BountyEscrow contract address
 */
export function useBountyEscrowAddress() {
  return useReadContract({
    address: CONTRACTS.UMA_ESCALATION_MANAGER,
    abi: QuickGigEscalationManagerABI.abi,
    functionName: 'bountyEscrow',
  });
}

/**
 * Get OptimisticOracle contract address
 */
export function useOptimisticOracleAddress() {
  return useReadContract({
    address: CONTRACTS.UMA_ESCALATION_MANAGER,
    abi: QuickGigEscalationManagerABI.abi,
    functionName: 'optimisticOracle',
  });
}

/**
 * Check if contract is paused
 */
export function useIsPaused() {
  return useReadContract({
    address: CONTRACTS.UMA_ESCALATION_MANAGER,
    abi: QuickGigEscalationManagerABI.abi,
    functionName: 'paused',
  });
}

// WRITE HOOKS

/**
 * Resolve a dispute (owner only)
 * @param assertionId The assertion identifier
 * @param clientWon True if client wins, false if worker wins
 */
export function useResolveDispute() {
  const { writeContract, ...rest } = useWriteContract();

  const resolveDispute = (assertionId: Hex, clientWon: boolean) => {
    return writeContract({
      address: CONTRACTS.UMA_ESCALATION_MANAGER,
      abi: QuickGigEscalationManagerABI.abi,
      functionName: 'resolveDispute',
      args: [assertionId, clientWon],
    });
  };

  return { resolveDispute, ...rest };
}

/**
 * Update default bond amount (owner only)
 */
export function useUpdateDefaultBond() {
  const { writeContract, ...rest } = useWriteContract();

  const updateDefaultBond = (newBond: bigint) => {
    return writeContract({
      address: CONTRACTS.UMA_ESCALATION_MANAGER,
      abi: QuickGigEscalationManagerABI.abi,
      functionName: 'updateDefaultBond',
      args: [newBond],
    });
  };

  return { updateDefaultBond, ...rest };
}

/**
 * Update liveness period (owner only)
 */
export function useUpdateLiveness() {
  const { writeContract, ...rest } = useWriteContract();

  const updateLiveness = (newLiveness: bigint) => {
    return writeContract({
      address: CONTRACTS.UMA_ESCALATION_MANAGER,
      abi: QuickGigEscalationManagerABI.abi,
      functionName: 'updateLiveness',
      args: [newLiveness],
    });
  };

  return { updateLiveness, ...rest };
}

/**
 * Authorize a disputer (owner only)
 */
export function useAuthorizeDisputer() {
  const { writeContract, ...rest } = useWriteContract();

  const authorizeDisputer = (disputer: Address) => {
    return writeContract({
      address: CONTRACTS.UMA_ESCALATION_MANAGER,
      abi: QuickGigEscalationManagerABI.abi,
      functionName: 'authorizeDisputer',
      args: [disputer],
    });
  };

  return { authorizeDisputer, ...rest };
}

/**
 * Revoke disputer authorization (owner only)
 */
export function useRevokeDisputer() {
  const { writeContract, ...rest } = useWriteContract();

  const revokeDisputer = (disputer: Address) => {
    return writeContract({
      address: CONTRACTS.UMA_ESCALATION_MANAGER,
      abi: QuickGigEscalationManagerABI.abi,
      functionName: 'revokeDisputer',
      args: [disputer],
    });
  };

  return { revokeDisputer, ...rest };
}

/**
 * Pause the contract (owner only)
 */
export function usePause() {
  const { writeContract, ...rest } = useWriteContract();

  const pause = () => {
    return writeContract({
      address: CONTRACTS.UMA_ESCALATION_MANAGER,
      abi: QuickGigEscalationManagerABI.abi,
      functionName: 'pause',
    });
  };

  return { pause, ...rest };
}

/**
 * Unpause the contract (owner only)
 */
export function useUnpause() {
  const { writeContract, ...rest } = useWriteContract();

  const unpause = () => {
    return writeContract({
      address: CONTRACTS.UMA_ESCALATION_MANAGER,
      abi: QuickGigEscalationManagerABI.abi,
      functionName: 'unpause',
    });
  };

  return { unpause, ...rest };
}

/**
 * Update BountyEscrow address (owner only)
 */
export function useUpdateBountyEscrow() {
  const { writeContract, ...rest } = useWriteContract();

  const updateBountyEscrow = (newBountyEscrow: Address) => {
    return writeContract({
      address: CONTRACTS.UMA_ESCALATION_MANAGER,
      abi: QuickGigEscalationManagerABI.abi,
      functionName: 'updateBountyEscrow',
      args: [newBountyEscrow],
    });
  };

  return { updateBountyEscrow, ...rest };
}

/**
 * Transfer ownership (owner only)
 */
export function useTransferOwnership() {
  const { writeContract, ...rest } = useWriteContract();

  const transferOwnership = (newOwner: Address) => {
    return writeContract({
      address: CONTRACTS.UMA_ESCALATION_MANAGER,
      abi: QuickGigEscalationManagerABI.abi,
      functionName: 'transferOwnership',
      args: [newOwner],
    });
  };

  return { transferOwnership, ...rest };
}

// EVENT WATCHING

/**
 * Watch for new disputes created
 */
export function useWatchDisputeCreated(onLogs?: (logs: Log[]) => void) {
  return useWatchContractEvent({
    address: CONTRACTS.UMA_ESCALATION_MANAGER,
    abi: QuickGigEscalationManagerABI.abi,
    eventName: 'DisputeCreated',
    onLogs,
  });
}

/**
 * Watch for disputes resolved
 */
export function useWatchDisputeResolved(onLogs?: (logs: Log[]) => void) {
  return useWatchContractEvent({
    address: CONTRACTS.UMA_ESCALATION_MANAGER,
    abi: QuickGigEscalationManagerABI.abi,
    eventName: 'DisputeResolved',
    onLogs,
  });
}

/**
 * Watch for bond updates
 */
export function useWatchBondUpdated(onLogs?: (logs: Log[]) => void) {
  return useWatchContractEvent({
    address: CONTRACTS.UMA_ESCALATION_MANAGER,
    abi: QuickGigEscalationManagerABI.abi,
    eventName: 'BondUpdated',
    onLogs,
  });
}

/**
 * Watch for liveness updates
 */
export function useWatchLivenessUpdated(onLogs?: (logs: Log[]) => void) {
  return useWatchContractEvent({
    address: CONTRACTS.UMA_ESCALATION_MANAGER,
    abi: QuickGigEscalationManagerABI.abi,
    eventName: 'LivenessUpdated',
    onLogs,
  });
}

/**
 * Watch for policy updates
 */
export function useWatchPolicyUpdated(onLogs?: (logs: Log[]) => void) {
  return useWatchContractEvent({
    address: CONTRACTS.UMA_ESCALATION_MANAGER,
    abi: QuickGigEscalationManagerABI.abi,
    eventName: 'PolicyUpdated',
    onLogs,
  });
}

/**
 * Watch for disputer authorizations
 */
export function useWatchDisputerAuthorized(onLogs?: (logs: Log[]) => void) {
  return useWatchContractEvent({
    address: CONTRACTS.UMA_ESCALATION_MANAGER,
    abi: QuickGigEscalationManagerABI.abi,
    eventName: 'DisputerAuthorized',
    onLogs,
  });
}

/**
 * Watch for disputer revocations
 */
export function useWatchDisputerRevoked(onLogs?: (logs: Log[]) => void) {
  return useWatchContractEvent({
    address: CONTRACTS.UMA_ESCALATION_MANAGER,
    abi: QuickGigEscalationManagerABI.abi,
    eventName: 'DisputerRevoked',
    onLogs,
  });
}

/**
 * Watch for pause events
 */
export function useWatchPaused(onLogs?: (logs: Log[]) => void) {
  return useWatchContractEvent({
    address: CONTRACTS.UMA_ESCALATION_MANAGER,
    abi: QuickGigEscalationManagerABI.abi,
    eventName: 'Paused',
    onLogs,
  });
}

/**
 * Watch for unpause events
 */
export function useWatchUnpaused(onLogs?: (logs: Log[]) => void) {
  return useWatchContractEvent({
    address: CONTRACTS.UMA_ESCALATION_MANAGER,
    abi: QuickGigEscalationManagerABI.abi,
    eventName: 'Unpaused',
    onLogs,
  });
}
