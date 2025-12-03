/**
 * Submitter Module
 * Handles bidding and deliverable submission to blockchain + IPFS
 */

import { createWalletClient, createPublicClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import axios from 'axios';
import { agentConfig } from './config';
import logger from './logger';

export class BountySubmitter {
  private walletClient;
  private publicClient;
  private account;

  constructor() {
    this.account = privateKeyToAccount(agentConfig.privateKey);

    this.walletClient = createWalletClient({
      account: this.account,
      chain: baseSepolia,
      transport: http(agentConfig.rpcUrl),
    });

    this.publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(agentConfig.rpcUrl),
    });
  }

  /**
   * Submit bid on bounty
   */
  async submitBid(bountyId: bigint, bidAmount: bigint, proposal: string): Promise<string | null> {
    try {
      if (agentConfig.dryRun) {
        logger.info(`[DRY RUN] Would submit bid: Bounty #${bountyId}, Amount: ${bidAmount}`);
        return 'dry-run-tx-hash';
      }

      // Upload proposal to IPFS first
      const proposalURI = await this.uploadToIPFS(proposal);

      logger.info(`Submitting bid: Bounty #${bountyId}, Amount: ${bidAmount}, Proposal: ${proposalURI}`);

      // Submit bid transaction
      const hash = await this.walletClient.writeContract({
        address: agentConfig.contracts.bountyEscrow,
        abi: [{
          name: 'submitBid',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'bountyId', type: 'uint256' },
            { name: 'bidAmount', type: 'uint256' },
            { name: 'proposalURI', type: 'string' },
          ],
          outputs: [],
        }],
        functionName: 'submitBid',
        args: [bountyId, bidAmount, proposalURI],
      });

      // Wait for confirmation
      await this.publicClient.waitForTransactionReceipt({ hash });

      logger.info(`✓ Bid submitted successfully: ${hash}`);
      return hash;
    } catch (error) {
      logger.error(`Failed to submit bid: ${error}`);
      return null;
    }
  }

  /**
   * Submit deliverable for completed work
   */
  async submitDeliverable(bountyId: bigint, deliverable: string): Promise<string | null> {
    try {
      if (agentConfig.dryRun) {
        logger.info(`[DRY RUN] Would submit deliverable for bounty #${bountyId}`);
        return 'dry-run-tx-hash';
      }

      // Upload deliverable to IPFS
      const deliverableURI = await this.uploadToIPFS(deliverable);

      logger.info(`Submitting deliverable: Bounty #${bountyId}, URI: ${deliverableURI}`);

      // Submit deliverable transaction
      const hash = await this.walletClient.writeContract({
        address: agentConfig.contracts.bountyEscrow,
        abi: [{
          name: 'submitDeliverable',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'bountyId', type: 'uint256' },
            { name: 'deliverableURI', type: 'string' },
          ],
          outputs: [],
        }],
        functionName: 'submitDeliverable',
        args: [bountyId, deliverableURI],
      });

      // Wait for confirmation
      await this.publicClient.waitForTransactionReceipt({ hash });

      logger.info(`✓ Deliverable submitted successfully: ${hash}`);
      return hash;
    } catch (error) {
      logger.error(`Failed to submit deliverable: ${error}`);
      return null;
    }
  }

  /**
   * Upload content to IPFS via Pinata
   */
  private async uploadToIPFS(content: string): Promise<string> {
    try {
      const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        {
          pinataContent: { content },
          pinataMetadata: {
            name: `QuickGig-${Date.now()}`,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${agentConfig.pinataJwt}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const ipfsHash = response.data.IpfsHash;
      logger.debug(`Uploaded to IPFS: ${ipfsHash}`);
      return `ipfs://${ipfsHash}`;
    } catch (error) {
      logger.error(`IPFS upload failed: ${error}`);
      throw new Error('Failed to upload to IPFS');
    }
  }

  /**
   * Check wallet balance
   */
  async checkBalance(): Promise<{ eth: bigint; usdc: bigint }> {
    try {
      const eth = await this.publicClient.getBalance({
        address: this.account.address,
      });

      const usdc = await this.publicClient.readContract({
        address: agentConfig.contracts.usdc,
        abi: [{
          name: 'balanceOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
        }],
        functionName: 'balanceOf',
        args: [this.account.address],
      }) as bigint;

      return { eth, usdc };
    } catch (error) {
      logger.error(`Failed to check balance: ${error}`);
      return { eth: 0n, usdc: 0n };
    }
  }
}

