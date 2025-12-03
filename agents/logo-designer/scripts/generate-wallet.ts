/**
 * Agent Wallet Generator
 * Automatically creates a new wallet for autonomous agent
 * Uses Viem to generate secure private key and address
 */

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http, formatEther } from 'viem';
import { baseSepolia } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';

async function generateAgentWallet() {
  console.log('🔐 Generating Agent Wallet...\n');

  // 1. Generate new private key
  const privateKey = generatePrivateKey();
  console.log('✓ Private key generated securely\n');

  // 2. Derive account from private key
  const account = privateKeyToAccount(privateKey);
  console.log('✓ Account derived from private key\n');

  // 3. Display wallet information
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 Agent Wallet Created Successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📍 Wallet Address:');
  console.log(`   ${account.address}\n`);

  console.log('🔑 Private Key:');
  console.log(`   ${privateKey}\n`);

  console.log('⚠️  SECURITY WARNING:');
  console.log('   - NEVER share your private key');
  console.log('   - NEVER commit .env file to git');
  console.log('   - This is for TESTNET only (Base Sepolia)');
  console.log('   - Keep this terminal output private\n');

  // 4. Check balance (will be 0 initially)
  try {
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http('https://sepolia.basescan.org/rpc'),
    });

    const balance = await publicClient.getBalance({ address: account.address });
    console.log('💰 Current Balance:');
    console.log(`   ETH: ${formatEther(balance)} (Base Sepolia)\n`);
  } catch (error) {
    console.log('💰 Current Balance:');
    console.log('   ETH: 0 (not funded yet)\n');
  }

  // 5. Create .env file
  const envContent = `# Agent Wallet Configuration
# Generated on ${new Date().toISOString()}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# AGENT IDENTITY
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Your agent wallet (auto-generated)
PRIVATE_KEY=${privateKey}

# Agent ID (get this after registering on ERC8004Registry)
# Visit: https://yourapp.vercel.app/register
AGENT_ID=

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# BLOCKCHAIN
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Base Sepolia RPC (get free key from Alchemy)
BASE_SEPOLIA_RPC=https://base-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY

# Contract Addresses (Base Sepolia - already deployed)
BOUNTY_ESCROW_ADDRESS=0xe04839605564C5e7cb181566fd78016a20c4339E
ERC8004_REGISTRY_ADDRESS=0x50D79739Fac55eb54A5b5D26666F6516a655DD71
REPUTATION_REGISTRY_ADDRESS=0x37cBa6712de87c7342522C69e5311FE60C58cE40
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# AI APIs
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# OpenAI API (for DALL-E and GPT-4)
OPENAI_API_KEY=sk-

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STORAGE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Pinata JWT (for IPFS uploads)
PINATA_JWT=

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# AGENT BEHAVIOR
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Start in dry run mode (true = no real transactions)
DRY_RUN=false

# Log level: debug | info | warn | error
LOG_LEVEL=info

# Skip validation (set to false in production)
SKIP_VALIDATION=false
`;

  const envPath = path.join(process.cwd(), '.env');
  fs.writeFileSync(envPath, envContent);

  console.log('✓ .env file created at:');
  console.log(`   ${envPath}\n`);

  // 6. Funding instructions
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 NEXT STEPS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('1️⃣  FUND AGENT WALLET');
  console.log('   Get Base Sepolia ETH (for gas):');
  console.log('   → https://www.alchemy.com/faucets/base-sepolia');
  console.log('   → Send to: ' + account.address);
  console.log('   → Amount needed: 0.005 ETH (~100 transactions)\n');

  console.log('2️⃣  CONFIGURE API KEYS');
  console.log('   Edit .env file and add:');
  console.log('   - BASE_SEPOLIA_RPC (from Alchemy)');
  console.log('   - OPENAI_API_KEY (from OpenAI)');
  console.log('   - PINATA_JWT (from Pinata)\n');

  console.log('3️⃣  REGISTER AGENT');
  console.log('   Visit your deployed app and register:');
  console.log('   - Connect with this wallet address');
  console.log('   - Select capabilities: logo-design, graphic-design');
  console.log('   - Pay 0.001 ETH registration fee');
  console.log('   - Copy AGENT_ID and add to .env\n');

  console.log('4️⃣  START AGENT');
  console.log('   Run: npm run dev');
  console.log('   Agent will start monitoring bounties!\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 7. Create wallet info file
  const walletInfo = {
    address: account.address,
    createdAt: new Date().toISOString(),
    network: 'Base Sepolia',
    purpose: 'Autonomous Logo Designer Agent',
    fundingInstructions: {
      eth: {
        amount: '0.005 ETH',
        purpose: 'Gas fees for ~100 transactions',
        faucet: 'https://www.alchemy.com/faucets/base-sepolia',
      },
      usdc: {
        amount: '$0 initially',
        purpose: 'Agent earns USDC by completing work',
        note: 'No initial USDC needed!',
      },
    },
    nextSteps: [
      'Fund wallet with 0.005 ETH',
      'Configure API keys in .env',
      'Register agent on ERC8004Registry',
      'Start agent with npm run dev',
    ],
  };

  const walletInfoPath = path.join(process.cwd(), 'wallet-info.json');
  fs.writeFileSync(walletInfoPath, JSON.stringify(walletInfo, null, 2));

  console.log('✓ Wallet info saved to: wallet-info.json\n');

  // 8. Create quick reference card
  const quickRef = `
┌────────────────────────────────────────────────────────────┐
│              AGENT WALLET QUICK REFERENCE                  │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Address:  ${account.address}                              │
│  Network:  Base Sepolia (Testnet)                          │
│  Purpose:  Logo Designer Agent                             │
│                                                             │
├────────────────────────────────────────────────────────────┤
│  FUNDING NEEDED                                             │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ✓ 0.005 ETH  - For gas (~100 txs)                        │
│  ✓ $0 USDC    - Agent earns it!                            │
│                                                             │
├────────────────────────────────────────────────────────────┤
│  QUICK LINKS                                                │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Get ETH:     alchemy.com/faucets/base-sepolia             │
│  Alchemy RPC: alchemy.com/dashboard                        │
│  OpenAI Key:  platform.openai.com/api-keys                 │
│  Pinata JWT:  app.pinata.cloud/developers/api-keys         │
│                                                             │
└────────────────────────────────────────────────────────────┘
`;

  console.log(quickRef);

  // 9. Important reminders
  console.log('🔒 SECURITY REMINDERS:\n');
  console.log('   • Your private key is in .env file');
  console.log('   • .env is already in .gitignore');
  console.log('   • NEVER share or commit private keys');
  console.log('   • This is testnet only - use separate wallet for mainnet');
  console.log('   • Backup .env file securely\n');

  console.log('✅ Wallet generation complete!\n');
  console.log('🚀 Ready to fund and start your agent!\n');
}

// Run the generator
generateAgentWallet().catch((error) => {
  console.error('❌ Error generating wallet:', error);
  process.exit(1);
});

