// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice On-chain commitment registry for segregated RWA business series.
/// @dev This contract records hashes and governance timing. It does not itself assert legal status,
///      ownership title, profitability, dividend guarantees, or regulatory approval.
contract RWASeriesRegistry is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant REVIEWER_ROLE = keccak256("REVIEWER_ROLE");

    struct Series {
        address issuer;
        bytes32 metadataHash;
        bytes32 immutableEconomicHash;
        bytes32 governedEconomicHash;
        bytes32 legalEvidenceHash;
        uint64 activatedAt;
        bool active;
        bool exists;
    }
    struct GovernedProposal {
        bytes32 newHash;
        uint64 executeAfter;
        bool executed;
    }

    mapping(bytes32 => Series) private _series;
    mapping(bytes32 => GovernedProposal) private _proposals;
    uint64 public immutable minimumNotice;

    error InvalidInput();
    error SeriesExists();
    error SeriesMissing();
    error AlreadyActive();
    error LegalEvidenceRequired();
    error ImmutableEconomicsRequired();
    error UnauthorizedIssuer();
    error ProposalMissing();
    error NoticeActive();
    error ProposalExecuted();

    event SeriesCreated(bytes32 indexed seriesId, address indexed issuer, bytes32 metadataHash, bytes32 immutableEconomicHash, bytes32 governedEconomicHash);
    event SeriesActivated(bytes32 indexed seriesId, bytes32 indexed legalEvidenceHash, address indexed reviewer);
    event GovernedEconomicChangeProposed(bytes32 indexed seriesId, bytes32 indexed proposalId, bytes32 newHash, uint64 executeAfter);
    event GovernedEconomicChangeExecuted(bytes32 indexed seriesId, bytes32 indexed proposalId, bytes32 newHash);

    constructor(address admin, uint64 minimumNoticeSeconds) {
        if (admin == address(0)) revert InvalidInput();
        minimumNotice = minimumNoticeSeconds;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function createSeries(bytes32 seriesId,address issuer,bytes32 metadataHash,bytes32 immutableEconomicHash,bytes32 governedEconomicHash)
        external onlyRole(ISSUER_ROLE)
    {
        if (seriesId == bytes32(0) || issuer == address(0) || metadataHash == bytes32(0) || immutableEconomicHash == bytes32(0) || governedEconomicHash == bytes32(0)) revert InvalidInput();
        if (_series[seriesId].exists) revert SeriesExists();
        _series[seriesId] = Series({issuer:issuer,metadataHash:metadataHash,immutableEconomicHash:immutableEconomicHash,governedEconomicHash:governedEconomicHash,legalEvidenceHash:bytes32(0),activatedAt:0,active:false,exists:true});
        emit SeriesCreated(seriesId,issuer,metadataHash,immutableEconomicHash,governedEconomicHash);
    }

    function activateSeries(bytes32 seriesId, bytes32 legalEvidenceHash) external onlyRole(REVIEWER_ROLE) {
        Series storage s=_series[seriesId];if(!s.exists) revert SeriesMissing();if(s.active) revert AlreadyActive();if(legalEvidenceHash==bytes32(0)) revert LegalEvidenceRequired();if(s.immutableEconomicHash==bytes32(0)) revert ImmutableEconomicsRequired();
        s.legalEvidenceHash=legalEvidenceHash;s.active=true;s.activatedAt=uint64(block.timestamp);emit SeriesActivated(seriesId,legalEvidenceHash,msg.sender);
    }

    function proposeGovernedEconomicHash(bytes32 seriesId, bytes32 newHash, bytes32 proposalSalt) external returns(bytes32 proposalId) {
        Series storage s=_series[seriesId];if(!s.exists) revert SeriesMissing();if(msg.sender!=s.issuer&&!hasRole(DEFAULT_ADMIN_ROLE,msg.sender)) revert UnauthorizedIssuer();if(newHash==bytes32(0)||proposalSalt==bytes32(0)) revert InvalidInput();
        proposalId=keccak256(abi.encode(seriesId,newHash,proposalSalt));if(_proposals[proposalId].newHash!=bytes32(0)) revert SeriesExists();uint64 executeAfter=uint64(block.timestamp)+minimumNotice;_proposals[proposalId]=GovernedProposal(newHash,executeAfter,false);emit GovernedEconomicChangeProposed(seriesId,proposalId,newHash,executeAfter);
    }

    function executeGovernedEconomicHash(bytes32 seriesId, bytes32 proposalId) external {
        Series storage s=_series[seriesId];if(!s.exists) revert SeriesMissing();if(msg.sender!=s.issuer&&!hasRole(DEFAULT_ADMIN_ROLE,msg.sender)) revert UnauthorizedIssuer();GovernedProposal storage p=_proposals[proposalId];if(p.newHash==bytes32(0)) revert ProposalMissing();if(p.executed) revert ProposalExecuted();if(block.timestamp<p.executeAfter) revert NoticeActive();p.executed=true;s.governedEconomicHash=p.newHash;emit GovernedEconomicChangeExecuted(seriesId,proposalId,p.newHash);
    }

    function series(bytes32 seriesId) external view returns(Series memory){return _series[seriesId];}
    function proposal(bytes32 proposalId) external view returns(GovernedProposal memory){return _proposals[proposalId];}
    function isActive(bytes32 seriesId) external view returns(bool){return _series[seriesId].active;}
}
