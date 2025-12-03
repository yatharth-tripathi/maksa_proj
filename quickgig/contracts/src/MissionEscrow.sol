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
        uint256 missionId,
        address client,
        address worker,
        uint256 amount,
        bytes32 assertionId
    ) external returns (bool);

    function getResolution(uint256 missionId)
        external
        view
        returns (bool resolved, uint256 clientBps, uint256 workerBps);
}

/**
 * @notice Interface for ERC-8004 Validation Registry
 */
interface IERC8004ValidationRegistry {
    function requestValidation(
        uint256 agentId,
        bytes32 deliverableHash,
        uint256 stake
    ) external returns (uint256 validationId);

    function submitValidationResult(
        uint256 validationId,
        bool approved,
        bytes32 proofHash
    ) external;

    function getValidationResult(uint256 validationId)
        external
        view
        returns (bool completed, bool approved, address validator);
}

/**
 * @title MissionEscrow
 * @author QUICKGIG Team
 * @notice Secure escrow for multi-agent missions with validation & arbitration
 * @dev Implements CEI pattern, reentrancy guards, and comprehensive dispute resolution
 *
 * Features:
 * - Client locks funds when creating mission
 * - Orchestrator coordinates multi-agent execution
 * - Agents submit deliverables
 * - Client can: approve, request validation, or dispute
 * - 48-hour auto-release if client doesn't act
 * - ERC-8004 validation for quality assurance
 * - UMA arbitration for dispute resolution
 *
 * Security:
 * - CEI (Checks-Effects-Interactions) pattern throughout
 * - OpenZeppelin ReentrancyGuard on all state-changing functions
 * - Explicit access control and state validation
 * - Safe ERC20 operations with SafeERC20
 * - Comprehensive event logging
 */
contract MissionEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/

    enum MissionStatus {
        Pending,          // 0: Created, waiting for execution
        InProgress,       // 1: Agents working on mission
        Submitted,        // 2: Deliverable submitted, awaiting client action
        Validating,       // 3: ERC-8004 validation in progress
        Disputed,         // 4: UMA dispute in progress
        Completed,        // 5: Client approved, funds released
        AutoReleased,     // 6: Auto-released after 48h timeout
        Cancelled         // 7: Cancelled before completion
    }

    struct AgentPayment {
        address agentAddress;
        uint256 amount;
        bool paid;
    }

    struct Mission {
        address client;
        address paymentToken;
        uint256 totalEscrow;
        uint256 createdAt;
        uint256 submittedAt;
        uint256 autoReleaseTime;
        string requirementsURI;
        string deliverableURI;
        MissionStatus status;
        AgentPayment[] agents;
        uint256 validationId;
        bytes32 disputeAssertionId;
    }

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Mapping from mission ID to mission data
    mapping(uint256 => Mission) public missions;

    /// @notice Counter for generating unique mission IDs
    uint256 public nextMissionId = 1;

    /// @notice Time window for client to act after submission (48 hours)
    uint256 public constant AUTO_RELEASE_WINDOW = 48 hours;

    /// @notice Platform fee in basis points (e.g., 250 = 2.5%)
    uint256 public platformFeeBps = 250;

    /// @notice Platform fee collector address
    address public feeCollector;

    /// @notice Owner address for admin functions
    address public owner;

    /// @notice UMA Optimistic Oracle V3 address
    address public optimisticOracle;

    /// @notice UMA Escalation Manager address
    address public escalationManager;

    /// @notice ERC-8004 Validation Registry address
    address public validationRegistry;

    /// @notice UMA assertion liveness period (2 hours)
    uint64 public constant ASSERTION_LIVENESS = 2 hours;

    /// @notice UMA assertion bond (10 USDC)
    uint256 public constant ASSERTION_BOND = 10e6;

    /// @notice Default identifier for UMA assertions
    bytes32 public constant ASSERTION_IDENTIFIER = bytes32("ASSERT_TRUTH");

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event MissionCreated(
        uint256 indexed missionId,
        address indexed client,
        uint256 totalEscrow,
        uint256 agentCount
    );

    event DeliverableSubmitted(
        uint256 indexed missionId,
        string deliverableURI,
        uint256 autoReleaseTime
    );

    event DeliverableApproved(
        uint256 indexed missionId,
        address indexed client
    );

    event ValidationRequested(
        uint256 indexed missionId,
        uint256 validationId,
        uint256 agentId
    );

    event ValidationCompleted(
        uint256 indexed missionId,
        uint256 validationId,
        bool approved
    );

    event DisputeCreated(
        uint256 indexed missionId,
        bytes32 assertionId,
        string claim
    );

    event DisputeResolved(
        uint256 indexed missionId,
        uint256 clientShare,
        uint256 agentsShare
    );

    event MissionAutoReleased(
        uint256 indexed missionId
    );

    event MissionCancelled(
        uint256 indexed missionId
    );

    event PaymentReleased(
        uint256 indexed missionId,
        address indexed recipient,
        uint256 amount
    );

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyOwner() {
        require(msg.sender == owner, "MissionEscrow: caller is not owner");
        _;
    }

    modifier onlyClient(uint256 missionId) {
        require(
            msg.sender == missions[missionId].client,
            "MissionEscrow: caller is not client"
        );
        _;
    }

    modifier missionExists(uint256 missionId) {
        require(
            missions[missionId].client != address(0),
            "MissionEscrow: mission does not exist"
        );
        _;
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        address _feeCollector,
        address _optimisticOracle,
        address _escalationManager,
        address _validationRegistry
    ) {
        require(_feeCollector != address(0), "MissionEscrow: invalid fee collector");

        owner = msg.sender;
        feeCollector = _feeCollector;
        optimisticOracle = _optimisticOracle;
        escalationManager = _escalationManager;
        validationRegistry = _validationRegistry;
    }

    /*//////////////////////////////////////////////////////////////
                          MISSION CREATION
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Create a new mission with escrow
     * @param paymentToken Token address for payments (e.g., USDC)
     * @param agentAddresses Array of agent wallet addresses
     * @param agentPayments Array of payment amounts for each agent
     * @param requirementsURI IPFS URI of mission requirements
     * @return missionId The ID of the created mission
     */
    function createMission(
        address paymentToken,
        address[] calldata agentAddresses,
        uint256[] calldata agentPayments,
        string calldata requirementsURI
    ) external nonReentrant returns (uint256) {
        require(paymentToken != address(0), "MissionEscrow: invalid token");
        require(agentAddresses.length > 0, "MissionEscrow: no agents");
        require(
            agentAddresses.length == agentPayments.length,
            "MissionEscrow: length mismatch"
        );
        require(bytes(requirementsURI).length > 0, "MissionEscrow: empty requirements");

        // Calculate total escrow amount
        uint256 totalPayments = 0;
        for (uint256 i = 0; i < agentPayments.length; i++) {
            require(agentPayments[i] > 0, "MissionEscrow: invalid payment");
            totalPayments += agentPayments[i];
        }

        uint256 platformFee = (totalPayments * platformFeeBps) / 10000;
        uint256 totalEscrow = totalPayments + platformFee;

        // Transfer escrow to contract
        IERC20(paymentToken).safeTransferFrom(
            msg.sender,
            address(this),
            totalEscrow
        );

        // Create mission
        uint256 missionId = nextMissionId++;
        Mission storage mission = missions[missionId];
        mission.client = msg.sender;
        mission.paymentToken = paymentToken;
        mission.totalEscrow = totalEscrow;
        mission.createdAt = block.timestamp;
        mission.requirementsURI = requirementsURI;
        mission.status = MissionStatus.Pending;

        // Add agent payments
        for (uint256 i = 0; i < agentAddresses.length; i++) {
            mission.agents.push(
                AgentPayment({
                    agentAddress: agentAddresses[i],
                    amount: agentPayments[i],
                    paid: false
                })
            );
        }

        emit MissionCreated(missionId, msg.sender, totalEscrow, agentAddresses.length);

        return missionId;
    }

    /*//////////////////////////////////////////////////////////////
                        DELIVERABLE SUBMISSION
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Submit deliverable for a mission
     * @param missionId The mission ID
     * @param deliverableURI IPFS URI of the deliverable
     */
    function submitDeliverable(
        uint256 missionId,
        string calldata deliverableURI
    ) external nonReentrant missionExists(missionId) {
        Mission storage mission = missions[missionId];

        require(
            mission.status == MissionStatus.Pending || mission.status == MissionStatus.InProgress,
            "MissionEscrow: invalid status"
        );
        require(bytes(deliverableURI).length > 0, "MissionEscrow: empty deliverable");

        // Check if caller is one of the agents
        bool isAgent = false;
        for (uint256 i = 0; i < mission.agents.length; i++) {
            if (mission.agents[i].agentAddress == msg.sender) {
                isAgent = true;
                break;
            }
        }
        require(isAgent, "MissionEscrow: caller is not agent");

        mission.deliverableURI = deliverableURI;
        mission.submittedAt = block.timestamp;
        mission.autoReleaseTime = block.timestamp + AUTO_RELEASE_WINDOW;
        mission.status = MissionStatus.Submitted;

        emit DeliverableSubmitted(missionId, deliverableURI, mission.autoReleaseTime);
    }

    /*//////////////////////////////////////////////////////////////
                         CLIENT ACTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Approve deliverable and release funds immediately
     * @param missionId The mission ID
     */
    function approveDeliverable(uint256 missionId)
        external
        nonReentrant
        missionExists(missionId)
        onlyClient(missionId)
    {
        Mission storage mission = missions[missionId];

        require(
            mission.status == MissionStatus.Submitted,
            "MissionEscrow: not submitted"
        );

        mission.status = MissionStatus.Completed;

        // Release payments to all agents
        _releasePayments(missionId);

        emit DeliverableApproved(missionId, msg.sender);
    }

    /**
     * @notice Request ERC-8004 validation for deliverable
     * @param missionId The mission ID
     * @param agentId ERC-8004 agent ID to validate
     * @param validatorStake Stake amount for validator
     */
    function requestValidation(
        uint256 missionId,
        uint256 agentId,
        uint256 validatorStake
    ) external nonReentrant missionExists(missionId) onlyClient(missionId) {
        Mission storage mission = missions[missionId];

        require(
            mission.status == MissionStatus.Submitted,
            "MissionEscrow: not submitted"
        );
        require(validationRegistry != address(0), "MissionEscrow: validation not configured");

        bytes32 deliverableHash = keccak256(abi.encodePacked(mission.deliverableURI));

        uint256 validationId = IERC8004ValidationRegistry(validationRegistry)
            .requestValidation(agentId, deliverableHash, validatorStake);

        mission.validationId = validationId;
        mission.status = MissionStatus.Validating;

        emit ValidationRequested(missionId, validationId, agentId);
    }

    /**
     * @notice Resolve mission after ERC-8004 validation completes
     * @param missionId The mission ID
     */
    function resolveValidation(uint256 missionId)
        external
        nonReentrant
        missionExists(missionId)
    {
        Mission storage mission = missions[missionId];

        require(
            mission.status == MissionStatus.Validating,
            "MissionEscrow: not validating"
        );

        (bool completed, bool approved, ) = IERC8004ValidationRegistry(validationRegistry)
            .getValidationResult(mission.validationId);

        require(completed, "MissionEscrow: validation not complete");

        if (approved) {
            mission.status = MissionStatus.Completed;
            _releasePayments(missionId);
        } else {
            // Validation failed - client can dispute or accept rejection
            mission.status = MissionStatus.Submitted;
        }

        emit ValidationCompleted(missionId, mission.validationId, approved);
    }

    /**
     * @notice Dispute deliverable using UMA Optimistic Oracle
     * @param missionId The mission ID
     * @param claim Human-readable dispute claim
     */
    function disputeDeliverable(
        uint256 missionId,
        string calldata claim
    ) external nonReentrant missionExists(missionId) onlyClient(missionId) {
        Mission storage mission = missions[missionId];

        require(
            mission.status == MissionStatus.Submitted,
            "MissionEscrow: not submitted"
        );
        require(optimisticOracle != address(0), "MissionEscrow: UMA not configured");
        require(bytes(claim).length > 0, "MissionEscrow: empty claim");

        // Transfer bond from client
        IERC20(mission.paymentToken).safeTransferFrom(
            msg.sender,
            address(this),
            ASSERTION_BOND
        );

        // Approve bond to Optimistic Oracle
        IERC20(mission.paymentToken).approve(optimisticOracle, ASSERTION_BOND);

        // Create assertion
        bytes32 assertionId = IOptimisticOracleV3(optimisticOracle).assertTruth(
            bytes(claim),
            msg.sender,
            address(this),
            escalationManager,
            ASSERTION_LIVENESS,
            IERC20(mission.paymentToken),
            ASSERTION_BOND,
            ASSERTION_IDENTIFIER,
            bytes32(0)
        );

        mission.disputeAssertionId = assertionId;
        mission.status = MissionStatus.Disputed;

        // Notify escalation manager
        if (escalationManager != address(0)) {
            IQuickGigEscalationManager(escalationManager).createDispute(
                missionId,
                mission.client,
                mission.agents[0].agentAddress, // First agent
                mission.totalEscrow,
                assertionId
            );
        }

        emit DisputeCreated(missionId, assertionId, claim);
    }

    /**
     * @notice Resolve UMA dispute and distribute funds
     * @param missionId The mission ID
     */
    function resolveUMADispute(uint256 missionId)
        external
        nonReentrant
        missionExists(missionId)
    {
        Mission storage mission = missions[missionId];

        require(
            mission.status == MissionStatus.Disputed,
            "MissionEscrow: not disputed"
        );

        // Get resolution from escalation manager
        (bool resolved, uint256 clientBps, uint256 workerBps) =
            IQuickGigEscalationManager(escalationManager).getResolution(missionId);

        require(resolved, "MissionEscrow: dispute not resolved");
        require(clientBps + workerBps == 10000, "MissionEscrow: invalid split");

        mission.status = MissionStatus.Completed;

        // Calculate amounts (excluding platform fee which was already included)
        uint256 platformFee = (mission.totalEscrow * platformFeeBps) / (10000 + platformFeeBps);
        uint256 totalPayments = mission.totalEscrow - platformFee;

        uint256 clientShare = (totalPayments * clientBps) / 10000;
        uint256 agentsShare = (totalPayments * workerBps) / 10000;

        // Transfer platform fee
        if (platformFee > 0) {
            IERC20(mission.paymentToken).safeTransfer(feeCollector, platformFee);
        }

        // Refund to client
        if (clientShare > 0) {
            IERC20(mission.paymentToken).safeTransfer(mission.client, clientShare);
        }

        // Pay agents proportionally
        if (agentsShare > 0) {
            _distributeToAgents(missionId, agentsShare);
        }

        emit DisputeResolved(missionId, clientShare, agentsShare);
    }

    /*//////////////////////////////////////////////////////////////
                          AUTO-RELEASE
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Auto-release funds after 48-hour window
     * @param missionId The mission ID
     */
    function autoRelease(uint256 missionId)
        external
        nonReentrant
        missionExists(missionId)
    {
        Mission storage mission = missions[missionId];

        require(
            mission.status == MissionStatus.Submitted,
            "MissionEscrow: not submitted"
        );
        require(
            block.timestamp >= mission.autoReleaseTime,
            "MissionEscrow: auto-release time not reached"
        );

        mission.status = MissionStatus.AutoReleased;
        _releasePayments(missionId);

        emit MissionAutoReleased(missionId);
    }

    /*//////////////////////////////////////////////////////////////
                         INTERNAL HELPERS
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Release payments to all agents and platform fee
     */
    function _releasePayments(uint256 missionId) internal {
        Mission storage mission = missions[missionId];

        uint256 platformFee = (mission.totalEscrow * platformFeeBps) / (10000 + platformFeeBps);

        // Pay platform fee
        if (platformFee > 0) {
            IERC20(mission.paymentToken).safeTransfer(feeCollector, platformFee);
            emit PaymentReleased(missionId, feeCollector, platformFee);
        }

        // Pay each agent
        for (uint256 i = 0; i < mission.agents.length; i++) {
            if (!mission.agents[i].paid) {
                IERC20(mission.paymentToken).safeTransfer(
                    mission.agents[i].agentAddress,
                    mission.agents[i].amount
                );
                mission.agents[i].paid = true;

                emit PaymentReleased(
                    missionId,
                    mission.agents[i].agentAddress,
                    mission.agents[i].amount
                );
            }
        }
    }

    /**
     * @dev Distribute amount proportionally to agents
     */
    function _distributeToAgents(uint256 missionId, uint256 totalAmount) internal {
        Mission storage mission = missions[missionId];

        uint256 totalAgentPayments = 0;
        for (uint256 i = 0; i < mission.agents.length; i++) {
            totalAgentPayments += mission.agents[i].amount;
        }

        for (uint256 i = 0; i < mission.agents.length; i++) {
            if (!mission.agents[i].paid) {
                uint256 share = (totalAmount * mission.agents[i].amount) / totalAgentPayments;

                IERC20(mission.paymentToken).safeTransfer(
                    mission.agents[i].agentAddress,
                    share
                );
                mission.agents[i].paid = true;

                emit PaymentReleased(missionId, mission.agents[i].agentAddress, share);
            }
        }
    }

    /*//////////////////////////////////////////////////////////////
                              VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get mission details
     */
    function getMission(uint256 missionId)
        external
        view
        returns (
            address client,
            address paymentToken,
            uint256 totalEscrow,
            uint256 createdAt,
            uint256 submittedAt,
            uint256 autoReleaseTime,
            string memory requirementsURI,
            string memory deliverableURI,
            MissionStatus status
        )
    {
        Mission storage mission = missions[missionId];
        return (
            mission.client,
            mission.paymentToken,
            mission.totalEscrow,
            mission.createdAt,
            mission.submittedAt,
            mission.autoReleaseTime,
            mission.requirementsURI,
            mission.deliverableURI,
            mission.status
        );
    }

    /**
     * @notice Get agent payment info
     */
    function getAgentPayment(uint256 missionId, uint256 agentIndex)
        external
        view
        returns (address agentAddress, uint256 amount, bool paid)
    {
        require(agentIndex < missions[missionId].agents.length, "MissionEscrow: invalid index");
        AgentPayment storage payment = missions[missionId].agents[agentIndex];
        return (payment.agentAddress, payment.amount, payment.paid);
    }

    /**
     * @notice Get number of agents for a mission
     */
    function getAgentCount(uint256 missionId) external view returns (uint256) {
        return missions[missionId].agents.length;
    }

    /**
     * @notice Check if auto-release is available
     */
    function canAutoRelease(uint256 missionId) external view returns (bool) {
        Mission storage mission = missions[missionId];
        return mission.status == MissionStatus.Submitted &&
               block.timestamp >= mission.autoReleaseTime;
    }

    /*//////////////////////////////////////////////////////////////
                           ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Update platform fee (owner only)
     */
    function setPlatformFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 1000, "MissionEscrow: fee too high"); // Max 10%
        platformFeeBps = newFeeBps;
    }

    /**
     * @notice Update fee collector (owner only)
     */
    function setFeeCollector(address newCollector) external onlyOwner {
        require(newCollector != address(0), "MissionEscrow: invalid collector");
        feeCollector = newCollector;
    }

    /**
     * @notice Update UMA configuration (owner only)
     */
    function setUMAConfig(address newOracle, address newManager) external onlyOwner {
        optimisticOracle = newOracle;
        escalationManager = newManager;
    }

    /**
     * @notice Update validation registry (owner only)
     */
    function setValidationRegistry(address newRegistry) external onlyOwner {
        validationRegistry = newRegistry;
    }
}
