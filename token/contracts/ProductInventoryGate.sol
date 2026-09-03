// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Canonical inventory liability gate for redeemable Product RWA classes.
/// @dev Accurate shortage states are recordable; shortage blocks new mint but does not falsify inventory.
contract ProductInventoryGate is AccessControl {
    bytes32 public constant INVENTORY_ROLE = keccak256("INVENTORY_ROLE");
    bytes32 public constant MINT_LEDGER_ROLE = keccak256("MINT_LEDGER_ROLE");
    bytes32 public constant REDEMPTION_ROLE = keccak256("REDEMPTION_ROLE");

    struct Inventory {
        uint256 verifiedRedeemable;
        uint256 nonTokenReserved;
        uint256 outstanding;
        uint256 requiredBuffer;
        uint256 redeemReserved;
        bytes32 evidenceHash;
        uint64 updatedAt;
    }

    mapping(uint256 => Inventory) private _inventory;

    error ZeroAdmin();
    error ZeroAmount();
    error EvidenceRequired();
    error MintExceedsEligibility(uint256 requested, uint256 eligible);
    error RedemptionExceedsOutstanding(uint256 requested, uint256 available);
    error InsufficientRedeemableInventory(uint256 requested, uint256 available);
    error InvalidReservationRelease(uint256 requested, uint256 reserved);

    event InventoryUpdated(
        uint256 indexed tokenId,
        uint256 verifiedRedeemable,
        uint256 nonTokenReserved,
        uint256 requiredBuffer,
        bytes32 indexed evidenceHash,
        address indexed actor
    );
    event CoverageBreach(uint256 indexed tokenId, uint256 numerator, uint256 outstanding, uint256 coverageBps);
    event MintLiabilityRecorded(uint256 indexed tokenId, uint256 amount, uint256 outstandingAfter);
    event RedemptionReserved(uint256 indexed tokenId, uint256 amount, uint256 reservedAfter);
    event RedemptionReservationReleased(uint256 indexed tokenId, uint256 amount, uint256 reservedAfter);
    event RedemptionClosed(uint256 indexed tokenId, uint256 amount, uint256 outstandingAfter, uint256 verifiedAfter);

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAdmin();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Record the actual verified stock state and an immutable evidence reference.
    /// @dev This deliberately permits a coverage breach to be recorded honestly; subsequent mint remains blocked.
    function setInventory(
        uint256 tokenId,
        uint256 verifiedRedeemable,
        uint256 nonTokenReserved,
        uint256 requiredBuffer,
        bytes32 evidenceHash
    ) external onlyRole(INVENTORY_ROLE) {
        if (evidenceHash == bytes32(0)) revert EvidenceRequired();
        Inventory storage x = _inventory[tokenId];
        x.verifiedRedeemable = verifiedRedeemable;
        x.nonTokenReserved = nonTokenReserved;
        x.requiredBuffer = requiredBuffer;
        x.evidenceHash = evidenceHash;
        x.updatedAt = uint64(block.timestamp);
        emit InventoryUpdated(tokenId, verifiedRedeemable, nonTokenReserved, requiredBuffer, evidenceHash, msg.sender);
        (bool applicable, uint256 numerator, uint256 denominator, uint256 bps) = coverage(tokenId);
        if (applicable && bps < 10_000) emit CoverageBreach(tokenId, numerator, denominator, bps);
    }

    /// @notice Canonical formula: MAX(0, verified - non-token reserved - outstanding - required buffer).
    function additionalMintable(uint256 tokenId) public view returns (uint256) {
        Inventory storage x = _inventory[tokenId];
        uint256 n = x.verifiedRedeemable;
        if (n <= x.nonTokenReserved) return 0;
        n -= x.nonTokenReserved;
        if (n <= x.outstanding) return 0;
        n -= x.outstanding;
        if (n <= x.requiredBuffer) return 0;
        return n - x.requiredBuffer;
    }

    function availableForRedemption(uint256 tokenId) public view returns (uint256) {
        Inventory storage x = _inventory[tokenId];
        uint256 n = x.verifiedRedeemable;
        if (n <= x.nonTokenReserved) return 0;
        n -= x.nonTokenReserved;
        if (n <= x.redeemReserved) return 0;
        return n - x.redeemReserved;
    }

    /// @return applicable False when outstanding is zero; UI should display coverage as N/A in that case.
    function coverage(uint256 tokenId)
        public
        view
        returns (bool applicable, uint256 numerator, uint256 denominator, uint256 coverageBps)
    {
        Inventory storage x = _inventory[tokenId];
        numerator = x.verifiedRedeemable > x.nonTokenReserved
            ? x.verifiedRedeemable - x.nonTokenReserved
            : 0;
        denominator = x.outstanding;
        if (denominator == 0) return (false, numerator, 0, 0);
        return (true, numerator, denominator, numerator * 10_000 / denominator);
    }

    function inventory(uint256 tokenId) external view returns (Inventory memory) {
        return _inventory[tokenId];
    }

    /// @notice Called by the Product RWA contract immediately before mint.
    function recordMint(uint256 tokenId, uint256 amount) external onlyRole(MINT_LEDGER_ROLE) {
        if (amount == 0) revert ZeroAmount();
        uint256 eligible = additionalMintable(tokenId);
        if (amount > eligible) revert MintExceedsEligibility(amount, eligible);
        Inventory storage x = _inventory[tokenId];
        x.outstanding += amount;
        emit MintLiabilityRecorded(tokenId, amount, x.outstanding);
    }

    /// @notice Reserve physical inventory for an existing token holder without burning the token early.
    function reserveRedemption(uint256 tokenId, uint256 amount) external onlyRole(REDEMPTION_ROLE) {
        if (amount == 0) revert ZeroAmount();
        Inventory storage x = _inventory[tokenId];
        uint256 liabilityAvailable = x.outstanding > x.redeemReserved ? x.outstanding - x.redeemReserved : 0;
        if (amount > liabilityAvailable) revert RedemptionExceedsOutstanding(amount, liabilityAvailable);
        uint256 physicalAvailable = availableForRedemption(tokenId);
        if (amount > physicalAvailable) revert InsufficientRedeemableInventory(amount, physicalAvailable);
        x.redeemReserved += amount;
        emit RedemptionReserved(tokenId, amount, x.redeemReserved);
    }

    function cancelRedemption(uint256 tokenId, uint256 amount) external onlyRole(REDEMPTION_ROLE) {
        if (amount == 0) revert ZeroAmount();
        Inventory storage x = _inventory[tokenId];
        if (amount > x.redeemReserved) revert InvalidReservationRelease(amount, x.redeemReserved);
        x.redeemReserved -= amount;
        emit RedemptionReservationReleased(tokenId, amount, x.redeemReserved);
    }

    /// @notice Close the liability only after the redemption manager records delivery.
    function closeRedemption(uint256 tokenId, uint256 amount) external onlyRole(REDEMPTION_ROLE) {
        if (amount == 0) revert ZeroAmount();
        Inventory storage x = _inventory[tokenId];
        if (amount > x.redeemReserved) revert InvalidReservationRelease(amount, x.redeemReserved);
        if (amount > x.outstanding) revert RedemptionExceedsOutstanding(amount, x.outstanding);
        if (amount > x.verifiedRedeemable) revert InsufficientRedeemableInventory(amount, x.verifiedRedeemable);
        x.redeemReserved -= amount;
        x.outstanding -= amount;
        x.verifiedRedeemable -= amount;
        emit RedemptionClosed(tokenId, amount, x.outstanding, x.verifiedRedeemable);
    }
}
