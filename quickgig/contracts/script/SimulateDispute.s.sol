// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/BountyEscrow.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SimulateDispute is Script {
    function run() external {
        address bountyEscrowAddr = 0x07e1c8aCa82244eDa18D46e54856Bd797307211C;
        address usdcAddr = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
        address userAddr = 0xd532763b8d4C3ECb8c10093c56A4E20d7C6Cb2fc;

        BountyEscrow escrow = BountyEscrow(bountyEscrowAddr);
        IERC20 usdc = IERC20(usdcAddr);

        uint256 bountyId = 3;
        uint256 bond = 10000000; // 10 USDC

        console.log("=== Pre-flight Checks ===");
        console.log("User USDC Balance:", usdc.balanceOf(userAddr));
        console.log("User USDC Allowance to Escrow:", usdc.allowance(userAddr, bountyEscrowAddr));
        console.log("User ETH Balance:", userAddr.balance);

        BountyEscrow.Bounty memory bounty = escrow.getBounty(bountyId);
        console.log("Bounty Client:", bounty.client);
        console.log("Calling as:", userAddr);
        console.log("Match?:", bounty.client == userAddr);

        // Try to call the function
        vm.startPrank(userAddr);

        try escrow.disputeDeliverableWithUMA(
            bountyId,
            "Test dispute claim",
            "ipfs://evidence",
            bond
        ) {
            console.log("SUCCESS: Dispute created");
        } catch Error(string memory reason) {
            console.log("REVERT with reason:", reason);
        } catch (bytes memory lowLevelData) {
            console.log("REVERT with low level data:");
            console.logBytes(lowLevelData);
        }

        vm.stopPrank();
    }
}
