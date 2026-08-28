// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

interface IRWASeriesRegistry { function isActive(bytes32 seriesId) external view returns(bool); }

/// @notice Fully funded, immutable-root claim vault for RWA Series distributions.
/// @dev The off-chain ledger/snapshot computes entitlements. This vault only releases a deposited ERC20
///      payout pool against a committed Merkle root. No unfunded or synthetic payout receipt is created.
contract RWADistributionVault is AccessControl {
    using SafeERC20 for IERC20;
    bytes32 public constant DISTRIBUTOR_ROLE=keccak256("DISTRIBUTOR_ROLE");
    IRWASeriesRegistry public immutable registry;
    uint256 public nextDistributionId=1;
    struct Distribution{bytes32 seriesId;IERC20 token;bytes32 merkleRoot;bytes32 manifestHash;uint256 funded;uint256 claimed;uint64 deadline;address funder;bool exists;}
    mapping(uint256=>Distribution) private _distributions;
    mapping(uint256=>mapping(uint256=>uint256)) private _claimedBitMap;
    error InvalidInput();error SeriesInactive();error DistributionMissing();error AlreadyClaimed();error InvalidProof();error ClaimExpired();error SweepTooEarly();error NotFunder();
    event DistributionFunded(uint256 indexed distributionId,bytes32 indexed seriesId,address indexed token,uint256 amount,bytes32 merkleRoot,bytes32 manifestHash,uint64 deadline,address funder);
    event Claimed(uint256 indexed distributionId,uint256 indexed index,address indexed account,uint256 amount);
    event RemainderSwept(uint256 indexed distributionId,address indexed to,uint256 amount);
    constructor(address admin,IRWASeriesRegistry registry_){if(admin==address(0)||address(registry_)==address(0))revert InvalidInput();registry=registry_;_grantRole(DEFAULT_ADMIN_ROLE,admin);}
    function fundDistribution(bytes32 seriesId,IERC20 token,uint256 amount,bytes32 merkleRoot,bytes32 manifestHash,uint64 deadline) external onlyRole(DISTRIBUTOR_ROLE) returns(uint256 distributionId){if(seriesId==bytes32(0)||address(token)==address(0)||amount==0||merkleRoot==bytes32(0)||manifestHash==bytes32(0)||deadline<=block.timestamp)revert InvalidInput();if(!registry.isActive(seriesId))revert SeriesInactive();distributionId=nextDistributionId++;_distributions[distributionId]=Distribution(seriesId,token,merkleRoot,manifestHash,amount,0,deadline,msg.sender,true);token.safeTransferFrom(msg.sender,address(this),amount);emit DistributionFunded(distributionId,seriesId,address(token),amount,merkleRoot,manifestHash,deadline,msg.sender);}
    function isClaimed(uint256 distributionId,uint256 index) public view returns(bool){uint256 wordIndex=index/256;uint256 bitIndex=index%256;uint256 word=_claimedBitMap[distributionId][wordIndex];uint256 mask=(1<<bitIndex);return word&mask==mask;}
    function _setClaimed(uint256 distributionId,uint256 index) private{uint256 wordIndex=index/256;uint256 bitIndex=index%256;_claimedBitMap[distributionId][wordIndex]|=(1<<bitIndex);}
    function claim(uint256 distributionId,uint256 index,address account,uint256 amount,bytes32[] calldata proof) external{Distribution storage d=_distributions[distributionId];if(!d.exists)revert DistributionMissing();if(block.timestamp>d.deadline)revert ClaimExpired();if(isClaimed(distributionId,index))revert AlreadyClaimed();bytes32 leaf=keccak256(bytes.concat(keccak256(abi.encode(index,account,amount))));if(!MerkleProof.verify(proof,d.merkleRoot,leaf))revert InvalidProof();if(d.claimed+amount>d.funded)revert InvalidInput();_setClaimed(distributionId,index);d.claimed+=amount;d.token.safeTransfer(account,amount);emit Claimed(distributionId,index,account,amount);}
    function sweepRemainder(uint256 distributionId,address to) external{Distribution storage d=_distributions[distributionId];if(!d.exists)revert DistributionMissing();if(block.timestamp<=d.deadline)revert SweepTooEarly();if(msg.sender!=d.funder&&!hasRole(DEFAULT_ADMIN_ROLE,msg.sender))revert NotFunder();if(to==address(0))revert InvalidInput();uint256 remaining=d.funded-d.claimed;d.claimed=d.funded;if(remaining>0)d.token.safeTransfer(to,remaining);emit RemainderSwept(distributionId,to,remaining);}
    function distribution(uint256 distributionId) external view returns(Distribution memory){return _distributions[distributionId];}
}
