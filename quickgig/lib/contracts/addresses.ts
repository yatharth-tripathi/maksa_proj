/**
 * Contract addresses for all deployed smart contracts
 * Automatically loads from environment variables
 */

export const CONTRACTS = {
  GIG_ESCROW: process.env.NEXT_PUBLIC_GIG_ESCROW_ADDRESS as `0x${string}`,
  BOUNTY_ESCROW: process.env.NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS as `0x${string}`,
  ERC8004_REGISTRY: process.env.NEXT_PUBLIC_ERC8004_REGISTRY_ADDRESS as `0x${string}`,
  REPUTATION_REGISTRY: process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS as `0x${string}`,
  SIMPLE_ARBITRATOR: process.env.NEXT_PUBLIC_SIMPLE_ARBITRATOR_ADDRESS as `0x${string}`,
  USDC: process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`,

  // UMA Optimistic Oracle V3 Integration
  UMA_ESCALATION_MANAGER: process.env.NEXT_PUBLIC_UMA_ESCALATION_MANAGER_ADDRESS as `0x${string}`,
  OPTIMISTIC_ORACLE_V3: process.env.NEXT_PUBLIC_OPTIMISTIC_ORACLE_V3_ADDRESS as `0x${string}`,
} as const;

// Validate that all addresses are defined
if (typeof window !== 'undefined') {
  const missing = Object.entries(CONTRACTS).filter(([, addr]) => !addr);
  if (missing.length > 0) {
    console.warn(
      '[Contract Addresses] Missing environment variables:',
      missing.map(([key]) => key).join(', ')
    );
  }
}

export default CONTRACTS;
