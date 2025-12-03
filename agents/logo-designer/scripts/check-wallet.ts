/**
 * Check Agent Wallet Status
 * Displays current balance and readiness
 */

import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http, formatEther, formatUnits } from 'viem';
import { baseSepolia } from 'viem/chains';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkWalletStatus() {
  console.log('🔍 Checking Agent Wallet Status...\n');

  // Check if .env exists
  if (!process.env.PRIVATE_KEY) {
    console.log('❌ No wallet configured!');
    console.log('   Run: npm run generate-wallet\n');
    process.exit(1);
  }

  try {
    // Get account from private key
    const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 Agent Wallet');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`   Address: ${account.address}\n`);

    // Create client
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(process.env.BASE_SEPOLIA_RPC || 'https://sepolia.basescan.org/rpc'),
    });

    // Get ETH balance
    const ethBalance = await publicClient.getBalance({ address: account.address });
    const ethFormatted = formatEther(ethBalance);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💰 Balances');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`   ETH: ${ethFormatted} (Base Sepolia)`);

    // Get USDC balance if contract address is configured
    if (process.env.USDC_ADDRESS) {
      try {
        const usdcBalance = await publicClient.readContract({
          address: process.env.USDC_ADDRESS as `0x${string}`,
          abi: [
            {
              name: 'balanceOf',
              type: 'function',
              stateMutability: 'view',
              inputs: [{ name: 'account', type: 'address' }],
              outputs: [{ name: '', type: 'uint256' }],
            },
          ],
          functionName: 'balanceOf',
          args: [account.address],
        });

        const usdcFormatted = formatUnits(usdcBalance as bigint, 6);
        console.log(`   USDC: $${usdcFormatted}\n`);
      } catch (error) {
        console.log('   USDC: $0.00 (or error fetching)\n');
      }
    }

    // Check readiness
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✓ Readiness Check');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const checks = {
      wallet: true,
      eth: parseFloat(ethFormatted) >= 0.005,
      rpc: !!process.env.BASE_SEPOLIA_RPC,
      openrouter: !!process.env.OPENROUTER_API_KEY,
      pinata: !!process.env.PINATA_JWT,
      agentId: !!process.env.AGENT_ID,
    };

    console.log(`   ${checks.wallet ? '✅' : '❌'} Wallet configured`);
    console.log(`   ${checks.eth ? '✅' : '⚠️ '} ETH balance (need 0.005 ETH)`);
    console.log(`   ${checks.rpc ? '✅' : '❌'} RPC configured`);
    console.log(`   ${checks.openrouter ? '✅' : '❌'} OpenRouter API key`);
    console.log(`   ${checks.pinata ? '✅' : '❌'} Pinata JWT`);
    console.log(`   ${checks.agentId ? '✅' : '⚠️ '} Agent ID (register on ERC8004)\n`);

    const allReady = Object.values(checks).every((c) => c);

    if (allReady) {
      console.log('🎉 Agent is READY TO START!\n');
      console.log('   Run: npm run dev\n');
    } else {
      console.log('⚠️  Agent needs configuration\n');

      if (!checks.eth) {
        console.log('   → Fund wallet with ETH:');
        console.log('     https://www.alchemy.com/faucets/base-sepolia\n');
      }

      if (!checks.rpc) {
        console.log('   → Get Alchemy RPC key:');
        console.log('     https://alchemy.com/dashboard\n');
      }

      if (!checks.openrouter) {
        console.log('   → Get OpenRouter API key:');
        console.log('     https://openrouter.ai/keys\n');
      }

      if (!checks.pinata) {
        console.log('   → Get Pinata JWT:');
        console.log('     https://app.pinata.cloud/developers/api-keys\n');
      }

      if (!checks.agentId) {
        console.log('   → Register agent:');
        console.log('     Visit your app at /register\n');
      }
    }

    // Explorer link
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`   View on BaseScan:`);
    console.log(`   https://sepolia.basescan.org/address/${account.address}\n`);
  } catch (error) {
    console.error('❌ Error checking wallet:', error);
    process.exit(1);
  }
}

checkWalletStatus().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

