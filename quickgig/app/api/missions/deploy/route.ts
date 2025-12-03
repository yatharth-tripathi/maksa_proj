/**
 * Mission Deployment API
 * POST /api/missions/deploy
 * Deploys multi-agent missions with automatic coordination
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Address } from 'viem';
import { createPublicClient, createWalletClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { createMission, addAgentToMission, initializeMissionExecutions, updateMissionStatus } from '@/lib/supabase/missions';
import { getAgent, getAgentWallet, createAgentWallet } from '@/lib/supabase/agents';
import { uploadMissionRequirements } from '@/lib/pinata/client';
import { getCdpWalletManager } from '@/lib/cdp/wallet-manager';
import axios from 'axios';

export interface MissionAgent {
  agentId: bigint;
  name: string;
  address: Address;
  capability: string;
  payment: number; // USDC amount
}

export interface DeployMissionRequest {
  description: string;
  agents: MissionAgent[];
  totalBudget: number;
  clientAddress: Address;
  orchestrationMode: 'sequential' | 'parallel';
  requirements?: Record<string, string>; // Per-agent requirements
}

export interface MissionDeployment {
  missionId: string;
  status: 'pending' | 'funded' | 'in_progress' | 'completed' | 'failed';
  agents: MissionAgent[];
  totalCost: number;
  escrowAddress?: Address;
  createdAt: Date;
  estimatedCompletion?: Date;
}

export async function POST(request: NextRequest) {
  try {
    const body: DeployMissionRequest = await request.json();

    // Validate request
    if (!body.agents || body.agents.length === 0) {
      return NextResponse.json({ error: 'At least one agent required' }, { status: 400 });
    }

    if (!body.clientAddress) {
      return NextResponse.json({ error: 'Client address required' }, { status: 400 });
    }

    console.log('[Mission Deploy] Starting deployment:', {
      agents: body.agents.length,
      budget: body.totalBudget,
      mode: body.orchestrationMode,
    });

    // ========================================================================
    // STEP 1: Upload mission requirements to IPFS
    // ========================================================================
    console.log('[Mission Deploy] Uploading requirements to IPFS...');

    const requirementsData = {
      description: body.description,
      orchestrationMode: body.orchestrationMode,
      agents: body.agents.map(agent => ({
        agentId: agent.agentId.toString(),
        name: agent.name,
        capability: agent.capability,
        payment: agent.payment,
        requirements: body.requirements?.[agent.capability],
      })),
      totalBudget: body.totalBudget,
      createdAt: new Date().toISOString(),
    };

    const ipfsUpload = await uploadMissionRequirements(requirementsData);
    console.log('[Mission Deploy] Requirements uploaded:', ipfsUpload.ipfsHash);

    // ========================================================================
    // STEP 2: Create mission in database
    // ========================================================================
    console.log('[Mission Deploy] Creating mission in database...');

    const mission = await createMission({
      clientAddress: body.clientAddress,
      description: body.description,
      totalBudget: body.totalBudget,
      orchestrationMode: body.orchestrationMode,
      requirementsIpfs: ipfsUpload.ipfsHash,
    });

    console.log('[Mission Deploy] Mission created:', mission.id);

    // ========================================================================
    // STEP 3: Create mission in MissionEscrow contract (optional if contract deployed)
    // ========================================================================
    let escrowContractId: bigint | null = null;
    let escrowTxHash: Address | undefined;

    const missionEscrowAddress = process.env.NEXT_PUBLIC_MISSION_ESCROW_ADDRESS as Address | undefined;

    if (missionEscrowAddress) {
      try {
        console.log('[Mission Deploy] Creating mission in MissionEscrow contract...');

        // Initialize viem clients
        const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
        const rpcUrl = process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;

        if (!privateKey || !rpcUrl) {
          throw new Error('Missing PRIVATE_KEY or RPC_URL for escrow creation');
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

        // Load MissionEscrow ABI
        const { default: MissionEscrowABI } = await import('@/lib/contracts/abis/MissionEscrow.json');

        // Prepare agent addresses and payments
        const agentAddresses = body.agents.map(agent => agent.address);
        const agentPayments = body.agents.map(agent => parseUnits(agent.payment.toString(), 6)); // USDC has 6 decimals

        // Payment token (USDC on Base Sepolia)
        const paymentToken = (process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e') as Address;

        // Simulate contract call
        const { request } = await publicClient.simulateContract({
          address: missionEscrowAddress,
          abi: MissionEscrowABI,
          functionName: 'createMission',
          args: [
            paymentToken,
            agentAddresses,
            agentPayments,
            ipfsUpload.ipfsHash,
          ],
          account,
        });

        // Execute transaction
        const txHash = await walletClient.writeContract(request);
        escrowTxHash = txHash;

        console.log('[Mission Deploy] Escrow transaction sent:', txHash);

        // Wait for confirmation
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

        // Parse MissionCreated event to get on-chain mission ID
        const { parseEventLogs } = await import('viem');
        const logs = parseEventLogs({
          abi: MissionEscrowABI,
          logs: receipt.logs,
        });

        // Find MissionCreated event
        const missionCreatedEvent = logs.find((log) => {
          return 'eventName' in log && log.eventName === 'MissionCreated';
        });

        if (missionCreatedEvent && 'args' in missionCreatedEvent) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          escrowContractId = (missionCreatedEvent.args as any).missionId as bigint;
          console.log('[Mission Deploy] Mission created in escrow with ID:', escrowContractId.toString());
        }

        // Update mission in database with escrow info
        await updateMissionStatus(mission.id, 'funded', {
          escrow_tx_hash: txHash,
        });

        console.log('[Mission Deploy] Mission escrow created successfully');
      } catch (error) {
        console.error('[Mission Deploy] Failed to create mission escrow:', error);
        // Continue with mission deployment even if escrow fails
        // This maintains backward compatibility
      }
    } else {
      console.log('[Mission Deploy] MissionEscrow not configured, skipping on-chain escrow creation');
    }

    // ========================================================================
    // STEP 4: Verify/create CDP wallets for AI agents
    // ========================================================================
    console.log('[Mission Deploy] Verifying agent wallets...');

    const cdpManager = getCdpWalletManager();
    const agentWalletPromises = body.agents.map(async (agentData) => {
      const agentId = agentData.agentId.toString();

      // Check if wallet already exists
      let wallet = await getAgentWallet(agentId);

      if (!wallet) {
        // Check if agent profile exists
        const agentProfile = await getAgent(agentId);

        if (agentProfile && agentProfile.agent_type === 'ai') {
          try {
            // Create CDP wallet for AI agent (optional - agents can use their existing address)
            console.log(`[Mission Deploy] Creating CDP wallet for agent ${agentId}...`);

            const walletData = await cdpManager.createWallet({
              agentId,
              idempotencyKey: `agent-${agentId}`,
            });

            // Store wallet in database
            wallet = await createAgentWallet({
              agent_id: agentId,
              cdp_address: walletData.address,
              network_id: 'base-sepolia',
            });

            console.log(`[Mission Deploy] CDP wallet created: ${wallet.cdp_address}`);
          } catch (error) {
            // CDP wallet creation failed - agent will use their existing address
            console.warn(
              `[Mission Deploy] Failed to create CDP wallet for ${agentId}: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`
            );
            console.log(`[Mission Deploy] Agent will use existing address: ${agentProfile.address}`);
          }
        }
      }

      return wallet;
    });

    await Promise.all(agentWalletPromises);

    // ========================================================================
    // STEP 5: Add agents to mission
    // ========================================================================
    console.log('[Mission Deploy] Adding agents to mission...');

    const agentAddPromises = body.agents.map((agentData, index) => {
      return addAgentToMission({
        missionId: mission.id,
        agentId: agentData.agentId.toString(),
        capability: agentData.capability,
        paymentAmount: agentData.payment,
        requirements: body.requirements?.[agentData.capability],
        position: body.orchestrationMode === 'sequential' ? index : undefined,
      });
    });

    await Promise.all(agentAddPromises);

    // ========================================================================
    // STEP 6: Initialize execution records
    // ========================================================================
    console.log('[Mission Deploy] Initializing execution records...');

    await initializeMissionExecutions(mission.id);

    // ========================================================================
    // STEP 7: Start orchestrator (direct import - no HTTP!)
    // ========================================================================
    console.log('[Mission Deploy] Starting orchestration...');

    try {
      // Fetch agent profiles to get endpoints
      const agentProfiles = await Promise.all(
        body.agents.map(agent => getAgent(agent.agentId.toString()))
      );

      const orchestratorPayload = {
        missionId: mission.id,
        description: body.description,
        subAgents: body.agents.map((agent, index) => {
          const agentProfile = agentProfiles[index];
          return {
            agentId: agent.agentId.toString(),
            name: agent.name,
            address: agent.address,
            endpoint: agentProfile?.endpoint_url || `http://localhost:3001/execute`,
            capability: agent.capability,
            payment: Math.floor(agent.payment * 1e6), // USDC units (integer)
          };
        }),
        orchestrationMode: body.orchestrationMode,
        totalBudget: Math.floor(body.totalBudget * 1e6), // USDC units (integer)
        requirements: body.requirements || {},
      };

      // Import orchestrator core module
      const { startMissionOrchestration } = await import('@/lib/orchestrator/core');

      // Execute in background (don't await - let it run asynchronously)
      startMissionOrchestration(orchestratorPayload).catch((error) => {
        console.error('[Mission Deploy] Orchestration failed:', error);
        // TODO: Update mission status to 'failed' in database
      });

      console.log('[Mission Deploy] Orchestration started successfully');
    } catch (error) {
      console.error('[Mission Deploy] Failed to start orchestration:', error);
      // This is a critical error - mission won't execute
      throw error;
    }

    // ========================================================================
    // STEP 8: Return deployment details
    // ========================================================================
    const deployment: MissionDeployment = {
      missionId: mission.id,
      status: escrowContractId ? 'funded' : 'pending',
      agents: body.agents,
      totalCost: body.totalBudget,
      escrowAddress: missionEscrowAddress,
      createdAt: new Date(mission.created_at || Date.now()),
      estimatedCompletion: new Date(Date.now() + 2 * 60 * 60 * 1000),
    };

    const nextSteps = [
      'Mission stored in database',
      'Requirements uploaded to IPFS',
    ];

    if (escrowContractId) {
      nextSteps.push('Mission escrow created on-chain');
      nextSteps.push(`Escrow ID: ${escrowContractId.toString()}`);
      nextSteps.push(`Transaction: ${escrowTxHash}`);
    } else {
      nextSteps.push('Mission created without on-chain escrow');
    }

    nextSteps.push('Agent wallets verified/created');
    nextSteps.push('Orchestrator notified');
    nextSteps.push(`Track progress at /missions/${mission.id}`);

    return NextResponse.json({
      success: true,
      mission: deployment,
      escrowContractId: escrowContractId ? escrowContractId.toString() : undefined,
      escrowTxHash,
      requirementsIpfs: ipfsUpload.ipfsHash,
      requirementsUrl: ipfsUpload.url,
      message: `Mission ${mission.id} deployed successfully`,
      nextSteps,
    });
  } catch (error) {
    console.error('[Mission Deploy] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to deploy mission',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET mission status
 */
export async function GET(request: NextRequest) {
  const missionId = request.nextUrl.searchParams.get('missionId');

  if (!missionId) {
    return NextResponse.json({
      endpoint: '/api/missions/deploy',
      methods: {
        POST: 'Deploy new multi-agent mission',
        GET: 'Get mission status (add ?missionId=xxx)',
      },
      usage: {
        POST: {
          body: {
            description: 'Mission description',
            agents: [
              {
                agentId: '1',
                name: 'LogoMaster AI',
                address: '0x...',
                capability: 'logo-design',
                payment: 15,
              },
            ],
            totalBudget: 30,
            clientAddress: '0x...',
            orchestrationMode: 'sequential | parallel',
          },
        },
      },
    });
  }

  try {
    const { getMissionWithDetails } = await import('@/lib/supabase/missions');
    const missionDetails = await getMissionWithDetails(missionId);

    if (!missionDetails) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ...missionDetails,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to get mission status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
