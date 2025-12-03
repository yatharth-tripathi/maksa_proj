/**
 * Agent Registration API
 * POST /api/agents/register
 * Creates CDP wallet and registers agent on ERC-8004
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCdpWalletManager } from '@/lib/cdp';
import { ERC8004_OFFICIAL } from '@/lib/erc8004/official-client';
import { getServerERC8004Client } from '@/lib/erc8004/server-client';
import { privateKeyToAccount } from 'viem/accounts';
import axios from 'axios';

interface RegisterAgentRequest {
  name: string;
  agentType: 'ai' | 'human' | 'hybrid';
  capabilities: string[];
  metadata: {
    description: string;
    pricing?: {
      perMessage?: number;
      perTask?: number;
    };
    contact?: {
      twitter?: string;
      github?: string;
      website?: string;
    };
  };
  ownerPrivateKey?: string; // Optional: For human agents who already have a wallet
}

export async function POST(request: NextRequest) {
  try {
    const body: RegisterAgentRequest = await request.json();

    // Validate request
    if (!body.name || !body.agentType || !body.capabilities || body.capabilities.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: name, agentType, capabilities' },
        { status: 400 }
      );
    }

    console.log('[Agent Registration] Starting registration:', {
      name: body.name,
      type: body.agentType,
      capabilities: body.capabilities,
    });

    // Step 1: Create CDP wallet for AI agents
    let walletAddress: string;
    let agentId: string;

    if (body.agentType === 'ai') {
      const cdpWalletManager = getCdpWalletManager();

      // Create unique agent ID based on name and timestamp
      agentId = `${body.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

      const walletData = await cdpWalletManager.createWallet({
        agentId,
        idempotencyKey: agentId, // Deterministic wallet generation
      });

      walletAddress = walletData.address;
      console.log('[Agent Registration] Created CDP wallet:', walletAddress);
    } else {
      // For human agents, they should provide their wallet address or we generate one
      if (!body.ownerPrivateKey) {
        return NextResponse.json(
          { error: 'Human agents must provide ownerPrivateKey' },
          { status: 400 }
        );
      }

      const account = privateKeyToAccount(body.ownerPrivateKey as `0x${string}`);
      walletAddress = account.address;
      agentId = `${body.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    }

    // Step 2: Create metadata JSON
    const metadataJson = {
      name: body.name,
      description: body.metadata.description,
      agentType: body.agentType,
      capabilities: body.capabilities,
      cdpWallet: walletAddress,
      pricing: body.metadata.pricing,
      contact: body.metadata.contact,
      registeredAt: new Date().toISOString(),
      version: '1.0.0',
      platform: 'SUPERMISSION'
    };

    // Step 3: Upload to IPFS via Pinata
    console.log('[Agent Registration] Uploading metadata to IPFS...');

    const PINATA_JWT = process.env.PINATA_JWT;
    if (!PINATA_JWT) {
      throw new Error('PINATA_JWT not configured');
    }

    let tokenUri: string;
    try {
      const ipfsResponse = await axios.post(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        metadataJson,
        {
          headers: {
            'Authorization': `Bearer ${PINATA_JWT}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const ipfsHash = ipfsResponse.data.IpfsHash;
      tokenUri = `ipfs://${ipfsHash}`;
      console.log('[Agent Registration] Metadata uploaded:', tokenUri);
    } catch (error) {
      console.error('[Agent Registration] IPFS upload failed:', error);
      throw new Error('Failed to upload metadata to IPFS');
    }

    // Step 4: Register on ERC-8004 Identity Registry (auto-register for AI agents)
    let erc8004AgentId: string | null = null;
    let registrationTxHash: string | null = null;

    if (body.agentType === 'ai') {
      try {
        console.log('[Agent Registration] Registering on ERC-8004 Identity Registry...');

        const erc8004Client = getServerERC8004Client();
        const registration = await erc8004Client.registerAgent(tokenUri);

        erc8004AgentId = registration.agentId.toString();
        registrationTxHash = registration.txHash;

        console.log('[Agent Registration] ERC-8004 registration successful!');
        console.log('   Agent ID (NFT):', erc8004AgentId);
        console.log('   Transaction:', registrationTxHash);
      } catch (error) {
        console.error('[Agent Registration] ERC-8004 registration failed:', error);
        // Don't fail the entire registration - AI can still work without on-chain ID
        console.warn('[Agent Registration] Continuing without on-chain registration');
      }
    }

    return NextResponse.json({
      success: true,
      agent: {
        agentId,
        walletAddress,
        name: body.name,
        agentType: body.agentType,
        capabilities: body.capabilities,
        metadataUri: tokenUri,
        erc8004AgentId, // Official ERC-8004 NFT ID (null if registration failed)
        registrationTxHash, // Transaction hash for on-chain registration
      },
      message: erc8004AgentId
        ? 'Agent created and registered on ERC-8004 successfully!'
        : 'Agent wallet created successfully.',
      onChainRegistration: erc8004AgentId ? {
        agentId: erc8004AgentId,
        txHash: registrationTxHash,
        registry: ERC8004_OFFICIAL.IDENTITY_REGISTRY,
        explorer: `https://sepolia.basescan.org/tx/${registrationTxHash}`,
      } : null,
    });
  } catch (error) {
    console.error('[Agent Registration] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to register agent',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agents/register
 * Returns registration info
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/agents/register',
    method: 'POST',
    description: 'Register a new autonomous agent with CDP wallet',
    requiredFields: {
      name: 'Agent name',
      agentType: 'ai | human | hybrid',
      capabilities: 'Array of capability strings',
      metadata: {
        description: 'Agent description',
        pricing: 'Optional pricing info',
        contact: 'Optional contact info',
      },
    },
    optionalFields: {
      ownerPrivateKey: 'Private key for human agents (not stored)',
    },
    response: {
      agentId: 'Unique agent identifier',
      walletAddress: 'CDP wallet address',
      metadataUri: 'IPFS metadata URI',
      nextSteps: 'Instructions for on-chain registration',
    },
  });
}
