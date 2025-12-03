// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {SimpleArbitrator} from "../src/SimpleArbitrator.sol";

/**
 * @title DeployArbitrator
 * @notice Deployment script for SimpleArbitrator on Base Sepolia
 * @dev Run with: forge script script/DeployArbitrator.s.sol --rpc-url base_sepolia --broadcast --verify
 *
 * Environment Variables Required:
 * - PRIVATE_KEY: Deployer's private key
 * - ARBITRATOR_1: First trusted arbitrator address
 * - ARBITRATOR_2: Second trusted arbitrator address
 * - ARBITRATOR_3: Third trusted arbitrator address
 */
contract DeployArbitrator is Script {
    SimpleArbitrator public simpleArbitrator;

    // Arbitrator addresses (loaded from environment)
    address public arbitrator1;
    address public arbitrator2;
    address public arbitrator3;

    function setUp() public {
        // Load arbitrator addresses from environment
        arbitrator1 = vm.envAddress("ARBITRATOR_1");
        arbitrator2 = vm.envAddress("ARBITRATOR_2");
        arbitrator3 = vm.envAddress("ARBITRATOR_3");

        // Validate addresses
        require(arbitrator1 != address(0), "ARBITRATOR_1 cannot be zero address");
        require(arbitrator2 != address(0), "ARBITRATOR_2 cannot be zero address");
        require(arbitrator3 != address(0), "ARBITRATOR_3 cannot be zero address");
        require(arbitrator1 != arbitrator2, "Arbitrators must be unique");
        require(arbitrator1 != arbitrator3, "Arbitrators must be unique");
        require(arbitrator2 != arbitrator3, "Arbitrators must be unique");

        console.log("Arbitrator addresses validated:");
        console.log("  Arbitrator 1:", arbitrator1);
        console.log("  Arbitrator 2:", arbitrator2);
        console.log("  Arbitrator 3:", arbitrator3);
    }

    function run() public {
        // Load private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        console.log("\nDeploying SimpleArbitrator to Base Sepolia...");
        console.log("Deployer:", vm.addr(deployerPrivateKey));

        // Deploy SimpleArbitrator with 3 trusted arbitrators
        simpleArbitrator = new SimpleArbitrator(
            arbitrator1,
            arbitrator2,
            arbitrator3
        );

        console.log("SimpleArbitrator deployed at:", address(simpleArbitrator));

        vm.stopBroadcast();

        // Print deployment summary
        console.log("\n========================================");
        console.log("DEPLOYMENT SUMMARY");
        console.log("========================================");
        console.log("SimpleArbitrator:", address(simpleArbitrator));
        console.log("Owner:", vm.addr(deployerPrivateKey));
        console.log("Arbitrator 1:", arbitrator1);
        console.log("Arbitrator 2:", arbitrator2);
        console.log("Arbitrator 3:", arbitrator3);
        console.log("========================================");
        console.log("\nAdd this to your .env.local:");
        console.log("NEXT_PUBLIC_SIMPLE_ARBITRATOR_ADDRESS=", address(simpleArbitrator));
        console.log("========================================");
        console.log("\nNOTE: Update BountyEscrow deployment to use this arbitrator address");
    }
}
