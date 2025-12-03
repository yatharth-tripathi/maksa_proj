// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/QuickGigEscalationManager.sol";

contract UpdateEscalationManager is Script {
    function run() external {
        address escalationManager = vm.envAddress("NEXT_PUBLIC_UMA_ESCALATION_MANAGER_ADDRESS");
        address bountyEscrow = vm.envAddress("NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS");

        console.log("Updating Escalation Manager at:", escalationManager);
        console.log("Setting BountyEscrow to:", bountyEscrow);

        vm.startBroadcast();

        QuickGigEscalationManager manager = QuickGigEscalationManager(escalationManager);
        manager.updateBountyEscrow(bountyEscrow);

        console.log("Updated successfully!");

        vm.stopBroadcast();
    }
}
