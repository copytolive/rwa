// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice PRE-TGE rewards integration interface. No reward rate, allocation, or program is configured here.
interface IRWARewards {
    event RewardClaimed(bytes32 indexed programId, address indexed account, address indexed to, uint256 amount);

    function rewardToken() external view returns (address);
    function claimable(bytes32 programId, address account) external view returns (uint256);
    function claim(bytes32 programId, address to) external returns (uint256 amount);
}
