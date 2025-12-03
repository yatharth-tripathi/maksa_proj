/**
 * Evaluator Module
 * Decides whether to bid on a bounty based on various criteria
 */

import { formatUnits } from 'viem';
import { agentConfig } from './config';
import logger from './logger';
import type { Bounty } from './monitor';

export interface EvaluationResult {
  shouldBid: boolean;
  bidAmount?: bigint; // In USDC wei (6 decimals)
  reason: string;
  confidence: number; // 0-1
}

export class BountyEvaluator {
  private activeBids: Set<string> = new Set();

  /**
   * Evaluate if agent should bid on bounty
   */
  async evaluate(bounty: Bounty): Promise<EvaluationResult> {
    logger.debug(`Evaluating bounty #${bounty.bountyId}`);

    // Check 1: Concurrent gigs limit
    if (this.activeBids.size >= agentConfig.bidding.maxConcurrent) {
      return {
        shouldBid: false,
        reason: `Already at max concurrent gigs (${this.activeBids.size}/${agentConfig.bidding.maxConcurrent})`,
        confidence: 0,
      };
    }

    // Check 2: Amount within range
    const escrowUSDC = Number(formatUnits(bounty.escrowAmount, 6));

    if (escrowUSDC < agentConfig.bidding.minAmount) {
      return {
        shouldBid: false,
        reason: `Amount too low: $${escrowUSDC} < $${agentConfig.bidding.minAmount}`,
        confidence: 0,
      };
    }

    if (escrowUSDC > agentConfig.bidding.maxAmount) {
      return {
        shouldBid: false,
        reason: `Amount too high: $${escrowUSDC} > $${agentConfig.bidding.maxAmount}`,
        confidence: 0,
      };
    }

    // Check 3: Deadline is reasonable
    const now = BigInt(Math.floor(Date.now() / 1000));
    const timeUntilDeadline = Number(bounty.deadline - now);
    const hoursUntilDeadline = timeUntilDeadline / 3600;

    if (hoursUntilDeadline < 1) {
      return {
        shouldBid: false,
        reason: `Deadline too soon: ${hoursUntilDeadline.toFixed(1)} hours`,
        confidence: 0,
      };
    }

    // Check 4: Requirements match capabilities (parse from URI)
    const requirementsMatch = await this.checkRequirements(bounty.requirementsURI);
    
    if (!requirementsMatch.matches) {
      return {
        shouldBid: false,
        reason: requirementsMatch.reason,
        confidence: 0,
      };
    }

    // Check 5: Calculate bid amount with profit margin
    const estimatedCost = this.estimateCost(bounty);
    const targetBid = estimatedCost * (1 + agentConfig.bidding.targetProfit);

    // Bid should be lower than escrow to be competitive
    let bidAmount = Math.min(targetBid, escrowUSDC * 0.95); // Max 95% of escrow

    // Round to 2 decimals
    bidAmount = Math.round(bidAmount * 100) / 100;

    // Convert to wei
    const bidAmountWei = BigInt(Math.floor(bidAmount * 1e6));

    // Check 6: Client reputation (optional, requires additional contract reads)
    const clientReputation = await this.checkClientReputation(bounty.client);
    
    if (clientReputation < 0.5 && escrowUSDC > 100) {
      return {
        shouldBid: false,
        reason: `Client reputation too low (${clientReputation.toFixed(2)}) for high-value gig`,
        confidence: 0,
      };
    }

    // All checks passed!
    const confidence = this.calculateConfidence(bounty, bidAmount, clientReputation);

    return {
      shouldBid: true,
      bidAmount: bidAmountWei,
      reason: `Good match: $${bidAmount} bid with ${(confidence * 100).toFixed(0)}% confidence`,
      confidence,
    };
  }

  /**
   * Check if requirements match agent capabilities
   */
  private async checkRequirements(requirementsURI: string): Promise<{ matches: boolean; reason: string }> {
    try {
      // In production, fetch from IPFS and parse requirements
      // For now, assume all match (override in your agent)
      
      // Example: Check if requirements contain agent capabilities
      const hasMatchingCapability = agentConfig.capabilities.some((cap) => 
        requirementsURI.toLowerCase().includes(cap.toLowerCase())
      );

      if (!hasMatchingCapability) {
        return {
          matches: false,
          reason: `Requirements don't match capabilities: ${agentConfig.capabilities.join(', ')}`,
        };
      }

      return { matches: true, reason: 'Requirements match' };
    } catch (error) {
      logger.error(`Error checking requirements: ${error}`);
      return { matches: false, reason: 'Failed to parse requirements' };
    }
  }

  /**
   * Estimate cost to complete bounty
   * Override in your agent implementation
   */
  private estimateCost(bounty: Bounty): number {
    // Base cost estimation
    // Override this in your specific agent
    const escrowUSDC = Number(formatUnits(bounty.escrowAmount, 6));
    
    // Estimate: 30-50% of escrow amount as cost
    return escrowUSDC * 0.4;
  }

  /**
   * Check client reputation
   */
  private async checkClientReputation(clientAddress: string): Promise<number> {
    try {
      // In production, read from ReputationRegistry
      // For now, return neutral score
      return 0.75; // 75% default reputation
    } catch (error) {
      logger.error(`Error checking client reputation: ${error}`);
      return 0.5;
    }
  }

  /**
   * Calculate confidence score (0-1)
   */
  private calculateConfidence(bounty: Bounty, bidAmount: number, clientReputation: number): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence for mid-range amounts
    const escrowUSDC = Number(formatUnits(bounty.escrowAmount, 6));
    if (escrowUSDC >= 20 && escrowUSDC <= 200) {
      confidence += 0.2;
    }

    // Higher confidence for good client reputation
    confidence += clientReputation * 0.2;

    // Higher confidence if bid is competitive
    if (bidAmount < escrowUSDC * 0.8) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Record active bid
   */
  addActiveBid(bountyId: string): void {
    this.activeBids.add(bountyId);
  }

  /**
   * Remove completed bid
   */
  removeActiveBid(bountyId: string): void {
    this.activeBids.delete(bountyId);
  }
}

