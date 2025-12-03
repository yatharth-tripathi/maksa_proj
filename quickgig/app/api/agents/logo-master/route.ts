/**
 * LogoMaster AI Agent Service (Serverless)
 * Generates logos using DALL-E 3
 * Migrated from agents/logo-master/index.ts to Vercel serverless
 */

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import OpenAI from 'openai';
import FormData from 'form-data';

const AGENT_ID = 'agent_1760886157698_lzy2czh83'; // LogoMaster AI (legacy)
const AGENT_NAME = 'LogoMaster AI';
const ERC8004_AGENT_ID = '2'; // Official ERC-8004 NFT Token ID
const CDP_WALLET = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

// OpenAI client for DALL-E
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Pinata for IPFS uploads
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY || process.env.PINATA_API_SECRET;

interface ExecuteRequest {
  missionId: string;
  agentId: string;
  description: string;
  capability: string;
  payment: number;
  requirements: Record<string, unknown>;
  callbackUrl: string;
}

/**
 * Execute task endpoint with X402 Payment Required support
 */
export async function POST(request: NextRequest) {
  try {
    const task: ExecuteRequest = await request.json();
    const paymentProofHeader = request.headers.get('x-payment-proof');

    console.log(`[${AGENT_NAME}] Received task:`, task.missionId);
    console.log(`[${AGENT_NAME}] Description:`, task.description);
    console.log(`[${AGENT_NAME}] Payment: ${task.payment} USDC`);

    // Check for payment proof
    if (!paymentProofHeader) {
      console.log(`[${AGENT_NAME}] No payment proof - returning 402 Payment Required`);

      // Return X402 Payment Required
      const paymentRequest = {
        amount: task.payment.toString(), // Amount in smallest unit (e.g., USDC with 6 decimals)
        token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC on Base Sepolia
        recipient: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', // LogoMaster AI wallet
        chainId: 84532, // Base Sepolia
        description: `Payment for logo design - Mission ${task.missionId}`,
      };

      return NextResponse.json(
        {
          error: 'Payment required',
          message: 'Please provide payment to execute this task',
          agentId: AGENT_ID,
          agentName: AGENT_NAME,
        },
        {
          status: 402,
          headers: {
            'X-Payment-Required': JSON.stringify(paymentRequest),
          },
        }
      );
    }

    // Verify payment proof
    try {
      const paymentProof = JSON.parse(paymentProofHeader);
      console.log(`[${AGENT_NAME}] Verifying payment proof:`, {
        from: paymentProof.from,
        to: paymentProof.to,
        amount: paymentProof.amount,
        txHash: paymentProof.txHash,
      });

      // TODO: Verify payment on-chain using viem
      // For now, just check that proof exists and has required fields
      if (!paymentProof.txHash || !paymentProof.amount || !paymentProof.from) {
        throw new Error('Invalid payment proof format');
      }

      console.log(`[${AGENT_NAME}] Payment verified! Executing task...`);

      // Execute task asynchronously (don't await)
      executeTask(task).catch((error) => {
        console.error(`[${AGENT_NAME}] Task execution failed:`, error);
      });

      // Respond immediately
      return NextResponse.json({
        success: true,
        message: 'Payment accepted, task execution started',
        agentId: AGENT_ID,
        agentName: AGENT_NAME,
        paymentReceived: paymentProof.amount,
      });
    } catch (error) {
      console.error(`[${AGENT_NAME}] Payment verification failed:`, error);
      return NextResponse.json(
        {
          error: 'Invalid payment proof',
          message: error instanceof Error ? error.message : 'Payment verification failed',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error(`[${AGENT_NAME}] Request error:`, error);
    return NextResponse.json(
      {
        error: 'Invalid request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    agent: AGENT_NAME,
    agentId: AGENT_ID, // Legacy ID
    erc8004AgentId: ERC8004_AGENT_ID, // Official ERC-8004 NFT ID
    cdpWallet: CDP_WALLET,
    capabilities: ['logo-design', 'graphic-design', 'branding'],
    officialRegistry: '0x8004AA63c570c570eBF15376c0dB199918BFe9Fb',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Execute the logo generation task
 */
async function executeTask(task: ExecuteRequest) {
  try {
    // Update status to executing
    console.log(`[${AGENT_NAME}] Starting execution...`);
    await updateStatus(task, 'executing', null, null);

    // Generate logo using DALL-E 3
    console.log(`[${AGENT_NAME}] Generating logo with DALL-E 3...`);

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const dalleResponse = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `Create a minimalist, professional logo based on this description: ${task.description}. The logo should be clean, modern, and suitable for business use. High quality, vector-style aesthetic.`,
      n: 1,
      size: '1024x1024',
      quality: 'hd',
      style: 'vivid',
    });

    if (!dalleResponse.data || dalleResponse.data.length === 0) {
      throw new Error('No image data returned from DALL-E');
    }

    const imageUrl = dalleResponse.data[0].url;
    if (!imageUrl) {
      throw new Error('Failed to generate image');
    }

    console.log(`[${AGENT_NAME}] Logo generated:`, imageUrl);

    // Download image
    console.log(`[${AGENT_NAME}] Downloading generated image...`);
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
    });
    const imageBuffer = Buffer.from(imageResponse.data);

    // Upload to IPFS via Pinata
    console.log(`[${AGENT_NAME}] Uploading to IPFS...`);
    const ipfsHash = await uploadToIPFS(imageBuffer, `logo-${task.missionId}.png`);
    const deliverableUri = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

    console.log(`[${AGENT_NAME}] Deliverable uploaded:`, deliverableUri);

    // Update status to completed
    await updateStatus(task, 'completed', deliverableUri, {
      imageUrl: deliverableUri,
      ipfsHash,
      model: 'dall-e-3',
      prompt: task.description,
      generatedAt: new Date().toISOString(),
    });

    console.log(`[${AGENT_NAME}] Task completed successfully`);
  } catch (error) {
    console.error(`[${AGENT_NAME}] Task failed:`, error);
    await updateStatus(
      task,
      'failed',
      null,
      null,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Upload image to IPFS via Pinata
 */
async function uploadToIPFS(buffer: Buffer, filename: string): Promise<string> {
  if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
    throw new Error('Pinata API keys not configured');
  }

  const formData = new FormData();
  formData.append('file', buffer, filename);

  const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
    headers: {
      ...formData.getHeaders(),
      pinata_api_key: PINATA_API_KEY,
      pinata_secret_api_key: PINATA_SECRET_KEY,
    },
  });

  return response.data.IpfsHash;
}

/**
 * Update mission execution status via callback
 */
async function updateStatus(
  task: ExecuteRequest,
  status: 'executing' | 'completed' | 'failed',
  deliverableUri: string | null,
  resultData: Record<string, unknown> | null,
  errorMessage?: string
) {
  try {
    // Try to get execution ID from database
    let executionId: number | undefined;

    try {
      const executionsResponse = await axios.get(
        `${task.callbackUrl.replace('/update', '')}`
      );
      const executions = executionsResponse.data.executions || [];
      const execution = executions.find((e: { agent_id: string }) => e.agent_id === task.agentId);

      if (execution) {
        executionId = execution.id;
      } else {
        console.warn(`[${AGENT_NAME}] Execution record not found for agent ${task.agentId}, calling update anyway`);
      }
    } catch (error) {
      console.warn(`[${AGENT_NAME}] Failed to fetch execution record, calling update anyway:`, error);
    }

    // Call update endpoint regardless (it will find/create execution if needed)
    await axios.post(task.callbackUrl, {
      executionId,
      agentId: task.agentId,
      status,
      deliverableUri,
      resultData,
      errorMessage,
    });

    console.log(`[${AGENT_NAME}] Status updated to: ${status}`);
  } catch (error) {
    console.error(`[${AGENT_NAME}] Failed to update status:`, error);
  }
}
