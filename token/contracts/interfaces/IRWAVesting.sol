// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Common read/release surface for PRE-TGE vesting integrations.
interface IRWAVesting {
    function token() external view returns (address);
    function beneficiary() external view returns (address);
    function allocation() external view returns (uint256);
    function released() external view returns (uint256);
    function vestedAt(uint256 timestamp) external view returns (uint256);
    function releasable() external view returns (uint256);
    function release() external;
}
