// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {BountyEscrow} from "../src/BountyEscrow.sol";

contract RedeployBountyEscrow is Script {
    // Existing addresses from .env (checksummed)
    address constant FEE_COLLECTOR = 0xd532763b8d4C3ECb8c10093c56A4E20d7C6Cb2fc;
    address constant REPUTATION_REGISTRY = 0x7866bFaFaf7c9C2935d47c6c61bf30D0A6f6e8Ba;
    address constant SIMPLE_ARBITRATOR = 0xA24AB1A64b65f3ffaa1F4cD44D9A34f69A0A6C96;
    address constant UMA_ESCALATION_MANAGER = 0x583Ad61644C7a82920F584Cfd4512612F62FD12a;
    address constant OPTIMISTIC_ORACLE_V3 = 0x0F7fC5E6482f096380db6158f978167b57388deE;

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console.log("Redeploying BountyEscrow with fixed callback...");
        console.log("Fee Collector:", FEE_COLLECTOR);
        console.log("UMA Escalation Manager:", UMA_ESCALATION_MANAGER);
        console.log("Optimistic Oracle V3:", OPTIMISTIC_ORACLE_V3);

        vm.startBroadcast(deployerPrivateKey);

        BountyEscrow bountyEscrow = new BountyEscrow(
            FEE_COLLECTOR,
            REPUTATION_REGISTRY,
            SIMPLE_ARBITRATOR,
            UMA_ESCALATION_MANAGER,
            OPTIMISTIC_ORACLE_V3
        );

        console.log("\n=== DEPLOYMENT SUCCESSFUL ===");
        console.log("NEW BountyEscrow:", address(bountyEscrow));
        console.log("\nUpdate your .env.local:");
        console.log("NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS=%s", address(bountyEscrow));

        vm.stopBroadcast();
    }
}
