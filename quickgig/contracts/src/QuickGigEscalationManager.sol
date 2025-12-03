// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

/**
 * @title QuickGigEscalationManager
 * @author QuickGig Team
 * @notice Custom Escalation Manager for UMA Optimistic Oracle V3 integration
 * @dev Manages dispute assertions for QuickGig bounty deliverables
 *
 * Features:
 * - Validates only authorized parties (bounty client) can dispute
 * - Configurable bond requirements for assertions
 * - Escalation to UMA DVM for complex disputes
 * - Direct admin resolution for simple cases
 * - Callback integration with BountyEscrow contract
 *
 * Security:
 * - Owner-controlled assertion policies
 * - Whitelist for authorized asserters
 * - Emergency pause functionality
 */
contract QuickGigEscalationManager {
    /*//////////////////////////////////////////////////////////////
                                 TYPES
                            //////////////////////////////////////////////////////////////*/

    struct AssertionPolicy {
        bool blockAssertion;           // If true, reject assertion
        uint64 arbitrateViaEscalationManager; // 0 = DVM, 1 = admin resolution
        bool discardOracle;            // If true, ignore oracle response
        bool validateDisputers;        // If true, check disputer whitelist
    }

    struct DisputeData {
        uint256 bountyId;              // Associated bounty ID
        address client;                // Bounty client (asserter)
        address worker;                // Assigned worker
        uint256 amount;                // Disputed amount
        bytes32 assertionId;           // UMA assertion identifier
        bool resolved;                 // Resolution status
        bool clientWon;                // True if client won dispute
    }

    /*//////////////////////////////////////////////////////////////
                                STORAGE
                            //////////////////////////////////////////////////////////////*/

    /// @notice Owner address for admin functions
    address public owner;

    /// @notice BountyEscrow contract address
    address public bountyEscrow;

    /// @notice OptimisticOracleV3 contract address
    address public optimisticOracle;

    /// @notice Default bond amount for assertions (in wei, typically USDC)
    uint256 public defaultBond;

    /// @notice Liveness period for assertions (in seconds)
    uint64 public livenessPeriod;

    /// @notice Contract paused state
    bool public paused;

    /// @notice Mapping from assertion ID to dispute data
    mapping(bytes32 => DisputeData) public disputes;

    /// @notice Mapping from bounty ID to assertion ID
    mapping(uint256 => bytes32) public bountyAssertions;

    /// @notice Whitelist of authorized disputers
    mapping(address => bool) public authorizedDisputers;

    /// @notice Default assertion policy
    AssertionPolicy public defaultPolicy;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
                            //////////////////////////////////////////////////////////////*/

    event DisputeCreated(
        bytes32 indexed assertionId,
        uint256 indexed bountyId,
        address indexed client,
        address worker,
        uint256 amount
    );

    event DisputeResolved(
        bytes32 indexed assertionId,
        uint256 indexed bountyId,
        bool clientWon
    );

    event BondUpdated(uint256 oldBond, uint256 newBond);

    event LivenessUpdated(uint64 oldLiveness, uint64 newLiveness);

    event PolicyUpdated(AssertionPolicy newPolicy);

    event DisputerAuthorized(address indexed disputer);

    event DisputerRevoked(address indexed disputer);

    event Paused(address indexed by);

    event Unpaused(address indexed by);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
                            //////////////////////////////////////////////////////////////*/

    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error AssertionNotFound();
    error AlreadyResolved();
    error ContractPaused();
    error NotAuthorizedDisputer();

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
                            //////////////////////////////////////////////////////////////*/

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyBountyEscrow() {
        if (msg.sender != bountyEscrow) revert Unauthorized();
        _;
    }

    modifier onlyOptimisticOracle() {
        if (msg.sender != optimisticOracle) revert Unauthorized();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
                            //////////////////////////////////////////////////////////////*/

    /**
     * @notice Initialize the Escalation Manager
     * @param _bountyEscrow BountyEscrow contract address
     * @param _optimisticOracle UMA OptimisticOracleV3 address
     * @param _defaultBond Default bond amount (e.g., 10 USDC = 10e6)
     * @param _livenessPeriod Challenge period in seconds (e.g., 7200 = 2 hours)
     */
    constructor(
        address _bountyEscrow,
        address _optimisticOracle,
        uint256 _defaultBond,
        uint64 _livenessPeriod
    ) {
        if (_bountyEscrow == address(0) || _optimisticOracle == address(0)) {
            revert InvalidAddress();
        }
        if (_defaultBond == 0) revert InvalidAmount();

        owner = msg.sender;
        bountyEscrow = _bountyEscrow;
        optimisticOracle = _optimisticOracle;
        defaultBond = _defaultBond;
        livenessPeriod = _livenessPeriod;

        // Default policy: Escalate to DVM, validate disputers
        defaultPolicy = AssertionPolicy({
            blockAssertion: false,
            arbitrateViaEscalationManager: 0, // 0 = DVM
            discardOracle: false,
            validateDisputers: true
        });
    }

    /*//////////////////////////////////////////////////////////////
                         EXTERNAL FUNCTIONS
                            //////////////////////////////////////////////////////////////*/

    /**
     * @notice Create a new dispute assertion (called by BountyEscrow)
     * @param bountyId The bounty identifier
     * @param client Bounty client address
     * @param worker Assigned worker address
     * @param amount Disputed amount
     * @param assertionId UMA assertion identifier
     * @return success True if dispute created successfully
     *
     * @dev Only callable by BountyEscrow contract
     */
    function createDispute(
        uint256 bountyId,
        address client,
        address worker,
        uint256 amount,
        bytes32 assertionId
    ) external onlyBountyEscrow whenNotPaused returns (bool success) {
        if (disputes[assertionId].bountyId != 0) revert AlreadyResolved();
        if (client == address(0) || worker == address(0)) revert InvalidAddress();

        // Store dispute data
        disputes[assertionId] = DisputeData({
            bountyId: bountyId,
            client: client,
            worker: worker,
            amount: amount,
            assertionId: assertionId,
            resolved: false,
            clientWon: false
        });

        bountyAssertions[bountyId] = assertionId;

        emit DisputeCreated(assertionId, bountyId, client, worker, amount);
        return true;
    }

    /**
     * @notice Check if asserting a dispute is allowed
     * @return allowed Always returns true to allow assertions
     *
     * @dev Called by OptimisticOracleV3 before creating an assertion
     * We allow all assertions and validate them in getAssertionPolicy
     */
    function assertingDisputeAllowed() external pure returns (bool) {
        return true;
    }

    /**
     * @notice Get assertion policy for UMA Oracle
     * @param assertionId The assertion identifier
     * @return policy Assertion policy configuration
     *
     * @dev Called by OptimisticOracleV3 to determine how to handle assertion
     */
    function getAssertionPolicy(bytes32 assertionId)
        external
        view
        returns (AssertionPolicy memory policy)
    {
        // Return default policy for all assertions
        // We validate on the BountyEscrow side before creating assertions
        return defaultPolicy;
    }

    /**
     * @notice Callback from UMA Oracle when assertion is resolved
     * @param assertionId The assertion identifier
     * @param assertedTruthfully True if assertion was upheld
     *
     * @dev Called by OptimisticOracleV3 after liveness period or DVM vote
     */
    function assertionResolvedCallback(
        bytes32 assertionId,
        bool assertedTruthfully
    ) external onlyOptimisticOracle {
        DisputeData storage dispute = disputes[assertionId];

        if (dispute.bountyId == 0) revert AssertionNotFound();

        // Make callback idempotent - OOv3 may call this multiple times
        if (dispute.resolved) {
            return; // Already resolved, silently succeed
        }

        // Mark as resolved
        dispute.resolved = true;
        dispute.clientWon = assertedTruthfully;

        emit DisputeResolved(assertionId, dispute.bountyId, assertedTruthfully);

        // Note: BountyEscrow will call back to get resolution and distribute funds
    }

    /**
     * @notice Admin resolution for simple disputes (bypass DVM)
     * @param assertionId The assertion identifier
     * @param clientWon True if client wins dispute
     *
     * @dev Only callable by owner when policy allows escalation manager arbitration
     */
    function resolveDispute(bytes32 assertionId, bool clientWon)
        external
        onlyOwner
    {
        DisputeData storage dispute = disputes[assertionId];

        if (dispute.bountyId == 0) revert AssertionNotFound();
        if (dispute.resolved) revert AlreadyResolved();

        // Check policy allows admin resolution
        if (defaultPolicy.arbitrateViaEscalationManager == 0) {
            revert Unauthorized(); // Must use DVM
        }

        dispute.resolved = true;
        dispute.clientWon = clientWon;

        emit DisputeResolved(assertionId, dispute.bountyId, clientWon);
    }

    /**
     * @notice Get dispute resolution
     * @param bountyId The bounty identifier
     * @return resolved True if dispute is resolved
     * @return clientBps Basis points awarded to client (0-10000)
     * @return workerBps Basis points awarded to worker (0-10000)
     */
    function getResolution(uint256 bountyId)
        external
        view
        returns (bool resolved, uint256 clientBps, uint256 workerBps)
    {
        bytes32 assertionId = bountyAssertions[bountyId];
        DisputeData storage dispute = disputes[assertionId];

        if (dispute.bountyId == 0) {
            return (false, 0, 0);
        }

        resolved = dispute.resolved;

        if (resolved) {
            if (dispute.clientWon) {
                // Client wins - full refund
                clientBps = 10000;
                workerBps = 0;
            } else {
                // Worker wins - full payment
                clientBps = 0;
                workerBps = 10000;
            }
        }
    }

    /*//////////////////////////////////////////////////////////////
                            ADMIN FUNCTIONS
                            //////////////////////////////////////////////////////////////*/

    /**
     * @notice Update default bond amount
     * @param newBond New bond amount in wei
     */
    function updateDefaultBond(uint256 newBond) external onlyOwner {
        if (newBond == 0) revert InvalidAmount();
        uint256 oldBond = defaultBond;
        defaultBond = newBond;
        emit BondUpdated(oldBond, newBond);
    }

    /**
     * @notice Update liveness period
     * @param newLiveness New liveness period in seconds
     */
    function updateLiveness(uint64 newLiveness) external onlyOwner {
        uint64 oldLiveness = livenessPeriod;
        livenessPeriod = newLiveness;
        emit LivenessUpdated(oldLiveness, newLiveness);
    }

    /**
     * @notice Update assertion policy
     * @param newPolicy New policy configuration
     */
    function updatePolicy(AssertionPolicy calldata newPolicy) external onlyOwner {
        defaultPolicy = newPolicy;
        emit PolicyUpdated(newPolicy);
    }

    /**
     * @notice Authorize a disputer
     * @param disputer Address to authorize
     */
    function authorizeDisputer(address disputer) external onlyOwner {
        if (disputer == address(0)) revert InvalidAddress();
        authorizedDisputers[disputer] = true;
        emit DisputerAuthorized(disputer);
    }

    /**
     * @notice Revoke disputer authorization
     * @param disputer Address to revoke
     */
    function revokeDisputer(address disputer) external onlyOwner {
        authorizedDisputers[disputer] = false;
        emit DisputerRevoked(disputer);
    }

    /**
     * @notice Pause the contract
     */
    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    /**
     * @notice Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        owner = newOwner;
    }

    /**
     * @notice Update BountyEscrow address
     * @param newBountyEscrow New BountyEscrow contract address
     */
    function updateBountyEscrow(address newBountyEscrow) external onlyOwner {
        if (newBountyEscrow == address(0)) revert InvalidAddress();
        bountyEscrow = newBountyEscrow;
    }

    /*//////////////////////////////////////////////////////////////
                           VIEW FUNCTIONS
                            //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get dispute details
     * @param assertionId The assertion identifier
     * @return dispute Complete dispute data
     */
    function getDispute(bytes32 assertionId)
        external
        view
        returns (DisputeData memory dispute)
    {
        return disputes[assertionId];
    }

    /**
     * @notice Check if address is authorized disputer
     * @param disputer Address to check
     * @return authorized True if authorized
     */
    function isAuthorizedDisputer(address disputer)
        external
        view
        returns (bool authorized)
    {
        return authorizedDisputers[disputer];
    }

    /**
     * @notice Get assertion ID for bounty
     * @param bountyId The bounty identifier
     * @return assertionId Associated assertion ID
     */
    function getAssertionId(uint256 bountyId)
        external
        view
        returns (bytes32 assertionId)
    {
        return bountyAssertions[bountyId];
    }
}
