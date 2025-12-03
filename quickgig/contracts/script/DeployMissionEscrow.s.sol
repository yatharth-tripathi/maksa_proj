// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {MissionEscrow} from "../src/MissionEscrow.sol";

/**
 * @title DeployMissionEscrow
 * @notice Deployment script for MissionEscrow on Base Sepolia
 * @dev Run with: forge script script/DeployMissionEscrow.s.sol --rpc-url base_sepolia --broadcast --verify
 *
 * Environment Variables Required:
 * - PRIVATE_KEY: Deployer's private key
 * - NEXT_PUBLIC_FEE_COLLECTOR_ADDRESS: Platform fee collector address
 *
 * Optional Environment Variables:
 * - NEXT_PUBLIC_OPTIMISTIC_ORACLE_V3_ADDRESS: UMA Optimistic Oracle V3 address
 * - NEXT_PUBLIC_UMA_ESCALATION_MANAGER_ADDRESS: UMA Escalation Manager address
 * - ERC8004_VALIDATION_REGISTRY_ADDRESS: ERC-8004 Validation Registry address
 */
contract DeployMissionEscrow is Script {
    MissionEscrow public missionEscrow;

    // UMA OOv3 address on Base Sepolia
    address public constant OPTIMISTIC_ORACLE_V3 = 0x0F7fC5E6482f096380db6158f978167b57388deE;

    // ERC-8004 Validation Registry on Base Sepolia (if deployed)
    address public constant VALIDATION_REGISTRY = 0x8004C269D0A5647E51E121FeB226200ECE932d55;

    // Loaded from environment
    address public feeCollector;
    address public optimisticOracle;
    address public escalationManager;
    address public validationRegistry;

    function setUp() public {
        // Load fee collector address from environment
        feeCollector = vm.envAddress("NEXT_PUBLIC_FEE_COLLECTOR_ADDRESS");
        require(feeCollector != address(0), "FEE_COLLECTOR cannot be zero address");

        // Load optional addresses with defaults
        optimisticOracle = vm.envOr(
            "NEXT_PUBLIC_OPTIMISTIC_ORACLE_V3_ADDRESS",
            OPTIMISTIC_ORACLE_V3
        );

        escalationManager = vm.envOr(
            "NEXT_PUBLIC_UMA_ESCALATION_MANAGER_ADDRESS",
            address(0)
        );

        validationRegistry = vm.envOr(
            "ERC8004_VALIDATION_REGISTRY_ADDRESS",
            VALIDATION_REGISTRY
        );

        console.log("Configuration validated:");
        console.log("  Fee Collector:", feeCollector);
        console.log("  Optimistic Oracle V3:", optimisticOracle);
        console.log("  Escalation Manager:", escalationManager);
        console.log("  Validation Registry:", validationRegistry);
    }

    function run() public {
        // Load private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        console.log("\nDeploying MissionEscrow to Base Sepolia...");
        console.log("Deployer:", deployer);

        // Deploy MissionEscrow
        missionEscrow = new MissionEscrow(
            feeCollector,
            optimisticOracle,
            escalationManager,
            validationRegistry
        );

        console.log("MissionEscrow deployed at:", address(missionEscrow));

        vm.stopBroadcast();

        // Print deployment summary
        console.log("\n========================================");
        console.log("DEPLOYMENT SUMMARY");
        console.log("========================================");
        console.log("Contract: MissionEscrow");
        console.log("Address:", address(missionEscrow));
        console.log("Network: Base Sepolia (chainId: 84532)");
        console.log("Deployer:", deployer);
        console.log("Fee Collector:", feeCollector);
        console.log("Optimistic Oracle:", optimisticOracle);
        console.log("Escalation Manager:", escalationManager);
        console.log("Validation Registry:", validationRegistry);
        console.log("Platform Fee: 2.5%");
        console.log("Auto-Release Window: 48 hours");
        console.log("========================================");
        console.log("\nNext steps:");
        console.log("1. Add NEXT_PUBLIC_MISSION_ESCROW_ADDRESS to .env.local");
        console.log("2. Update lib/contracts/addresses.ts");
        console.log("3. Generate ABI: forge inspect MissionEscrow abi > lib/contracts/abis/MissionEscrow.json");
        console.log("4. Verify contract on BaseScan");
        console.log("\nVerify command:");
        console.log("forge verify-contract", address(missionEscrow), "MissionEscrow --chain base-sepolia");
        console.log("========================================\n");
    }
}
