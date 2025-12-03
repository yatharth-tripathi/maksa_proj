/**
 * Generate Feedback Auth API
 * POST /api/reputation/generate-auth
 * Generates a signed feedbackAuth parameter for ERC-8004 feedback submission
 *
 * The feedbackAuth contains:
 * 1. Struct data (224 bytes): agentId, clientAddress, indexLimit, expiry, chainId, identityRegistry, signerAddress
 * 2. Signature (65+ bytes): Agent owner's signature authorizing this client to give feedback
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
  toBytes,
  type Address,
  createWalletClient,
  http,
  hashMessage,
} from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// NFT Owner Wallet (Deployer)
// ALL ERC-8004 NFTs (agents 2, 3, 4) are owned by this address on-chain
// This wallet MUST sign the feedbackAuth for all agents
const NFT_OWNER = {
  address: '0x57E94Af6f45fD9Cda508Ee8E6467B2895F75bBF9' as Address,
  privateKey: (process.env.PRIVATE_KEY || '0xcd6e40c315aa007128416e77c85e900ad7391b8923c200ddcfd005c8ecd6e9f6') as `0x${string}`,
};

// Agent names for logging
const AGENT_NAMES: Record<string, string> = {
  '2': 'LogoMaster AI',
  '3': 'CopyWriter AI',
  '4': 'SocialMedia AI',
};

// ERC-8004 contracts
const IDENTITY_REGISTRY = '0x8004AA63c570c570eBF15376c0dB199918BFe9Fb';
const REPUTATION_REGISTRY = '0x8004bd8daB57f14Ed299135749a5CB5c42d341BF';

interface GenerateAuthRequest {
  agentId: string; // ERC-8004 NFT token ID (2, 3, or 4)
  clientAddress: string; // Client wallet address
  indexLimit?: number; // Max feedback count (default: 10)
  expiryHours?: number; // Hours until expiry (default: 24)
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Generate Auth] Received request');
    const body: GenerateAuthRequest = await request.json();

    // Validate request
    if (!body.agentId || !body.clientAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: agentId, clientAddress' },
        { status: 400 }
      );
    }

    // Get agent name
    const agentName = AGENT_NAMES[body.agentId];
    if (!agentName) {
      return NextResponse.json(
        { error: `Agent ${body.agentId} not configured` },
        { status: 400 }
      );
    }

    console.log('[Generate Auth] Generating auth for:', {
      agentId: body.agentId,
      agentName,
      nftOwner: NFT_OWNER.address,
      clientAddress: body.clientAddress,
    });

    // Create account from NFT owner's private key
    // ALL NFTs are owned by the deployer wallet
    const account = privateKeyToAccount(NFT_OWNER.privateKey);

    console.log('[Generate Auth] NFT Owner Account:', account.address);
    console.log('[Generate Auth] Expected:', NFT_OWNER.address);

    // Build FeedbackAuth struct
    const indexLimit = body.indexLimit || 10; // Allow up to 10 feedback submissions
    const expiryHours = body.expiryHours || 24; // Valid for 24 hours
    const expiry = Math.floor(Date.now() / 1000) + (expiryHours * 3600);
    const chainId = 84532; // Base Sepolia
    const signerAddress = NFT_OWNER.address; // Must be the NFT owner

    console.log('[Generate Auth] Auth parameters:', {
      agentId: body.agentId,
      clientAddress: body.clientAddress,
      indexLimit,
      expiry: new Date(expiry * 1000).toISOString(),
      chainId,
      identityRegistry: IDENTITY_REGISTRY,
      signerAddress,
    });

    // Encode struct (first 224 bytes)
    const encodedStruct = encodeAbiParameters(
      parseAbiParameters('uint256, address, uint64, uint256, uint256, address, address'),
      [
        BigInt(body.agentId),
        body.clientAddress as `0x${string}`,
        BigInt(indexLimit),
        BigInt(expiry),
        BigInt(chainId),
        IDENTITY_REGISTRY as `0x${string}`,
        signerAddress,
      ]
    );

    console.log('[Generate Auth] Encoded struct:', encodedStruct);
    console.log('[Generate Auth] Struct length:', encodedStruct.length);

    // Create message to sign - must match contract's verification
    // Contract does: keccak256(abi.encode(...)).toEthSignedMessageHash().recover(signature)

    // Step 1: Hash the encoded struct (same as Solidity's keccak256(abi.encode(...)))
    const structHash = keccak256(encodedStruct);
    console.log('[Generate Auth] Struct hash:', structHash);

    // Step 2: Sign the hash - signMessage will add EIP-191 prefix automatically
    // This matches Solidity's .toEthSignedMessageHash()
    const signature = await account.signMessage({
      message: { raw: toBytes(structHash) },
    });

    console.log('[Generate Auth] Signing with address:', account.address);

    console.log('[Generate Auth] Signature:', signature);
    console.log('[Generate Auth] Signature length:', signature.length);

    // Concatenate struct + signature to create feedbackAuth
    // Remove '0x' prefix from signature before concatenating
    const signatureHex = signature.startsWith('0x') ? signature.slice(2) : signature;
    const feedbackAuth = (encodedStruct + signatureHex) as `0x${string}`;

    console.log('[Generate Auth] Final feedbackAuth:', feedbackAuth);
    console.log('[Generate Auth] Final length:', feedbackAuth.length);
    console.log('[Generate Auth] Final length in bytes:', (feedbackAuth.length - 2) / 2);

    // Verify length is >= 289 bytes (578 hex chars + '0x' = 580 total chars)
    const byteLength = (feedbackAuth.length - 2) / 2;
    if (byteLength < 289) {
      console.error('[Generate Auth] feedbackAuth too short:', byteLength, 'bytes');
      return NextResponse.json(
        { error: `feedbackAuth too short: ${byteLength} bytes (need >= 289)` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      feedbackAuth,
      metadata: {
        agentId: body.agentId,
        agentName,
        clientAddress: body.clientAddress,
        indexLimit,
        expiry,
        expiryDate: new Date(expiry * 1000).toISOString(),
        chainId,
        identityRegistry: IDENTITY_REGISTRY,
        signerAddress,
        byteLength,
      },
    });

  } catch (error) {
    console.error('[Generate Auth] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate feedbackAuth',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reputation/generate-auth
 * Returns API documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/reputation/generate-auth',
    method: 'POST',
    description: 'Generate signed feedbackAuth for ERC-8004 feedback submission',
    requiredFields: {
      agentId: 'ERC-8004 NFT token ID (2, 3, or 4)',
      clientAddress: 'Client wallet address',
    },
    optionalFields: {
      indexLimit: 'Max feedback count (default: 10)',
      expiryHours: 'Hours until expiry (default: 24)',
    },
    returns: {
      feedbackAuth: 'Hex-encoded auth data (>= 289 bytes)',
      metadata: 'Auth parameters and expiry info',
    },
  });
}
