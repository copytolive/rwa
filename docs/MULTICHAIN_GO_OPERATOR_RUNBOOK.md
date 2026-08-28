# MULTI CHAIN GO Operator Runbook

This runbook is the final human-authorized path from the current fail-closed state to a legitimate mainnet GO. It never asks for or stores a seed phrase/private key.

## 1. LI.FI production fee setup

1. Open the LI.FI Partner Portal: https://portal.li.fi/
2. Create/verify the `copytolive-rwa` integration.
3. Configure the production fee wallet.
4. Keep the repo fee intent at 20 bps (`fee_decimal: 0.002`) unless an approved business decision changes it.
5. Capture public/HTTPS provider evidence that proves the integrator and fee wallet are active.
6. Only then update `rwa-multichain-revenue.json` so `integrator_verified`, `portal_configured`, and `fee_wallet_configured_externally` are true and set `evidence_url`.

Do not place LI.FI API keys in browser source or commit them to GitHub.

## 2. Hyperliquid builder activation

1. Use the production builder wallet address that will receive builder-code fees.
2. Open `/rwa/multichain-pilot.html` from the deployed GitHub Pages site.
3. Connect the builder wallet and use **Hyperliquid funding / builder activation**.
4. Verify in the wallet that the transaction is native Arbitrum USDC to the official Hyperliquid Bridge2 flow before signing.
5. The pilot accepts 5–105 USDC and verifies the resulting Hyperliquid perps account value. Builder eligibility requires account value >=100 USDC.
6. The end user must separately approve the builder fee with the main wallet (`approveBuilderFee`). Never use an agent/API wallet for this approval.
7. Verify the approval using Hyperliquid `maxBuilderFee` and store HTTPS evidence.
8. Only then set the builder address/account-value/approval fields in `rwa-multichain-revenue.json` to their verified production values.

## 3. Five real receipt classes

Use the same deployed pilot. Every positive route has an ordinary value cap of 2 USDC and requires an explicit wallet confirmation.

Required classes:

- `EVM_TO_EVM` — Base USDC -> Arbitrum USDC
- `EVM_TO_SOLANA` — Base USDC -> Solana USDC
- `SOLANA_TO_EVM` — Solana USDC -> Arbitrum USDC
- `SAME_CHAIN` — Base USDC -> Base USDT
- `FAILURE_OR_REFUND` — import an already-existing genuine failed/refunded provider transaction; do not intentionally create a loss

Wait until provider status is terminal. Then use **Export machine-verifiable evidence JSON**. The export must contain a real hash/signature, amount >0, terminal provider status, and HTTPS evidence URL for each class.

## 4. Import and gate

Run:

```bash
node tools/multichain-import-pilot-evidence.mjs multichain-real-receipts.json
node tools/multichain-import-pilot-evidence.mjs multichain-real-receipts.json --write
node tools/multichain-receipt-matrix.mjs --require-complete
node tools/multichain-provider-probe.mjs --write
node tools/multichain-revenue-contract.mjs --require-live
node tools/multichain-mainnet-gate.mjs --write --require-ready
node tools/launch-gate-current.mjs --write --require-mainnet
```

The importer is fail-closed: it refuses missing/non-terminal receipts, non-HTTPS evidence, invalid hashes/signatures, and a supplied Hyperliquid funding receipt that does not prove >=100 USDC account value.

## 5. Unlock rule

Unrestricted mainnet execution may be enabled only when both are true:

- `launch/multichain-readiness.json`: `status=READY`, `ready=true`
- `launch/readiness.json`: `status=READY_FOR_MAINNET`, `mainnet_ready=true`

Do not bypass either gate. A green CI workflow that verifies a fail-closed BLOCKED state is not the same thing as launch readiness.
