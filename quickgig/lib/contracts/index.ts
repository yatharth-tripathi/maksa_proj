/**
 * Contract Hooks & Exports
 * Central export point for all contract interactions
 */

export * from './addresses';
export * from './gigEscrow';
export * from './bountyEscrow';
export * from './simpleArbitrator';
export * from './erc20';
export * from './transactions'; // OnchainKit transaction builders

// Export ABIs
export { default as GigEscrowABI } from './abis/GigEscrow.json';
export { default as BountyEscrowABI } from './abis/BountyEscrow.json';
export { default as SimpleArbitratorABI } from './abis/SimpleArbitrator.json';
export { default as ERC8004RegistryABI } from './abis/ERC8004Registry.json';
export { default as ReputationRegistryABI } from './abis/ReputationRegistry.json';
