// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice PRE-TGE governance integration surface. No governor, quorum, voting period, or proposal threshold is selected here.
interface IRWAGovernance {
    function delegates(address account) external view returns (address);
    function getVotes(address account) external view returns (uint256);
    function getPastVotes(address account, uint256 timepoint) external view returns (uint256);
    function delegate(address delegatee) external;
}
