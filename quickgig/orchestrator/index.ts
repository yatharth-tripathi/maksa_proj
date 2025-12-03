/**
 * Mission Orchestrator Service
 * Coordinates multi-agent mission execution
 * Runs on port 3002
 */

import { config } from 'dotenv';
import { join } from 'path';
import express from 'express';
import axios from 'axios';
import { createPublicClient, createWalletClient, http, parseUnits } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Load env from parent directory
config({ path: join(__dirname, '../.env.local') });

const app = express();
app.use(express.json());

// CORS configuration for production
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://quickgig.fun',
    'https://www.quickgig.fun',
    'http://localhost:3000',
  ];

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Payment-Proof');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

const PORT = 3002;
const API_BASE = process.env.CALLBACK_BASE_URL ||
                 process.env.NEXT_PUBLIC_SITE_URL ||
                 'http://localhost:3000';

// Orchestrator wallet for A2A payments (loads from PRIVATE_KEY env var)
const ORCHESTRATOR_PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`;

// Viem clients for on-chain payments
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL),
});

const orchestratorAccount = ORCHESTRATOR_PRIVATE_KEY
  ? privateKeyToAccount(ORCHESTRATOR_PRIVATE_KEY)
  : null;

const walletClient = orchestratorAccount
  ? createWalletClient({
      account: orchestratorAccount,
      chain: baseSepolia,
      transport: http(process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL),
    })
  : null;

interface SubAgent {
  agentId: string;
  name: string;
  address: string;
  endpoint: string;
  capability: string;
  payment: number;
}

interface MissionPayload {
  missionId: string;
  description: string;
  subAgents: SubAgent[];
  orchestrationMode: 'sequential' | 'parallel';
  totalBudget: number;
  requirements: any;
}

/**
 * Execute mission endpoint
 */
app.post('/execute', async (req, res) => {
  const payload: MissionPayload = req.body;

  console.log('[Orchestrator] Received mission:', payload.missionId);
  console.log('[Orchestrator] Mode:', payload.orchestrationMode);
  console.log('[Orchestrator] Agents:', payload.subAgents.length);

  try {
    if (payload.orchestrationMode === 'sequential') {
      await executeSequential(payload);
    } else {
      await executeParallel(payload);
    }

    res.json({
      success: true,
      message: 'Mission execution started',
      missionId: payload.missionId,
    });
  } catch (error) {
    console.error('[Orchestrator] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Execute agents sequentially
 */
async function executeSequential(payload: MissionPayload) {
  console.log('[Orchestrator] Starting sequential execution...');

  for (let i = 0; i < payload.subAgents.length; i++) {
    const agent = payload.subAgents[i];
    console.log(`[Orchestrator] Executing agent ${i + 1}/${payload.subAgents.length}: ${agent.name}`);

    try {
      await executeAgent(payload.missionId, agent, payload.description, payload.requirements);
      console.log(`[Orchestrator] Agent ${agent.name} completed`);
    } catch (error) {
      console.error(`[Orchestrator] Agent ${agent.name} failed:`, error);
      throw error;
    }
  }

  console.log('[Orchestrator] Sequential execution complete');
}

/**
 * Execute agents in parallel
 */
async function executeParallel(payload: MissionPayload) {
  console.log('[Orchestrator] Starting parallel execution...');

  const promises = payload.subAgents.map((agent) =>
    executeAgent(payload.missionId, agent, payload.description, payload.requirements)
  );

  await Promise.all(promises);

  console.log('[Orchestrator] Parallel execution complete');
}

/**
 * Execute single agent with X402 A2A payment support
 */
async function executeAgent(
  missionId: string,
  agent: SubAgent,
  description: string,
  requirements: any
) {
  console.log(`[Orchestrator] Calling agent ${agent.name} at ${agent.endpoint}`);

  try {
    // First request - agent may return 402 Payment Required
    let response = await axios.post(
      agent.endpoint,
      {
        missionId,
        agentId: agent.agentId,
        description,
        capability: agent.capability,
        payment: agent.payment,
        requirements,
        callbackUrl: `${API_BASE}/api/missions/${missionId}/update`,
      },
      {
        timeout: 120000,
        validateStatus: (status) => status < 500, // Accept 402 status
      }
    );

    // Handle X402 Payment Required response
    if (response.status === 402) {
      console.log(`[Orchestrator] Agent ${agent.name} requires payment (402)`);

      const paymentRequired = response.headers['x-payment-required'];
      if (!paymentRequired) {
        throw new Error('Agent returned 402 but missing X-Payment-Required header');
      }

      const paymentRequest = JSON.parse(paymentRequired);
      console.log(`[Orchestrator] Payment request:`, {
        amount: paymentRequest.amount,
        recipient: paymentRequest.recipient,
        token: paymentRequest.token,
      });

      // Execute A2A payment
      const paymentProof = await executeA2APayment(
        paymentRequest.recipient,
        paymentRequest.amount,
        paymentRequest.token
      );

      console.log(`[Orchestrator] Payment completed, retrying with proof...`);

      // Retry request with payment proof
      response = await axios.post(
        agent.endpoint,
        {
          missionId,
          agentId: agent.agentId,
          description,
          capability: agent.capability,
          payment: agent.payment,
          requirements,
          callbackUrl: `${API_BASE}/api/missions/${missionId}/update`,
        },
        {
          headers: {
            'X-Payment-Proof': JSON.stringify(paymentProof),
          },
          timeout: 120000,
        }
      );
    }

    console.log(`[Orchestrator] Agent ${agent.name} response:`, response.data);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[Orchestrator] Agent ${agent.name} HTTP error:`, {
        status: error.response?.status,
        message: error.message,
      });
    } else {
      console.error(`[Orchestrator] Agent ${agent.name} error:`, error);
    }
    throw error;
  }
}

/**
 * Execute Agent-to-Agent payment via X402
 */
async function executeA2APayment(
  recipient: string,
  amount: string,
  token: string
): Promise<any> {
  if (!walletClient || !orchestratorAccount) {
    throw new Error('Orchestrator wallet not configured');
  }

  console.log(`[Orchestrator] Executing A2A payment:`, {
    from: orchestratorAccount.address,
    to: recipient,
    amount,
    token,
  });

  // ERC20 Transfer ABI
  const transferAbi = [
    {
      name: 'transfer',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'bool' }],
    },
  ] as const;

  // Execute USDC transfer
  const txHash = await walletClient.writeContract({
    address: token as `0x${string}`,
    abi: transferAbi,
    functionName: 'transfer',
    args: [recipient as `0x${string}`, BigInt(amount)],
    chain: baseSepolia,
    account: orchestratorAccount,
  });

  console.log(`[Orchestrator] Payment transaction:`, txHash);

  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`[Orchestrator] Payment confirmed in block:`, receipt.blockNumber);

  // Create payment proof for X402
  const paymentProof = {
    from: orchestratorAccount.address,
    to: recipient,
    amount,
    token,
    txHash,
    blockNumber: receipt.blockNumber.toString(),
    timestamp: Math.floor(Date.now() / 1000),
  };

  return paymentProof;
}

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'orchestrator',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log(`[Orchestrator] Running on http://localhost:${PORT}`);
  console.log(`[Orchestrator] API Base: ${API_BASE}`);
});
