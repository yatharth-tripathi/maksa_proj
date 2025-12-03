/**
 * Logo Designer Agent
 * Autonomous AI agent that generates professional logos using DALL-E 3
 * 
 * Capabilities:
 * - Monitors BountyEscrow for relevant bounties
 * - Evaluates bounties based on requirements & client reputation
 * - Autonomously submits competitive bids
 * - Generates high-quality logos with DALL-E 3
 * - Submits deliverables to IPFS and blockchain
 * - Gets paid in USDC and builds reputation
 */

import { createWalletClient, createPublicClient, http, parseAbiItem, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { agentConfig } from './config';
import logger from './logger';
import { BountyMonitor } from '../../template/src/monitor';
import { BountyEvaluator } from '../../template/src/evaluator';
import { LogoExecutor } from './executor';
import { DeliverableSubmitter } from '../../template/src/submitter';
import BountyEscrowABI from '../../../quickgig/lib/contracts/abis/BountyEscrow.json';

interface ActiveGig {
  bountyId: bigint;
  client: string;
  amount: bigint;
  requirements: string;
  deadline: bigint;
  startedAt: number;
}

class LogoDesignerAgent {
  private monitor: BountyMonitor;
  private evaluator: BountyEvaluator;
  private executor: LogoExecutor;
  private submitter: DeliverableSubmitter;
  
  private publicClient;
  private walletClient;
  private account;
  
  private activeGigs: Map<string, ActiveGig> = new Map();
  private processedBounties: Set<string> = new Set();
  
  private isRunning = false;

  constructor() {
    // Setup blockchain clients
    this.account = privateKeyToAccount(agentConfig.privateKey);
    
    this.publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(agentConfig.rpcUrl),
    });

    this.walletClient = createWalletClient({
      account: this.account,
      chain: baseSepolia,
      transport: http(agentConfig.rpcUrl),
    });

    // Initialize modules
    this.monitor = new BountyMonitor(this.publicClient, agentConfig.contracts.bountyEscrow);
    this.evaluator = new BountyEvaluator(this.publicClient, agentConfig);
    this.executor = new LogoExecutor();
    this.submitter = new DeliverableSubmitter(
      this.publicClient,
      this.walletClient,
      agentConfig.contracts.bountyEscrow,
      agentConfig.pinataJwt
    );

    logger.info(`Logo Designer Agent initialized`);
    logger.info(`Agent ID: ${agentConfig.agentId}`);
    logger.info(`Wallet: ${this.account.address}`);
    logger.info(`Capabilities: ${agentConfig.capabilities.join(', ')}`);
    logger.info(`Dry Run Mode: ${agentConfig.dryRun}`);
  }

  /**
   * Start the agent
   */
  async start() {
    this.isRunning = true;
    logger.info('🤖 Starting Logo Designer Agent...');

    // Check wallet balance
    await this.checkBalance();

    // Main loop
    while (this.isRunning) {
      try {
        // 1. Monitor for new bounties
        await this.monitorBounties();

        // 2. Check assigned gigs and execute
        await this.processAssignedGigs();

        // 3. Wait before next iteration
        await this.sleep(agentConfig.monitorIntervalMs);
      } catch (error) {
        logger.error(`Main loop error: ${error}`);
        await this.sleep(10000); // Wait 10s on error
      }
    }
  }

  /**
   * Stop the agent
   */
  stop() {
    logger.info('Stopping Logo Designer Agent...');
    this.isRunning = false;
  }

  /**
   * Check wallet balance
   */
  private async checkBalance() {
    try {
      const balance = await this.publicClient.getBalance({
        address: this.account.address,
      });

      logger.info(`Wallet balance: ${formatUnits(balance, 18)} ETH`);

      if (balance < BigInt(1e15)) { // Less than 0.001 ETH
        logger.warn('⚠️ Low ETH balance! Please add funds for gas.');
      }
    } catch (error) {
      logger.error(`Balance check failed: ${error}`);
    }
  }

  /**
   * Monitor for new bounties
   */
  private async monitorBounties() {
    try {
      const newBounties = await this.monitor.getNewBounties();

      if (newBounties.length === 0) {
        logger.debug('No new bounties found');
        return;
      }

      logger.info(`📋 Found ${newBounties.length} new bounties`);

      for (const bounty of newBounties) {
        const bountyId = bounty.bountyId.toString();

        // Skip if already processed
        if (this.processedBounties.has(bountyId)) {
          continue;
        }

        // Evaluate bounty
        const evaluation = await this.evaluator.evaluate(bounty);

        if (!evaluation.shouldBid) {
          logger.debug(`Skipping bounty ${bountyId}: ${evaluation.reason}`);
          this.processedBounties.add(bountyId);
          continue;
        }

        // Submit bid
        await this.submitBid(bounty, evaluation.bidAmount!, evaluation.proposal!);
        this.processedBounties.add(bountyId);
      }
    } catch (error) {
      logger.error(`Monitor bounties error: ${error}`);
    }
  }

  /**
   * Submit bid for a bounty
   */
  private async submitBid(bounty: any, bidAmount: bigint, proposal: string) {
    try {
      logger.info(`💰 Submitting bid for bounty ${bounty.bountyId}: ${formatUnits(bidAmount, 6)} USDC`);

      if (agentConfig.dryRun) {
        logger.info('[DRY RUN] Bid not submitted (dry run mode)');
        return;
      }

      // Check if we're at concurrent limit
      if (this.activeGigs.size >= agentConfig.bidding.maxConcurrent) {
        logger.warn(`Max concurrent gigs reached (${agentConfig.bidding.maxConcurrent})`);
        return;
      }

      // Submit bid on-chain
      const hash = await this.walletClient.writeContract({
        address: agentConfig.contracts.bountyEscrow,
        abi: BountyEscrowABI.abi,
        functionName: 'submitBid',
        args: [bounty.bountyId, bidAmount, proposal],
      });

      logger.info(`✓ Bid submitted: ${hash}`);

      // Wait for confirmation
      await this.publicClient.waitForTransactionReceipt({ hash });
      logger.info(`✓ Bid confirmed for bounty ${bounty.bountyId}`);
    } catch (error) {
      logger.error(`Bid submission failed: ${error}`);
    }
  }

  /**
   * Process assigned gigs
   */
  private async processAssignedGigs() {
    try {
      // Get bounties assigned to us
      const logs = await this.publicClient.getLogs({
        address: agentConfig.contracts.bountyEscrow,
        event: parseAbiItem('event WorkerAssigned(uint256 indexed bountyId, address indexed worker, uint256 bidAmount)'),
        args: {
          worker: this.account.address,
        },
        fromBlock: 'earliest',
        toBlock: 'latest',
      });

      for (const log of logs) {
        const bountyId = log.args.bountyId!;
        const gigKey = bountyId.toString();

        // Skip if already processing or completed
        if (this.activeGigs.has(gigKey)) {
          continue;
        }

        // Check if bounty is still assigned and not completed
        const bounty = await this.publicClient.readContract({
          address: agentConfig.contracts.bountyEscrow,
          abi: BountyEscrowABI.abi,
          functionName: 'getBounty',
          args: [bountyId],
        }) as any;

        // Status: 1 = Assigned, 2 = Submitted
        if (bounty.status === 1) {
          logger.info(`🎉 Bounty ${bountyId} assigned to us! Starting work...`);
          
          // Add to active gigs
          this.activeGigs.set(gigKey, {
            bountyId,
            client: bounty.client,
            amount: bounty.assignedBidAmount,
            requirements: bounty.requirementsURI,
            deadline: bounty.deadline,
            startedAt: Date.now(),
          });

          // Execute work
          await this.executeGig(gigKey);
        }
      }
    } catch (error) {
      logger.error(`Process assigned gigs error: ${error}`);
    }
  }

  /**
   * Execute a gig (generate logo)
   */
  private async executeGig(gigKey: string) {
    const gig = this.activeGigs.get(gigKey);
    if (!gig) return;

    try {
      logger.info(`🎨 Generating logo for bounty ${gig.bountyId}...`);

      // Execute logo generation
      const result = await this.executor.execute(gig.requirements);

      if (!result.success) {
        logger.error(`Logo generation failed: ${result.error}`);
        this.activeGigs.delete(gigKey);
        return;
      }

      logger.info(`✓ Logo generated successfully!`);

      // Submit deliverable
      await this.submitDeliverable(gigKey, result.deliverable!);
    } catch (error) {
      logger.error(`Execute gig error: ${error}`);
      this.activeGigs.delete(gigKey);
    }
  }

  /**
   * Submit deliverable to IPFS and blockchain
   */
  private async submitDeliverable(gigKey: string, deliverable: string) {
    const gig = this.activeGigs.get(gigKey);
    if (!gig) return;

    try {
      logger.info(`📤 Submitting deliverable for bounty ${gig.bountyId}...`);

      if (agentConfig.dryRun) {
        logger.info('[DRY RUN] Deliverable not submitted (dry run mode)');
        logger.info(`Deliverable preview:\n${deliverable.substring(0, 500)}...`);
        this.activeGigs.delete(gigKey);
        return;
      }

      // Submit to IPFS and blockchain
      const success = await this.submitter.submit(gig.bountyId, deliverable);

      if (success) {
        logger.info(`✓ Deliverable submitted for bounty ${gig.bountyId}`);
        logger.info(`💰 Waiting for client approval and payment...`);
        
        // Remove from active gigs
        this.activeGigs.delete(gigKey);
        
        // Log earnings (estimate)
        const amount = formatUnits(gig.amount, 6);
        logger.info(`💰 Expected payment: $${amount} USDC`);
      } else {
        logger.error(`Failed to submit deliverable for bounty ${gig.bountyId}`);
      }
    } catch (error) {
      logger.error(`Submit deliverable error: ${error}`);
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get agent stats
   */
  async getStats() {
    try {
      const balance = await this.publicClient.getBalance({
        address: this.account.address,
      });

      return {
        wallet: this.account.address,
        balance: formatUnits(balance, 18),
        activeGigs: this.activeGigs.size,
        processedBounties: this.processedBounties.size,
        capabilities: agentConfig.capabilities,
        dryRun: agentConfig.dryRun,
      };
    } catch (error) {
      logger.error(`Get stats error: ${error}`);
      return null;
    }
  }
}

// Main execution
async function main() {
  const agent = new LogoDesignerAgent();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    agent.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    agent.stop();
    process.exit(0);
  });

  // Start agent
  await agent.start();
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    logger.error(`Fatal error: ${error}`);
    process.exit(1);
  });
}

export default LogoDesignerAgent;

