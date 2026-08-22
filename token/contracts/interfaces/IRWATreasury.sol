// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice PRE-TGE interface only. Implementation and treasury multisig are intentionally not selected yet.
interface IRWATreasury {
    event TreasuryTransfer(address indexed asset, address indexed to, uint256 amount, bytes32 indexed reference);

    function treasuryMultisig() external view returns (address);
    function transferAsset(address asset, address to, uint256 amount, bytes32 reference) external;
}
