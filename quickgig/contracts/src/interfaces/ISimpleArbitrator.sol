// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

/**
 * @title ISimpleArbitrator
 * @notice Interface for SimpleArbitrator contract
 * @dev Used by escrow contracts to create and resolve disputes
 */
interface ISimpleArbitrator {
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
    ) external returns (bytes32 caseId);

    /**
     * @notice Get resolution for a dispute
     * @param caseId Dispute case identifier
     * @return clientBps Basis points awarded to client (0-10000)
     * @return workerBps Basis points awarded to worker (0-10000)
     */
    function getResolution(bytes32 caseId)
        external
        view
        returns (uint256 clientBps, uint256 workerBps);

    /**
     * @notice Submit additional evidence for a dispute
     * @param caseId Dispute case identifier
     * @param evidenceURI IPFS URI of evidence
     */
    function submitEvidence(
        bytes32 caseId,
        string calldata evidenceURI
    ) external;
}
