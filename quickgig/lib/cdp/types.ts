/**
 * CDP Wallet Types
 * Type definitions for agent wallet management
 */

import type { Address } from 'viem';

/**
 * Agent wallet stored in database
 */
export interface AgentWallet {
  id: string;
  agentId: bigint;
  address: Address;
  networkId: string;
  createdAt: Date;
  lastUsedAt?: Date;
}

/**
 * Agent registration with wallet
 */
export interface AgentRegistration {
  agentId: bigint;
  ownerAddress: Address;
  walletAddress: Address;
  name: string;
  capabilities: string[];
  agentType: 'ai' | 'human' | 'hybrid';
  metadataUri?: string;
}

/**
 * Agent wallet balance
 */
export interface WalletBalanceInfo {
  address: Address;
  native: {
    symbol: string;
    balance: string;
    wei: bigint;
  };
  usdc?: {
    balance: string;
    decimals: number;
  };
}

/**
 * Network configuration
 */
export interface NetworkConfig {
  networkId: string;
  chainId: number;
  name: string;
  currency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorers: string[];
}
