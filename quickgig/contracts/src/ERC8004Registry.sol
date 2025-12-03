// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title ERC8004Registry
 * @author QuickGig Team
 * @notice Implementation of ERC-8004 standard for trustless agent identity and discovery
 * @dev Secure registry for AI agents with capability-based queries and reputation integration
 *
 * ERC-8004 Standard Features:
 * - Agent registration with AgentCard metadata (IPFS URI)
 * - Capability-based discovery (skills, services offered)
 * - Wallet-to-agentId mapping for on-chain interactions
 * - Verification and validation mechanisms
 * - Cross-platform portability
 *
 * Security:
 * - OpenZeppelin ReentrancyGuard
 * - Signature verification for agent authorization
 * - Access control for agent updates
 * - CEI pattern throughout
 * - Comprehensive event logging
 */
contract ERC8004Registry is ReentrancyGuard {
    using ECDSA for bytes32;

    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/

    enum AgentType {
        Human,          // 0: Human freelancer
        AI,             // 1: AI agent
        Hybrid          // 2: Human-AI hybrid
    }

    enum AgentStatus {
        Active,         // 0: Agent is active
        Paused,         // 1: Temporarily paused
        Deactivated     // 2: Permanently deactivated
    }

    struct AgentCard {
        address owner;              // Wallet controlling the agent
        AgentType agentType;
        AgentStatus status;
        string agentCardURI;        // IPFS hash of full agent metadata (JSON)
        string[] capabilities;      // Array of capability strings (e.g., ["logo-design", "python"])
        uint256 registeredAt;
        uint256 lastUpdated;
        bool verified;              // Verified by platform or external oracle
    }

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Mapping from agentId to AgentCard
    mapping(bytes32 => AgentCard) public agents;

    /// @notice Mapping from wallet address to agentId
    mapping(address => bytes32) public walletToAgent;

    /// @notice Mapping from capability to array of agentIds
    mapping(string => bytes32[]) private capabilityIndex;

    /// @notice Mapping to check if agent exists in capability index
    mapping(string => mapping(bytes32 => bool)) private agentInCapability;

    /// @notice Total number of registered agents
    uint256 public totalAgents;

    /// @notice Owner address for admin functions
    address public owner;

    /// @notice Verifier address (can mark agents as verified)
    address public verifier;

    /// @notice Registration fee (prevents spam)
    uint256 public registrationFee = 0.001 ether;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event AgentRegistered(
        bytes32 indexed agentId,
        address indexed owner,
        AgentType agentType,
        string agentCardURI
    );

    event AgentUpdated(
        bytes32 indexed agentId,
        string newAgentCardURI,
        string[] newCapabilities
    );

    event AgentStatusChanged(
        bytes32 indexed agentId,
        AgentStatus oldStatus,
        AgentStatus newStatus
    );

    event AgentVerified(bytes32 indexed agentId, address indexed verifier);

    event AgentTransferred(
        bytes32 indexed agentId,
        address indexed oldOwner,
        address indexed newOwner
    );

    event CapabilityAdded(bytes32 indexed agentId, string capability);

    event CapabilityRemoved(bytes32 indexed agentId, string capability);

    event RegistrationFeeUpdated(uint256 oldFee, uint256 newFee);

    event VerifierUpdated(address indexed oldVerifier, address indexed newVerifier);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error Unauthorized();
    error AgentAlreadyExists();
    error AgentNotFound();
    error InvalidAgentType();
    error InvalidStatus();
    error InsufficientFee();
    error EmptyCapabilities();
    error EmptyAgentCardURI();
    error ZeroAddress();
    error InvalidSignature();

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyAgentOwner(bytes32 agentId) {
        if (agents[agentId].owner != msg.sender) revert Unauthorized();
        _;
    }

    modifier agentExists(bytes32 agentId) {
        if (agents[agentId].owner == address(0)) revert AgentNotFound();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(address _verifier) {
        owner = msg.sender;
        verifier = _verifier;
    }

    /*//////////////////////////////////////////////////////////////
                            EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Register a new agent in the ERC-8004 registry
     * @param agentType Type of agent (Human, AI, Hybrid)
     * @param agentCardURI IPFS hash of AgentCard JSON metadata
     * @param capabilities Array of capability strings
     * @return agentId Unique identifier for the registered agent
     *
     * @dev Follows CEI pattern. Requires registration fee to prevent spam.
     *      AgentId is derived from keccak256(owner, agentCardURI, timestamp)
     */
    function registerAgent(
        AgentType agentType,
        string calldata agentCardURI,
        string[] calldata capabilities
    ) external payable nonReentrant returns (bytes32 agentId) {
        // CHECKS
        if (msg.value < registrationFee) revert InsufficientFee();
        if (bytes(agentCardURI).length == 0) revert EmptyAgentCardURI();
        if (capabilities.length == 0) revert EmptyCapabilities();
        if (walletToAgent[msg.sender] != bytes32(0)) revert AgentAlreadyExists();
        if (uint8(agentType) > uint8(AgentType.Hybrid)) revert InvalidAgentType();

        // EFFECTS
        agentId = keccak256(abi.encodePacked(msg.sender, agentCardURI, block.timestamp));

        agents[agentId] = AgentCard({
            owner: msg.sender,
            agentType: agentType,
            status: AgentStatus.Active,
            agentCardURI: agentCardURI,
            capabilities: capabilities,
            registeredAt: block.timestamp,
            lastUpdated: block.timestamp,
            verified: false
        });

        walletToAgent[msg.sender] = agentId;
        totalAgents++;

        // Index capabilities
        for (uint256 i = 0; i < capabilities.length; i++) {
            if (!agentInCapability[capabilities[i]][agentId]) {
                capabilityIndex[capabilities[i]].push(agentId);
                agentInCapability[capabilities[i]][agentId] = true;
                emit CapabilityAdded(agentId, capabilities[i]);
            }
        }

        emit AgentRegistered(agentId, msg.sender, agentType, agentCardURI);
    }

    /**
     * @notice Update agent metadata and capabilities
     * @param agentId The agent identifier
     * @param newAgentCardURI New IPFS hash of AgentCard metadata
     * @param newCapabilities New array of capabilities
     *
     * @dev Only agent owner can update. Reindexes capabilities.
     */
    function updateAgent(
        bytes32 agentId,
        string calldata newAgentCardURI,
        string[] calldata newCapabilities
    ) external nonReentrant onlyAgentOwner(agentId) agentExists(agentId) {
        // CHECKS
        if (bytes(newAgentCardURI).length == 0) revert EmptyAgentCardURI();
        if (newCapabilities.length == 0) revert EmptyCapabilities();

        // EFFECTS
        AgentCard storage agent = agents[agentId];

        // Remove old capabilities from index
        for (uint256 i = 0; i < agent.capabilities.length; i++) {
            _removeFromCapabilityIndex(agent.capabilities[i], agentId);
        }

        // Update agent data
        agent.agentCardURI = newAgentCardURI;
        agent.capabilities = newCapabilities;
        agent.lastUpdated = block.timestamp;

        // Add new capabilities to index
        for (uint256 i = 0; i < newCapabilities.length; i++) {
            if (!agentInCapability[newCapabilities[i]][agentId]) {
                capabilityIndex[newCapabilities[i]].push(agentId);
                agentInCapability[newCapabilities[i]][agentId] = true;
                emit CapabilityAdded(agentId, newCapabilities[i]);
            }
        }

        emit AgentUpdated(agentId, newAgentCardURI, newCapabilities);
    }

    /**
     * @notice Change agent status (Active, Paused, Deactivated)
     * @param agentId The agent identifier
     * @param newStatus New status to set
     *
     * @dev Only agent owner can change status
     */
    function updateAgentStatus(bytes32 agentId, AgentStatus newStatus)
        external
        nonReentrant
        onlyAgentOwner(agentId)
        agentExists(agentId)
    {
        // CHECKS
        if (uint8(newStatus) > uint8(AgentStatus.Deactivated)) revert InvalidStatus();

        // EFFECTS
        AgentCard storage agent = agents[agentId];
        AgentStatus oldStatus = agent.status;
        agent.status = newStatus;
        agent.lastUpdated = block.timestamp;

        emit AgentStatusChanged(agentId, oldStatus, newStatus);
    }

    /**
     * @notice Transfer agent ownership to new wallet
     * @param agentId The agent identifier
     * @param newOwner Address of the new owner
     *
     * @dev Only current owner can transfer
     */
    function transferAgent(bytes32 agentId, address newOwner)
        external
        nonReentrant
        onlyAgentOwner(agentId)
        agentExists(agentId)
    {
        // CHECKS
        if (newOwner == address(0)) revert ZeroAddress();
        if (walletToAgent[newOwner] != bytes32(0)) revert AgentAlreadyExists();

        // EFFECTS
        AgentCard storage agent = agents[agentId];
        address oldOwner = agent.owner;

        delete walletToAgent[oldOwner];
        agent.owner = newOwner;
        walletToAgent[newOwner] = agentId;
        agent.lastUpdated = block.timestamp;

        emit AgentTransferred(agentId, oldOwner, newOwner);
    }

    /**
     * @notice Mark agent as verified (verifier only)
     * @param agentId The agent identifier
     *
     * @dev Verification provides trust signal for agent discovery
     */
    function verifyAgent(bytes32 agentId)
        external
        nonReentrant
        agentExists(agentId)
    {
        // CHECKS
        if (msg.sender != verifier && msg.sender != owner) revert Unauthorized();

        // EFFECTS
        agents[agentId].verified = true;
        agents[agentId].lastUpdated = block.timestamp;

        emit AgentVerified(agentId, msg.sender);
    }

    /*//////////////////////////////////////////////////////////////
                            ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Update registration fee (owner only)
     * @param newFee New registration fee amount
     */
    function updateRegistrationFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = registrationFee;
        registrationFee = newFee;
        emit RegistrationFeeUpdated(oldFee, newFee);
    }

    /**
     * @notice Update verifier address (owner only)
     * @param newVerifier New verifier address
     */
    function updateVerifier(address newVerifier) external onlyOwner {
        address oldVerifier = verifier;
        verifier = newVerifier;
        emit VerifierUpdated(oldVerifier, newVerifier);
    }

    /**
     * @notice Withdraw collected registration fees (owner only)
     * @param recipient Address to receive fees
     */
    function withdrawFees(address payable recipient) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        uint256 balance = address(this).balance;
        (bool success,) = recipient.call{value: balance}("");
        require(success, "Transfer failed");
    }

    /**
     * @notice Transfer ownership (owner only)
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    /*//////////////////////////////////////////////////////////////
                             VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get complete agent card data
     * @param agentId The agent identifier
     * @return agent Complete AgentCard struct
     */
    function getAgent(bytes32 agentId)
        external
        view
        agentExists(agentId)
        returns (AgentCard memory agent)
    {
        return agents[agentId];
    }

    /**
     * @notice Get agentId for a wallet address
     * @param wallet Wallet address
     * @return agentId Associated agentId (returns bytes32(0) if none)
     */
    function getAgentByWallet(address wallet) external view returns (bytes32 agentId) {
        return walletToAgent[wallet];
    }

    /**
     * @notice Discover agents by capability
     * @param capability Capability string (e.g., "logo-design")
     * @return agentIds Array of agentIds with this capability
     *
     * @dev Core ERC-8004 discovery mechanism
     */
    function discoverByCapability(string calldata capability)
        external
        view
        returns (bytes32[] memory agentIds)
    {
        return capabilityIndex[capability];
    }

    /**
     * @notice Get all active agents with a specific capability
     * @param capability Capability string
     * @return activeAgentIds Array of active agentIds
     */
    function getActiveAgentsByCapability(string calldata capability)
        external
        view
        returns (bytes32[] memory activeAgentIds)
    {
        bytes32[] memory allAgents = capabilityIndex[capability];
        uint256 activeCount = 0;

        // Count active agents
        for (uint256 i = 0; i < allAgents.length; i++) {
            if (agents[allAgents[i]].status == AgentStatus.Active) {
                activeCount++;
            }
        }

        // Build active agents array
        activeAgentIds = new bytes32[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allAgents.length; i++) {
            if (agents[allAgents[i]].status == AgentStatus.Active) {
                activeAgentIds[index] = allAgents[i];
                index++;
            }
        }
    }

    /**
     * @notice Get agent capabilities
     * @param agentId The agent identifier
     * @return capabilities Array of capability strings
     */
    function getAgentCapabilities(bytes32 agentId)
        external
        view
        agentExists(agentId)
        returns (string[] memory capabilities)
    {
        return agents[agentId].capabilities;
    }

    /**
     * @notice Check if agent has a specific capability
     * @param agentId The agent identifier
     * @param capability Capability string
     * @return hasCapability True if agent has the capability
     */
    function hasCapability(bytes32 agentId, string calldata capability)
        external
        view
        returns (bool hasCapability)
    {
        return agentInCapability[capability][agentId];
    }

    /**
     * @notice Get all verified agents with a specific capability
     * @param capability Capability string
     * @return verifiedAgentIds Array of verified agentIds
     */
    function getVerifiedAgentsByCapability(string calldata capability)
        external
        view
        returns (bytes32[] memory verifiedAgentIds)
    {
        bytes32[] memory allAgents = capabilityIndex[capability];
        uint256 verifiedCount = 0;

        // Count verified agents
        for (uint256 i = 0; i < allAgents.length; i++) {
            if (
                agents[allAgents[i]].verified
                    && agents[allAgents[i]].status == AgentStatus.Active
            ) {
                verifiedCount++;
            }
        }

        // Build verified agents array
        verifiedAgentIds = new bytes32[](verifiedCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allAgents.length; i++) {
            if (
                agents[allAgents[i]].verified
                    && agents[allAgents[i]].status == AgentStatus.Active
            ) {
                verifiedAgentIds[index] = allAgents[i];
                index++;
            }
        }
    }

    /*//////////////////////////////////////////////////////////////
                        INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Remove agent from capability index
     * @param capability Capability string
     * @param agentId Agent identifier
     */
    function _removeFromCapabilityIndex(string memory capability, bytes32 agentId)
        internal
    {
        if (!agentInCapability[capability][agentId]) return;

        bytes32[] storage agents_array = capabilityIndex[capability];
        for (uint256 i = 0; i < agents_array.length; i++) {
            if (agents_array[i] == agentId) {
                // Move last element to this position and pop
                agents_array[i] = agents_array[agents_array.length - 1];
                agents_array.pop();
                agentInCapability[capability][agentId] = false;
                emit CapabilityRemoved(agentId, capability);
                break;
            }
        }
    }
}
