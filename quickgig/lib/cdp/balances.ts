/**
 * CDP Token Balances API
 * Fetch token balances using Coinbase Developer Platform APIs
 */

import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';

/**
 * Get token balance via CDP API
 * Note: For now using RPC as fallback since CDP Token API requires production setup
 */
export async function getTokenBalance(
  address: Address,
  tokenAddress: Address
): Promise<bigint> {
  try {
    // TODO: Use CDP Token Balances API when available
    // const response = await fetch(
    //   `https://api.cdp.coinbase.com/v1/base-sepolia/accounts/${address}/balances`,
    //   {
    //     headers: {
    //       'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CDP_API_KEY}`,
    //     },
    //   }
    // );
    // const data = await response.json();
    // const token = data.balances.find(
    //   (b: any) => b.token_address.toLowerCase() === tokenAddress.toLowerCase()
    // );
    // return BigInt(token?.value || '0');
    
    // Fallback to direct RPC call for now
    const response = await fetch(
      `https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [
            {
              to: tokenAddress,
              data: `0x70a08231000000000000000000000000${address.slice(2)}`, // balanceOf(address)
            },
            'latest',
          ],
          id: 1,
        }),
      }
    );
    
    const data = await response.json();
    return BigInt(data.result || '0');
  } catch (error) {
    console.error('Error fetching token balance:', error);
    return 0n;
  }
}

/**
 * React Query hook for token balances
 * Auto-refreshes every 10 seconds
 */
export function useTokenBalanceCDP(tokenAddress: Address, address?: Address) {
  return useQuery({
    queryKey: ['cdp-balance', address, tokenAddress],
    queryFn: () => address ? getTokenBalance(address, tokenAddress) : Promise.resolve(null),
    enabled: !!address,
    refetchInterval: 10_000, // Refetch every 10 seconds
    staleTime: 5_000, // Consider data stale after 5 seconds
  });
}

/**
 * Get ETH balance via CDP
 */
export async function getEthBalance(address: Address): Promise<bigint> {
  try {
    const response = await fetch(
      `https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBalance',
          params: [address, 'latest'],
          id: 1,
        }),
      }
    );
    
    const data = await response.json();
    return BigInt(data.result || '0');
  } catch (error) {
    console.error('Error fetching ETH balance:', error);
    return 0n;
  }
}

/**
 * React Query hook for ETH balance
 */
export function useEthBalanceCDP(address?: Address) {
  return useQuery({
    queryKey: ['cdp-eth-balance', address],
    queryFn: () => address ? getEthBalance(address) : Promise.resolve(null),
    enabled: !!address,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}

