/**
 * CDP WebSocket Client
 * Real-time blockchain data using WebSocket connections
 */

import { createPublicClient, webSocket, parseAbiItem, type PublicClient } from 'viem';
import { baseSepolia } from 'viem/chains';
import { CONTRACTS } from '../contracts/addresses';
import BountyEscrowABI from '../contracts/abis/BountyEscrow.json';

// WebSocket URL - Alchemy provides WebSocket endpoints
const WS_URL = `wss://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`;

// Lazy-loaded WebSocket client (only initialize in browser)
let cdpWebSocketClientInstance: PublicClient | null = null;

/**
 * Get or create WebSocket client for real-time updates
 * Only creates client in browser environment
 */
function getWebSocketClient(): PublicClient | null {
  // Only create client in browser
  if (typeof window === 'undefined') {
    return null;
  }

  if (!cdpWebSocketClientInstance) {
    cdpWebSocketClientInstance = createPublicClient({
      chain: baseSepolia,
      transport: webSocket(WS_URL, {
        reconnect: true,
        retryCount: 5,
        retryDelay: 1000,
        keepAlive: {
          interval: 30_000, // 30 seconds
        },
      }),
    }) as PublicClient;
  }

  return cdpWebSocketClientInstance;
}

export const cdpWebSocketClient = getWebSocketClient();

/**
 * Watch for BountyCreated events in real-time
 */
export function watchBountyEvents(callback: (bounty: { bountyId?: bigint; client?: string; paymentToken?: string; escrowAmount?: bigint; deadline?: bigint; requirementsURI?: string }) => void) {
  const client = getWebSocketClient();

  if (!client) {
    console.warn('WebSocket client not available (server-side)');
    return () => {}; // Return no-op unsubscribe function
  }

  return client.watchContractEvent({
    address: CONTRACTS.BOUNTY_ESCROW,
    abi: BountyEscrowABI.abi || BountyEscrowABI,
    eventName: 'BountyCreated',
    onLogs: (logs) => {
      logs.forEach(log => {
        const typedLog = log as unknown as { args: { bountyId?: bigint; client?: string; paymentToken?: string; escrowAmount?: bigint; deadline?: bigint; requirementsURI?: string } };
        console.log('New bounty detected via WebSocket:', typedLog.args);
        callback(typedLog.args);
      });
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
    },
  });
}

/**
 * Watch for BidSubmitted events in real-time
 */
export function watchBidEvents(bountyId: bigint, callback: (bid: { bountyId?: bigint; bidIndex?: bigint; bidder?: string; amount?: bigint; proposalURI?: string }) => void) {
  const client = getWebSocketClient();

  if (!client) {
    console.warn('WebSocket client not available (server-side)');
    return () => {};
  }

  return client.watchContractEvent({
    address: CONTRACTS.BOUNTY_ESCROW,
    abi: BountyEscrowABI.abi || BountyEscrowABI,
    eventName: 'BidSubmitted',
    args: {
      bountyId,
    },
    onLogs: (logs) => {
      logs.forEach(log => {
        const typedLog = log as unknown as { args: { bountyId?: bigint; bidIndex?: bigint; bidder?: string; amount?: bigint; proposalURI?: string } };
        console.log('New bid detected via WebSocket:', typedLog.args);
        callback(typedLog.args);
      });
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
    },
  });
}

/**
 * Watch for WorkerAssigned events in real-time
 */
export function watchWorkerAssignedEvents(callback: (assignment: { bountyId?: bigint; worker?: string; bidIndex?: bigint; amount?: bigint }) => void) {
  const client = getWebSocketClient();

  if (!client) {
    console.warn('WebSocket client not available (server-side)');
    return () => {};
  }

  return client.watchContractEvent({
    address: CONTRACTS.BOUNTY_ESCROW,
    abi: BountyEscrowABI.abi || BountyEscrowABI,
    eventName: 'WorkerAssigned',
    onLogs: (logs) => {
      logs.forEach(log => {
        const typedLog = log as unknown as { args: { bountyId?: bigint; worker?: string; bidIndex?: bigint; amount?: bigint } };
        console.log('Worker assigned via WebSocket:', typedLog.args);
        callback(typedLog.args);
      });
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
    },
  });
}

/**
 * Watch for new blocks
 */
export function watchBlocks(callback: (blockNumber: bigint) => void) {
  const client = getWebSocketClient();

  if (!client) {
    console.warn('WebSocket client not available (server-side)');
    return () => {};
  }

  return client.watchBlockNumber({
    onBlockNumber: (blockNumber) => {
      callback(blockNumber);
    },
    onError: (error) => {
      console.error('Block watch error:', error);
    },
  });
}

