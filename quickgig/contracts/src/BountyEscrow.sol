// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISimpleArbitrator} from "./interfaces/ISimpleArbitrator.sol";

/**
 * @notice Minimal UMA OptimisticOracleV3 interface for assertions
 */
interface IOptimisticOracleV3 {
    function assertTruth(
        bytes memory claim,
        address asserter,
        address callbackRecipient,
        address escalationManager,
        uint64 liveness,
        IERC20 currency,
        uint256 bond,
        bytes32 identifier,
        bytes32 domainId
    ) external returns (bytes32 assertionId);

    function settleAssertion(bytes32 assertionId) external;

    function getAssertion(bytes32 assertionId)
        external
        view
        returns (
            bool,
            address,
            address,
            address,
            IERC20,
            uint256,
            uint64,
            bool
        );
}

/**
 * @notice Interface for QuickGigEscalationManager
 */
interface IQuickGigEscalationManager {
    function createDispute(
        uint256 bountyId,
        address client,
        address worker,
        uint256 amount,
        bytes32 assertionId
    ) external returns (bool);

    function getResolution(uint256 bountyId)
        external
        view
        returns (bool resolved, uint256 clientBps, uint256 workerBps);
}

/**
 * @title BountyEscrow
 * @author QuickGig Team
 * @notice Secure escrow for bounty-style gigs with multiple bidders
 * @dev Implements CEI pattern, reentrancy guards, and competitive bidding
 *
 * Features:
 * - Multiple agents/workers can bid on a single bounty
 * - Client selects winner from bids
 * - Automatic refund of escrowed funds to client on completion
 * - 48-hour auto-release after deliverable submission
 * - Dispute mechanism with arbitration support
 * - ERC-8004 reputation integration for bidder discovery
 *
 * Security:
 * - CEI (Checks-Effects-Interactions) pattern throughout
 * - OpenZeppelin ReentrancyGuard on all state-changing functions
 * - Explicit access control and state validation
 * - Safe ERC20 operations with SafeERC20
 * - Comprehensive event logging
 */
contract BountyEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/

    enum BountyStatus {
        Open,             // 0: Accepting bids
        Assigned,         // 1: Winner selected, in progress
        Submitted,        // 2: Deliverable submitted
        Completed,        // 3: Client approved, funds released
        Disputed,         // 4: Client disputed submission
        Cancelled,        // 5: Cancelled by client
        AutoReleased      // 6: Auto-released after 48h
    }

    struct Bid {
        address bidder;
        uint256 amount;
        string proposalURI;  // IPFS hash of proposal details
        uint256 bidTime;
        bool withdrawn;
    }

    struct Bounty {
        address client;
        address paymentToken;
        uint256 escrowAmount;
        uint256 createdAt;
        uint256 deadline;        // Deadline for bid submissions
        string requirementsURI;  // IPFS hash of bounty requirements
        BountyStatus status;
        address assignedWorker;
        uint256 assignedBidAmount;
        uint256 submittedAt;
        string deliverableURI;
        Bid[] bids;
        bool useUMAArbitration;  // True if using UMA OOv3, false for SimpleArbitrator
    }

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Mapping from bounty ID to bounty data
    mapping(uint256 => Bounty) public bounties;

    /// @notice Counter for generating unique bounty IDs
    uint256 public nextBountyId = 1;

    /// @notice Time window for client to approve/dispute after submission (48 hours)
    uint256 public constant AUTO_RELEASE_WINDOW = 48 hours;

    /// @notice Minimum bid deadline duration (1 hour)
    uint256 public constant MIN_DEADLINE = 1 hours;

    /// @notice Reputation registry contract (ERC-8004)
    address public reputationRegistry;

    /// @notice Platform fee in basis points (e.g., 250 = 2.5%)
    uint256 public platformFeeBps = 250;

    /// @notice Platform fee collector address
    address public feeCollector;

    /// @notice Owner address for admin functions
    address public owner;

    /// @notice Arbitrator contract address for dispute resolution
    address public arbitrator;

    /// @notice Mapping from bounty ID to arbitration case ID (SimpleArbitrator)
    mapping(uint256 => bytes32) public disputeCases;

    /// @notice UMA Escalation Manager contract address
    address public umaEscalationManager;

    /// @notice UMA OptimisticOracleV3 contract address
    address public optimisticOracle;

    /// @notice Mapping from bounty ID to UMA assertion ID
    mapping(uint256 => bytes32) public umaAssertionIds;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event BountyCreated(
        uint256 indexed bountyId,
        address indexed client,
        address paymentToken,
        uint256 escrowAmount,
        uint256 deadline,
        string requirementsURI
    );

    event BidSubmitted(
        uint256 indexed bountyId,
        address indexed bidder,
        uint256 bidAmount,
        string proposalURI,
        uint256 bidIndex
    );

    event BidWithdrawn(uint256 indexed bountyId, uint256 indexed bidIndex, address indexed bidder);

    event WorkerAssigned(
        uint256 indexed bountyId,
        address indexed worker,
        uint256 bidAmount
    );

    event DeliverableSubmitted(
        uint256 indexed bountyId,
        address indexed worker,
        string deliverableURI,
        uint256 submittedAt
    );

    event BountyCompleted(
        uint256 indexed bountyId,
        address indexed worker,
        uint256 amount
    );

    event BountyDisputed(uint256 indexed bountyId, string reason, bytes32 indexed caseId);

    event DisputeResolved(
        uint256 indexed bountyId,
        uint256 clientAmount,
        uint256 workerAmount
    );

    event BountyAutoReleased(
        uint256 indexed bountyId,
        address indexed worker,
        uint256 amount
    );

    event BountyCancelled(uint256 indexed bountyId, uint256 refundAmount);

    event PlatformFeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);

    event FeeCollectorUpdated(address indexed oldCollector, address indexed newCollector);

    event ReputationRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);

    event ArbitratorUpdated(address indexed oldArbitrator, address indexed newArbitrator);

    event UMADisputeCreated(
        uint256 indexed bountyId,
        bytes32 indexed assertionId,
        string claim,
        uint256 bond
    );

    event UMADisputeResolved(
        uint256 indexed bountyId,
        bytes32 indexed assertionId,
        bool clientWon
    );

    event UMAEscalationManagerUpdated(
        address indexed oldManager,
        address indexed newManager
    );

    event OptimisticOracleUpdated(
        address indexed oldOracle,
        address indexed newOracle
    );

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error Unauthorized();
    error InvalidAmount();
    error InvalidStatus();
    error InvalidDeadline();
    error DeadlinePassed();
    error BidTooHigh();
    error AlreadyAssigned();
    error NotAssigned();
    error AlreadySubmitted();
    error AutoReleaseNotReady();
    error InvalidBidIndex();
    error BidNotWithdrawable();
    error ZeroAddress();

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyClient(uint256 bountyId) {
        if (msg.sender != bounties[bountyId].client) revert Unauthorized();
        _;
    }

    modifier onlyAssignedWorker(uint256 bountyId) {
        if (msg.sender != bounties[bountyId].assignedWorker) revert Unauthorized();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        address _feeCollector,
        address _reputationRegistry,
        address _arbitrator,
        address _umaEscalationManager,
        address _optimisticOracle
    ) {
        if (_feeCollector == address(0)) revert ZeroAddress();
        owner = msg.sender;
        feeCollector = _feeCollector;
        reputationRegistry = _reputationRegistry;
        arbitrator = _arbitrator;
        umaEscalationManager = _umaEscalationManager;
        optimisticOracle = _optimisticOracle;
    }

    /*//////////////////////////////////////////////////////////////
                            EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Create a new bounty with escrowed funds
     * @param paymentToken ERC20 token address (e.g., USDC)
     * @param escrowAmount Maximum amount willing to pay (client locks this)
     * @param deadline Timestamp when bidding closes
     * @param requirementsURI IPFS hash of bounty requirements
     * @param useUMAArbitration True to use UMA OOv3, false for SimpleArbitrator
     * @return bountyId The newly created bounty ID
     *
     * @dev Client escrows full amount upfront. Excess refunded when winner selected.
     *      Follows CEI pattern for security.
     */
    function createBounty(
        address paymentToken,
        uint256 escrowAmount,
        uint256 deadline,
        string calldata requirementsURI,
        bool useUMAArbitration
    ) external nonReentrant returns (uint256 bountyId) {
        // CHECKS
        if (paymentToken == address(0)) revert ZeroAddress();
        if (escrowAmount == 0) revert InvalidAmount();
        if (deadline < block.timestamp + MIN_DEADLINE) revert InvalidDeadline();

        // EFFECTS
        bountyId = nextBountyId++;

        Bounty storage bounty = bounties[bountyId];
        bounty.client = msg.sender;
        bounty.paymentToken = paymentToken;
        bounty.escrowAmount = escrowAmount;
        bounty.createdAt = block.timestamp;
        bounty.deadline = deadline;
        bounty.requirementsURI = requirementsURI;
        bounty.status = BountyStatus.Open;
        bounty.useUMAArbitration = useUMAArbitration;

        emit BountyCreated(bountyId, msg.sender, paymentToken, escrowAmount, deadline, requirementsURI);

        // INTERACTIONS (last step)
        IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), escrowAmount);
    }

    /**
     * @notice Submit a bid for an open bounty
     * @param bountyId The bounty identifier
     * @param bidAmount Amount the bidder is willing to accept (must be <= escrow)
     * @param proposalURI IPFS hash of the bid proposal
     *
     * @dev No funds locked from bidder. Client chooses winner.
     */
    function submitBid(
        uint256 bountyId,
        uint256 bidAmount,
        string calldata proposalURI
    ) external nonReentrant {
        Bounty storage bounty = bounties[bountyId];

        // CHECKS
        if (bounty.status != BountyStatus.Open) revert InvalidStatus();
        if (block.timestamp > bounty.deadline) revert DeadlinePassed();
        if (bidAmount == 0 || bidAmount > bounty.escrowAmount) revert BidTooHigh();

        // EFFECTS
        uint256 bidIndex = bounty.bids.length;
        bounty.bids.push(
            Bid({
                bidder: msg.sender,
                amount: bidAmount,
                proposalURI: proposalURI,
                bidTime: block.timestamp,
                withdrawn: false
            })
        );

        emit BidSubmitted(bountyId, msg.sender, bidAmount, proposalURI, bidIndex);
    }

    /**
     * @notice Withdraw a bid before winner is assigned
     * @param bountyId The bounty identifier
     * @param bidIndex Index of the bid to withdraw
     *
     * @dev Only bidder can withdraw their own bid, only before assignment
     */
    function withdrawBid(uint256 bountyId, uint256 bidIndex) external nonReentrant {
        Bounty storage bounty = bounties[bountyId];

        // CHECKS
        if (bounty.status != BountyStatus.Open) revert InvalidStatus();
        if (bidIndex >= bounty.bids.length) revert InvalidBidIndex();

        Bid storage bid = bounty.bids[bidIndex];
        if (bid.bidder != msg.sender) revert Unauthorized();
        if (bid.withdrawn) revert BidNotWithdrawable();

        // EFFECTS
        bid.withdrawn = true;

        emit BidWithdrawn(bountyId, bidIndex, msg.sender);
    }

    /**
     * @notice Client assigns bounty to a winning bidder
     * @param bountyId The bounty identifier
     * @param bidIndex Index of the winning bid
     *
     * @dev Refunds excess escrow amount to client. Follows CEI pattern.
     */
    function assignWorker(uint256 bountyId, uint256 bidIndex)
        external
        nonReentrant
        onlyClient(bountyId)
    {
        Bounty storage bounty = bounties[bountyId];

        // CHECKS
        if (bounty.status != BountyStatus.Open) revert InvalidStatus();
        if (bidIndex >= bounty.bids.length) revert InvalidBidIndex();

        Bid storage winningBid = bounty.bids[bidIndex];
        if (winningBid.withdrawn) revert BidNotWithdrawable();

        // EFFECTS
        bounty.status = BountyStatus.Assigned;
        bounty.assignedWorker = winningBid.bidder;
        bounty.assignedBidAmount = winningBid.amount;

        uint256 refundAmount = bounty.escrowAmount - winningBid.amount;

        emit WorkerAssigned(bountyId, winningBid.bidder, winningBid.amount);

        // INTERACTIONS (last step)
        if (refundAmount > 0) {
            IERC20(bounty.paymentToken).safeTransfer(bounty.client, refundAmount);
        }
    }

    /**
     * @notice Assigned worker submits deliverable
     * @param bountyId The bounty identifier
     * @param deliverableURI IPFS or storage URI of the completed work
     *
     * @dev Starts 48-hour countdown for auto-release
     */
    function submitDeliverable(uint256 bountyId, string calldata deliverableURI)
        external
        nonReentrant
        onlyAssignedWorker(bountyId)
    {
        Bounty storage bounty = bounties[bountyId];

        // CHECKS
        if (bounty.status != BountyStatus.Assigned) revert InvalidStatus();

        // EFFECTS
        bounty.status = BountyStatus.Submitted;
        bounty.deliverableURI = deliverableURI;
        bounty.submittedAt = block.timestamp;

        emit DeliverableSubmitted(bountyId, msg.sender, deliverableURI, block.timestamp);
    }

    /**
     * @notice Client approves deliverable and releases payment
     * @param bountyId The bounty identifier
     *
     * @dev Follows CEI pattern with platform fee deduction
     */
    function approveDeliverable(uint256 bountyId)
        external
        nonReentrant
        onlyClient(bountyId)
    {
        Bounty storage bounty = bounties[bountyId];

        // CHECKS
        if (bounty.status != BountyStatus.Submitted) revert InvalidStatus();

        // EFFECTS
        bounty.status = BountyStatus.Completed;

        uint256 fee = (bounty.assignedBidAmount * platformFeeBps) / 10000;
        uint256 workerAmount = bounty.assignedBidAmount - fee;

        emit BountyCompleted(bountyId, bounty.assignedWorker, bounty.assignedBidAmount);

        // Hook: Update reputation in ERC-8004 registry
        if (reputationRegistry != address(0)) {
            // Call reputation registry to record successful completion
        }

        // INTERACTIONS (last step)
        IERC20 token = IERC20(bounty.paymentToken);
        token.safeTransfer(bounty.assignedWorker, workerAmount);
        if (fee > 0) {
            token.safeTransfer(feeCollector, fee);
        }
    }

    /**
     * @notice Auto-release payment after 48 hours
     * @param bountyId The bounty identifier
     *
     * @dev Can be called by anyone after the time window passes
     */
    function autoReleasePayment(uint256 bountyId) external nonReentrant {
        Bounty storage bounty = bounties[bountyId];

        // CHECKS
        if (bounty.status != BountyStatus.Submitted) revert InvalidStatus();
        if (block.timestamp < bounty.submittedAt + AUTO_RELEASE_WINDOW) {
            revert AutoReleaseNotReady();
        }

        // EFFECTS
        bounty.status = BountyStatus.AutoReleased;

        uint256 fee = (bounty.assignedBidAmount * platformFeeBps) / 10000;
        uint256 workerAmount = bounty.assignedBidAmount - fee;

        emit BountyAutoReleased(bountyId, bounty.assignedWorker, bounty.assignedBidAmount);

        // INTERACTIONS (last step)
        IERC20 token = IERC20(bounty.paymentToken);
        token.safeTransfer(bounty.assignedWorker, workerAmount);
        if (fee > 0) {
            token.safeTransfer(feeCollector, fee);
        }
    }

    /**
     * @notice Client disputes submitted deliverable
     * @param bountyId The bounty identifier
     * @param reason Description of the dispute
     * @param evidenceURI IPFS URI of client's evidence
     *
     * @dev Creates dispute case in arbitrator contract
     */
    function disputeDeliverable(
        uint256 bountyId,
        string calldata reason,
        string calldata evidenceURI
    ) external nonReentrant onlyClient(bountyId) {
        Bounty storage bounty = bounties[bountyId];

        // CHECKS
        if (bounty.status != BountyStatus.Submitted) revert InvalidStatus();

        // EFFECTS
        bounty.status = BountyStatus.Disputed;

        // Create dispute case in arbitrator
        bytes32 caseId;
        if (arbitrator != address(0)) {
            caseId = ISimpleArbitrator(arbitrator).createDispute(
                bountyId,
                msg.sender,              // client
                bounty.assignedWorker,   // worker
                bounty.assignedBidAmount,// amount
                reason,
                evidenceURI
            );
            disputeCases[bountyId] = caseId;
        }

        emit BountyDisputed(bountyId, reason, caseId);
    }

    /**
     * @notice Resolve a disputed bounty based on arbitrator decision
     * @param bountyId The bounty identifier
     *
     * @dev Callable by anyone after arbitrator has resolved the case
     */
    function resolveDispute(uint256 bountyId) external nonReentrant {
        Bounty storage bounty = bounties[bountyId];

        // CHECKS
        if (bounty.status != BountyStatus.Disputed) revert InvalidStatus();
        if (arbitrator == address(0)) revert ZeroAddress();

        bytes32 caseId = disputeCases[bountyId];

        // Get resolution from arbitrator
        (uint256 clientBps, uint256 workerBps) =
            ISimpleArbitrator(arbitrator).getResolution(caseId);

        require(clientBps + workerBps == 10000, "Invalid split");

        // EFFECTS
        bounty.status = BountyStatus.Completed;

        // Calculate amounts
        uint256 totalAmount = bounty.assignedBidAmount;
        uint256 clientAmount = (totalAmount * clientBps) / 10000;
        uint256 workerAmount = (totalAmount * workerBps) / 10000;

        emit DisputeResolved(bountyId, clientAmount, workerAmount);

        // Record reputation (disputed)
        if (reputationRegistry != address(0) && workerAmount > 0) {
            // TODO: Call reputationRegistry.recordFeedback()
            // Rating based on workerBps split
            // uint8 rating = _calculateRatingFromSplit(workerBps);
        }

        // INTERACTIONS (last step)
        IERC20 token = IERC20(bounty.paymentToken);

        // Refund client their portion
        if (clientAmount > 0) {
            token.safeTransfer(bounty.client, clientAmount);
        }

        // Pay worker their portion (minus platform fee)
        if (workerAmount > 0) {
            uint256 fee = (workerAmount * platformFeeBps) / 10000;
            uint256 workerNet = workerAmount - fee;

            token.safeTransfer(bounty.assignedWorker, workerNet);
            if (fee > 0) {
                token.safeTransfer(feeCollector, fee);
            }
        }
    }

    /**
     * @notice Client disputes submitted deliverable using UMA Optimistic Oracle
     * @param bountyId The bounty identifier
     * @param claim Human-readable claim describing the dispute
     * @param evidenceURI IPFS URI of client's evidence
     * @param bond Bond amount for the assertion (in payment token)
     *
     * @dev Creates UMA assertion that will be resolved after liveness period or challenge
     */
    function disputeDeliverableWithUMA(
        uint256 bountyId,
        string calldata claim,
        string calldata evidenceURI,
        uint256 bond
    ) external nonReentrant onlyClient(bountyId) {
        Bounty storage bounty = bounties[bountyId];

        // CHECKS
        if (bounty.status != BountyStatus.Submitted) revert InvalidStatus();
        if (!bounty.useUMAArbitration) revert InvalidStatus(); // Must use UMA
        if (optimisticOracle == address(0) || umaEscalationManager == address(0)) {
            revert ZeroAddress();
        }

        // EFFECTS
        bounty.status = BountyStatus.Disputed;

        // Create UMA assertion
        bytes memory claimBytes = bytes(claim);
        IERC20 currency = IERC20(bounty.paymentToken);

        // UMA assertion parameters
        bytes32 identifier = bytes32("ASSERT_TRUTH");
        bytes32 domainId = keccak256(abi.encodePacked("QuickGig", block.chainid));
        uint64 liveness = 7200; // 2 hours for testing (should be configurable)

        // Approve bond for UMA Oracle
        if (bond > 0) {
            currency.safeTransferFrom(msg.sender, address(this), bond);
            currency.approve(optimisticOracle, bond);
        }

        // Create assertion in UMA OOv3
        bytes32 assertionId = IOptimisticOracleV3(optimisticOracle).assertTruth(
            claimBytes,
            msg.sender,              // asserter (client)
            umaEscalationManager,    // callback recipient (escalation manager handles callbacks)
            umaEscalationManager,    // escalation manager
            liveness,                // challenge period
            currency,                // bond currency
            bond,                    // bond amount
            identifier,              // assertion identifier
            domainId                 // domain ID
        );

        // Store assertion ID
        umaAssertionIds[bountyId] = assertionId;

        // Notify escalation manager
        IQuickGigEscalationManager(umaEscalationManager).createDispute(
            bountyId,
            bounty.client,
            bounty.assignedWorker,
            bounty.assignedBidAmount,
            assertionId
        );

        emit UMADisputeCreated(bountyId, assertionId, claim, bond);
    }

    /**
     * @notice Resolve UMA dispute based on Escalation Manager decision
     * @param bountyId The bounty identifier
     *
     * @dev Callable by anyone after UMA assertion is resolved
     */
    function resolveUMADispute(uint256 bountyId) external nonReentrant {
        Bounty storage bounty = bounties[bountyId];

        // CHECKS
        if (bounty.status != BountyStatus.Disputed) revert InvalidStatus();
        if (!bounty.useUMAArbitration) revert InvalidStatus();
        if (umaEscalationManager == address(0)) revert ZeroAddress();

        bytes32 assertionId = umaAssertionIds[bountyId];

        // Get resolution from UMA Escalation Manager
        (bool resolved, uint256 clientBps, uint256 workerBps) =
            IQuickGigEscalationManager(umaEscalationManager).getResolution(bountyId);

        require(resolved, "Dispute not yet resolved");
        require(clientBps + workerBps == 10000, "Invalid split");

        // EFFECTS
        bounty.status = BountyStatus.Completed;

        // Calculate amounts
        uint256 totalAmount = bounty.assignedBidAmount;
        uint256 clientAmount = (totalAmount * clientBps) / 10000;
        uint256 workerAmount = (totalAmount * workerBps) / 10000;

        emit UMADisputeResolved(bountyId, assertionId, clientBps > 0);

        // Record reputation (disputed)
        if (reputationRegistry != address(0) && workerAmount > 0) {
            // TODO: Call reputationRegistry.recordFeedback()
            // Rating based on workerBps split
            // uint8 rating = _calculateRatingFromSplit(workerBps);
        }

        // INTERACTIONS (last step)
        IERC20 token = IERC20(bounty.paymentToken);

        // Refund client their portion
        if (clientAmount > 0) {
            token.safeTransfer(bounty.client, clientAmount);
        }

        // Pay worker their portion (minus platform fee)
        if (workerAmount > 0) {
            uint256 fee = (workerAmount * platformFeeBps) / 10000;
            uint256 workerNet = workerAmount - fee;

            token.safeTransfer(bounty.assignedWorker, workerNet);
            if (fee > 0) {
                token.safeTransfer(feeCollector, fee);
            }
        }
    }

    /**
     * @notice Cancel bounty and refund client
     * @param bountyId The bounty identifier
     *
     * @dev Only callable by client before assignment. Follows CEI pattern.
     */
    function cancelBounty(uint256 bountyId) external nonReentrant onlyClient(bountyId) {
        Bounty storage bounty = bounties[bountyId];

        // CHECKS
        if (bounty.status != BountyStatus.Open) revert InvalidStatus();

        // EFFECTS
        uint256 refundAmount = bounty.escrowAmount;
        bounty.status = BountyStatus.Cancelled;

        emit BountyCancelled(bountyId, refundAmount);

        // INTERACTIONS (last step)
        IERC20(bounty.paymentToken).safeTransfer(bounty.client, refundAmount);
    }

    /*//////////////////////////////////////////////////////////////
                            ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Update platform fee (owner only)
     * @param newFeeBps New fee in basis points (max 1000 = 10%)
     */
    function updatePlatformFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > 1000) revert InvalidAmount(); // Max 10% fee
        uint256 oldFee = platformFeeBps;
        platformFeeBps = newFeeBps;
        emit PlatformFeeUpdated(oldFee, newFeeBps);
    }

    /**
     * @notice Update fee collector address (owner only)
     * @param newCollector New fee collector address
     */
    function updateFeeCollector(address newCollector) external onlyOwner {
        if (newCollector == address(0)) revert ZeroAddress();
        address oldCollector = feeCollector;
        feeCollector = newCollector;
        emit FeeCollectorUpdated(oldCollector, newCollector);
    }

    /**
     * @notice Update reputation registry address (owner only)
     * @param newRegistry New ERC-8004 reputation registry address
     */
    function updateReputationRegistry(address newRegistry) external onlyOwner {
        address oldRegistry = reputationRegistry;
        reputationRegistry = newRegistry;
        emit ReputationRegistryUpdated(oldRegistry, newRegistry);
    }

    /**
     * @notice Transfer ownership (owner only)
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    /**
     * @notice Update arbitrator address (owner only)
     * @param newArbitrator New arbitrator contract address
     */
    function updateArbitrator(address newArbitrator) external onlyOwner {
        address oldArbitrator = arbitrator;
        arbitrator = newArbitrator;
        emit ArbitratorUpdated(oldArbitrator, newArbitrator);
    }

    /**
     * @notice Update UMA Escalation Manager address (owner only)
     * @param newManager New escalation manager contract address
     */
    function updateUMAEscalationManager(address newManager) external onlyOwner {
        address oldManager = umaEscalationManager;
        umaEscalationManager = newManager;
        emit UMAEscalationManagerUpdated(oldManager, newManager);
    }

    /**
     * @notice Update UMA OptimisticOracleV3 address (owner only)
     * @param newOracle New optimistic oracle contract address
     */
    function updateOptimisticOracle(address newOracle) external onlyOwner {
        address oldOracle = optimisticOracle;
        optimisticOracle = newOracle;
        emit OptimisticOracleUpdated(oldOracle, newOracle);
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL HELPERS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Convert workerBps to star rating (1-5)
     * @param workerBps Basis points awarded to worker (0-10000)
     * @return rating Star rating from 1-5
     *
     * @dev Used for reputation system when dispute is resolved
     *      0-20% to worker = 1 star
     *      20-40% = 2 stars
     *      40-60% = 3 stars
     *      60-80% = 4 stars
     *      80-100% = 5 stars
     */
    function _calculateRatingFromSplit(uint256 workerBps)
        internal
        pure
        returns (uint8 rating)
    {
        if (workerBps <= 2000) return 1;
        if (workerBps <= 4000) return 2;
        if (workerBps <= 6000) return 3;
        if (workerBps <= 8000) return 4;
        return 5;
    }

    /*//////////////////////////////////////////////////////////////
                             VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get complete bounty details
     * @param bountyId The bounty identifier
     * @return bounty Complete bounty struct data
     */
    function getBounty(uint256 bountyId) external view returns (Bounty memory bounty) {
        return bounties[bountyId];
    }

    /**
     * @notice Get specific bid details
     * @param bountyId The bounty identifier
     * @param bidIndex Index of the bid
     * @return bid Complete bid data
     */
    function getBid(uint256 bountyId, uint256 bidIndex)
        external
        view
        returns (Bid memory bid)
    {
        return bounties[bountyId].bids[bidIndex];
    }

    /**
     * @notice Get total number of bids for a bounty
     * @param bountyId The bounty identifier
     * @return count Number of bids
     */
    function getBidCount(uint256 bountyId) external view returns (uint256 count) {
        return bounties[bountyId].bids.length;
    }

    /**
     * @notice Get all active (non-withdrawn) bids for a bounty
     * @param bountyId The bounty identifier
     * @return activeBids Array of active bids
     */
    function getActiveBids(uint256 bountyId)
        external
        view
        returns (Bid[] memory activeBids)
    {
        Bounty storage bounty = bounties[bountyId];
        uint256 activeCount = 0;

        // Count active bids
        for (uint256 i = 0; i < bounty.bids.length; i++) {
            if (!bounty.bids[i].withdrawn) {
                activeCount++;
            }
        }

        // Build active bids array
        activeBids = new Bid[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < bounty.bids.length; i++) {
            if (!bounty.bids[i].withdrawn) {
                activeBids[index] = bounty.bids[i];
                index++;
            }
        }
    }

    /**
     * @notice Check if bounty can be auto-released
     * @param bountyId The bounty identifier
     * @return canRelease True if auto-release is available
     */
    function canAutoRelease(uint256 bountyId) external view returns (bool canRelease) {
        Bounty storage bounty = bounties[bountyId];
        return bounty.status == BountyStatus.Submitted
            && block.timestamp >= bounty.submittedAt + AUTO_RELEASE_WINDOW;
    }
}
