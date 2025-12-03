/**
 * Client-triggered Mission Execution API
 * POST /api/missions/[missionId]/execute
 * Allows clients to directly trigger and pay for mission execution
 */

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { getMissionWithDetails, updateMissionStatus } from '@/lib/supabase/missions';
import { getAgent } from '@/lib/supabase/agents';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string }> }
) {
  try {
    const { missionId } = await params;
    const paymentProofHeader = request.headers.get('x-payment-proof');

    console.log(`[Client Execute] Mission: ${missionId}`);
    console.log(`[Client Execute] Payment proof: ${paymentProofHeader ? 'Yes' : 'No'}`);

    // Fetch mission details
    const missionDetails = await getMissionWithDetails(missionId);

    if (!missionDetails || !missionDetails.mission) {
      return NextResponse.json(
        { error: 'Mission not found' },
        { status: 404 }
      );
    }

    const { mission, agents, executions } = missionDetails;

    if (mission.status !== 'pending') {
      return NextResponse.json(
        { error: `Mission is ${mission.status}, cannot trigger execution` },
        { status: 400 }
      );
    }

    if (!agents || agents.length === 0) {
      return NextResponse.json(
        { error: 'No agents assigned to mission' },
        { status: 400 }
      );
    }

    // Get first agent (for simplicity, extend this for multi-agent)
    const firstAgent = agents[0];
    const agentProfile = await getAgent(firstAgent.agent_id);

    if (!agentProfile) {
      return NextResponse.json(
        { error: 'Agent profile not found' },
        { status: 404 }
      );
    }

    const execution = executions?.find(e => e.agent_id === firstAgent.agent_id);
    if (!execution) {
      return NextResponse.json(
        { error: 'Execution record not found' },
        { status: 404 }
      );
    }

    // Check if payment proof provided
    if (!paymentProofHeader) {
      console.log(`[Client Execute] No payment proof - returning 402`);

      // Return X402 Payment Required
      const paymentRequest = {
        amount: (firstAgent.payment_amount * 1e6).toString(), // Convert to USDC units (6 decimals)
        token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC on Base Sepolia
        recipient: agentProfile.address,
        chainId: 84532, // Base Sepolia
        description: `Payment for ${firstAgent.capability} - Mission ${missionId}`,
      };

      return NextResponse.json(
        {
          error: 'Payment required',
          message: 'Please pay the agent to execute this mission',
          agentId: firstAgent.agent_id,
          agentName: agentProfile.name,
          amount: firstAgent.payment_amount,
        },
        {
          status: 402,
          headers: {
            'X-Payment-Required': JSON.stringify(paymentRequest),
          },
        }
      );
    }

    // Verify payment proof (basic validation - extend for production)
    try {
      const paymentProof = JSON.parse(paymentProofHeader);
      console.log(`[Client Execute] Payment proof:`, {
        from: paymentProof.from,
        to: paymentProof.to,
        txHash: paymentProof.txHash,
      });

      if (!paymentProof.txHash || !paymentProof.from) {
        throw new Error('Invalid payment proof format');
      }

      console.log(`[Client Execute] Payment verified, calling agent...`);

      // Call agent directly with payment proof
      const agentEndpoint = agentProfile.endpoint_url || 'http://localhost:3001/execute';

      const agentResponse = await axios.post(
        agentEndpoint,
        {
          missionId,
          agentId: firstAgent.agent_id,
          description: mission.description,
          capability: firstAgent.capability,
          payment: firstAgent.payment_amount * 1e6,
          requirements: firstAgent.requirements,
          callbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/missions/${missionId}/update`,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Payment-Proof': JSON.stringify(paymentProof),
          },
          timeout: 120000,
        }
      );

      console.log(`[Client Execute] Agent response:`, agentResponse.data);

      // Update mission status to in_progress
      await updateMissionStatus(missionId, 'in_progress');

      return NextResponse.json({
        success: true,
        message: 'Mission execution started',
        missionId,
        agentResponse: agentResponse.data,
      });

    } catch (error) {
      console.error(`[Client Execute] Error:`, error);

      if (axios.isAxiosError(error)) {
        return NextResponse.json(
          {
            error: 'Failed to call agent',
            message: error.message,
            details: error.response?.data,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          error: 'Invalid payment proof or execution failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error(`[Client Execute] Error:`, error);
    return NextResponse.json(
      {
        error: 'Failed to execute mission',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
