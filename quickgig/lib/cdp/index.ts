/**
 * CDP Module Exports
 * Autonomous agent wallet management using Coinbase Developer Platform
 */

export { CdpWalletManager, getCdpWalletManager } from './wallet-manager';
export type {
  AgentWalletData,
  CreateWalletParams,
  WalletBalance,
} from './wallet-manager';

export type {
  AgentWallet,
  AgentRegistration,
  WalletBalanceInfo,
  NetworkConfig,
} from './types';
