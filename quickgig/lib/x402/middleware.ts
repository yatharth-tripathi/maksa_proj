/**
 * X402 Payment Middleware
 * Handles HTTP 402 Payment Required responses and payment authorization
 */

import { Address, createPublicClient, createWalletClient, http, parseUnits } from 'viem';
import { baseSepolia } from 'viem/chains';
import type { X402PaymentRequest, X402PaymentProof, X402Response } from './types';
import { CONTRACTS } from '@/lib/contracts/addresses';

/**
 * Check if response is X402 Payment Required
 */
export function isX402Response(response: Response): boolean {
  return response.status === 402 && response.headers.has('X-Payment-Required');
}

/**
 * Extract payment request from X402 response
 */
export async function extractPaymentRequest(response: Response): Promise<X402PaymentRequest> {
  const paymentHeader = response.headers.get('X-Payment-Required');
  
  if (!paymentHeader) {
    throw new Error('X-Payment-Required header not found');
  }

  try {
    const paymentData = JSON.parse(paymentHeader);
    
    return {
      amount: paymentData.amount,
      token: paymentData.token as Address,
      recipient: paymentData.recipient as Address,
      chainId: paymentData.chainId || 84532, // Base Sepolia default
      description: paymentData.description,
    };
  } catch (error) {
    throw new Error(`Failed to parse X-Payment-Required header: ${error}`);
  }
}

/**
 * Create payment proof from transaction receipt
 */
export function createPaymentProof(
  txHash: string,
  from: Address,
  to: Address,
  amount: string,
  token: Address
): X402PaymentProof {
  return {
    txHash,
    from,
    to,
    amount,
    token,
    timestamp: Date.now(),
  };
}

/**
 * Verify payment proof on-chain
 * SECURITY: Verifies amount, recipient, sender, and token
 */
export async function verifyPaymentProof(
  proof: X402PaymentProof,
  rpcUrl?: string
): Promise<boolean> {
  try {
    // Use public RPC if available, otherwise fall back to Alchemy
    const defaultRpcUrl = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ||
                          `https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`;

    const client = createPublicClient({
      chain: baseSepolia,
      transport: http(rpcUrl || defaultRpcUrl),
    });

    // Get transaction receipt
    const receipt = await client.getTransactionReceipt({
      hash: proof.txHash as `0x${string}`,
    });

    if (!receipt) {
      console.error('Payment proof verification failed: receipt not found');
      return false;
    }

    // Verify transaction succeeded
    if (receipt.status !== 'success') {
      console.error('Payment proof verification failed: transaction failed');
      return false;
    }

    // Verify transaction is recent (within 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (proof.timestamp < fiveMinutesAgo) {
      console.error('Payment proof verification failed: timestamp too old');
      return false;
    }

    // Find Transfer event in logs
    const transferEvent = receipt.logs.find(
      (log) =>
        log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' && // Transfer event signature
        log.address.toLowerCase() === proof.token.toLowerCase()
    );

    if (!transferEvent) {
      console.error('Payment proof verification failed: Transfer event not found');
      return false;
    }

    // Decode Transfer event: Transfer(address indexed from, address indexed to, uint256 value)
    // topics[0] = event signature
    // topics[1] = from (indexed)
    // topics[2] = to (indexed)
    // data = value (not indexed)
    
    if (transferEvent.topics.length < 3 || !transferEvent.topics[1] || !transferEvent.topics[2]) {
      console.error('Payment proof verification failed: invalid Transfer event');
      return false;
    }

    // Extract from address (topics[1])
    const fromAddress = ('0x' + transferEvent.topics[1].slice(26)) as Address; // Remove padding

    // Extract to address (topics[2])
    const toAddress = ('0x' + transferEvent.topics[2].slice(26)) as Address; // Remove padding

    // Extract value from data (uint256)
    const value = BigInt(transferEvent.data);

    // Verify sender matches proof
    if (fromAddress.toLowerCase() !== proof.from.toLowerCase()) {
      console.error('Payment proof verification failed: sender mismatch', {
        expected: proof.from,
        actual: fromAddress,
      });
      return false;
    }

    // Verify recipient matches proof
    if (toAddress.toLowerCase() !== proof.to.toLowerCase()) {
      console.error('Payment proof verification failed: recipient mismatch', {
        expected: proof.to,
        actual: toAddress,
      });
      return false;
    }

    // Verify amount matches proof
    if (value !== BigInt(proof.amount)) {
      console.error('Payment proof verification failed: amount mismatch', {
        expected: proof.amount,
        actual: value.toString(),
      });
      return false;
    }

    console.log('Payment proof verified successfully:', {
      from: fromAddress,
      to: toAddress,
      amount: value.toString(),
      token: proof.token,
    });

    return true;
  } catch (error) {
    console.error('Payment proof verification failed:', error);
    return false;
  }
}

/**
 * Retry fetch with payment proof
 */
export async function retryWithPayment(
  url: string,
  options: RequestInit,
  proof: X402PaymentProof
): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set('X-Payment-Proof', JSON.stringify(proof));

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * X402-enabled fetch wrapper
 */
export async function x402Fetch(
  url: string,
  options: RequestInit = {},
  onPaymentRequired?: (request: X402PaymentRequest) => Promise<X402PaymentProof>
): Promise<Response> {
  // Initial request
  const response = await fetch(url, options);

  // Check if payment required
  if (isX402Response(response)) {
    if (!onPaymentRequired) {
      throw new Error('Payment required but no payment handler provided');
    }

    // Extract payment request
    const paymentRequest = await extractPaymentRequest(response);

    // Get payment proof from handler (this will trigger payment modal)
    const proof = await onPaymentRequired(paymentRequest);

    // Verify payment proof
    const isValid = await verifyPaymentProof(proof);
    if (!isValid) {
      throw new Error('Payment proof verification failed');
    }

    // Retry request with payment proof
    return retryWithPayment(url, options, proof);
  }

  return response;
}

/**
 * Session-based payment manager
 */
export class X402SessionManager {
  private sessions: Map<string, { messagesRemaining: number; expiresAt: number }> = new Map();

  /**
   * Check if session has remaining messages
   */
  hasRemainingMessages(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Check if expired
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return false;
    }

    return session.messagesRemaining > 0;
  }

  /**
   * Use one message from session
   */
  useMessage(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.messagesRemaining <= 0) {
      return false;
    }

    session.messagesRemaining--;
    this.sessions.set(sessionId, session);
    return true;
  }

  /**
   * Create new session (after payment)
   */
  createSession(sessionId: string, messageCount: number = 10, durationMs: number = 24 * 60 * 60 * 1000): void {
    this.sessions.set(sessionId, {
      messagesRemaining: messageCount,
      expiresAt: Date.now() + durationMs,
    });
  }

  /**
   * Get remaining messages for session
   */
  getRemainingMessages(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    if (!session || Date.now() > session.expiresAt) {
      return 0;
    }
    return session.messagesRemaining;
  }
}

