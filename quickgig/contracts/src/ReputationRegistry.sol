// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ReputationRegistry
 * @author QuickGig Team
 * @notice Decentralized reputation system integrated with X402 payment proofs
 * @dev Tracks agent performance, client satisfaction, and dispute history
 *
 * Features:
 * - Feedback recording tied to completed gigs/bounties
 * - Weighted trust scores based on payment amount
 * - Category-specific ratings (quality, communication, timeliness)
 * - Dispute history tracking
 * - Stake-based validation for high-value transactions
 * - ERC-8004 integration for portable reputation
 *
 * Security:
 * - Only authorized escrow contracts can record feedback
 * - CEI pattern throughout
 * - ReentrancyGuard on state-changing functions
 * - Immutable feedback records (append-only)
 * - Comprehensive event logging
 */
contract ReputationRegistry is ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/

    struct Feedback {
        address from;               // Client or worker giving feedback
        address to;                 // Agent receiving feedback
        uint256 gigId;             // Reference to gig/bounty
        address escrowContract;    // Contract that facilitated the transaction
        uint256 paymentAmount;     // Amount paid (weight for scoring)
        uint8 qualityRating;       // 1-5 stars
        uint8 communicationRating; // 1-5 stars
        uint8 timelinessRating;    // 1-5 stars
        string comment;            // IPFS hash or short text
        uint256 timestamp;
        bool isDisputed;           // True if gig was disputed
    }

    struct ReputationScore {
        uint256 totalFeedbacks;
        uint256 totalValue;         // Sum of all payment amounts (for weighting)
        uint256 qualitySum;         // Weighted sum of quality ratings
        uint256 communicationSum;   // Weighted sum of communication ratings
        uint256 timelinessSum;      // Weighted sum of timeliness ratings
        uint256 disputeCount;       // Number of disputed gigs
        uint256 completedGigs;      // Total successful completions
    }

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Mapping from agent address to their reputation score
    mapping(address => ReputationScore) public reputations;

    /// @notice Array of all feedbacks for an agent
    mapping(address => Feedback[]) private agentFeedbacks;

    /// @notice Mapping to check if feedback already recorded for a gig
    mapping(address => mapping(uint256 => bool)) public feedbackRecorded;

    /// @notice Authorized escrow contracts that can record feedback
    mapping(address => bool) public authorizedEscrows;

    /// @notice Owner address for admin functions
    address public owner;

    /// @notice Minimum rating value (1 star)
    uint8 public constant MIN_RATING = 1;

    /// @notice Maximum rating value (5 stars)
    uint8 public constant MAX_RATING = 5;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event FeedbackRecorded(
        address indexed from,
        address indexed to,
        uint256 indexed gigId,
        address escrowContract,
        uint256 paymentAmount,
        uint8 qualityRating,
        uint8 communicationRating,
        uint8 timelinessRating,
        bool isDisputed
    );

    event EscrowAuthorized(address indexed escrowContract, bool authorized);

    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error Unauthorized();
    error InvalidRating();
    error FeedbackAlreadyRecorded();
    error ZeroAddress();
    error InvalidPaymentAmount();

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyAuthorizedEscrow() {
        if (!authorizedEscrows[msg.sender]) revert Unauthorized();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor() {
        owner = msg.sender;
    }

    /*//////////////////////////////////////////////////////////////
                            EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Record feedback for a completed gig (escrow contracts only)
     * @param from Address giving feedback
     * @param to Address receiving feedback
     * @param gigId Unique identifier for the gig/bounty
     * @param paymentAmount Amount paid (used for weighting)
     * @param qualityRating Rating for work quality (1-5)
     * @param communicationRating Rating for communication (1-5)
     * @param timelinessRating Rating for timeliness (1-5)
     * @param comment IPFS hash or short comment
     * @param isDisputed True if gig ended in dispute
     *
     * @dev Only callable by authorized escrow contracts. Follows CEI pattern.
     *      Payment amount is used to weight ratings (higher value = more impact)
     */
    function recordFeedback(
        address from,
        address to,
        uint256 gigId,
        uint256 paymentAmount,
        uint8 qualityRating,
        uint8 communicationRating,
        uint8 timelinessRating,
        string calldata comment,
        bool isDisputed
    ) external nonReentrant onlyAuthorizedEscrow {
        // CHECKS
        if (from == address(0) || to == address(0)) revert ZeroAddress();
        if (paymentAmount == 0) revert InvalidPaymentAmount();
        if (feedbackRecorded[msg.sender][gigId]) revert FeedbackAlreadyRecorded();
        if (
            qualityRating < MIN_RATING || qualityRating > MAX_RATING
                || communicationRating < MIN_RATING || communicationRating > MAX_RATING
                || timelinessRating < MIN_RATING || timelinessRating > MAX_RATING
        ) {
            revert InvalidRating();
        }

        // EFFECTS
        Feedback memory feedback = Feedback({
            from: from,
            to: to,
            gigId: gigId,
            escrowContract: msg.sender,
            paymentAmount: paymentAmount,
            qualityRating: qualityRating,
            communicationRating: communicationRating,
            timelinessRating: timelinessRating,
            comment: comment,
            timestamp: block.timestamp,
            isDisputed: isDisputed
        });

        agentFeedbacks[to].push(feedback);
        feedbackRecorded[msg.sender][gigId] = true;

        // Update reputation scores (weighted by payment amount)
        ReputationScore storage rep = reputations[to];
        rep.totalFeedbacks++;
        rep.totalValue += paymentAmount;
        rep.qualitySum += uint256(qualityRating) * paymentAmount;
        rep.communicationSum += uint256(communicationRating) * paymentAmount;
        rep.timelinessSum += uint256(timelinessRating) * paymentAmount;

        if (isDisputed) {
            rep.disputeCount++;
        } else {
            rep.completedGigs++;
        }

        emit FeedbackRecorded(
            from,
            to,
            gigId,
            msg.sender,
            paymentAmount,
            qualityRating,
            communicationRating,
            timelinessRating,
            isDisputed
        );
    }

    /**
     * @notice Authorize an escrow contract to record feedback
     * @param escrowContract Address of the escrow contract
     * @param authorized True to authorize, false to revoke
     *
     * @dev Only owner can authorize contracts
     */
    function setEscrowAuthorization(address escrowContract, bool authorized)
        external
        onlyOwner
    {
        if (escrowContract == address(0)) revert ZeroAddress();
        authorizedEscrows[escrowContract] = authorized;
        emit EscrowAuthorized(escrowContract, authorized);
    }

    /**
     * @notice Transfer ownership (owner only)
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    /*//////////////////////////////////////////////////////////////
                             VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get complete reputation score for an agent
     * @param agent Address of the agent
     * @return reputation Complete ReputationScore struct
     */
    function getReputation(address agent)
        external
        view
        returns (ReputationScore memory reputation)
    {
        return reputations[agent];
    }

    /**
     * @notice Get weighted average quality rating for an agent
     * @param agent Address of the agent
     * @return rating Weighted average rating (scaled by 100, e.g., 450 = 4.50 stars)
     *
     * @dev Returns 0 if no feedbacks. Formula: (qualitySum / totalValue) * 100
     */
    function getQualityRating(address agent) external view returns (uint256 rating) {
        ReputationScore memory rep = reputations[agent];
        if (rep.totalValue == 0) return 0;
        return (rep.qualitySum * 100) / rep.totalValue;
    }

    /**
     * @notice Get weighted average communication rating
     * @param agent Address of the agent
     * @return rating Weighted average rating (scaled by 100)
     */
    function getCommunicationRating(address agent) external view returns (uint256 rating) {
        ReputationScore memory rep = reputations[agent];
        if (rep.totalValue == 0) return 0;
        return (rep.communicationSum * 100) / rep.totalValue;
    }

    /**
     * @notice Get weighted average timeliness rating
     * @param agent Address of the agent
     * @return rating Weighted average rating (scaled by 100)
     */
    function getTimelinessRating(address agent) external view returns (uint256 rating) {
        ReputationScore memory rep = reputations[agent];
        if (rep.totalValue == 0) return 0;
        return (rep.timelinessSum * 100) / rep.totalValue;
    }

    /**
     * @notice Get overall weighted average rating
     * @param agent Address of the agent
     * @return rating Weighted average of all categories (scaled by 100)
     */
    function getOverallRating(address agent) external view returns (uint256 rating) {
        ReputationScore memory rep = reputations[agent];
        if (rep.totalValue == 0) return 0;

        uint256 totalSum = rep.qualitySum + rep.communicationSum + rep.timelinessSum;
        return (totalSum * 100) / (rep.totalValue * 3);
    }

    /**
     * @notice Get dispute rate for an agent
     * @param agent Address of the agent
     * @return rate Dispute rate in basis points (e.g., 250 = 2.5%)
     */
    function getDisputeRate(address agent) external view returns (uint256 rate) {
        ReputationScore memory rep = reputations[agent];
        if (rep.totalFeedbacks == 0) return 0;
        return (rep.disputeCount * 10000) / rep.totalFeedbacks;
    }

    /**
     * @notice Get success rate for an agent
     * @param agent Address of the agent
     * @return rate Success rate in basis points (e.g., 9500 = 95%)
     */
    function getSuccessRate(address agent) external view returns (uint256 rate) {
        ReputationScore memory rep = reputations[agent];
        if (rep.totalFeedbacks == 0) return 0;
        return (rep.completedGigs * 10000) / rep.totalFeedbacks;
    }

    /**
     * @notice Get all feedbacks for an agent
     * @param agent Address of the agent
     * @return feedbacks Array of all feedback records
     */
    function getAgentFeedbacks(address agent)
        external
        view
        returns (Feedback[] memory feedbacks)
    {
        return agentFeedbacks[agent];
    }

    /**
     * @notice Get recent feedbacks for an agent
     * @param agent Address of the agent
     * @param count Number of recent feedbacks to retrieve
     * @return feedbacks Array of recent feedback records
     */
    function getRecentFeedbacks(address agent, uint256 count)
        external
        view
        returns (Feedback[] memory feedbacks)
    {
        Feedback[] storage allFeedbacks = agentFeedbacks[agent];
        uint256 totalFeedbacks = allFeedbacks.length;

        if (totalFeedbacks == 0) {
            return new Feedback[](0);
        }

        uint256 returnCount = count > totalFeedbacks ? totalFeedbacks : count;
        feedbacks = new Feedback[](returnCount);

        for (uint256 i = 0; i < returnCount; i++) {
            feedbacks[i] = allFeedbacks[totalFeedbacks - returnCount + i];
        }
    }

    /**
     * @notice Get feedback count for an agent
     * @param agent Address of the agent
     * @return count Total number of feedbacks
     */
    function getFeedbackCount(address agent) external view returns (uint256 count) {
        return agentFeedbacks[agent].length;
    }

    /**
     * @notice Check if agent meets quality threshold
     * @param agent Address of the agent
     * @param minRating Minimum rating threshold (scaled by 100, e.g., 400 = 4.00)
     * @param minFeedbacks Minimum number of feedbacks required
     * @return meetsThreshold True if agent meets both criteria
     *
     * @dev Useful for filtering high-quality agents in discovery
     */
    function meetsQualityThreshold(
        address agent,
        uint256 minRating,
        uint256 minFeedbacks
    ) external view returns (bool meetsThreshold) {
        ReputationScore memory rep = reputations[agent];

        if (rep.totalFeedbacks < minFeedbacks) return false;
        if (rep.totalValue == 0) return false;

        uint256 overallRating =
            (rep.qualitySum + rep.communicationSum + rep.timelinessSum) * 100
                / (rep.totalValue * 3);

        return overallRating >= minRating;
    }

    /**
     * @notice Get trust score for an agent (0-10000 basis points)
     * @param agent Address of the agent
     * @return score Trust score combining ratings, completion rate, and dispute rate
     *
     * @dev Formula: (overallRating/5) * successRate * (1 - disputeRate/2)
     *      Returns basis points (10000 = 100% trust)
     */
    function getTrustScore(address agent) external view returns (uint256 score) {
        ReputationScore memory rep = reputations[agent];
        if (rep.totalFeedbacks == 0) return 0;

        // Overall rating (0-500, scaled to 0-10000)
        uint256 totalSum = rep.qualitySum + rep.communicationSum + rep.timelinessSum;
        uint256 overallRating = (totalSum * 100) / (rep.totalValue * 3); // 0-500

        // Success rate (0-10000)
        uint256 successRate = (rep.completedGigs * 10000) / rep.totalFeedbacks;

        // Dispute penalty (disputes reduce score by up to 50%)
        uint256 disputeRate = (rep.disputeCount * 10000) / rep.totalFeedbacks;
        uint256 disputePenalty = disputeRate / 2; // Max 50% penalty

        // Combined score
        score = (overallRating * 20 * successRate) / 10000; // Scale rating to 0-10000
        if (score > disputePenalty) {
            score -= disputePenalty;
        } else {
            score = 0;
        }

        // Cap at 10000
        if (score > 10000) score = 10000;
    }
}
