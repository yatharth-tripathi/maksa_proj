/**
 * CDP Client for Autonomous Agents
 * WebSocket and REST API for blockchain interactions
 */

import { createPublicClient, webSocket, http, parseAbiItem } from 'viem';
import { baseSepolia } from 'viem/chains';
import { agentConfig } from './config';
import logger from './logger';

// WebSocket URL for real-time updates
const WS_URL = `wss://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;

// HTTP fallback
const HTTP_URL = `https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;

/**
 * WebSocket client for real-time event monitoring
 */
export const websocketClient = createPublicClient({
  chain: baseSepolia,
  transport: webSocket(WS_URL, {
    reconnect: true,
    retryCount: 10,
    retryDelay: 2000,
    keepAlive: {
      interval: 30_000, // 30 seconds
    },
  }),
});

/**
 * HTTP client for contract reads and transactions
 */
export const httpClient = createPublicClient({
  chain: baseSepolia,
  transport: http(HTTP_URL),
});

/**
 * Watch for BountyCreated events via WebSocket
 */
export function watchBountyEvents(callback: (bounty: any) => void) {
  logger.info('Starting WebSocket listener for BountyCreated events');
  
  return websocketClient.watchContractEvent({
    address: agentConfig.contracts.bountyEscrow,
    abi: parseAbiItem(
      'event BountyCreated(uint256 indexed bountyId, address indexed client, address paymentToken, uint256 escrowAmount, uint256 deadline, string requirementsURI)'
    ),
    eventName: 'BountyCreated',
    onLogs: (logs) => {
      logs.forEach(log => {
        logger.info('New bounty detected via WebSocket', {
          bountyId: log.args.bountyId,
          client: log.args.client,
          amount: log.args.escrowAmount,
        });
        callback(log.args);
      });
    },
    onError: (error) => {
      logger.error('WebSocket error', error);
      // Will auto-reconnect due to reconnect: true
    },
  });
}

/**
 * Watch for WorkerAssigned events
 */
export function watchWorkerAssignedEvents(callback: (assignment: any) => void) {
  logger.info('Starting WebSocket listener for WorkerAssigned events');
  
  return websocketClient.watchContractEvent({
    address: agentConfig.contracts.bountyEscrow,
    abi: parseAbiItem(
      'event WorkerAssigned(uint256 indexed bountyId, address indexed worker, uint256 bidAmount)'
    ),
    eventName: 'WorkerAssigned',
    onLogs: (logs) => {
      logs.forEach(log => {
        logger.info('Worker assigned via WebSocket', {
          bountyId: log.args.bountyId,
          worker: log.args.worker,
        });
        callback(log.args);
      });
    },
    onError: (error) => {
      logger.error('WebSocket error', error);
    },
  });
}

/**
 * Fetch historical logs via HTTP (for initial sync)
 * Handles Alchemy free tier 10-block limit automatically
 */
export async function getHistoricalLogs(
  fromBlock: bigint,
  toBlock: bigint
): Promise<any[]> {
  const CHUNK_SIZE = 10n;
  const allLogs: any[] = [];
  
  logger.info(`Fetching historical logs from block ${fromBlock} to ${toBlock}`);
  
  for (let i = fromBlock; i <= toBlock; i += CHUNK_SIZE) {
    const chunkEnd = i + CHUNK_SIZE - 1n > toBlock ? toBlock : i + CHUNK_SIZE - 1n;
    
    try {
      const logs = await httpClient.getLogs({
        address: agentConfig.contracts.bountyEscrow,
        event: parseAbiItem(
          'event BountyCreated(uint256 indexed bountyId, address indexed client, address paymentToken, uint256 escrowAmount, uint256 deadline, string requirementsURI)'
        ),
        fromBlock: i,
        toBlock: chunkEnd,
      });
      
      allLogs.push(...logs);
      logger.debug(`Fetched ${logs.length} logs from blocks ${i} to ${chunkEnd}`);
    } catch (error) {
      logger.error(`Error fetching logs for blocks ${i} to ${chunkEnd}`, error);
      // Continue with next chunk
    }
  }
  
  logger.info(`Fetched ${allLogs.length} total historical logs`);
  return allLogs;
}

/**
 * Get current block number
 */
export async function getCurrentBlockNumber(): Promise<bigint> {
  return await httpClient.getBlockNumber();
}

/**
 * Read contract data
 */
export async function readContract(params: any) {
  return await httpClient.readContract(params);
}

/**
 * Get transaction receipt
 */
export async function getTransactionReceipt(hash: `0x${string}`) {
  return await httpClient.getTransactionReceipt({ hash });
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(hash: `0x${string}`, timeout = 60000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const receipt = await getTransactionReceipt(hash);
      if (receipt) {
        return receipt;
      }
    } catch (error) {
      // Transaction not yet mined, continue waiting
    }
    
    // Wait 2 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error(`Transaction ${hash} not confirmed within ${timeout}ms`);
}

/**
 * Health check for CDP connection
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await httpClient.getBlockNumber();
    logger.info('CDP health check: OK');
    return true;
  } catch (error) {
    logger.error('CDP health check: FAILED', error);
    return false;
  }
}

