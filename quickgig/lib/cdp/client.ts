/**
 * CDP Client with RPC Fallback
 * Hybrid approach: Try CDP APIs first, fallback to Alchemy RPC
 */

import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import type { GetLogsParameters, GetLogsReturnType } from 'viem';

const ALCHEMY_RPC_URL = `https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`;

/**
 * Standard RPC client for fallback
 */
export const rpcClient = createPublicClient({
  chain: baseSepolia,
  transport: http(ALCHEMY_RPC_URL),
});

/**
 * Fetch logs with CDP API fallback to RPC
 * Handles Alchemy free tier 10-block limit automatically
 */
export async function getLogsWithFallback(
  params: GetLogsParameters
): Promise<GetLogsReturnType> {
  try {
    // For now, use RPC directly since CDP logs API requires specific setup
    // In production, you would try CDP first:
    //
    // const response = await fetch(
    //   `https://api.cdp.coinbase.com/v1/base-sepolia/logs`,
    //   {
    //     method: 'POST',
    //     headers: {
    //       'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CDP_API_KEY}`,
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify(params),
    //   }
    // );
    //
    // if (response.ok) {
    //   return await response.json();
    // }
    
    // Fallback to RPC with 10-block batching for Alchemy free tier
    return await fetchLogsViaRPC(params);
  } catch (error) {
    console.warn('CDP API unavailable, using RPC fallback', error);
    return await fetchLogsViaRPC(params);
  }
}

/**
 * Fetch logs via RPC with automatic 10-block batching
 * Handles Alchemy free tier limitation
 */
async function fetchLogsViaRPC(
  params: GetLogsParameters
): Promise<GetLogsReturnType> {
  const { fromBlock, toBlock, ...restParams } = params;
  
  // If block range is 10 or less, fetch directly
  if (
    typeof fromBlock === 'bigint' &&
    typeof toBlock === 'bigint' &&
    toBlock - fromBlock <= 9n
  ) {
    return await rpcClient.getLogs(params) as GetLogsReturnType;
  }
  
  // Otherwise, batch into 10-block chunks
  const CHUNK_SIZE = 10n;
  const allLogs: GetLogsReturnType = [];
  
  const startBlock = typeof fromBlock === 'bigint' ? fromBlock : 0n;
  const endBlock = typeof toBlock === 'bigint' ? toBlock : await rpcClient.getBlockNumber();
  
  for (let i = startBlock; i <= endBlock; i += CHUNK_SIZE) {
    const chunkEnd = i + CHUNK_SIZE - 1n > endBlock ? endBlock : i + CHUNK_SIZE - 1n;
    
    try {
      const logs = await rpcClient.getLogs({
        ...restParams,
        fromBlock: i,
        toBlock: chunkEnd,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any) as GetLogsReturnType;
      allLogs.push(...logs);
    } catch (error) {
      console.error(`Error fetching logs for blocks ${i} to ${chunkEnd}:`, error);
      // Continue with next chunk even if this one fails
    }
  }
  
  return allLogs;
}

/**
 * Get current block number
 */
export async function getCurrentBlockNumber(): Promise<bigint> {
  return await rpcClient.getBlockNumber();
}

/**
 * Get transaction receipt
 */
export async function getTransactionReceipt(hash: `0x${string}`) {
  return await rpcClient.getTransactionReceipt({ hash });
}

