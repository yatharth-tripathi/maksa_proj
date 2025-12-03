// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {QuickGigEscalationManager} from "../src/QuickGigEscalationManager.sol";

/**
 * @title DeployEscalationManager
 * @notice Deployment script for QuickGigEscalationManager on Base Sepolia
 * @dev Run with: forge script script/DeployEscalationManager.s.sol --rpc-url base_sepolia --broadcast --verify
 *
 * Environment Variables Required:
 * - PRIVATE_KEY: Deployer's private key
 * - NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS: BountyEscrow contract address
 *
 * Optional Environment Variables:
 * - UMA_LIVENESS_PERIOD: Challenge period in seconds (default: 7200 = 2 hours)
 * - UMA_DEFAULT_BOND: Bond amount in USDC wei (default: 10000000 = 10 USDC)
 */
contract DeployEscalationManager is Script {
    QuickGigEscalationManager public escalationManager;

    // UMA OOv3 address on Base Sepolia
    address public constant OPTIMISTIC_ORACLE_V3 = 0x0F7fC5E6482f096380db6158f978167b57388deE;

    // Default configuration
    uint256 public constant DEFAULT_BOND = 10_000_000; // 10 USDC (6 decimals)
    uint64 public constant DEFAULT_LIVENESS = 7200; // 2 hours (for testing)

    // Loaded from environment
    address public bountyEscrow;
    uint256 public bondAmount;
    uint64 public liveness;

    function setUp() public {
        // Load BountyEscrow address from environment
        bountyEscrow = vm.envAddress("NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS");
        require(bountyEscrow != address(0), "BOUNTY_ESCROW cannot be zero address");

        // Load optional configuration with defaults
        bondAmount = vm.envOr("UMA_DEFAULT_BOND", DEFAULT_BOND);
        liveness = uint64(vm.envOr("UMA_LIVENESS_PERIOD", uint256(DEFAULT_LIVENESS)));

        // Validate configuration
        require(bondAmount > 0, "Bond amount must be greater than zero");
        require(liveness >= 3600, "Liveness must be at least 1 hour");

        console.log("Configuration validated:");
        console.log("  BountyEscrow:", bountyEscrow);
        console.log("  OptimisticOracleV3:", OPTIMISTIC_ORACLE_V3);
        console.log("  Default Bond (wei):", bondAmount);
        console.log("  Liveness Period (seconds):", liveness);
    }

    function run() public {
        // Load private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        console.log("\nDeploying QuickGigEscalationManager to Base Sepolia...");
        console.log("Deployer:", deployer);

        // Deploy QuickGigEscalationManager
        escalationManager = new QuickGigEscalationManager(
            bountyEscrow,
            OPTIMISTIC_ORACLE_V3,
            bondAmount,
            liveness
        );

        console.log("QuickGigEscalationManager deployed at:", address(escalationManager));

        vm.stopBroadcast();

        // Print deployment summary
        console.log("\n========================================");
        console.log("DEPLOYMENT SUMMARY");
        console.log("========================================");
        console.log("QuickGigEscalationManager:", address(escalationManager));
        console.log("Owner:", deployer);
        console.log("BountyEscrow:", bountyEscrow);
        console.log("OptimisticOracleV3:", OPTIMISTIC_ORACLE_V3);
        console.log("Default Bond (wei):", bondAmount);
        console.log("Default Bond (USDC):", bondAmount / 1_000_000);
        console.log("Liveness Period (seconds):", liveness);
        console.log("Liveness Period (hours):", liveness / 3600);
        console.log("========================================");
        console.log("\nAdd this to your .env.local:");
        console.log("NEXT_PUBLIC_UMA_ESCALATION_MANAGER_ADDRESS=", address(escalationManager));
        console.log("========================================");
        console.log("\nNEXT STEPS:");
        console.log("1. Update BountyEscrow to integrate with this Escalation Manager");
        console.log("2. Update lib/contracts/addresses.ts with the new address");
        console.log("3. Deploy upgraded BountyEscrow contract with UMA support");
        console.log("========================================");
    }
}
