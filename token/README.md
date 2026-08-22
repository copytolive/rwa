# RWA Token Infrastructure — PRE-TGE

This directory intentionally prepares token infrastructure without launching a live token.

## Network plan

- HyperEVM testnet: chain ID `998`, RPC `https://rpc.hyperliquid-testnet.xyz/evm`.
- HyperEVM mainnet: chain ID `999`, RPC `https://rpc.hyperliquid.xyz/evm`.
- TGE and mainnet deployment are OFF in `config.json`.
- Token name, ticker and fixed supply remain blank until governance/business/legal approval.

## Contracts

- `RWAToken.sol`: fixed supply, ERC-20 Permit, ERC20Votes governance-ready token. No post-deployment minting.
- `RWAVestingVault.sol`: immutable cliff + linear vesting vault for team/investor/partner allocations.

## Launch order

1. Complete real-wallet Hyperliquid testnet E2E trading.
2. Set treasury multisig and platform builder-fee wallet.
3. Finalize token name/ticker/supply/allocation.
4. Legal classification and disclosures.
5. Contract tests + third-party audit.
6. Deploy contracts to HyperEVM testnet (998).
7. Rehearse treasury, vesting, rewards and governance flows.
8. Only after explicit approval: HyperEVM mainnet deployment (999).
9. Only after explicit approval: HIP-1 spot registration and HIP-2 liquidity bootstrap.

## Security policy

- No private key is committed to GitHub.
- No mainnet deployment script runs automatically.
- No TGE is activated by the website.
- A token must not be represented as company equity, guaranteed yield, or profit-sharing without appropriate legal review.
