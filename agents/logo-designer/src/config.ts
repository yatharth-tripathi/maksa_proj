import { type Address } from 'viem';
import * as dotenv from 'dotenv';

dotenv.config();

export interface AgentConfig {
  name: string;
  agentId: string;
  privateKey: `0x${string}`;
  capabilities: string[];
  rpcUrl: string;
  contracts: {
    bountyEscrow: Address;
    erc8004Registry: Address;
    reputationRegistry: Address;
    usdc: Address;
  };
  bidding: {
    minAmount: number;
    maxAmount: number;
    targetProfit: number;
    maxConcurrent: number;
  };
  monitorIntervalMs: number;
  dryRun: boolean;
  openrouterKey: string;
  pinataJwt: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export const agentConfig: AgentConfig = {
  name: 'Logo Designer Agent',
  agentId: process.env.AGENT_ID || '',
  privateKey: (process.env.PRIVATE_KEY as `0x${string}`) || '0x',
  
  // Logo design capabilities
  capabilities: ['logo-design', 'graphic-design', 'branding'],

  rpcUrl: process.env.BASE_SEPOLIA_RPC || '',
  contracts: {
    bountyEscrow: (process.env.BOUNTY_ESCROW_ADDRESS as Address) || '0xe04839605564C5e7cb181566fd78016a20c4339E',
    erc8004Registry: (process.env.ERC8004_REGISTRY_ADDRESS as Address) || '0x50D79739Fac55eb54A5b5D26666F6516a655DD71',
    reputationRegistry: (process.env.REPUTATION_REGISTRY_ADDRESS as Address) || '0x37cBa6712de87c7342522C69e5311FE60C58cE40',
    usdc: (process.env.USDC_ADDRESS as Address) || '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },

  // Logo design bidding strategy (CHEAP for testing!)
  bidding: {
    minAmount: 3, // Min $3 for testing (was 20)
    maxAmount: 10, // Max $10 for testing (was 300)
    targetProfit: 0.8, // 80% profit margin (super cheap AI!)
    maxConcurrent: 3, // Can handle 3 logos at once
  },

  monitorIntervalMs: 30000, // Check every 30 seconds
  dryRun: process.env.DRY_RUN === 'true',
  openrouterKey: process.env.OPENROUTER_API_KEY || '',
  pinataJwt: process.env.PINATA_JWT || '',
  logLevel: (process.env.LOG_LEVEL as AgentConfig['logLevel']) || 'info',
};

// Validation
if (!process.env.SKIP_VALIDATION) {
  const errors: string[] = [];
  if (!agentConfig.agentId) errors.push('AGENT_ID required');
  if (!agentConfig.privateKey || agentConfig.privateKey === '0x') errors.push('PRIVATE_KEY required');
  if (!agentConfig.rpcUrl) errors.push('BASE_SEPOLIA_RPC required');
  if (!agentConfig.openrouterKey) errors.push('OPENROUTER_API_KEY required');
  if (!agentConfig.pinataJwt) errors.push('PINATA_JWT required');

  if (errors.length > 0) {
    console.error('❌ Configuration errors:', errors);
    process.exit(1);
  }
}

