# RWA Operating System V14

## Scope

V14 closes the repository-side architecture between a validated real-world business and an auditable holder distribution. It supports property developers, agriculture/harvest businesses, hotels, franchises, SMEs, rental businesses, energy/infrastructure and custom validated businesses without mixing their cashflows.

Each business uses a segregated **RWA Series**. The platform token `$RWA` remains distinct from series-level economic rights. A series is not activatable without HTTPS evidence references for ownership, legal review, valuation, issuer identity and disclosure.

## Canonical flow

`Business → RWA transaction reference/barcode → payment state → SETTLED ledger → revenue basis → verified expenses/deductions → reserve → investor allocation → holder snapshot → entitlement manifest → authorized funding → payout receipt → reconciliation/audit`

Refunded, reversed and cancelled transactions are not distribution eligible. A created or merely paid transaction is not revenue until it is settled.

## Economic terms

Immutable after activation:
- distribution basis;
- investor allocation basis points;
- payout asset;
- holder unit definition.

Governed with notice/timelock:
- reserve basis points;
- frequency;
- holder snapshot policy;
- minimum payout.

The repository does not claim that a configured distribution is legally a dividend in every jurisdiction. Issuers must obtain the required legal/regulatory approval and evidence before production activation.

## Transaction/POS security

Production POS ingestion is designed for terminal-specific HMAC authentication using `RWA_OS_TERMINAL_SECRETS`, timestamp freshness and an idempotent provider/external reference. Static pages never become the authoritative revenue ledger.

## Holder accounting

Supported snapshot policies:
- `RECORD_DATE` — last balance at the record timestamp;
- `AVERAGE_BALANCE` — average of supplied trusted checkpoints in the period;
- `TIME_WEIGHTED` — balance weighted by elapsed time across the period.

All payouts use integer minor-unit accounting. Remainders are allocated deterministically; the sum of entitlements can never exceed the funded distribution pool.

## On-chain commitments and series units

`RWASeriesRegistry.sol` commits metadata, immutable economics, governed economics and legal evidence hashes. Governed changes are timelocked.

`RWASeriesUnits1155.sol` provides a scalable per-series unit ledger. One ERC-1155 token id maps to one RWA Series. Issuance is capped, requires an active series, and only eligible accounts may receive issuance. Ordinary transfers require both sender and receiver to be eligible and can be frozen by compliance. A transfer-agent role exists for controlled administrative transfers. These technical controls do not themselves establish that an instrument may lawfully be offered or transferred in a jurisdiction.

Holder checkpoints consumed by the distribution engine may be produced from these series-unit balances or another trusted canonical ownership source. Production must record the snapshot source reference so holder entitlements are reproducible.

`RWADistributionVault.sol` accepts only an active series, requires an ERC20 pool to be funded before claims, commits an immutable Merkle root + manifest hash, blocks invalid/double claims, and never fabricates a payout receipt.

## Fail-closed production dependencies

Engineering/browser tests can pass while production remains blocked. Real launch still requires verified asset evidence, jurisdiction/legal approval, real merchant/payment/POS settlement, production commerce/worker services, trusted holder snapshots, authorized distribution funding, real payout receipts, LI.FI/Hyperliquid external setup where applicable, beta evidence and the global mainnet launch gate.

## Verification

Run locally:

```bash
node tools/rwa-os-core.test.mjs
node rwa-os-service/test.mjs
cd token && npm install --no-audit --no-fund && npm run verify
```

Browser acceptance is executed by `.github/workflows/rwa-operating-system-v14.yml`. It verifies Marketplace → RWA OS navigation, desktop operation at 1600×1000, mobile operation at 390×844, the transaction barcode, settled-only revenue, refund exclusion, holder entitlements, funding-gated distribution and audit hashes. Default mode must show zero fabricated series/revenue. `?fixture=1` is reserved for deterministic CI and is visibly labelled `BROWSER TEST FIXTURE`.
