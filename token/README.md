# RWA Token Infrastructure — PRE-TGE + Product RWA MVP

This directory prepares token infrastructure without launching a live platform token, TGE, Product RWA deployment, or mainnet market.

## Network plan

- HyperEVM testnet: chain ID `998`, RPC `https://rpc.hyperliquid-testnet.xyz/evm`.
- HyperEVM mainnet: chain ID `999`, RPC `https://rpc.hyperliquid.xyz/evm`.
- Platform-token TGE and mainnet deployment are OFF in `config.json`.
- Product RWA testnet/mainnet deployment are OFF in `product-rwa-config.json`.
- Platform token name, ticker and fixed supply remain blank until governance/business/legal approval.

## Two token layers are intentionally different

### Platform PRE-TGE token

- `contracts/RWAToken.sol`: fixed supply, ERC-20 Permit, ERC20Votes governance-ready template. No post-deployment minting.
- `contracts/RWAVestingVault.sol`: immutable cliff + linear vesting vault for team/investor/partner allocations.
- PRE-TGE interfaces define future integration boundaries without inventing treasury, reward, governance or tokenomics decisions.

### Product RWA MVP

The Product RWA is a **redeemable physical-product entitlement**, not HGB/HM, warehouse/property title, equity, a deposit, profit sharing, or guaranteed yield.

- `contracts/ProductInventoryGate.sol` implements the canonical inventory-liability gate:
  `MAX(0, Verified Redeemable Inventory - Non-token Reserved Inventory - Outstanding Redeemable Tokens - Required Buffer)`.
- Coverage is `(Verified Redeemable Inventory - Non-token Reserved Inventory) / Outstanding Redeemable Tokens`; outstanding `0` is reported as N/A. Actual shortages may be recorded honestly, but a shortage blocks new mint.
- `contracts/ProductRWA1155.sol` requires explicit entitlement metadata and separates mint requester, approver and executor. Inventory eligibility is revalidated immediately before mint.
- `contracts/RedemptionManager.sol` reserves inventory atomically, locks holder units against duplicate claims, records PICK_PACK → SHIPPED → DELIVERED evidence, and burns/closes only after delivery.
- Holder-to-holder transfer and public secondary market are **immutably OFF in this MVP contract**. Enabling future transfer requires a separately reviewed design/Decision Record rather than flipping a runtime switch.

## Unit tests and CI

`token/test/contracts.test.mjs` verifies the PRE-TGE platform token and vesting vault.

`token/test/product-rwa.test.mjs` verifies:

- explicit product entitlement requirements;
- exact canonical additional-mintable formula;
- coverage N/A with zero outstanding and breach reporting below 1.00x;
- requester/approver/executor segregation of duties;
- execution-time inventory revalidation;
- immutable holder-transfer OFF policy;
- atomic redemption reservation and duplicate-claim prevention;
- evidence-bound fulfillment state transitions;
- delivery-only burn/close;
- cancellation releasing reserved inventory;
- truthful shortage recording while new mint fails closed.

`.github/workflows/token-contracts.yml` runs on pull requests and `main`, installs pinned dependencies, compiles all token/Product RWA contracts, runs both local-EVM test suites, verifies source controls, and verifies that deployment locks remain closed.

Local verification after dependencies are installed:

```bash
npm run --prefix token verify
```

## Deployment guards

`deploy-guard.mjs` is for the platform PRE-TGE token and creates only an unsigned plan. It never accepts or stores a private key.

`product-rwa-deploy-guard.mjs` is for the Product RWA MVP and also creates only an unsigned HyperEVM testnet plan. It requires explicit testnet approval, complete role addresses, separate mint requester/approver/executor addresses, and compiled artifacts. Mainnet automatic deployment is intentionally unsupported.

Current Product RWA config is fail closed:

- `transfer_enabled=false`;
- `secondary_market_enabled=false`;
- `testnet_deployment_allowed=false`;
- `mainnet_deployment_allowed=false`;
- contract/role addresses blank;
- status `NOT_DEPLOYED`.

These values must not be changed to simulate progress. Real transaction hashes, chain-998 receipts, deployed addresses, role assignments, source verification and testnet mint/redeem evidence are required after a genuine deployment.

## Platform-token deployment guard

Before the platform PRE-TGE guard will produce a testnet plan, all of these must exist:

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

1. Keep canonical Product RWA/property/commerce boundaries locked in UI and contracts.
2. Pass Product RWA compile + local lifecycle tests.
3. Obtain genuine physical inventory/evidence and counsel-reviewed entitlement/Terms.
4. Assign real separated operating roles/multisig.
5. Explicitly approve Product RWA TESTNET deployment only.
6. Generate the unsigned Product RWA testnet plan and deploy with the approved external wallet.
7. Verify on-chain role assignments, inventory-gated mint, redemption reservation, delivery evidence and burn on HyperEVM testnet.
8. Complete real beta/operational/reconciliation/recovery gates.
9. Separately finalize platform-token name/ticker/supply/allocation and legal classification if a platform token/TGE is still desired.
10. Mainnet/TGE remain separate explicit decisions after all machine and external gates pass.

## Security policy

- No private key is committed to GitHub.
- No private key is accepted by either deployment guard.
- No mainnet deployment runs automatically.
- No TGE is activated by the website.
- Product RWA minting cannot exceed the canonical verified-inventory liability gate.
- Existing-customer redemption is not stopped merely to improve a coverage ratio; shortage is surfaced and handled operationally.
- A token must not be represented as company equity, property title, guaranteed yield, or profit-sharing without the appropriate legal structure and review.
