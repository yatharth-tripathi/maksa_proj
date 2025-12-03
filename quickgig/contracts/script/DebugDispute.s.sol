// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/BountyEscrow.sol";

contract DebugDispute is Script {
    function run() external view {
        address bountyEscrowAddr = 0x07e1c8aCa82244eDa18D46e54856Bd797307211C;
        BountyEscrow escrow = BountyEscrow(bountyEscrowAddr);

        uint256 bountyId = 3;

        // Get bounty details
        BountyEscrow.Bounty memory bounty = escrow.getBounty(bountyId);

        console.log("=== Bounty 3 Debug Info ===");
        console.log("Client:", bounty.client);
        console.log("Payment Token:", bounty.paymentToken);
        console.log("Status:", uint256(bounty.status));
        console.log("Use UMA Arbitration:", bounty.useUMAArbitration);
        console.log("Assigned Worker:", bounty.assignedWorker);
        console.log("Escrow Amount:", bounty.escrowAmount);

        console.log("\n=== Contract Configuration ===");
        console.log("Optimistic Oracle:", escrow.optimisticOracle());
        console.log("UMA Escalation Manager:", escrow.umaEscalationManager());

        // Check if conditions for dispute are met
        console.log("\n=== Dispute Checks ===");
        bool statusOk = bounty.status == BountyEscrow.BountyStatus.Submitted;
        console.log("Status is Submitted:", statusOk);
        console.log("Uses UMA:", bounty.useUMAArbitration);
        console.log("Oracle configured:", escrow.optimisticOracle() != address(0));
        console.log("Escalation Manager configured:", escrow.umaEscalationManager() != address(0));
    }
}
