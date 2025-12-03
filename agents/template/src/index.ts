/**
 * QuickGig Autonomous Agent Template
 * Main entry point
 */

import { formatUnits } from 'viem';
import { agentConfig } from './config';
import logger from './logger';
import { BountyMonitor } from './monitor';
import { BountyEvaluator } from './evaluator';
import { WorkExecutor } from './executor';
import { BountySubmitter } from './submitter';

class AutonomousAgent {
  private monitor: BountyMonitor;
  private evaluator: BountyEvaluator;
  private executor: WorkExecutor;
  private submitter: BountySubmitter;
  private isRunning: boolean = false;
  private activeBounties: Map<string, any> = new Map();

  constructor() {
    this.monitor = new BountyMonitor();
    this.evaluator = new BountyEvaluator();
    this.executor = new WorkExecutor();
    this.submitter = new BountySubmitter();
  }

  /**
   * Start the agent
   */
  async start(): Promise<void> {
    logger.info(`🚀 Starting ${agentConfig.name}`);
    logger.info(`Agent ID: ${agentConfig.agentId}`);
    logger.info(`Capabilities: ${agentConfig.capabilities.join(', ')}`);
    logger.info(`Dry Run: ${agentConfig.dryRun ? 'YES' : 'NO'}`);

    // Check wallet balance
    const balance = await this.submitter.checkBalance();
    logger.info(`Wallet Balance:`);
    logger.info(`  ETH: ${formatUnits(balance.eth, 18)}`);
    logger.info(`  USDC: ${formatUnits(balance.usdc, 6)}`);

    // Initialize monitor
    await this.monitor.initialize();

    this.isRunning = true;

    // Start monitoring loop
    this.monitorLoop();

    // Handle graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());

    logger.info(`✓ Agent started successfully`);
    logger.info(`Monitoring bounties every ${agentConfig.monitorIntervalMs / 1000}s...`);
  }

  /**
   * Main monitoring loop
   */
  private async monitorLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        // Check for new bounties
        const newBounties = await this.monitor.checkForNewBounties();

        // Process each bounty
        for (const bounty of newBounties) {
          await this.processBounty(bounty);
        }

        // Check status of active bounties
        await this.checkActiveBounties();
      } catch (error) {
        logger.error(`Error in monitor loop: ${error}`);
      }

      // Wait before next check
      await this.sleep(agentConfig.monitorIntervalMs);
    }
  }

  /**
   * Process a new bounty
   */
  private async processBounty(bounty: any): Promise<void> {
    try {
      const bountyId = bounty.bountyId.toString();

      logger.info(`Processing bounty #${bountyId}`);

      // Evaluate if we should bid
      const evaluation = await this.evaluator.evaluate(bounty);

      if (!evaluation.shouldBid) {
        logger.info(`❌ Skip bounty #${bountyId}: ${evaluation.reason}`);
        return;
      }

      logger.info(`✓ ${evaluation.reason}`);

      // Submit bid
      const proposal = `I can complete this work as a ${agentConfig.name}. My capabilities include: ${agentConfig.capabilities.join(', ')}. I will deliver high-quality results within the deadline.`;

      const txHash = await this.submitter.submitBid(
        bounty.bountyId,
        evaluation.bidAmount!,
        proposal
      );

      if (txHash) {
        // Track active bid
        this.activeBounties.set(bountyId, {
          bounty,
          bidAmount: evaluation.bidAmount,
          status: 'bid_submitted',
          submittedAt: Date.now(),
        });

        this.evaluator.addActiveBid(bountyId);

        logger.info(`✓ Bid submitted for bounty #${bountyId}`);
      }
    } catch (error) {
      logger.error(`Error processing bounty: ${error}`);
    }
  }

  /**
   * Check status of active bounties
   */
  private async checkActiveBounties(): Promise<void> {
    for (const [bountyId, data] of this.activeBounties.entries()) {
      try {
        // Check if our bid was accepted
        // In production, watch for WorkerAssigned events
        // For now, check contract state

        const bountyData = await this.monitor.getBountyDetails(BigInt(bountyId));

        if (!bountyData) continue;

        // If assigned to us, execute work
        if (bountyData.assignedWorker === agentConfig.contracts.bountyEscrow && data.status === 'bid_submitted') {
          logger.info(`🎉 Bounty #${bountyId} assigned to us! Starting work...`);

          await this.executeWork(bountyId, data.bounty);
        }

        // If completed, clean up
        if (bountyData.status === 3) {
          // Status 3 = Completed
          logger.info(`✓ Bounty #${bountyId} completed and paid`);
          this.activeBounties.delete(bountyId);
          this.evaluator.removeActiveBid(bountyId);
        }
      } catch (error) {
        logger.error(`Error checking bounty #${bountyId}: ${error}`);
      }
    }
  }

  /**
   * Execute work for an assigned bounty
   */
  private async executeWork(bountyId: string, bounty: any): Promise<void> {
    try {
      logger.info(`Executing work for bounty #${bountyId}`);

      // Get requirements from IPFS
      const requirements = bounty.requirementsURI || 'Complete the bounty as specified';

      // Execute work
      const result = await this.executor.execute(requirements);

      if (!result.success) {
        logger.error(`Work execution failed: ${result.error}`);
        return;
      }

      logger.info(`✓ Work completed for bounty #${bountyId}`);

      // Submit deliverable
      const txHash = await this.submitter.submitDeliverable(
        BigInt(bountyId),
        result.deliverable!
      );

      if (txHash) {
        logger.info(`✓ Deliverable submitted for bounty #${bountyId}`);

        // Update status
        const data = this.activeBounties.get(bountyId);
        if (data) {
          data.status = 'deliverable_submitted';
          data.submittedAt = Date.now();
          this.activeBounties.set(bountyId, data);
        }
      }
    } catch (error) {
      logger.error(`Error executing work for bounty #${bountyId}: ${error}`);
    }
  }

  /**
   * Stop the agent
   */
  async stop(): Promise<void> {
    logger.info('🛑 Stopping agent...');
    this.isRunning = false;

    // Save state if needed
    logger.info(`Active bounties: ${this.activeBounties.size}`);

    logger.info('✓ Agent stopped');
    process.exit(0);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Start the agent
const agent = new AutonomousAgent();
agent.start().catch((error) => {
  logger.error(`Fatal error: ${error}`);
  process.exit(1);
});

