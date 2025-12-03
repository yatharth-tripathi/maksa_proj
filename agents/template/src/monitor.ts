/**
 * Monitor Module
 * Watches blockchain for new bounties matching agent capabilities
 * Now uses CDP WebSocket for real-time updates!
 */

import { agentConfig } from './config';
import logger from './logger';
import { 
  watchBountyEvents, 
  watchWorkerAssignedEvents,
  getHistoricalLogs,
  getCurrentBlockNumber,
  healthCheck,
} from './cdp-client';

export interface Bounty {
  bountyId: bigint;
  client: string;
  paymentToken: string;
  escrowAmount: bigint;
  deadline: bigint;
  requirementsURI: string;
  blockNumber?: bigint;
  transactionHash?: string;
}

export class BountyMonitor {
  private unwatchBounties: (() => void) | null = null;
  private unwatchAssignments: (() => void) | null = null;
  private lastBlockChecked: bigint = 0n;
  private seenBounties: Set<string> = new Set();

  /**
   * Initialize monitor with WebSocket
   */
  async initialize(): Promise<void> {
    try {
      // Health check
      const healthy = await healthCheck();
      if (!healthy) {
        throw new Error('CDP client health check failed');
      }

      // Get current block
      const block = await getCurrentBlockNumber();
      this.lastBlockChecked = block;
      logger.info(`Monitor initialized at block ${block}`);

      // Fetch recent historical bounties (last 100 blocks)
      const LOOKBACK_BLOCKS = 100n;
      const fromBlock = block > LOOKBACK_BLOCKS ? block - LOOKBACK_BLOCKS : 0n;
      
      logger.info(`Fetching historical bounties from block ${fromBlock}`);
      const historicalLogs = await getHistoricalLogs(fromBlock, block);
      
      logger.info(`Found ${historicalLogs.length} historical bounties`);
      historicalLogs.forEach(log => {
        this.seenBounties.add(log.args.bountyId.toString());
      });

      // Start WebSocket listeners
      this.startWebSocketListeners();

      logger.info('Monitor initialization complete - listening for real-time events');
    } catch (error) {
      logger.error(`Failed to initialize monitor: ${error}`);
      throw error;
    }
  }

  /**
   * Start WebSocket event listeners
   */
  private startWebSocketListeners(): void {
    // Listen for new bounties
    this.unwatchBounties = watchBountyEvents((bountyArgs) => {
      const bountyKey = bountyArgs.bountyId.toString();
      
      if (this.seenBounties.has(bountyKey)) {
        logger.debug(`Bounty ${bountyKey} already seen, skipping`);
        return;
      }

      this.seenBounties.add(bountyKey);

      const bounty: Bounty = {
        bountyId: bountyArgs.bountyId,
        client: bountyArgs.client,
        paymentToken: bountyArgs.paymentToken,
        escrowAmount: bountyArgs.escrowAmount,
        deadline: bountyArgs.deadline,
        requirementsURI: bountyArgs.requirementsURI,
      };

      logger.info(`New bounty detected in real-time: ${bountyKey}`);
      
      // Emit event for processing
      this.emit('newBounty', bounty);
    });

    // Listen for worker assignments (to track our bids)
    this.unwatchAssignments = watchWorkerAssignedEvents((assignment) => {
      logger.info(`Worker assigned to bounty ${assignment.bountyId}`, {
        worker: assignment.worker,
        amount: assignment.bidAmount,
      });
      
      this.emit('workerAssigned', assignment);
    });

    logger.info('WebSocket listeners started');
  }

  /**
   * Event emitter for bounty events
   */
  private listeners: Map<string, Function[]> = new Map();

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        logger.error(`Error in ${event} listener`, error);
      }
    });
  }

  /**
   * Legacy method for backward compatibility
   * Now returns empty array since WebSocket handles real-time updates
   */
  async checkForNewBounties(): Promise<Bounty[]> {
    logger.warn('checkForNewBounties() is deprecated - use on("newBounty", callback) for WebSocket updates');
    return [];
  }

  /**
   * Get bounty details from contract
   */
  async getBountyDetails(bountyId: bigint): Promise<any> {
    try {
      const { readContract } = await import('./cdp-client');
      
      // TODO: Import proper BountyEscrow ABI
      return await readContract({
        address: agentConfig.contracts.bountyEscrow,
        abi: [{
          name: 'getBounty',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'bountyId', type: 'uint256' }],
          outputs: [{ name: '', type: 'tuple', components: [] }], // Simplified
        }],
        functionName: 'getBounty',
        args: [bountyId],
      });
    } catch (error) {
      logger.error(`Error getting bounty details: ${error}`);
      return null;
    }
  }

  /**
   * Stop monitoring and cleanup WebSocket connections
   */
  async stop(): Promise<void> {
    logger.info('Stopping bounty monitor');
    
    // Unwatch WebSocket events
    if (this.unwatchBounties) {
      this.unwatchBounties();
      this.unwatchBounties = null;
    }
    
    if (this.unwatchAssignments) {
      this.unwatchAssignments();
      this.unwatchAssignments = null;
    }
    
    // Clear listeners
    this.listeners.clear();
    
    logger.info('Bounty monitor stopped');
  }

  /**
   * Clean up old seen bounties (keep last 1000)
   */
  private cleanupSeenBounties(): void {
    if (this.seenBounties.size > 1000) {
      const toRemove = this.seenBounties.size - 1000;
      const iterator = this.seenBounties.values();
      for (let i = 0; i < toRemove; i++) {
        const nextValue = iterator.next().value;
        if (nextValue) {
          this.seenBounties.delete(nextValue);
        }
      }
    }
  }
}

