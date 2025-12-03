/**
 * CDP Wallet Manager for Autonomous Agents
 * Provisions and manages wallets for AI agents using Coinbase Developer Platform
 */

import type { Address } from 'viem';

// Type definitions for CDP wallet
export interface AgentWalletData {
  address: Address;
  agentId: string;
  createdAt: Date;
}

export interface CreateWalletParams {
  agentId: string;
  idempotencyKey?: string; // For deterministic wallet generation
}

export interface WalletBalance {
  wei: bigint;
  eth: string;
  usdc?: string;
}

/**
 * CDP Wallet Manager
 * Creates and manages wallets for autonomous agents
 */
export class CdpWalletManager {
  private apiKeyId: string;
  private apiKeySecret: string;
  private walletSecret: string;
  private networkId: string;
  private rpcUrl?: string;

  constructor(config: {
    apiKeyId: string;
    apiKeySecret: string;
    walletSecret: string;
    networkId?: string;
    rpcUrl?: string;
  }) {
    this.apiKeyId = config.apiKeyId;
    this.apiKeySecret = config.apiKeySecret;
    this.walletSecret = config.walletSecret;
    this.networkId = config.networkId || 'base-sepolia';
    this.rpcUrl = config.rpcUrl;
  }

  /**
   * Create a new wallet for an agent
   * Returns wallet address and metadata
   */
  async createWallet(params: CreateWalletParams): Promise<AgentWalletData> {
    // Dynamic import to avoid issues with server-side rendering
    const { CdpEvmWalletProvider } = await import('@coinbase/agentkit');

    try {
      // Create new CDP wallet
      const walletProvider = await CdpEvmWalletProvider.configureWithWallet({
        apiKeyId: this.apiKeyId,
        apiKeySecret: this.apiKeySecret,
        walletSecret: this.walletSecret,
        networkId: this.networkId as 'base-sepolia' | 'base-mainnet',
        idempotencyKey: params.idempotencyKey,
        rpcUrl: this.rpcUrl,
      });

      const address = walletProvider.getAddress();

      return {
        address: address as Address,
        agentId: params.agentId,
        createdAt: new Date(),
      };
    } catch (error) {
      console.error('[CDP Wallet Manager] Failed to create wallet:', error);
      throw new Error(
        `Failed to create wallet for agent ${params.agentId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Get wallet provider for existing agent wallet
   */
  async getWalletProvider(address: Address) {
    const { CdpEvmWalletProvider } = await import('@coinbase/agentkit');

    try {
      return await CdpEvmWalletProvider.configureWithWallet({
        apiKeyId: this.apiKeyId,
        apiKeySecret: this.apiKeySecret,
        walletSecret: this.walletSecret,
        address,
        networkId: this.networkId as 'base-sepolia' | 'base-mainnet',
        rpcUrl: this.rpcUrl,
      });
    } catch (error) {
      console.error('[CDP Wallet Manager] Failed to get wallet provider:', error);
      throw error;
    }
  }

  /**
   * Get wallet balance (native token + optionally USDC)
   */
  async getBalance(address: Address): Promise<WalletBalance> {
    try {
      const walletProvider = await this.getWalletProvider(address);
      const balance = await walletProvider.getBalance();

      // Convert wei to ETH string
      const ethBalance = (Number(balance) / 1e18).toFixed(6);

      return {
        wei: balance,
        eth: ethBalance,
      };
    } catch (error) {
      console.error('[CDP Wallet Manager] Failed to get balance:', error);
      throw error;
    }
  }

  /**
   * Transfer native token (ETH on mainnet, ETH on Base)
   */
  async transferNative(params: {
    fromAddress: Address;
    toAddress: Address;
    amountWei: string;
  }): Promise<string> {
    try {
      const walletProvider = await this.getWalletProvider(params.fromAddress);
      const txHash = await walletProvider.nativeTransfer(params.toAddress, params.amountWei);
      return txHash;
    } catch (error) {
      console.error('[CDP Wallet Manager] Failed to transfer:', error);
      throw error;
    }
  }

  /**
   * Get wallet details
   */
  async getWalletInfo(address: Address) {
    try {
      const walletProvider = await this.getWalletProvider(address);
      const network = walletProvider.getNetwork();
      const balance = await walletProvider.getBalance();

      return {
        address,
        networkId: network.networkId,
        chainId: network.chainId,
        balance: balance.toString(),
      };
    } catch (error) {
      console.error('[CDP Wallet Manager] Failed to get wallet info:', error);
      throw error;
    }
  }
}

/**
 * Singleton instance for server-side usage
 */
let cdpWalletManager: CdpWalletManager | null = null;

/**
 * Validate CDP API key secret format
 * Must be either PEM EC key or base64 Ed25519 key
 */
function validateCdpApiKeySecret(secret: string): boolean {
  // Check for PEM format (starts with -----BEGIN and ends with -----END)
  const isPemFormat = secret.includes('-----BEGIN') && secret.includes('-----END');

  // Check for base64 Ed25519 format (64 bytes = 88 base64 chars without padding)
  const isBase64Ed25519 = /^[A-Za-z0-9+/]{86,88}={0,2}$/.test(secret.trim());

  return isPemFormat || isBase64Ed25519;
}

export function getCdpWalletManager(): CdpWalletManager {
  if (!cdpWalletManager) {
    // Validate environment variables
    const apiKeyId = process.env.CDP_API_KEY_ID;
    const apiKeySecret = process.env.CDP_API_KEY_SECRET;
    const walletSecret = process.env.CDP_WALLET_SECRET;

    if (!apiKeyId || !apiKeySecret || !walletSecret) {
      throw new Error(
        'Missing CDP credentials. Set CDP_API_KEY_ID, CDP_API_KEY_SECRET, and CDP_WALLET_SECRET'
      );
    }

    // Validate CDP_API_KEY_SECRET format
    if (!validateCdpApiKeySecret(apiKeySecret)) {
      throw new Error(
        'Invalid CDP_API_KEY_SECRET format. Must be either:\n' +
        '1. PEM EC private key (starts with -----BEGIN EC PRIVATE KEY-----)\n' +
        '2. Base64 encoded Ed25519 key (88 characters)\n' +
        'Check your .env.local file and ensure you copied the private key correctly from CDP.'
      );
    }

    cdpWalletManager = new CdpWalletManager({
      apiKeyId,
      apiKeySecret,
      walletSecret,
      networkId: process.env.NETWORK_ID || 'base-sepolia',
      rpcUrl: process.env.RPC_URL,
    });
  }

  return cdpWalletManager;
}
