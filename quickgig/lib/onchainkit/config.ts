/**
 * OnchainKit Configuration
 * Includes Paymaster setup for gasless transactions
 */

import { base, baseSepolia } from 'wagmi/chains';

// Determine environment
const isProduction = process.env.NEXT_PUBLIC_ENVIRONMENT === 'production';

/**
 * Paymaster URL for Base
 * Enables gasless transactions for Coinbase Smart Wallet users
 */
export const paymasterUrl = isProduction
  ? 'https://api.developer.coinbase.com/rpc/v1/base/paymaster'
  : 'https://api.developer.coinbase.com/rpc/v1/base-sepolia/paymaster';

/**
 * Paymaster capabilities configuration
 * Pass this to Transaction components to enable gasless txs
 */
export const paymasterCapabilities = {
  paymasterService: {
    url: paymasterUrl,
  },
};

/**
 * Get chain-specific config
 */
export function getChainConfig(chainId: number) {
  const chain = chainId === base.id ? base : baseSepolia;
  
  return {
    chain,
    paymasterUrl: chainId === base.id 
      ? 'https://api.developer.coinbase.com/rpc/v1/base/paymaster'
      : 'https://api.developer.coinbase.com/rpc/v1/base-sepolia/paymaster',
  };
}

/**
 * Check if address is using Coinbase Smart Wallet
 * Smart Wallets get gasless transactions via Paymaster
 */
export function isCoinbaseSmartWallet(address?: string): boolean {
  // Coinbase Smart Wallets have specific address patterns
  // This is a simplified check - in production you'd use proper detection
  return address?.toLowerCase().startsWith('0x') ?? false;
}

