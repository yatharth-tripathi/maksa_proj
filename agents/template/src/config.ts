import { type Address } from 'viem';
import * as dotenv from 'dotenv';

dotenv.config();

export interface AgentConfig {
  // Identity
  name: string;
  agentId: string;
  privateKey: `0x${string}`;
  capabilities: string[];

  // Blockchain
  rpcUrl: string;
  contracts: {
    bountyEscrow: Address;
    erc8004Registry: Address;
    reputationRegistry: Address;
    usdc: Address;
  };

  // Bidding Strategy
  bidding: {
    minAmount: number; // Min USDC amount
    maxAmount: number; // Max USDC amount
    targetProfit: number; // 0.3 = 30% profit margin
    maxConcurrent: number; // Max concurrent gigs
    maxDailySpend?: number;
  };

  // Behavior
  monitorIntervalMs: number;
  dryRun: boolean; // If true, simulate but don't actually bid/submit

  // AI & Storage
  openaiKey: string;
  pinataJwt: string;

  // Logging
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export const agentConfig: AgentConfig = {
  // Identity
  name: process.env.AGENT_NAME || 'Template Agent',
  agentId: process.env.AGENT_ID || '',
  privateKey: (process.env.PRIVATE_KEY as `0x${string}`) || '0x',
  capabilities: ['template'], // Override in your agent

  // Blockchain
  rpcUrl: process.env.BASE_SEPOLIA_RPC || '',
  contracts: {
    bountyEscrow: (process.env.BOUNTY_ESCROW_ADDRESS as Address) || '0x',
    erc8004Registry: (process.env.ERC8004_REGISTRY_ADDRESS as Address) || '0x',
    reputationRegistry: (process.env.REPUTATION_REGISTRY_ADDRESS as Address) || '0x',
    usdc: (process.env.USDC_ADDRESS as Address) || '0x',
  },

  // Bidding Strategy
  bidding: {
    minAmount: Number(process.env.MIN_BID_AMOUNT) || 10,
    maxAmount: Number(process.env.MAX_BID_AMOUNT) || 500,
    targetProfit: Number(process.env.TARGET_PROFIT_MARGIN) || 0.3,
    maxConcurrent: Number(process.env.MAX_CONCURRENT_GIGS) || 3,
    maxDailySpend: Number(process.env.MAX_DAILY_SPEND) || undefined,
  },

  // Behavior
  monitorIntervalMs: Number(process.env.MONITOR_INTERVAL_MS) || 30000,
  dryRun: process.env.DRY_RUN === 'true',

  // AI & Storage
  openaiKey: process.env.OPENAI_API_KEY || '',
  pinataJwt: process.env.PINATA_JWT || '',

  // Logging
  logLevel: (process.env.LOG_LEVEL as AgentConfig['logLevel']) || 'info',
};

// Validation
function validateConfig(config: AgentConfig): void {
  const errors: string[] = [];

  if (!config.agentId) errors.push('AGENT_ID is required');
  if (!config.privateKey || config.privateKey === '0x') errors.push('PRIVATE_KEY is required');
  if (!config.rpcUrl) errors.push('BASE_SEPOLIA_RPC is required');
  if (!config.openaiKey) errors.push('OPENAI_API_KEY is required');
  if (!config.pinataJwt) errors.push('PINATA_JWT is required');

  if (errors.length > 0) {
    console.error('❌ Configuration errors:');
    errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }
}

// Validate on import
if (!process.env.SKIP_VALIDATION) {
  validateConfig(agentConfig);
}

