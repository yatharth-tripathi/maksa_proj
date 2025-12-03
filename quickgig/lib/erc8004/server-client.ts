/**
 * Server-side ERC-8004 Client
 * Uses deployer wallet for gas-sponsored agent registration
 */

import { createPublicClient, createWalletClient, http, type Address, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { OfficialERC8004Client } from './official-client';

/**
 * Get server-side ERC-8004 client (uses deployer wallet for gas)
 */
export function getServerERC8004Client(): OfficialERC8004Client {
  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  const rpcUrl = process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;

  if (!privateKey) {
    throw new Error('PRIVATE_KEY not configured in environment');
  }

  if (!rpcUrl) {
    throw new Error('NEXT_PUBLIC_ALCHEMY_RPC_URL not configured in environment');
  }

  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  // Type assertion needed due to viem internal type differences
  return new OfficialERC8004Client(publicClient as PublicClient, walletClient as WalletClient);
}

/**
 * Get deployer wallet address
 */
export function getDeployerAddress(): Address {
  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;

  if (!privateKey) {
    throw new Error('PRIVATE_KEY not configured in environment');
  }

  const account = privateKeyToAccount(privateKey);
  return account.address;
}
