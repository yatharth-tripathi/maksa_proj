/**
 * Submit Reputation Feedback API
 * POST /api/reputation/submit
 * Submits feedback to official ERC-8004 Reputation Registry
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { OfficialERC8004Client } from '@/lib/erc8004/official-client';
import axios from 'axios';

interface SubmitFeedbackRequest {
  agentId: string; // ERC-8004 NFT token ID
  rating: number; // 1-5 stars
  comment?: string;
  missionId?: string;
  userAddress: string; // Client wallet address
  userSignature?: string; // Optional signature for verification
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Reputation V2] Received request');
    const body: SubmitFeedbackRequest = await request.json();
    console.log('[Reputation V2] Parsed body:', { agentId: body.agentId, rating: body.rating });

    // Validate request
    if (!body.agentId || !body.rating || !body.userAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: agentId, rating, userAddress' },
        { status: 400 }
      );
    }

    if (body.rating < 1 || body.rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    console.log('[Reputation] Submitting feedback:', {
      agentId: body.agentId,
      rating: body.rating,
      from: body.userAddress,
      missionId: body.missionId,
    });

    // Convert 1-5 stars to 0-100 score
    const score = (body.rating / 5) * 100;
    console.log('[Reputation] Calculated score:', score);

    // Upload feedback comment to IPFS if provided (optional - DISABLED FOR NOW)
    const feedbackUri = '';
    // TODO: Fix IPFS upload - currently disabled due to serialization issues
    console.log('[Reputation] IPFS upload currently disabled, feedback will be submitted without comment URI');

    // Setup blockchain clients (user must sign transaction)
    const rpcUrl = process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;
    if (!rpcUrl) {
      throw new Error('RPC URL not configured');
    }

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(rpcUrl),
    });

    // For now, return the transaction data for client-side signing
    // In a real implementation, the client would sign this transaction
    return NextResponse.json({
      success: true,
      message: 'Feedback prepared for submission',
      data: {
        agentId: body.agentId,
        score: Math.floor(score),
        feedbackUri,
        rating: body.rating,
      },
      // Return contract call data for client to execute
      contractCall: {
        contract: '0x8004bd8daB57f14Ed299135749a5CB5c42d341BF', // Reputation Registry
        method: 'giveFeedback',
        args: {
          agentId: body.agentId, // Keep as string, client will convert to BigInt
          score: Math.floor(score),
          tag1: '0x' + '0'.repeat(64), // bytes32 zero
          tag2: '0x' + '0'.repeat(64), // bytes32 zero
          feedbackUri,
          feedbackHash: '0x' + '0'.repeat(64), // bytes32 zero
          feedbackAuth: '0x', // empty bytes
        },
      },
      note: 'User must sign this transaction with their wallet to submit feedback on-chain',
    });

  } catch (error) {
    console.error('[Reputation] Error submitting feedback:', error);
    return NextResponse.json(
      {
        error: 'Failed to submit feedback',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reputation/submit
 * Returns API documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/reputation/submit',
    method: 'POST',
    description: 'Submit reputation feedback to ERC-8004 Reputation Registry',
    requiredFields: {
      agentId: 'ERC-8004 NFT token ID',
      rating: '1-5 stars',
      userAddress: 'Client wallet address',
    },
    optionalFields: {
      comment: 'Feedback text (stored on IPFS)',
      missionId: 'Mission ID reference',
      userSignature: 'Optional signature for verification',
    },
    note: 'Returns transaction data for client-side signing. User must sign with their wallet.',
  });
}
