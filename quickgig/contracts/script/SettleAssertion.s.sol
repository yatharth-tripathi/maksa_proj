// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

interface IOptimisticOracleV3 {
    function settleAndGetAssertionResult(bytes32 assertionId) external returns (bool);
    
    function getAssertion(bytes32 assertionId)
        external
        view
        returns (
            bool escalationManagerRefunded,
            bool settled,
            address asserter,
            address callbackRecipient,
            address escalationManager,
            address caller,
            uint64 expirationTime,
            address currency,
            uint256 bond,
            bytes32 identifier,
            bytes32 domainId
        );
}

contract SettleAssertion is Script {
    function run() external {
        bytes32 assertionId = 0xf4f13afd2c55c100fcd1ab117cc6ec2e56aab3e9265bc0c73aa29886cdce4722;
        address oracle = 0x0F7fC5E6482f096380db6158f978167b57388deE;

        IOptimisticOracleV3 oo = IOptimisticOracleV3(oracle);

        // Check assertion state
        (
            bool escalationManagerRefunded,
            bool settled,
            ,
            ,
            ,
            ,
            uint64 expirationTime,
            ,
            ,
            ,
        ) = oo.getAssertion(assertionId);

        console.log("Assertion ID:", vm.toString(assertionId));
        console.log("Settled:", settled);
        console.log("Escalation Manager Refunded:", escalationManagerRefunded);
        console.log("Expiration Time:", expirationTime);
        console.log("Current Time:", block.timestamp);
        console.log("Expired:", block.timestamp >= expirationTime);

        if (settled) {
            console.log("Already settled!");
            return;
        }

        if (block.timestamp < expirationTime) {
            console.log("Not expired yet! Wait", expirationTime - block.timestamp, "seconds");
            return;
        }

        // Try to settle
        vm.startBroadcast();
        try oo.settleAndGetAssertionResult(assertionId) returns (bool result) {
            console.log("Settlement successful! Result:", result);
        } catch Error(string memory reason) {
            console.log("Settlement failed:", reason);
        } catch (bytes memory lowLevelData) {
            console.log("Settlement failed with low level error:");
            console.logBytes(lowLevelData);
        }
        vm.stopBroadcast();
    }
}
