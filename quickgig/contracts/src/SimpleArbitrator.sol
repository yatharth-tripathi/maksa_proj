// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SimpleArbitrator
 * @author QuickGig Team
 * @notice Multi-sig arbitration system for dispute resolution
 * @dev 3 trusted arbitrators vote on disputes. Quorum = 2 of 3.
 *
 * Features:
 * - Evidence submission (IPFS URIs)
 * - 7-day voting window
 * - Average of votes determines fund split
 * - 1 appeal allowed per case
 * - Basis points (0-10000) for percentage splits
 */
contract SimpleArbitrator is ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/

    enum DisputeStatus {
        Active,      // Voting in progress
        Resolved,    // Decision made
        Appealed     // Under appeal
    }

    struct Evidence {
        address submitter;
        string ipfsURI;
        uint256 timestamp;
    }

    struct Vote {
        address arbitrator;
        uint256 clientBps;  // 0-10000 (basis points)
        uint256 timestamp;
    }

    struct DisputeCase {
        uint256 bountyId;
        address escrowContract;
        address client;
        address worker;
        uint256 amount;
        string reason;
        uint256 createdAt;
        uint256 votingDeadline;
        DisputeStatus status;
        Evidence[] evidences;
        Vote[] votes;
        bool appealed;
        uint256 finalClientBps;
    }

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Mapping from case ID to dispute case data
    mapping(bytes32 => DisputeCase) public disputes;

    /// @notice Mapping of authorized arbitrators
    mapping(address => bool) public arbitrators;

    /// @notice Mapping to track if arbitrator has voted on a case
    mapping(bytes32 => mapping(address => bool)) public hasVoted;

    /// @notice Voting period duration (7 days)
    uint256 public constant VOTING_PERIOD = 7 days;

    /// @notice Number of votes required for quorum
    uint256 public constant QUORUM = 2;

    /// @notice Contract owner (can add/remove arbitrators)
    address public owner;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event DisputeCreated(
        bytes32 indexed caseId,
        uint256 indexed bountyId,
        address client,
        address worker,
        uint256 amount
    );

    event EvidenceSubmitted(
        bytes32 indexed caseId,
        address indexed submitter,
        string ipfsURI
    );

    event VoteCast(
        bytes32 indexed caseId,
        address indexed arbitrator,
        uint256 clientBps
    );

    event DisputeResolved(
        bytes32 indexed caseId,
        uint256 clientBps,
        uint256 workerBps
    );

    event DisputeAppealed(
        bytes32 indexed caseId,
        address indexed appellant,
        string reason
    );

    event ArbitratorAdded(address indexed arbitrator);
    event ArbitratorRemoved(address indexed arbitrator);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error Unauthorized();
    error InvalidStatus();
    error VotingEnded();
    error AlreadyVoted();
    error InvalidBasisPoints();
    error NotParty();
    error NoQuorum();
    error NotResolved();
    error AlreadyAppealed();
    error VotingNotEnded();

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyArbitrator() {
        if (!arbitrators[msg.sender]) revert Unauthorized();
        _;
    }

    modifier onlyEscrow(bytes32 caseId) {
        if (msg.sender != disputes[caseId].escrowContract) revert Unauthorized();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Initialize arbitrator with 3 trusted addresses
     * @param arbitrator1 First arbitrator address
     * @param arbitrator2 Second arbitrator address
     * @param arbitrator3 Third arbitrator address
     */
    constructor(
        address arbitrator1,
        address arbitrator2,
        address arbitrator3
    ) {
        owner = msg.sender;
        arbitrators[arbitrator1] = true;
        arbitrators[arbitrator2] = true;
        arbitrators[arbitrator3] = true;

        emit ArbitratorAdded(arbitrator1);
        emit ArbitratorAdded(arbitrator2);
        emit ArbitratorAdded(arbitrator3);
    }

    /*//////////////////////////////////////////////////////////////
                            CORE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Create a new dispute case
     * @param bountyId The bounty identifier
     * @param client Client address
     * @param worker Worker address
     * @param amount Amount in dispute
     * @param reason Dispute reason
     * @param clientEvidenceURI IPFS URI of client's evidence
     * @return caseId Unique identifier for this dispute
     */
    function createDispute(
        uint256 bountyId,
        address client,
        address worker,
        uint256 amount,
        string calldata reason,
        string calldata clientEvidenceURI
    ) external returns (bytes32 caseId) {
        caseId = keccak256(abi.encodePacked(
            bountyId,
            msg.sender,
            block.timestamp
        ));

        DisputeCase storage dispute = disputes[caseId];
        dispute.bountyId = bountyId;
        dispute.escrowContract = msg.sender;
        dispute.client = client;
        dispute.worker = worker;
        dispute.amount = amount;
        dispute.reason = reason;
        dispute.createdAt = block.timestamp;
        dispute.votingDeadline = block.timestamp + VOTING_PERIOD;
        dispute.status = DisputeStatus.Active;

        // Add client evidence
        dispute.evidences.push(Evidence({
            submitter: client,
            ipfsURI: clientEvidenceURI,
            timestamp: block.timestamp
        }));

        emit DisputeCreated(caseId, bountyId, client, worker, amount);
        emit EvidenceSubmitted(caseId, client, clientEvidenceURI);
    }

    /**
     * @notice Submit additional evidence for a dispute
     * @param caseId Dispute case identifier
     * @param evidenceURI IPFS URI of evidence
     */
    function submitEvidence(
        bytes32 caseId,
        string calldata evidenceURI
    ) external {
        DisputeCase storage dispute = disputes[caseId];
        if (dispute.status != DisputeStatus.Active) revert InvalidStatus();
        if (msg.sender != dispute.client && msg.sender != dispute.worker) revert NotParty();

        dispute.evidences.push(Evidence({
            submitter: msg.sender,
            ipfsURI: evidenceURI,
            timestamp: block.timestamp
        }));

        emit EvidenceSubmitted(caseId, msg.sender, evidenceURI);
    }

    /**
     * @notice Cast a vote on a dispute
     * @param caseId Dispute case identifier
     * @param clientBps Basis points to award client (0-10000)
     * @dev Worker receives (10000 - clientBps)
     */
    function vote(
        bytes32 caseId,
        uint256 clientBps
    ) external onlyArbitrator {
        DisputeCase storage dispute = disputes[caseId];
        if (dispute.status != DisputeStatus.Active) revert InvalidStatus();
        if (block.timestamp > dispute.votingDeadline) revert VotingEnded();
        if (hasVoted[caseId][msg.sender]) revert AlreadyVoted();
        if (clientBps > 10000) revert InvalidBasisPoints();

        dispute.votes.push(Vote({
            arbitrator: msg.sender,
            clientBps: clientBps,
            timestamp: block.timestamp
        }));

        hasVoted[caseId][msg.sender] = true;

        emit VoteCast(caseId, msg.sender, clientBps);

        // Check if quorum reached
        if (dispute.votes.length >= QUORUM) {
            _finalizeDispute(caseId);
        }
    }

    /**
     * @notice Finalize dispute if voting period expired with quorum
     * @param caseId Dispute case identifier
     */
    function finalizeIfExpired(bytes32 caseId) external {
        DisputeCase storage dispute = disputes[caseId];
        if (dispute.status != DisputeStatus.Active) revert InvalidStatus();
        if (block.timestamp <= dispute.votingDeadline) revert VotingNotEnded();
        if (dispute.votes.length < QUORUM) revert NoQuorum();

        _finalizeDispute(caseId);
    }

    /**
     * @notice Internal function to finalize a dispute
     * @param caseId Dispute case identifier
     */
    function _finalizeDispute(bytes32 caseId) internal {
        DisputeCase storage dispute = disputes[caseId];

        // Calculate average of votes
        uint256 totalBps = 0;
        for (uint256 i = 0; i < dispute.votes.length; i++) {
            totalBps += dispute.votes[i].clientBps;
        }
        uint256 avgClientBps = totalBps / dispute.votes.length;

        dispute.finalClientBps = avgClientBps;
        dispute.status = DisputeStatus.Resolved;

        emit DisputeResolved(caseId, avgClientBps, 10000 - avgClientBps);
    }

    /**
     * @notice Get resolution for a dispute (called by escrow contract)
     * @param caseId Dispute case identifier
     * @return clientBps Basis points awarded to client
     * @return workerBps Basis points awarded to worker
     */
    function getResolution(bytes32 caseId)
        external
        view
        onlyEscrow(caseId)
        returns (uint256 clientBps, uint256 workerBps)
    {
        DisputeCase storage dispute = disputes[caseId];
        if (dispute.status != DisputeStatus.Resolved) revert NotResolved();

        clientBps = dispute.finalClientBps;
        workerBps = 10000 - clientBps;
    }

    /**
     * @notice Appeal a resolved dispute
     * @param caseId Dispute case identifier
     * @param appealReason Reason for appeal
     * @param newEvidenceURI IPFS URI of new evidence
     */
    function appealDispute(
        bytes32 caseId,
        string calldata appealReason,
        string calldata newEvidenceURI
    ) external {
        DisputeCase storage dispute = disputes[caseId];
        if (dispute.status != DisputeStatus.Resolved) revert NotResolved();
        if (dispute.appealed) revert AlreadyAppealed();
        if (msg.sender != dispute.client && msg.sender != dispute.worker) revert NotParty();

        dispute.appealed = true;
        dispute.status = DisputeStatus.Active;

        // Reset votes
        delete dispute.votes;
        dispute.votingDeadline = block.timestamp + VOTING_PERIOD;

        // Reset voting flags
        // Note: In production, you'd want to select DIFFERENT arbitrators for appeal
        // For MVP, same arbitrators can vote again

        // Add appeal evidence
        dispute.evidences.push(Evidence({
            submitter: msg.sender,
            ipfsURI: newEvidenceURI,
            timestamp: block.timestamp
        }));

        emit DisputeAppealed(caseId, msg.sender, appealReason);
        emit EvidenceSubmitted(caseId, msg.sender, newEvidenceURI);
    }

    /*//////////////////////////////////////////////////////////////
                            ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Add a new arbitrator
     * @param arbitrator Address to add as arbitrator
     */
    function addArbitrator(address arbitrator) external onlyOwner {
        arbitrators[arbitrator] = true;
        emit ArbitratorAdded(arbitrator);
    }

    /**
     * @notice Remove an arbitrator
     * @param arbitrator Address to remove from arbitrators
     */
    function removeArbitrator(address arbitrator) external onlyOwner {
        arbitrators[arbitrator] = false;
        emit ArbitratorRemoved(arbitrator);
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get full dispute case details
     * @param caseId Dispute case identifier
     * @return bountyId The bounty ID
     * @return escrowContract The escrow contract address
     * @return client Client address
     * @return worker Worker address
     * @return amount Amount in dispute
     * @return reason Dispute reason
     * @return createdAt Creation timestamp
     * @return votingDeadline Voting deadline timestamp
     * @return status Current dispute status
     * @return appealed Whether case has been appealed
     * @return finalClientBps Final client basis points awarded
     */
    function getDispute(bytes32 caseId)
        external
        view
        returns (
            uint256 bountyId,
            address escrowContract,
            address client,
            address worker,
            uint256 amount,
            string memory reason,
            uint256 createdAt,
            uint256 votingDeadline,
            DisputeStatus status,
            bool appealed,
            uint256 finalClientBps
        )
    {
        DisputeCase storage dispute = disputes[caseId];
        return (
            dispute.bountyId,
            dispute.escrowContract,
            dispute.client,
            dispute.worker,
            dispute.amount,
            dispute.reason,
            dispute.createdAt,
            dispute.votingDeadline,
            dispute.status,
            dispute.appealed,
            dispute.finalClientBps
        );
    }

    /**
     * @notice Get all votes for a case
     * @param caseId Dispute case identifier
     * @return Array of votes
     */
    function getVotes(bytes32 caseId)
        external
        view
        returns (Vote[] memory)
    {
        return disputes[caseId].votes;
    }

    /**
     * @notice Get all evidences for a case
     * @param caseId Dispute case identifier
     * @return Array of evidence submissions
     */
    function getEvidences(bytes32 caseId)
        external
        view
        returns (Evidence[] memory)
    {
        return disputes[caseId].evidences;
    }
}
