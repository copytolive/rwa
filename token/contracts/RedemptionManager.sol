// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ProductInventoryGate} from "./ProductInventoryGate.sol";
import {ProductRWA1155} from "./ProductRWA1155.sol";

/// @notice Evidence-bound redemption workflow for Product RWA.
/// @dev Existing customer redemption has priority; tokens burn only after DELIVERED evidence is recorded.
contract RedemptionManager is AccessControl {
    bytes32 public constant FULFILLMENT_ROLE = keccak256("FULFILLMENT_ROLE");

    enum State { None, Requested, Reserved, PickPack, Shipped, Delivered, Closed, Cancelled }

    struct Redemption {
        address holder;
        uint256 tokenId;
        uint256 amount;
        State state;
        bytes32 requestEvidenceHash;
        bytes32 pickPackEvidenceHash;
        bytes32 shipmentEvidenceHash;
        bytes32 deliveryEvidenceHash;
        uint64 requestedAt;
        uint64 updatedAt;
    }

    ProductRWA1155 public immutable productRWA;
    ProductInventoryGate public immutable inventoryGate;
    uint256 public nextRedemptionId = 1;
    mapping(uint256 => Redemption) private _redemptions;
    mapping(address => mapping(uint256 => uint256)) public lockedForRedemption;

    error ZeroAdmin();
    error ZeroToken();
    error ZeroGate();
    error ZeroAmount();
    error EvidenceRequired();
    error InsufficientUnlockedBalance(uint256 requested, uint256 available);
    error InvalidState(State expected, State actual);
    error CancellationNotAllowed();
    error NotRedemptionHolder();

    event RedemptionRequested(uint256 indexed redemptionId, address indexed holder, uint256 indexed tokenId, uint256 amount, bytes32 requestEvidenceHash);
    event RedemptionReserved(uint256 indexed redemptionId, uint256 amount);
    event RedemptionAdvanced(uint256 indexed redemptionId, State indexed state, bytes32 indexed evidenceHash, address actor);
    event RedemptionCancelled(uint256 indexed redemptionId, address indexed actor);
    event RedemptionClosed(uint256 indexed redemptionId, address indexed holder, uint256 indexed tokenId, uint256 amount, bytes32 deliveryEvidenceHash);

    constructor(address admin, ProductRWA1155 token, ProductInventoryGate gate) {
        if (admin == address(0)) revert ZeroAdmin();
        if (address(token) == address(0)) revert ZeroToken();
        if (address(gate) == address(0)) revert ZeroGate();
        productRWA = token;
        inventoryGate = gate;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function redemption(uint256 redemptionId) external view returns (Redemption memory) {
        return _redemptions[redemptionId];
    }

    /// @notice Reserve inventory atomically while the holder token remains unburned until delivery.
    function requestRedemption(uint256 tokenId, uint256 amount, bytes32 requestEvidenceHash)
        external
        returns (uint256 redemptionId)
    {
        if (amount == 0) revert ZeroAmount();
        if (requestEvidenceHash == bytes32(0)) revert EvidenceRequired();
        uint256 balance = productRWA.balanceOf(msg.sender, tokenId);
        uint256 locked = lockedForRedemption[msg.sender][tokenId];
        uint256 available = balance > locked ? balance - locked : 0;
        if (amount > available) revert InsufficientUnlockedBalance(amount, available);

        redemptionId = nextRedemptionId++;
        _redemptions[redemptionId] = Redemption({
            holder: msg.sender,
            tokenId: tokenId,
            amount: amount,
            state: State.Requested,
            requestEvidenceHash: requestEvidenceHash,
            pickPackEvidenceHash: bytes32(0),
            shipmentEvidenceHash: bytes32(0),
            deliveryEvidenceHash: bytes32(0),
            requestedAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp)
        });
        lockedForRedemption[msg.sender][tokenId] = locked + amount;
        emit RedemptionRequested(redemptionId, msg.sender, tokenId, amount, requestEvidenceHash);

        inventoryGate.reserveRedemption(tokenId, amount);
        _redemptions[redemptionId].state = State.Reserved;
        _redemptions[redemptionId].updatedAt = uint64(block.timestamp);
        emit RedemptionReserved(redemptionId, amount);
    }

    function markPickPack(uint256 redemptionId, bytes32 evidenceHash) external onlyRole(FULFILLMENT_ROLE) {
        Redemption storage r = _redemptions[redemptionId];
        if (r.state != State.Reserved) revert InvalidState(State.Reserved, r.state);
        if (evidenceHash == bytes32(0)) revert EvidenceRequired();
        r.pickPackEvidenceHash = evidenceHash;
        r.state = State.PickPack;
        r.updatedAt = uint64(block.timestamp);
        emit RedemptionAdvanced(redemptionId, State.PickPack, evidenceHash, msg.sender);
    }

    function markShipped(uint256 redemptionId, bytes32 evidenceHash) external onlyRole(FULFILLMENT_ROLE) {
        Redemption storage r = _redemptions[redemptionId];
        if (r.state != State.PickPack) revert InvalidState(State.PickPack, r.state);
        if (evidenceHash == bytes32(0)) revert EvidenceRequired();
        r.shipmentEvidenceHash = evidenceHash;
        r.state = State.Shipped;
        r.updatedAt = uint64(block.timestamp);
        emit RedemptionAdvanced(redemptionId, State.Shipped, evidenceHash, msg.sender);
    }

    function markDelivered(uint256 redemptionId, bytes32 evidenceHash) external onlyRole(FULFILLMENT_ROLE) {
        Redemption storage r = _redemptions[redemptionId];
        if (r.state != State.Shipped) revert InvalidState(State.Shipped, r.state);
        if (evidenceHash == bytes32(0)) revert EvidenceRequired();
        r.deliveryEvidenceHash = evidenceHash;
        r.state = State.Delivered;
        r.updatedAt = uint64(block.timestamp);
        emit RedemptionAdvanced(redemptionId, State.Delivered, evidenceHash, msg.sender);
    }

    /// @notice Burn/close only after delivery; all calls are atomic in one transaction.
    function closeRedemption(uint256 redemptionId) external onlyRole(FULFILLMENT_ROLE) {
        Redemption storage r = _redemptions[redemptionId];
        if (r.state != State.Delivered) revert InvalidState(State.Delivered, r.state);
        productRWA.burnForRedemption(r.holder, r.tokenId, r.amount, r.deliveryEvidenceHash);
        inventoryGate.closeRedemption(r.tokenId, r.amount);
        lockedForRedemption[r.holder][r.tokenId] -= r.amount;
        r.state = State.Closed;
        r.updatedAt = uint64(block.timestamp);
        emit RedemptionClosed(redemptionId, r.holder, r.tokenId, r.amount, r.deliveryEvidenceHash);
    }

    /// @notice Cancellation is allowed only before pick/pack begins and releases the physical reservation.
    function cancelRedemption(uint256 redemptionId) external {
        Redemption storage r = _redemptions[redemptionId];
        if (r.holder == address(0)) revert NotRedemptionHolder();
        if (msg.sender != r.holder && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert NotRedemptionHolder();
        if (r.state != State.Reserved) revert CancellationNotAllowed();
        inventoryGate.cancelRedemption(r.tokenId, r.amount);
        lockedForRedemption[r.holder][r.tokenId] -= r.amount;
        r.state = State.Cancelled;
        r.updatedAt = uint64(block.timestamp);
        emit RedemptionCancelled(redemptionId, msg.sender);
    }
}
