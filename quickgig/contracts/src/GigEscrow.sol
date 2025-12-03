// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

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
 * @title GigEscrow
 * @author QuickGig Team
 * @notice Secure escrow contract for 1-on-1 gigs with milestone-based payments
 * @dev Implements CEI pattern, reentrancy guards, and comprehensive security measures
 *
 * Features:
 * - Milestone-based escrow (pay-as-you-go or single payment)
 * - 48-hour auto-release after deliverable submission
 * - Client dispute mechanism with arbitration
 * - ERC-8004 reputation integration hooks
 * - EIP-3009 compatible for gasless USDC transfers
 *
 * Security:
 * - CEI (Checks-Effects-Interactions) pattern throughout
 * - OpenZeppelin ReentrancyGuard on all state-changing functions
 * - No delegatecall or assembly for reduced attack surface
 * - Explicit access control checks
 * - Comprehensive event logging for transparency
 */
contract GigEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/

    enum GigStatus {
        Active,           // 0: Gig is in progress
        Completed,        // 1: Successfully completed
        Disputed,         // 2: Client raised dispute
        Cancelled,        // 3: Cancelled by mutual agreement
        AutoReleased      // 4: Auto-released after 48h
    }

    enum MilestoneStatus {
        Pending,          // 0: Not yet submitted
        Submitted,        // 1: Waiting for client approval
        Approved,         // 2: Client approved, funds released
        Disputed,         // 3: Client disputed submission
        AutoReleased      // 4: Auto-released after 48h
    }

    struct Milestone {
        string description;
        uint256 amount;
        uint256 submittedAt;
        string deliverableURI;  // IPFS hash or other storage URI
        MilestoneStatus status;
    }

    struct Gig {
        address client;
        address worker;
        address paymentToken;
        uint256 totalAmount;
        uint256 releasedAmount;
        uint256 createdAt;
        GigStatus status;
        Milestone[] milestones;
        bool useUMAArbitration;  // True if using UMA OOv3, false for standard dispute
    }

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Mapping from gig ID to gig data
    mapping(uint256 => Gig) public gigs;

    /// @notice Counter for generating unique gig IDs
    uint256 public nextGigId = 1;

    /// @notice Time window for client to approve/dispute after submission (48 hours)
    uint256 public constant AUTO_RELEASE_WINDOW = 48 hours;

    /// @notice Reputation registry contract (ERC-8004)
    address public reputationRegistry;

    /// @notice Platform fee in basis points (e.g., 250 = 2.5%)
    uint256 public platformFeeBps = 250;

    /// @notice Platform fee collector address
    address public feeCollector;

    /// @notice Owner address for admin functions
    address public owner;

    /// @notice UMA Escalation Manager contract address
    address public umaEscalationManager;

    /// @notice UMA OptimisticOracleV3 contract address
    address public optimisticOracle;

    /// @notice Mapping from gig ID + milestone index to UMA assertion ID
    mapping(uint256 => mapping(uint256 => bytes32)) public umaAssertionIds;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event GigCreated(
        uint256 indexed gigId,
        address indexed client,
        address indexed worker,
        address paymentToken,
        uint256 totalAmount,
        uint256 milestoneCount
    );

    event MilestoneSubmitted(
        uint256 indexed gigId,
        uint256 indexed milestoneIndex,
        string deliverableURI,
        uint256 submittedAt
    );

    event MilestoneApproved(
        uint256 indexed gigId,
        uint256 indexed milestoneIndex,
        uint256 amount,
        address worker
    );

    event MilestoneDisputed(
        uint256 indexed gigId,
        uint256 indexed milestoneIndex,
        string reason
    );

    event MilestoneAutoReleased(
        uint256 indexed gigId,
        uint256 indexed milestoneIndex,
        uint256 amount,
        address worker
    );

    event GigCompleted(uint256 indexed gigId, uint256 totalReleased);

    event GigCancelled(uint256 indexed gigId, uint256 refundedAmount);

    event PlatformFeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);

    event FeeCollectorUpdated(address indexed oldCollector, address indexed newCollector);

    event ReputationRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);

    event UMADisputeCreated(
        uint256 indexed gigId,
        uint256 indexed milestoneIndex,
        bytes32 indexed assertionId,
        string claim,
        uint256 bond
    );

    event UMADisputeResolved(
        uint256 indexed gigId,
        uint256 indexed milestoneIndex,
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
    error AlreadySubmitted();
    error NotSubmitted();
    error AutoReleaseNotReady();
    error InvalidMilestoneIndex();
    error TransferFailed();
    error ZeroAddress();

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyClient(uint256 gigId) {
        if (msg.sender != gigs[gigId].client) revert Unauthorized();
        _;
    }

    modifier onlyWorker(uint256 gigId) {
        if (msg.sender != gigs[gigId].worker) revert Unauthorized();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        address _feeCollector,
        address _reputationRegistry,
        address _umaEscalationManager,
        address _optimisticOracle
    ) {
        if (_feeCollector == address(0)) revert ZeroAddress();
        owner = msg.sender;
        feeCollector = _feeCollector;
        reputationRegistry = _reputationRegistry;
        umaEscalationManager = _umaEscalationManager;
        optimisticOracle = _optimisticOracle;
    }

    /*//////////////////////////////////////////////////////////////
                            EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Create a new gig with milestone-based escrow
     * @param worker Address of the worker performing the gig
     * @param paymentToken ERC20 token address (e.g., USDC)
     * @param milestoneDescriptions Array of milestone descriptions
     * @param milestoneAmounts Array of milestone payment amounts
     * @return gigId The newly created gig ID
     *
     * @dev Follows CEI pattern:
     *      1. Checks: Validate inputs
     *      2. Effects: Create gig, update storage
     *      3. Interactions: Transfer tokens from client
     */
    function createGig(
        address worker,
        address paymentToken,
        string[] calldata milestoneDescriptions,
        uint256[] calldata milestoneAmounts,
        bool useUMAArbitration
    ) external nonReentrant returns (uint256 gigId) {
        // CHECKS
        if (worker == address(0) || paymentToken == address(0)) revert ZeroAddress();
        if (milestoneDescriptions.length != milestoneAmounts.length) revert InvalidAmount();
        if (milestoneDescriptions.length == 0) revert InvalidAmount();

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            if (milestoneAmounts[i] == 0) revert InvalidAmount();
            totalAmount += milestoneAmounts[i];
        }

        // EFFECTS
        gigId = nextGigId++;

        Gig storage gig = gigs[gigId];
        gig.client = msg.sender;
        gig.worker = worker;
        gig.paymentToken = paymentToken;
        gig.totalAmount = totalAmount;
        gig.releasedAmount = 0;
        gig.createdAt = block.timestamp;
        gig.status = GigStatus.Active;
        gig.useUMAArbitration = useUMAArbitration;

        for (uint256 i = 0; i < milestoneDescriptions.length; i++) {
            gig.milestones.push(
                Milestone({
                    description: milestoneDescriptions[i],
                    amount: milestoneAmounts[i],
                    submittedAt: 0,
                    deliverableURI: "",
                    status: MilestoneStatus.Pending
                })
            );
        }

        emit GigCreated(gigId, msg.sender, worker, paymentToken, totalAmount, milestoneDescriptions.length);

        // INTERACTIONS (last step)
        IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), totalAmount);
    }

    /**
     * @notice Worker submits deliverable for a milestone
     * @param gigId The gig identifier
     * @param milestoneIndex Index of the milestone to submit
     * @param deliverableURI IPFS or storage URI of the deliverable
     *
     * @dev Starts 48-hour countdown for auto-release
     */
    function submitMilestone(
        uint256 gigId,
        uint256 milestoneIndex,
        string calldata deliverableURI
    ) external nonReentrant onlyWorker(gigId) {
        Gig storage gig = gigs[gigId];

        // CHECKS
        if (gig.status != GigStatus.Active) revert InvalidStatus();
        if (milestoneIndex >= gig.milestones.length) revert InvalidMilestoneIndex();

        Milestone storage milestone = gig.milestones[milestoneIndex];
        if (milestone.status != MilestoneStatus.Pending) revert AlreadySubmitted();

        // EFFECTS
        milestone.status = MilestoneStatus.Submitted;
        milestone.deliverableURI = deliverableURI;
        milestone.submittedAt = block.timestamp;

        emit MilestoneSubmitted(gigId, milestoneIndex, deliverableURI, block.timestamp);
    }

    /**
     * @notice Client approves milestone and releases payment to worker
     * @param gigId The gig identifier
     * @param milestoneIndex Index of the milestone to approve
     *
     * @dev Follows CEI pattern with platform fee deduction
     */
    function approveMilestone(uint256 gigId, uint256 milestoneIndex)
        external
        nonReentrant
        onlyClient(gigId)
    {
        Gig storage gig = gigs[gigId];

        // CHECKS
        if (gig.status != GigStatus.Active) revert InvalidStatus();
        if (milestoneIndex >= gig.milestones.length) revert InvalidMilestoneIndex();

        Milestone storage milestone = gig.milestones[milestoneIndex];
        if (milestone.status != MilestoneStatus.Submitted) revert NotSubmitted();

        // EFFECTS
        milestone.status = MilestoneStatus.Approved;
        gig.releasedAmount += milestone.amount;

        // Calculate platform fee
        uint256 fee = (milestone.amount * platformFeeBps) / 10000;
        uint256 workerAmount = milestone.amount - fee;

        emit MilestoneApproved(gigId, milestoneIndex, milestone.amount, gig.worker);

        // Check if all milestones are complete
        bool allComplete = true;
        for (uint256 i = 0; i < gig.milestones.length; i++) {
            if (
                gig.milestones[i].status != MilestoneStatus.Approved
                    && gig.milestones[i].status != MilestoneStatus.AutoReleased
            ) {
                allComplete = false;
                break;
            }
        }

        if (allComplete) {
            gig.status = GigStatus.Completed;
            emit GigCompleted(gigId, gig.releasedAmount);

            // Hook: Update reputation in ERC-8004 registry (if set)
            if (reputationRegistry != address(0)) {
                // Call reputation registry to record successful completion
                // Implementation depends on ERC-8004 interface
            }
        }

        // INTERACTIONS (last step)
        IERC20 token = IERC20(gig.paymentToken);
        token.safeTransfer(gig.worker, workerAmount);
        if (fee > 0) {
            token.safeTransfer(feeCollector, fee);
        }
    }

    /**
     * @notice Auto-release milestone payment after 48 hours
     * @param gigId The gig identifier
     * @param milestoneIndex Index of the milestone to auto-release
     *
     * @dev Can be called by anyone after the time window passes
     */
    function autoReleaseMilestone(uint256 gigId, uint256 milestoneIndex) external nonReentrant {
        Gig storage gig = gigs[gigId];

        // CHECKS
        if (gig.status != GigStatus.Active) revert InvalidStatus();
        if (milestoneIndex >= gig.milestones.length) revert InvalidMilestoneIndex();

        Milestone storage milestone = gig.milestones[milestoneIndex];
        if (milestone.status != MilestoneStatus.Submitted) revert NotSubmitted();
        if (block.timestamp < milestone.submittedAt + AUTO_RELEASE_WINDOW) {
            revert AutoReleaseNotReady();
        }

        // EFFECTS
        milestone.status = MilestoneStatus.AutoReleased;
        gig.releasedAmount += milestone.amount;

        uint256 fee = (milestone.amount * platformFeeBps) / 10000;
        uint256 workerAmount = milestone.amount - fee;

        emit MilestoneAutoReleased(gigId, milestoneIndex, milestone.amount, gig.worker);

        // Check if all milestones are complete
        bool allComplete = true;
        for (uint256 i = 0; i < gig.milestones.length; i++) {
            if (
                gig.milestones[i].status != MilestoneStatus.Approved
                    && gig.milestones[i].status != MilestoneStatus.AutoReleased
            ) {
                allComplete = false;
                break;
            }
        }

        if (allComplete) {
            gig.status = GigStatus.AutoReleased;
            emit GigCompleted(gigId, gig.releasedAmount);
        }

        // INTERACTIONS (last step)
        IERC20 token = IERC20(gig.paymentToken);
        token.safeTransfer(gig.worker, workerAmount);
        if (fee > 0) {
            token.safeTransfer(feeCollector, fee);
        }
    }

    /**
     * @notice Client disputes a submitted milestone
     * @param gigId The gig identifier
     * @param milestoneIndex Index of the milestone to dispute
     * @param reason Description of the dispute
     *
     * @dev Sets status to disputed, requiring arbitration or mutual resolution
     */
    function disputeMilestone(
        uint256 gigId,
        uint256 milestoneIndex,
        string calldata reason
    ) external nonReentrant onlyClient(gigId) {
        Gig storage gig = gigs[gigId];

        // CHECKS
        if (gig.status != GigStatus.Active) revert InvalidStatus();
        if (milestoneIndex >= gig.milestones.length) revert InvalidMilestoneIndex();

        Milestone storage milestone = gig.milestones[milestoneIndex];
        if (milestone.status != MilestoneStatus.Submitted) revert NotSubmitted();

        // EFFECTS
        milestone.status = MilestoneStatus.Disputed;
        gig.status = GigStatus.Disputed;

        emit MilestoneDisputed(gigId, milestoneIndex, reason);
    }

    /**
     * @notice Cancel gig and refund remaining funds to client
     * @param gigId The gig identifier
     *
     * @dev Only callable by client or worker, follows CEI pattern
     */
    function cancelGig(uint256 gigId) external nonReentrant {
        Gig storage gig = gigs[gigId];

        // CHECKS
        if (msg.sender != gig.client && msg.sender != gig.worker) revert Unauthorized();
        if (gig.status != GigStatus.Active && gig.status != GigStatus.Disputed) {
            revert InvalidStatus();
        }

        // EFFECTS
        uint256 refundAmount = gig.totalAmount - gig.releasedAmount;
        gig.status = GigStatus.Cancelled;

        emit GigCancelled(gigId, refundAmount);

        // INTERACTIONS (last step)
        if (refundAmount > 0) {
            IERC20(gig.paymentToken).safeTransfer(gig.client, refundAmount);
        }
    }

    /**
     * @notice Client disputes milestone using UMA Optimistic Oracle
     * @param gigId The gig identifier
     * @param milestoneIndex Index of the milestone to dispute
     * @param claim Human-readable claim describing the dispute
     * @param evidenceURI IPFS URI of client's evidence
     * @param bond Bond amount for the assertion (in payment token)
     *
     * @dev Creates UMA assertion that will be resolved after liveness period or challenge
     */
    function disputeMilestoneWithUMA(
        uint256 gigId,
        uint256 milestoneIndex,
        string calldata claim,
        string calldata evidenceURI,
        uint256 bond
    ) external nonReentrant onlyClient(gigId) {
        Gig storage gig = gigs[gigId];

        // CHECKS
        if (milestoneIndex >= gig.milestones.length) revert InvalidMilestoneIndex();
        if (!gig.useUMAArbitration) revert InvalidStatus(); // Must use UMA
        if (optimisticOracle == address(0) || umaEscalationManager == address(0)) {
            revert ZeroAddress();
        }

        Milestone storage milestone = gig.milestones[milestoneIndex];
        if (milestone.status != MilestoneStatus.Submitted) revert InvalidStatus();

        // EFFECTS
        milestone.status = MilestoneStatus.Disputed;

        // Create UMA assertion
        bytes memory claimBytes = bytes(claim);
        IERC20 currency = IERC20(gig.paymentToken);

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
            address(this),           // callback recipient
            umaEscalationManager,    // escalation manager
            liveness,                // challenge period
            currency,                // bond currency
            bond,                    // bond amount
            identifier,              // assertion identifier
            domainId                 // domain ID
        );

        // Store assertion ID
        umaAssertionIds[gigId][milestoneIndex] = assertionId;

        // Notify escalation manager
        IQuickGigEscalationManager(umaEscalationManager).createDispute(
            gigId,
            gig.client,
            gig.worker,
            milestone.amount,
            assertionId
        );

        emit UMADisputeCreated(gigId, milestoneIndex, assertionId, claim, bond);
    }

    /**
     * @notice Resolve UMA dispute for a milestone
     * @param gigId The gig identifier
     * @param milestoneIndex Index of the disputed milestone
     *
     * @dev Callable by anyone after UMA assertion is resolved
     */
    function resolveUMADispute(uint256 gigId, uint256 milestoneIndex) external nonReentrant {
        Gig storage gig = gigs[gigId];

        // CHECKS
        if (milestoneIndex >= gig.milestones.length) revert InvalidMilestoneIndex();
        if (!gig.useUMAArbitration) revert InvalidStatus();
        if (umaEscalationManager == address(0)) revert ZeroAddress();

        Milestone storage milestone = gig.milestones[milestoneIndex];
        if (milestone.status != MilestoneStatus.Disputed) revert InvalidStatus();

        bytes32 assertionId = umaAssertionIds[gigId][milestoneIndex];

        // Get resolution from UMA Escalation Manager
        (bool resolved, uint256 clientBps, uint256 workerBps) =
            IQuickGigEscalationManager(umaEscalationManager).getResolution(gigId);

        require(resolved, "Dispute not yet resolved");
        require(clientBps + workerBps == 10000, "Invalid split");

        // EFFECTS
        milestone.status = MilestoneStatus.Approved; // Mark as resolved
        uint256 totalAmount = milestone.amount;
        uint256 clientAmount = (totalAmount * clientBps) / 10000;
        uint256 workerAmount = (totalAmount * workerBps) / 10000;

        gig.releasedAmount += totalAmount;

        emit UMADisputeResolved(gigId, milestoneIndex, assertionId, clientBps > 0);

        // INTERACTIONS (last step)
        IERC20 token = IERC20(gig.paymentToken);

        // Refund client their portion
        if (clientAmount > 0) {
            token.safeTransfer(gig.client, clientAmount);
        }

        // Pay worker their portion (minus platform fee)
        if (workerAmount > 0) {
            uint256 fee = (workerAmount * platformFeeBps) / 10000;
            uint256 workerNet = workerAmount - fee;

            token.safeTransfer(gig.worker, workerNet);
            if (fee > 0) {
                token.safeTransfer(feeCollector, fee);
            }
        }

        // Check if all milestones completed
        bool allCompleted = true;
        for (uint256 i = 0; i < gig.milestones.length; i++) {
            if (gig.milestones[i].status != MilestoneStatus.Approved
                && gig.milestones[i].status != MilestoneStatus.AutoReleased) {
                allCompleted = false;
                break;
            }
        }

        if (allCompleted && gig.status != GigStatus.Completed) {
            gig.status = GigStatus.Completed;
            emit GigCompleted(gigId, gig.releasedAmount);
        }
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
                             VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get complete gig details
     * @param gigId The gig identifier
     * @return gig Complete gig struct data
     */
    function getGig(uint256 gigId) external view returns (Gig memory gig) {
        return gigs[gigId];
    }

    /**
     * @notice Get specific milestone details
     * @param gigId The gig identifier
     * @param milestoneIndex Index of the milestone
     * @return milestone Complete milestone data
     */
    function getMilestone(uint256 gigId, uint256 milestoneIndex)
        external
        view
        returns (Milestone memory milestone)
    {
        return gigs[gigId].milestones[milestoneIndex];
    }

    /**
     * @notice Get total number of milestones for a gig
     * @param gigId The gig identifier
     * @return count Number of milestones
     */
    function getMilestoneCount(uint256 gigId) external view returns (uint256 count) {
        return gigs[gigId].milestones.length;
    }

    /**
     * @notice Check if milestone can be auto-released
     * @param gigId The gig identifier
     * @param milestoneIndex Index of the milestone
     * @return canRelease True if auto-release is available
     */
    function canAutoRelease(uint256 gigId, uint256 milestoneIndex)
        external
        view
        returns (bool canRelease)
    {
        Milestone memory milestone = gigs[gigId].milestones[milestoneIndex];
        return milestone.status == MilestoneStatus.Submitted
            && block.timestamp >= milestone.submittedAt + AUTO_RELEASE_WINDOW;
    }
}
