# RWA Token Infrastructure — PRE-TGE

This directory prepares token infrastructure without launching a live token.

## Network plan

- HyperEVM testnet: chain ID `998`, RPC `https://rpc.hyperliquid-testnet.xyz/evm`.
- HyperEVM mainnet: chain ID `999`, RPC `https://rpc.hyperliquid.xyz/evm`.
- TGE and mainnet deployment are OFF in `config.json`.
- Token name, ticker and fixed supply remain blank until governance/business/legal approval.

## Contracts

- `contracts/RWAToken.sol`: fixed supply, ERC-20 Permit, ERC20Votes governance-ready token. No post-deployment minting.
- `contracts/RWAVestingVault.sol`: immutable cliff + linear vesting vault for team/investor/partner allocations.

## Deployment guard

`deploy-guard.mjs` creates only an unsigned deployment plan. It never accepts or stores a private key.

Before it will produce a testnet plan, all of these must exist:

- approved token name;
- approved uppercase ticker;
- approved fixed supply;
- `RWA_TOKEN_TREASURY` set to the approved multisig address;
- testnet `deploymentAllowed=true`.

Example after those values have been approved:

```bash
RWA_TOKEN_TREASURY=0x... node token/deploy-guard.mjs --network=testnet
```

Mainnet remains blocked while `mainnetDeploymentEnabled=false`, and TGE remains blocked while `tgeEnabled=false`.

## Launch order

1. Complete real-wallet Hyperliquid testnet E2E trading.
2. Set treasury multisig and platform builder-fee wallet.
3. Finalize token name/ticker/supply/allocation.
4. Legal classification and disclosures.
5. Contract tests + third-party audit.
6. Generate the guarded unsigned testnet deployment plan.
7. Deploy contracts to HyperEVM testnet (998) with the approved wallet.
8. Rehearse treasury, vesting, rewards and governance flows.
9. Only after explicit approval: HyperEVM mainnet deployment (999).
10. Only after explicit approval: HIP-1 spot registration and HIP-2 liquidity bootstrap.

## Security policy

- No private key is committed to GitHub.
- No private key is accepted by the deployment guard.
- No mainnet deployment runs automatically.
- No TGE is activated by the website.
- A token must not be represented as company equity, guaranteed yield, or profit-sharing without appropriate legal review.
