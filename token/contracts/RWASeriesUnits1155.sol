// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

interface IRWASeriesActivation { function isActive(bytes32 seriesId) external view returns(bool); }

/// @notice Compliance-gated units for segregated RWA Series.
/// @dev One ERC-1155 token id maps 1:1 to uint256(seriesId). This is a technical ownership ledger only;
///      eligibility, legal rights and transfer permissions must be established by the issuer's approved documents.
contract RWASeriesUnits1155 is ERC1155, AccessControl {
    bytes32 public constant ISSUANCE_ROLE = keccak256("ISSUANCE_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant TRANSFER_AGENT_ROLE = keccak256("TRANSFER_AGENT_ROLE");
    IRWASeriesActivation public immutable registry;

    mapping(address => bool) public eligible;
    mapping(bytes32 => uint256) public maxSupply;
    mapping(bytes32 => uint256) public issuedSupply;
    mapping(bytes32 => bool) public frozen;
    mapping(uint256 => string) private _seriesURI;

    error InvalidInput();
    error SeriesInactive();
    error SeriesAlreadyConfigured();
    error SeriesNotConfigured();
    error SupplyCapExceeded();
    error IneligibleAccount();
    error SeriesFrozen();

    event EligibilitySet(address indexed account, bool eligibleStatus, address indexed actor);
    event SeriesConfigured(bytes32 indexed seriesId, uint256 indexed tokenId, uint256 maxSupply, string uri);
    event SeriesFreezeSet(bytes32 indexed seriesId, bool frozenStatus, address indexed actor);
    event SeriesIssued(bytes32 indexed seriesId, address indexed to, uint256 amount, uint256 issuedSupply);

    constructor(address admin, IRWASeriesActivation registry_) ERC1155("") {
        if (admin == address(0) || address(registry_) == address(0)) revert InvalidInput();
        registry = registry_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function tokenId(bytes32 seriesId) public pure returns (uint256) { return uint256(seriesId); }

    function setEligible(address account, bool status) external onlyRole(COMPLIANCE_ROLE) {
        if (account == address(0)) revert InvalidInput();
        eligible[account] = status;
        emit EligibilitySet(account, status, msg.sender);
    }

    function configureSeries(bytes32 seriesId, uint256 supplyCap, string calldata seriesUri) external onlyRole(ISSUANCE_ROLE) {
        if (seriesId == bytes32(0) || supplyCap == 0 || bytes(seriesUri).length == 0) revert InvalidInput();
        if (!registry.isActive(seriesId)) revert SeriesInactive();
        if (maxSupply[seriesId] != 0) revert SeriesAlreadyConfigured();
        maxSupply[seriesId] = supplyCap;
        _seriesURI[tokenId(seriesId)] = seriesUri;
        emit SeriesConfigured(seriesId, tokenId(seriesId), supplyCap, seriesUri);
    }

    function issue(bytes32 seriesId, address to, uint256 amount, bytes calldata data) external onlyRole(ISSUANCE_ROLE) {
        if (maxSupply[seriesId] == 0) revert SeriesNotConfigured();
        if (!registry.isActive(seriesId)) revert SeriesInactive();
        if (!eligible[to]) revert IneligibleAccount();
        uint256 next = issuedSupply[seriesId] + amount;
        if (amount == 0 || next > maxSupply[seriesId]) revert SupplyCapExceeded();
        issuedSupply[seriesId] = next;
        _mint(to, tokenId(seriesId), amount, data);
        emit SeriesIssued(seriesId, to, amount, next);
    }

    function setSeriesFrozen(bytes32 seriesId, bool status) external onlyRole(COMPLIANCE_ROLE) {
        if (maxSupply[seriesId] == 0) revert SeriesNotConfigured();
        frozen[seriesId] = status;
        emit SeriesFreezeSet(seriesId, status, msg.sender);
    }

    function uri(uint256 id) public view override returns (string memory) { return _seriesURI[id]; }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values) internal override {
        if (from != address(0) && to != address(0) && !hasRole(TRANSFER_AGENT_ROLE, _msgSender())) {
            if (!eligible[from] || !eligible[to]) revert IneligibleAccount();
            for (uint256 i = 0; i < ids.length; i++) {
                if (values[i] > 0 && frozen[bytes32(ids[i])]) revert SeriesFrozen();
            }
        }
        super._update(from, to, ids, values);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
