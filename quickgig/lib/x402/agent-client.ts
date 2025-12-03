/**
 * A2A Payment Client Library
 * Enables agents to pay other agents for sub-tasks
 */

import { createWalletClient, createPublicClient, http, parseUnits, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { x402Fetch, createPaymentProof } from './middleware';
import type { X402PaymentRequest, X402PaymentProof } from './types';

export interface AgentCredentials {
  privateKey: `0x${string}`;
  address: Address;
  agentId: string;
}

export interface SubTaskRequest {
  targetAgentId: string;
  targetEndpoint: string;
  task: string;
  maxPayment: bigint; // Maximum willing to pay
}

export interface SubTaskResult {
  result: string;
  paid: bigint;
  txHash?: string;
}

/**
 * Agent-to-Agent Payment Client
 * Allows autonomous agents to pay other agents for sub-tasks
 */
export class A2APaymentClient {
  private credentials: AgentCredentials;
  private publicClient;
  private walletClient;
  private usdcAddress: Address;

  constructor(
    credentials: AgentCredentials,
    usdcAddress: Address,
    rpcUrl?: string
  ) {
    this.credentials = credentials;
    this.usdcAddress = usdcAddress;

    const account = privateKeyToAccount(credentials.privateKey);

    this.publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(rpcUrl || `https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`),
    });

    this.walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(rpcUrl || `https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`),
    });
  }

  /**
   * Execute sub-task with automatic payment handling
   */
  async executeSubTask(request: SubTaskRequest): Promise<SubTaskResult> {
    console.log(`[A2A] ${this.credentials.agentId} requesting task from ${request.targetAgentId}`);

    try {
      // Track payment amount if payment is made
      let paidAmount = 0n;

      // Make initial request with X402 handler
      const response = await x402Fetch(
        request.targetEndpoint,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task: request.task,
            requestingAgent: this.credentials.agentId,
          }),
        },
        async (paymentRequest) => {
          paidAmount = BigInt(paymentRequest.amount);
          return this.handlePaymentRequest(paymentRequest, request.maxPayment);
        }
      );

      if (!response.ok) {
        throw new Error(`Sub-task request failed: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        result: data.result || data.message,
        paid: data.paid ? paidAmount : 0n,
        txHash: data.txHash,
      };
    } catch (error) {
      console.error(`[A2A] Sub-task failed:`, error);
      throw error;
    }
  }

  /**
   * Handle payment request from target agent
   */
  private async handlePaymentRequest(
    paymentRequest: X402PaymentRequest,
    maxPayment: bigint
  ): Promise<X402PaymentProof> {
    const requestedAmount = BigInt(paymentRequest.amount);

    // Check if payment is within budget
    if (requestedAmount > maxPayment) {
      throw new Error(
        `Payment requested (${requestedAmount}) exceeds maximum (${maxPayment})`
      );
    }

    console.log(
      `[A2A] Paying ${requestedAmount} USDC to ${paymentRequest.recipient}`
    );

    // Approve USDC spending
    const approveHash = await this.approveUSDC(
      paymentRequest.recipient,
      requestedAmount
    );
    console.log(`[A2A] Approval tx: ${approveHash}`);

    // Wait for approval
    await this.publicClient.waitForTransactionReceipt({ hash: approveHash });

    // Transfer USDC
    const transferHash = await this.transferUSDC(
      paymentRequest.recipient,
      requestedAmount
    );
    console.log(`[A2A] Transfer tx: ${transferHash}`);

    // Wait for transfer
    await this.publicClient.waitForTransactionReceipt({ hash: transferHash });

    // Create payment proof
    const proof = createPaymentProof(
      transferHash,
      this.credentials.address,
      paymentRequest.recipient,
      paymentRequest.amount,
      paymentRequest.token
    );

    console.log(`[A2A] Payment complete: ${transferHash}`);

    return proof;
  }

  /**
   * Approve USDC spending
   */
  private async approveUSDC(spender: Address, amount: bigint): Promise<`0x${string}`> {
    const ERC20_ABI = [
      {
        constant: false,
        inputs: [
          { name: '_spender', type: 'address' },
          { name: '_value', type: 'uint256' },
        ],
        name: 'approve',
        outputs: [{ name: '', type: 'bool' }],
        type: 'function',
      },
    ] as const;

    const hash = await this.walletClient.writeContract({
      address: this.usdcAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender, amount],
    });

    return hash;
  }

  /**
   * Transfer USDC
   */
  private async transferUSDC(to: Address, amount: bigint): Promise<`0x${string}`> {
    const ERC20_ABI = [
      {
        constant: false,
        inputs: [
          { name: '_to', type: 'address' },
          { name: '_value', type: 'uint256' },
        ],
        name: 'transfer',
        outputs: [{ name: '', type: 'bool' }],
        type: 'function',
      },
    ] as const;

    const hash = await this.walletClient.writeContract({
      address: this.usdcAddress,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [to, amount],
    });

    return hash;
  }

  /**
   * Get agent USDC balance
   */
  async getBalance(): Promise<bigint> {
    const ERC20_ABI = [
      {
        constant: true,
        inputs: [{ name: '_owner', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: 'balance', type: 'uint256' }],
        type: 'function',
      },
    ] as const;

    const balance = await this.publicClient.readContract({
      address: this.usdcAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [this.credentials.address],
    });

    return balance as bigint;
  }
}

/**
 * Example usage for autonomous agents:
 * 
 * const logoAgent = new A2APaymentClient(
 *   {
 *     privateKey: process.env.LOGO_AGENT_PRIVATE_KEY,
 *     address: '0x...',
 *     agentId: 'logo-designer-agent'
 *   },
 *   USDC_ADDRESS
 * );
 * 
 * // Logo agent needs a tagline, so it hires copywriting agent
 * const result = await logoAgent.executeSubTask({
 *   targetAgentId: 'copywriting-agent',
 *   targetEndpoint: 'https://api.quickgig.io/agent/copywriting',
 *   task: 'Generate tagline for tech startup',
 *   maxPayment: parseUnits('0.05', 6) // Willing to pay $0.05
 * });
 * 
 * console.log('Tagline:', result.result);
 * console.log('Paid:', formatUnits(result.paid, 6), 'USDC');
 */

