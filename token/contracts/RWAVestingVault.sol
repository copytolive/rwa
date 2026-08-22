// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Simple immutable linear vesting vault for one beneficiary.
contract RWAVestingVault {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    address public immutable beneficiary;
    uint64 public immutable start;
    uint64 public immutable cliff;
    uint64 public immutable duration;
    uint256 public immutable allocation;
    uint256 public released;

    error NotBeneficiary();
    error InvalidSchedule();
    error NothingToRelease();

    constructor(
        IERC20 token_,
        address beneficiary_,
        uint64 start_,
        uint64 cliffSeconds_,
        uint64 durationSeconds_,
        uint256 allocation_
    ) {
        if (beneficiary_ == address(0) || address(token_) == address(0)) revert InvalidSchedule();
        if (durationSeconds_ == 0 || cliffSeconds_ > durationSeconds_ || allocation_ == 0) revert InvalidSchedule();
        token = token_;
        beneficiary = beneficiary_;
        start = start_;
        cliff = start_ + cliffSeconds_;
        duration = durationSeconds_;
        allocation = allocation_;
    }

    function vestedAt(uint256 timestamp) public view returns (uint256) {
        if (timestamp < cliff) return 0;
        if (timestamp >= uint256(start) + duration) return allocation;
        return allocation * (timestamp - start) / duration;
    }

    function releasable() public view returns (uint256) {
        return vestedAt(block.timestamp) - released;
    }

    function release() external {
        if (msg.sender != beneficiary) revert NotBeneficiary();
        uint256 amount = releasable();
        if (amount == 0) revert NothingToRelease();
        released += amount;
        token.safeTransfer(beneficiary, amount);
    }
}
