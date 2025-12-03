/**
 * Mission Validation API
 * POST /api/missions/[missionId]/validate
 * Requests ERC-8004 validation for mission deliverable
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, keccak256, toBytes, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { supabaseAdmin } from '@/lib/supabase/client';
import { createValidationClient } from '@/lib/erc8004/validation-client';

interface ValidateRequest {
  validatorAgentId: string;
  stake: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string }> }
) {
  try {
    const { missionId } = await params;
    const body: ValidateRequest = await request.json();

    console.log(`[Validate] Mission ${missionId}:`, body);

    // Validate input
    if (!body.validatorAgentId || !body.stake) {
      return NextResponse.json(
        { success: false, error: 'Missing validatorAgentId or stake' },
        { status: 400 }
      );
    }

    // Fetch mission from database to get deliverable URI
    const { data: mission, error: missionError } = await supabaseAdmin
      .from('missions')
      .select('*, mission_executions(*)')
      .eq('id', missionId)
      .single();

    if (missionError || !mission) {
      console.error('[Validate] Mission not found:', missionError);
      return NextResponse.json(
        { success: false, error: 'Mission not found' },
        { status: 404 }
      );
    }

    // Check mission has deliverable
    const executions = mission.mission_executions || [];
    const completedExecution = executions.find(
      (e: { status: string; deliverable_uri: string }) =>
        e.status === 'completed' && e.deliverable_uri
    );

    if (!completedExecution || !completedExecution.deliverable_uri) {
      return NextResponse.json(
        { success: false, error: 'No deliverable found for validation' },
        { status: 400 }
      );
    }

    const deliverableURI = completedExecution.deliverable_uri;

    // Initialize viem clients for server-side transaction
    const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
    const rpcUrl = process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;

    if (!privateKey || !rpcUrl) {
      console.error('[Validate] Missing PRIVATE_KEY or RPC_URL');
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const account = privateKeyToAccount(privateKey);

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(rpcUrl),
    });

    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(rpcUrl),
    });

    // Create validation client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const validationClient = createValidationClient(publicClient as any, walletClient);

    // Hash deliverable URI for on-chain storage
    const deliverableHash = keccak256(toBytes(deliverableURI));

    // Convert stake to USDC (6 decimals)
    const stakeAmount = parseUnits(body.stake.toString(), 6);

    console.log('[Validate] Requesting validation:', {
      validatorAgentId: body.validatorAgentId,
      deliverableHash,
      stake: stakeAmount.toString(),
    });

    // Request validation on-chain
    const { txHash, validationId } = await validationClient.requestValidation(
      BigInt(body.validatorAgentId),
      deliverableHash,
      stakeAmount
    );

    console.log('[Validate] Validation requested:', {
      validationId: validationId.toString(),
      txHash,
    });

    // Update mission with validation info
    // Note: In Phase 4, we'll add proper validation columns to the schema
    // For now, store in mission metadata or update status
    const { error: updateError } = await supabaseAdmin
      .from('missions')
      .update({
        status: 'in_progress', // Keep as in_progress while validating
        updated_at: new Date().toISOString(),
      })
      .eq('id', missionId);

    if (updateError) {
      console.error('[Validate] Failed to update mission:', updateError);
      // Don't fail the request - validation was successful on-chain
    }

    // Store validation info in mission execution metadata
    const { error: executionError } = await supabaseAdmin
      .from('mission_executions')
      .update({
        result_data: {
          ...completedExecution.result_data,
          validation: {
            validationId: validationId.toString(),
            validatorAgentId: body.validatorAgentId,
            stake: body.stake,
            txHash,
            requestedAt: new Date().toISOString(),
            status: 'pending',
          },
        },
      })
      .eq('id', completedExecution.id);

    if (executionError) {
      console.error('[Validate] Failed to update execution:', executionError);
    }

    return NextResponse.json({
      success: true,
      validationId: validationId.toString(),
      txHash,
      message: 'Validation requested successfully',
    });
  } catch (error) {
    console.error('[Validate] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to request validation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
