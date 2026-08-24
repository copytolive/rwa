// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ProductInventoryGate} from "./ProductInventoryGate.sol";

/// @notice MVP Product RWA representing an explicit redeemable physical-product entitlement.
/// @dev Holder-to-holder transfers are intentionally disabled. This contract does not convey HGB/HM,
///      warehouse/property title, equity, deposit rights, or guaranteed yield.
contract ProductRWA1155 is ERC1155Supply, AccessControl {
    bytes32 public constant CLASS_ADMIN_ROLE = keccak256("CLASS_ADMIN_ROLE");
    bytes32 public constant MINT_REQUEST_ROLE = keccak256("MINT_REQUEST_ROLE");
    bytes32 public constant MINT_APPROVER_ROLE = keccak256("MINT_APPROVER_ROLE");
    bytes32 public constant MINT_ROLE = keccak256("MINT_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    struct Entitlement {
        bytes32 productFamilyHash;
        bytes32 skuHash;
        bytes32 batchLotHash;
        uint256 quantityPerToken;
        string redemptionUnit;
        bytes32 optionsHash;
        bytes32 geographyHash;
        uint64 expiry;
        bytes32 exclusionsHash;
        string metadataURI;
        bool active;
    }

    enum MintState { None, Requested, Approved, Executed, Cancelled }

    struct MintRequest {
        uint256 tokenId;
        address recipient;
        uint256 amount;
        address requester;
        address approver;
        bytes32 inventoryEvidenceHash;
        bytes32 approvalEvidenceHash;
        MintState state;
        uint64 requestedAt;
        uint64 approvedAt;
        uint64 executedAt;
    }

    ProductInventoryGate public immutable inventoryGate;
    uint256 public nextRequestId = 1;
    mapping(uint256 => Entitlement) private _entitlements;
    mapping(uint256 => MintRequest) private _mintRequests;

    error ZeroAdmin();
    error ZeroGate();
    error ZeroRecipient();
    error ZeroAmount();
    error EvidenceRequired();
    error EntitlementMissing();
    error EntitlementInactive();
    error EntitlementExpired();
    error InvalidEntitlement();
    error InvalidMintState(MintState expected, MintState actual);
    error SegregationOfDuties();
    error TransfersDisabled();

    event EntitlementConfigured(uint256 indexed tokenId, bytes32 indexed productFamilyHash, bytes32 indexed skuHash, bool active, address actor);
    event MintRequested(uint256 indexed requestId, uint256 indexed tokenId, address indexed recipient, uint256 amount, address requester, bytes32 inventoryEvidenceHash);
    event MintApproved(uint256 indexed requestId, address indexed approver, bytes32 indexed approvalEvidenceHash);
    event MintCancelled(uint256 indexed requestId, address indexed actor);
    event MintExecuted(uint256 indexed requestId, uint256 indexed tokenId, address indexed recipient, uint256 amount, address executor);
    event RedemptionBurned(address indexed holder, uint256 indexed tokenId, uint256 amount, bytes32 indexed fulfillmentEvidenceHash, address actor);

    constructor(address admin, ProductInventoryGate gate) ERC1155("") {
        if (admin == address(0)) revert ZeroAdmin();
        if (address(gate) == address(0)) revert ZeroGate();
        inventoryGate = gate;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function setEntitlement(uint256 tokenId, Entitlement calldata e) external onlyRole(CLASS_ADMIN_ROLE) {
        if (e.productFamilyHash == bytes32(0) || e.quantityPerToken == 0 || bytes(e.redemptionUnit).length == 0 || bytes(e.metadataURI).length == 0) {
            revert InvalidEntitlement();
        }
        _entitlements[tokenId] = e;
        emit EntitlementConfigured(tokenId, e.productFamilyHash, e.skuHash, e.active, msg.sender);
    }

    function entitlement(uint256 tokenId) external view returns (Entitlement memory) {
        return _entitlements[tokenId];
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        return _entitlements[tokenId].metadataURI;
    }

    function mintRequest(uint256 requestId) external view returns (MintRequest memory) {
        return _mintRequests[requestId];
    }

    function requestMint(uint256 tokenId, address recipient, uint256 amount, bytes32 inventoryEvidenceHash)
        external
        onlyRole(MINT_REQUEST_ROLE)
        returns (uint256 requestId)
    {
        if (recipient == address(0)) revert ZeroRecipient();
        if (amount == 0) revert ZeroAmount();
        if (inventoryEvidenceHash == bytes32(0)) revert EvidenceRequired();
        Entitlement storage e = _entitlements[tokenId];
        if (e.productFamilyHash == bytes32(0)) revert EntitlementMissing();
        if (!e.active) revert EntitlementInactive();
        if (e.expiry != 0 && block.timestamp >= e.expiry) revert EntitlementExpired();
        requestId = nextRequestId++;
        _mintRequests[requestId] = MintRequest({
            tokenId: tokenId,
            recipient: recipient,
            amount: amount,
            requester: msg.sender,
            approver: address(0),
            inventoryEvidenceHash: inventoryEvidenceHash,
            approvalEvidenceHash: bytes32(0),
            state: MintState.Requested,
            requestedAt: uint64(block.timestamp),
            approvedAt: 0,
            executedAt: 0
        });
        emit MintRequested(requestId, tokenId, recipient, amount, msg.sender, inventoryEvidenceHash);
    }

    function approveMint(uint256 requestId, bytes32 approvalEvidenceHash) external onlyRole(MINT_APPROVER_ROLE) {
        MintRequest storage r = _mintRequests[requestId];
        if (r.state != MintState.Requested) revert InvalidMintState(MintState.Requested, r.state);
        if (msg.sender == r.requester) revert SegregationOfDuties();
        if (approvalEvidenceHash == bytes32(0)) revert EvidenceRequired();
        r.approver = msg.sender;
        r.approvalEvidenceHash = approvalEvidenceHash;
        r.state = MintState.Approved;
        r.approvedAt = uint64(block.timestamp);
        emit MintApproved(requestId, msg.sender, approvalEvidenceHash);
    }

    function cancelMint(uint256 requestId) external {
        MintRequest storage r = _mintRequests[requestId];
        if (r.state != MintState.Requested && r.state != MintState.Approved) revert InvalidMintState(MintState.Requested, r.state);
        if (msg.sender != r.requester && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert AccessControlUnauthorizedAccount(msg.sender, DEFAULT_ADMIN_ROLE);
        r.state = MintState.Cancelled;
        emit MintCancelled(requestId, msg.sender);
    }

    /// @notice Revalidates the canonical inventory formula immediately before minting.
    function executeMint(uint256 requestId) external onlyRole(MINT_ROLE) {
        MintRequest storage r = _mintRequests[requestId];
        if (r.state != MintState.Approved) revert InvalidMintState(MintState.Approved, r.state);
        if (msg.sender == r.requester || msg.sender == r.approver) revert SegregationOfDuties();
        Entitlement storage e = _entitlements[r.tokenId];
        if (!e.active) revert EntitlementInactive();
        if (e.expiry != 0 && block.timestamp >= e.expiry) revert EntitlementExpired();
        inventoryGate.recordMint(r.tokenId, r.amount);
        r.state = MintState.Executed;
        r.executedAt = uint64(block.timestamp);
        _mint(r.recipient, r.tokenId, r.amount, "");
        emit MintExecuted(requestId, r.tokenId, r.recipient, r.amount, msg.sender);
    }

    /// @notice Burn is reserved for the redemption manager and must be accompanied by fulfillment evidence.
    function burnForRedemption(address holder, uint256 tokenId, uint256 amount, bytes32 fulfillmentEvidenceHash)
        external
        onlyRole(BURNER_ROLE)
    {
        if (amount == 0) revert ZeroAmount();
        if (fulfillmentEvidenceHash == bytes32(0)) revert EvidenceRequired();
        _burn(holder, tokenId, amount);
        emit RedemptionBurned(holder, tokenId, amount, fulfillmentEvidenceHash, msg.sender);
    }

    /// @dev MVP transfer policy is immutable: only mint (from=0) and burn (to=0) are allowed.
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values) internal override {
        if (from != address(0) && to != address(0)) revert TransfersDisabled();
        super._update(from, to, ids, values);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
