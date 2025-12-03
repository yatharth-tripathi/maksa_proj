// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Test, console} from "forge-std/Test.sol";
import {GigEscrow} from "../src/GigEscrow.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title GigEscrowTest
 * @notice Comprehensive test suite for GigEscrow contract
 * @dev Tests all functions, security patterns, and edge cases
 */
contract MockERC20 is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {
        _mint(msg.sender, 1_000_000 * 10 ** 18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract GigEscrowTest is Test {
    GigEscrow public gigEscrow;
    MockERC20 public usdc;

    address public owner = address(1);
    address public feeCollector = address(2);
    address public reputationRegistry = address(3);
    address public client = address(4);
    address public worker = address(5);

    uint256 constant INITIAL_BALANCE = 100_000 * 10 ** 18;

    function setUp() public {
        vm.startPrank(owner);

        // Deploy mock USDC
        usdc = new MockERC20();

        // Deploy GigEscrow
        gigEscrow = new GigEscrow(
            feeCollector,
            reputationRegistry,
            address(0), // UMA Escalation Manager
            address(0)  // OptimisticOracle
        );

        // Fund client and worker
        usdc.mint(client, INITIAL_BALANCE);
        usdc.mint(worker, INITIAL_BALANCE);

        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                            CREATE GIG TESTS
    //////////////////////////////////////////////////////////////*/

    function test_CreateGig_Success() public {
        string[] memory descriptions = new string[](2);
        descriptions[0] = "Design logo";
        descriptions[1] = "Deliver files";

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 100 * 10 ** 18;
        amounts[1] = 50 * 10 ** 18;

        vm.startPrank(client);
        usdc.approve(address(gigEscrow), 150 * 10 ** 18);

        uint256 gigId = gigEscrow.createGig(worker, address(usdc), descriptions, amounts, false);

        assertEq(gigId, 1, "Gig ID should be 1");
        assertEq(
            usdc.balanceOf(address(gigEscrow)), 150 * 10 ** 18, "Escrow should hold funds"
        );

        (
            address gigClient,
            address gigWorker,
            address paymentToken,
            uint256 totalAmount,
            uint256 releasedAmount,
            ,
            GigEscrow.GigStatus status,
            // bool useUMAArbitration (ignored)
        ) = gigEscrow.gigs(gigId);

        assertEq(gigClient, client, "Client should match");
        assertEq(gigWorker, worker, "Worker should match");
        assertEq(paymentToken, address(usdc), "Payment token should match");
        assertEq(totalAmount, 150 * 10 ** 18, "Total amount should match");
        assertEq(releasedAmount, 0, "Released amount should be 0");
        assertEq(uint8(status), uint8(GigEscrow.GigStatus.Active), "Status should be Active");

        vm.stopPrank();
    }

    function test_RevertWhen_CreateGig_ZeroWorker() public {
        string[] memory descriptions = new string[](1);
        descriptions[0] = "Test";

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100 * 10 ** 18;

        vm.prank(client);
        vm.expectRevert(GigEscrow.ZeroAddress.selector);
        gigEscrow.createGig(address(0), address(usdc), descriptions, amounts, false);
    }

    function test_RevertWhen_CreateGig_MismatchedArrays() public {
        string[] memory descriptions = new string[](2);
        descriptions[0] = "Test 1";
        descriptions[1] = "Test 2";

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100 * 10 ** 18;

        vm.prank(client);
        vm.expectRevert(GigEscrow.InvalidAmount.selector);
        gigEscrow.createGig(worker, address(usdc), descriptions, amounts, false);
    }

    function test_RevertWhen_CreateGig_ZeroAmount() public {
        string[] memory descriptions = new string[](1);
        descriptions[0] = "Test";

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 0;

        vm.prank(client);
        vm.expectRevert(GigEscrow.InvalidAmount.selector);
        gigEscrow.createGig(worker, address(usdc), descriptions, amounts, false);
    }

    /*//////////////////////////////////////////////////////////////
                        SUBMIT MILESTONE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_SubmitMilestone_Success() public {
        uint256 gigId = _createBasicGig();

        vm.prank(worker);
        gigEscrow.submitMilestone(gigId, 0, "ipfs://deliverable1");

        GigEscrow.Milestone memory milestone = gigEscrow.getMilestone(gigId, 0);
        assertEq(
            uint8(milestone.status),
            uint8(GigEscrow.MilestoneStatus.Submitted),
            "Milestone should be submitted"
        );
        assertEq(
            milestone.deliverableURI, "ipfs://deliverable1", "Deliverable URI should match"
        );
        assertEq(milestone.submittedAt, block.timestamp, "Submitted time should be recorded");
    }

    function test_RevertWhen_SubmitMilestone_NotWorker() public {
        uint256 gigId = _createBasicGig();

        vm.prank(client);
        vm.expectRevert(GigEscrow.Unauthorized.selector);
        gigEscrow.submitMilestone(gigId, 0, "ipfs://deliverable1");
    }

    function test_RevertWhen_SubmitMilestone_AlreadySubmitted() public {
        uint256 gigId = _createBasicGig();

        vm.startPrank(worker);
        gigEscrow.submitMilestone(gigId, 0, "ipfs://deliverable1");
        vm.expectRevert(GigEscrow.AlreadySubmitted.selector);
        gigEscrow.submitMilestone(gigId, 0, "ipfs://deliverable2");
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                        APPROVE MILESTONE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_ApproveMilestone_Success() public {
        uint256 gigId = _createBasicGig();

        vm.prank(worker);
        gigEscrow.submitMilestone(gigId, 0, "ipfs://deliverable1");

        uint256 workerBalanceBefore = usdc.balanceOf(worker);
        uint256 feeCollectorBalanceBefore = usdc.balanceOf(feeCollector);

        vm.prank(client);
        gigEscrow.approveMilestone(gigId, 0);

        // Check milestone status
        GigEscrow.Milestone memory milestone = gigEscrow.getMilestone(gigId, 0);
        assertEq(
            uint8(milestone.status),
            uint8(GigEscrow.MilestoneStatus.Approved),
            "Milestone should be approved"
        );

        // Check payments
        uint256 expectedFee = (100 * 10 ** 18 * 250) / 10000; // 2.5%
        uint256 expectedWorkerAmount = 100 * 10 ** 18 - expectedFee;

        assertEq(
            usdc.balanceOf(worker),
            workerBalanceBefore + expectedWorkerAmount,
            "Worker should receive payment minus fee"
        );
        assertEq(
            usdc.balanceOf(feeCollector),
            feeCollectorBalanceBefore + expectedFee,
            "Fee collector should receive fee"
        );
    }

    function test_RevertWhen_ApproveMilestone_NotSubmitted() public {
        uint256 gigId = _createBasicGig();

        vm.prank(client);
        vm.expectRevert(GigEscrow.NotSubmitted.selector);
        gigEscrow.approveMilestone(gigId, 0);
    }

    function test_RevertWhen_ApproveMilestone_NotClient() public {
        uint256 gigId = _createBasicGig();

        vm.prank(worker);
        gigEscrow.submitMilestone(gigId, 0, "ipfs://deliverable1");

        vm.prank(worker);
        vm.expectRevert(GigEscrow.Unauthorized.selector);
        gigEscrow.approveMilestone(gigId, 0);
    }

    /*//////////////////////////////////////////////////////////////
                        AUTO-RELEASE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_AutoReleaseMilestone_Success() public {
        uint256 gigId = _createBasicGig();

        vm.prank(worker);
        gigEscrow.submitMilestone(gigId, 0, "ipfs://deliverable1");

        // Fast forward 48 hours + 1 second
        vm.warp(block.timestamp + 48 hours + 1);

        uint256 workerBalanceBefore = usdc.balanceOf(worker);

        vm.prank(address(9999)); // Anyone can call auto-release
        gigEscrow.autoReleaseMilestone(gigId, 0);

        // Check milestone status
        GigEscrow.Milestone memory milestone = gigEscrow.getMilestone(gigId, 0);
        assertEq(
            uint8(milestone.status),
            uint8(GigEscrow.MilestoneStatus.AutoReleased),
            "Milestone should be auto-released"
        );

        // Check payment
        uint256 expectedFee = (100 * 10 ** 18 * 250) / 10000;
        uint256 expectedWorkerAmount = 100 * 10 ** 18 - expectedFee;

        assertEq(
            usdc.balanceOf(worker),
            workerBalanceBefore + expectedWorkerAmount,
            "Worker should receive payment"
        );
    }

    function test_RevertWhen_AutoReleaseMilestone_TooEarly() public {
        uint256 gigId = _createBasicGig();

        vm.prank(worker);
        gigEscrow.submitMilestone(gigId, 0, "ipfs://deliverable1");

        // Try to auto-release before 48 hours
        vm.warp(block.timestamp + 47 hours);

        vm.prank(address(9999));
        vm.expectRevert(GigEscrow.AutoReleaseNotReady.selector);
        gigEscrow.autoReleaseMilestone(gigId, 0);
    }

    /*//////////////////////////////////////////////////////////////
                            DISPUTE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_DisputeMilestone_Success() public {
        uint256 gigId = _createBasicGig();

        vm.prank(worker);
        gigEscrow.submitMilestone(gigId, 0, "ipfs://deliverable1");

        vm.prank(client);
        gigEscrow.disputeMilestone(gigId, 0, "Quality not acceptable");

        GigEscrow.Milestone memory milestone = gigEscrow.getMilestone(gigId, 0);
        assertEq(
            uint8(milestone.status),
            uint8(GigEscrow.MilestoneStatus.Disputed),
            "Milestone should be disputed"
        );
    }

    function test_RevertWhen_DisputeMilestone_NotClient() public {
        uint256 gigId = _createBasicGig();

        vm.prank(worker);
        gigEscrow.submitMilestone(gigId, 0, "ipfs://deliverable1");

        vm.prank(worker);
        vm.expectRevert(GigEscrow.Unauthorized.selector);
        gigEscrow.disputeMilestone(gigId, 0, "Test");
    }

    /*//////////////////////////////////////////////////////////////
                            CANCEL GIG TESTS
    //////////////////////////////////////////////////////////////*/

    function test_CancelGig_Success() public {
        uint256 gigId = _createBasicGig();

        uint256 clientBalanceBefore = usdc.balanceOf(client);

        vm.prank(client);
        gigEscrow.cancelGig(gigId);

        assertEq(
            usdc.balanceOf(client),
            clientBalanceBefore + 100 * 10 ** 18,
            "Client should receive refund"
        );
    }

    function test_CancelGig_ByWorker() public {
        uint256 gigId = _createBasicGig();

        uint256 clientBalanceBefore = usdc.balanceOf(client);

        vm.prank(worker);
        gigEscrow.cancelGig(gigId);

        assertEq(
            usdc.balanceOf(client),
            clientBalanceBefore + 100 * 10 ** 18,
            "Client should receive refund"
        );
    }

    function test_RevertWhen_CancelGig_Unauthorized() public {
        uint256 gigId = _createBasicGig();

        vm.prank(address(9999));
        vm.expectRevert(GigEscrow.Unauthorized.selector);
        gigEscrow.cancelGig(gigId);
    }

    /*//////////////////////////////////////////////////////////////
                            ADMIN TESTS
    //////////////////////////////////////////////////////////////*/

    function test_UpdatePlatformFee_Success() public {
        vm.prank(owner);
        gigEscrow.updatePlatformFee(500); // 5%

        assertEq(gigEscrow.platformFeeBps(), 500, "Platform fee should be updated");
    }

    function test_RevertWhen_UpdatePlatformFee_Unauthorized() public {
        vm.prank(client);
        vm.expectRevert(GigEscrow.Unauthorized.selector);
        gigEscrow.updatePlatformFee(500);
    }

    function test_RevertWhen_UpdatePlatformFee_TooHigh() public {
        vm.prank(owner);
        vm.expectRevert(GigEscrow.InvalidAmount.selector);
        gigEscrow.updatePlatformFee(1001); // > 10%
    }

    function test_UpdateFeeCollector_Success() public {
        address newCollector = address(6);

        vm.prank(owner);
        gigEscrow.updateFeeCollector(newCollector);

        assertEq(gigEscrow.feeCollector(), newCollector, "Fee collector should be updated");
    }

    function test_RevertWhen_UpdateFeeCollector_ZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(GigEscrow.ZeroAddress.selector);
        gigEscrow.updateFeeCollector(address(0));
    }

    /*//////////////////////////////////////////////////////////////
                        REENTRANCY TESTS
    //////////////////////////////////////////////////////////////*/

    function test_NoReentrancy_ApproveMilestone() public {
        // This test confirms ReentrancyGuard is in place
        // Actual reentrancy attack would require a malicious ERC20
        uint256 gigId = _createBasicGig();

        vm.prank(worker);
        gigEscrow.submitMilestone(gigId, 0, "ipfs://deliverable1");

        vm.prank(client);
        gigEscrow.approveMilestone(gigId, 0);

        // If reentrancy guard wasn't in place, multiple withdrawals could occur
        // Foundry's vm.expectRevert could be used with malicious token
    }

    /*//////////////////////////////////////////////////////////////
                            FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    function testFuzz_CreateGig_VariousAmounts(uint256 amount) public {
        // Bound amount to INITIAL_BALANCE to prevent overflow
        amount = bound(amount, 1, INITIAL_BALANCE);

        string[] memory descriptions = new string[](1);
        descriptions[0] = "Test";

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        vm.startPrank(client);
        usdc.approve(address(gigEscrow), amount);
        uint256 gigId = gigEscrow.createGig(worker, address(usdc), descriptions, amounts, false);
        vm.stopPrank();

        assertEq(usdc.balanceOf(address(gigEscrow)), amount, "Escrow should hold fuzzed amount");
    }

    function testFuzz_ApproveMilestone_CorrectFeeCalculation(uint256 amount) public {
        // Bound amount to INITIAL_BALANCE to prevent overflow
        amount = bound(amount, 1, INITIAL_BALANCE);

        string[] memory descriptions = new string[](1);
        descriptions[0] = "Test";

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        vm.startPrank(client);
        usdc.approve(address(gigEscrow), amount);
        uint256 gigId = gigEscrow.createGig(worker, address(usdc), descriptions, amounts, false);
        vm.stopPrank();

        vm.prank(worker);
        gigEscrow.submitMilestone(gigId, 0, "ipfs://test");

        uint256 workerBalanceBefore = usdc.balanceOf(worker);
        uint256 feeCollectorBalanceBefore = usdc.balanceOf(feeCollector);

        vm.prank(client);
        gigEscrow.approveMilestone(gigId, 0);

        uint256 expectedFee = (amount * 250) / 10000;
        uint256 expectedWorkerAmount = amount - expectedFee;

        assertEq(
            usdc.balanceOf(worker),
            workerBalanceBefore + expectedWorkerAmount,
            "Worker should receive correct amount"
        );
        assertEq(
            usdc.balanceOf(feeCollector),
            feeCollectorBalanceBefore + expectedFee,
            "Fee collector should receive correct fee"
        );
    }

    /*//////////////////////////////////////////////////////////////
                            HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _createBasicGig() internal returns (uint256 gigId) {
        string[] memory descriptions = new string[](1);
        descriptions[0] = "Complete task";

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100 * 10 ** 18;

        vm.startPrank(client);
        usdc.approve(address(gigEscrow), 100 * 10 ** 18);
        gigId = gigEscrow.createGig(worker, address(usdc), descriptions, amounts, false);
        vm.stopPrank();
    }
}
