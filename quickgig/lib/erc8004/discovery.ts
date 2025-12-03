/**
 * ERC-8004 Agent Discovery Helpers
 * Capability-based agent search, filtering, and ranking
 */

import { useReadContract } from 'wagmi';
import ERC8004RegistryABI from '../contracts/abis/ERC8004Registry.json';
import ReputationRegistryABI from '../contracts/abis/ReputationRegistry.json';
import { CONTRACTS } from '../contracts/addresses';
import type { Address } from 'viem';

/**
 * Agent types from ERC-8004
 */
export enum AgentType {
  Human = 0,
  AI = 1,
  Hybrid = 2,
}

/**
 * Agent status from ERC-8004
 */
export enum AgentStatus {
  Active = 0,
  Paused = 1,
  Deactivated = 2,
}

/**
 * Agent Card structure
 */
export interface AgentCard {
  owner: Address;
  agentType: AgentType;
  status: AgentStatus;
  agentCardURI: string; // IPFS hash
  capabilities: string[];
  registeredAt: bigint;
  lastUpdated: bigint;
  verified: boolean;
}

/**
 * Agent with reputation scores
 */
export interface AgentWithReputation extends AgentCard {
  agentId: string;
  reputation: {
    totalFeedbacks: bigint;
    qualityRating: number; // 0-500 (scaled by 100)
    communicationRating: number;
    timelinessRating: number;
    overallRating: number;
    trustScore: number; // 0-10000
    disputeRate: number; // basis points
    successRate: number; // basis points
    completedGigs: bigint;
  };
}

/**
 * Discover agents by capability
 */
export function useDiscoverByCapability(capability: string) {
  return useReadContract({
    address: CONTRACTS.ERC8004_REGISTRY,
    abi: ERC8004RegistryABI.abi,
    functionName: 'discoverByCapability',
    args: [capability],
  });
}

/**
 * Get active agents by capability
 */
export function useGetActiveAgentsByCapability(capability: string) {
  return useReadContract({
    address: CONTRACTS.ERC8004_REGISTRY,
    abi: ERC8004RegistryABI.abi,
    functionName: 'getActiveAgentsByCapability',
    args: [capability],
  });
}

/**
 * Get verified agents by capability
 */
export function useGetVerifiedAgentsByCapability(capability: string) {
  return useReadContract({
    address: CONTRACTS.ERC8004_REGISTRY,
    abi: ERC8004RegistryABI.abi,
    functionName: 'getVerifiedAgentsByCapability',
    args: [capability],
  });
}

/**
 * Get agent details by ID
 */
export function useGetAgent(agentId: string) {
  return useReadContract({
    address: CONTRACTS.ERC8004_REGISTRY,
    abi: ERC8004RegistryABI.abi,
    functionName: 'getAgent',
    args: [agentId as `0x${string}`],
  });
}

/**
 * Get agent by wallet address
 */
export function useGetAgentByWallet(wallet: Address) {
  return useReadContract({
    address: CONTRACTS.ERC8004_REGISTRY,
    abi: ERC8004RegistryABI.abi,
    functionName: 'getAgentByWallet',
    args: [wallet],
  });
}

/**
 * Check if agent has capability
 */
export function useHasCapability(agentId: string, capability: string) {
  return useReadContract({
    address: CONTRACTS.ERC8004_REGISTRY,
    abi: ERC8004RegistryABI.abi,
    functionName: 'hasCapability',
    args: [agentId as `0x${string}`, capability],
  });
}

/**
 * Get agent reputation
 */
export function useGetAgentReputation(agentAddress: Address) {
  return useReadContract({
    address: CONTRACTS.REPUTATION_REGISTRY,
    abi: ReputationRegistryABI.abi,
    functionName: 'getReputation',
    args: [agentAddress],
  });
}

/**
 * Get agent quality rating
 */
export function useGetQualityRating(agentAddress: Address) {
  return useReadContract({
    address: CONTRACTS.REPUTATION_REGISTRY,
    abi: ReputationRegistryABI.abi,
    functionName: 'getQualityRating',
    args: [agentAddress],
  });
}

/**
 * Get agent trust score (0-10000)
 */
export function useGetTrustScore(agentAddress: Address) {
  return useReadContract({
    address: CONTRACTS.REPUTATION_REGISTRY,
    abi: ReputationRegistryABI.abi,
    functionName: 'getTrustScore',
    args: [agentAddress],
  });
}

/**
 * Get agent success rate
 */
export function useGetSuccessRate(agentAddress: Address) {
  return useReadContract({
    address: CONTRACTS.REPUTATION_REGISTRY,
    abi: ReputationRegistryABI.abi,
    functionName: 'getSuccessRate',
    args: [agentAddress],
  });
}

/**
 * Client-side filtering and sorting utilities
 */

/**
 * Filter agents by minimum trust score
 */
export function filterByTrustScore(
  agents: AgentWithReputation[],
  minScore: number
): AgentWithReputation[] {
  return agents.filter((agent) => agent.reputation.trustScore >= minScore);
}

/**
 * Filter agents by agent type
 */
export function filterByAgentType(
  agents: AgentWithReputation[],
  type: AgentType
): AgentWithReputation[] {
  return agents.filter((agent) => agent.agentType === type);
}

/**
 * Filter verified agents only
 */
export function filterVerifiedOnly(
  agents: AgentWithReputation[]
): AgentWithReputation[] {
  return agents.filter((agent) => agent.verified);
}

/**
 * Sort agents by trust score (descending)
 */
export function sortByTrustScore(
  agents: AgentWithReputation[]
): AgentWithReputation[] {
  return [...agents].sort(
    (a, b) => b.reputation.trustScore - a.reputation.trustScore
  );
}

/**
 * Sort agents by completed gigs (descending)
 */
export function sortByExperience(
  agents: AgentWithReputation[]
): AgentWithReputation[] {
  return [...agents].sort(
    (a, b) => Number(b.reputation.completedGigs - a.reputation.completedGigs)
  );
}

/**
 * Sort agents by registration date (newest first)
 */
export function sortByNewest(agents: AgentWithReputation[]): AgentWithReputation[] {
  return [...agents].sort(
    (a, b) => Number(b.registeredAt - a.registeredAt)
  );
}

/**
 * Combined discovery: Find top agents by capability with filters
 */
export interface DiscoveryFilters {
  capability: string;
  minTrustScore?: number;
  agentType?: AgentType;
  verifiedOnly?: boolean;
  sortBy?: 'trust' | 'experience' | 'newest';
  limit?: number;
}

/**
 * Format agent type as string
 */
export function formatAgentType(type: AgentType): string {
  switch (type) {
    case AgentType.Human:
      return 'Human';
    case AgentType.AI:
      return 'AI';
    case AgentType.Hybrid:
      return 'Hybrid';
    default:
      return 'Unknown';
  }
}

/**
 * Format agent status as string
 */
export function formatAgentStatus(status: AgentStatus): string {
  switch (status) {
    case AgentStatus.Active:
      return 'Active';
    case AgentStatus.Paused:
      return 'Paused';
    case AgentStatus.Deactivated:
      return 'Deactivated';
    default:
      return 'Unknown';
  }
}

/**
 * Format trust score as rating (0-5 stars)
 */
export function formatTrustScoreAsStars(trustScore: number): number {
  // Trust score is 0-10000, convert to 0-5
  return (trustScore / 10000) * 5;
}

/**
 * Format basis points as percentage
 */
export function formatBasisPoints(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

/**
 * Get agent card metadata from IPFS
 */
export async function fetchAgentCardMetadata(ipfsUri: string): Promise<{
  name: string;
  description: string;
  avatar?: string;
  contact?: {
    twitter?: string;
    github?: string;
    email?: string;
    website?: string;
  };
  portfolio?: Array<{
    title: string;
    description: string;
    imageUrl: string;
    url?: string;
  }>;
}> {
  // Convert IPFS URI to HTTP gateway
  const gatewayUrl = ipfsUri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');

  try {
    const response = await fetch(gatewayUrl);
    if (!response.ok) {
      console.log(`Could not fetch agent card from ${gatewayUrl}: ${response.status} ${response.statusText}`);
      return {
        name: 'Unknown Agent',
        description: 'Agent card metadata unavailable',
      };
    }
    return await response.json();
  } catch (error) {
    console.log('Agent card fetch error (using fallback):', error instanceof Error ? error.message : String(error));
    return {
      name: 'Unknown Agent',
      description: 'Agent card metadata unavailable',
    };
  }
}

