// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/BountyEscrow.sol";

/**
 * Update UMA contract addresses in BountyEscrow
 *
 * Usage:
 * forge script script/UpdateBountyUMA.s.sol --rpc-url base_sepolia --broadcast --legacy
 */
contract UpdateBountyUMA is Script {
    function run() external {
        // Get addresses from environment
        address bountyEscrow = vm.envAddress("NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS");
        address optimisticOracle = vm.envAddress("NEXT_PUBLIC_OPTIMISTIC_ORACLE_V3_ADDRESS");
        address umaEscalationManager = vm.envAddress("NEXT_PUBLIC_UMA_ESCALATION_MANAGER_ADDRESS");

        console.log("Updating BountyEscrow at:", bountyEscrow);
        console.log("OptimisticOracle:", optimisticOracle);
        console.log("UMAEscalationManager:", umaEscalationManager);

        vm.startBroadcast();

        BountyEscrow escrow = BountyEscrow(bountyEscrow);

        // Update Optimistic Oracle
        escrow.updateOptimisticOracle(optimisticOracle);
        console.log("Updated OptimisticOracle");

        // Update UMA Escalation Manager
        escrow.updateUMAEscalationManager(umaEscalationManager);
        console.log("Updated UMAEscalationManager");

        vm.stopBroadcast();

        console.log("\nUMA contracts updated successfully!");
    }
}
