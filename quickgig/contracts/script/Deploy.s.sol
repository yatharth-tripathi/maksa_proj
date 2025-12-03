// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {GigEscrow} from "../src/GigEscrow.sol";
import {BountyEscrow} from "../src/BountyEscrow.sol";
import {ERC8004Registry} from "../src/ERC8004Registry.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {SimpleArbitrator} from "../src/SimpleArbitrator.sol";

/**
 * @title Deploy
 * @notice Deployment script for all QuickGig contracts on Base Sepolia
 * @dev Run with: forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
 */
contract Deploy is Script {
    // Deployment addresses will be logged and saved to .env.local
    GigEscrow public gigEscrow;
    BountyEscrow public bountyEscrow;
    ERC8004Registry public erc8004Registry;
    ReputationRegistry public reputationRegistry;
    SimpleArbitrator public simpleArbitrator;

    // Fee collector address (can be changed later by owner)
    address public feeCollector;

    // Verifier address for ERC-8004 (can be platform or external oracle)
    address public verifier;

    // Arbitrator addresses for SimpleArbitrator
    address public arbitrator1;
    address public arbitrator2;
    address public arbitrator3;

    function setUp() public {
        // Use deployer as initial fee collector and verifier
        feeCollector = vm.envAddress("DEPLOYER_ADDRESS");
        verifier = vm.envAddress("DEPLOYER_ADDRESS");

        // Load arbitrator addresses from environment
        arbitrator1 = vm.envAddress("ARBITRATOR_1");
        arbitrator2 = vm.envAddress("ARBITRATOR_2");
        arbitrator3 = vm.envAddress("ARBITRATOR_3");
    }

    function run() public {
        // Load private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        console.log("Deploying QuickGig contracts to Base Sepolia...");
        console.log("Deployer:", vm.addr(deployerPrivateKey));

        // 1. Deploy ReputationRegistry first (needed by escrows)
        console.log("\n1. Deploying ReputationRegistry...");
        reputationRegistry = new ReputationRegistry();
        console.log("   ReputationRegistry deployed at:", address(reputationRegistry));

        // 2. Deploy ERC8004Registry (for agent discovery)
        console.log("\n2. Deploying ERC8004Registry...");
        erc8004Registry = new ERC8004Registry(verifier);
        console.log("   ERC8004Registry deployed at:", address(erc8004Registry));

        // 3. Deploy SimpleArbitrator (needed by BountyEscrow)
        console.log("\n3. Deploying SimpleArbitrator...");
        simpleArbitrator = new SimpleArbitrator(arbitrator1, arbitrator2, arbitrator3);
        console.log("   SimpleArbitrator deployed at:", address(simpleArbitrator));

        // 4. Deploy GigEscrow
        console.log("\n4. Deploying GigEscrow...");
        gigEscrow = new GigEscrow(
            feeCollector,
            address(reputationRegistry),
            address(0), // UMA Escalation Manager (can be set later)
            address(0)  // UMA OptimisticOracleV3 (can be set later)
        );
        console.log("   GigEscrow deployed at:", address(gigEscrow));

        // 5. Deploy BountyEscrow with arbitrator (UMA addresses can be set later via admin functions)
        console.log("\n5. Deploying BountyEscrow...");
        bountyEscrow = new BountyEscrow(
            feeCollector,
            address(reputationRegistry),
            address(simpleArbitrator),
            address(0), // UMA Escalation Manager (can be set later)
            address(0)  // UMA OptimisticOracleV3 (can be set later)
        );
        console.log("   BountyEscrow deployed at:", address(bountyEscrow));

        // 6. Authorize escrow contracts in ReputationRegistry
        console.log("\n6. Authorizing escrow contracts in ReputationRegistry...");
        reputationRegistry.setEscrowAuthorization(address(gigEscrow), true);
        reputationRegistry.setEscrowAuthorization(address(bountyEscrow), true);
        console.log("   Escrow contracts authorized");

        vm.stopBroadcast();

        // Print deployment summary
        console.log("\n========================================");
        console.log("DEPLOYMENT SUMMARY");
        console.log("========================================");
        console.log("SimpleArbitrator:", address(simpleArbitrator));
        console.log("GigEscrow:", address(gigEscrow));
        console.log("BountyEscrow:", address(bountyEscrow));
        console.log("ERC8004Registry:", address(erc8004Registry));
        console.log("ReputationRegistry:", address(reputationRegistry));
        console.log("========================================");
        console.log("\nAdd these to your .env.local:");
        console.log("NEXT_PUBLIC_SIMPLE_ARBITRATOR_ADDRESS=", address(simpleArbitrator));
        console.log("NEXT_PUBLIC_GIG_ESCROW_ADDRESS=", address(gigEscrow));
        console.log("NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS=", address(bountyEscrow));
        console.log("NEXT_PUBLIC_ERC8004_REGISTRY_ADDRESS=", address(erc8004Registry));
        console.log("NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS=", address(reputationRegistry));
        console.log("========================================");
    }
}
