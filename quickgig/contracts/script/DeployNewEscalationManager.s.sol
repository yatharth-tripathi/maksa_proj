// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/QuickGigEscalationManager.sol";

contract DeployNewEscalationManager is Script {
    function run() external {
        address optimisticOracle = vm.envAddress("NEXT_PUBLIC_OPTIMISTIC_ORACLE_V3_ADDRESS");
        address bountyEscrow = vm.envAddress("NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS");

        console.log("Deploying new QuickGigEscalationManager...");
        console.log("OptimisticOracle:", optimisticOracle);
        console.log("BountyEscrow:", bountyEscrow);

        vm.startBroadcast();

        QuickGigEscalationManager manager = new QuickGigEscalationManager(
            bountyEscrow,
            optimisticOracle,
            10000000, // 10 USDC bond
            7200      // 2 hours liveness (testnet)
        );

        console.log("New Escalation Manager deployed at:", address(manager));

        vm.stopBroadcast();

        console.log("\nNext steps:");
        console.log("1. Update .env with new address:");
        console.log("   NEXT_PUBLIC_UMA_ESCALATION_MANAGER_ADDRESS=", vm.toString(address(manager)));
        console.log("2. Update BountyEscrow to point to new manager");
        console.log("   Run: cast send", vm.toString(bountyEscrow), '"updateUMAEscalationManager(address)"', vm.toString(address(manager)));
    }
}
