# RWA System — Production Launch Runbook

Status is machine-evaluated by `tools/launch-gate.mjs`, written to `launch/readiness.json`, deployed to GitHub Pages, and surfaced in the RWA Assets tab. The repository must never claim production readiness from UI state alone.

## 1. Execution Agent — automated, real-wallet proof is the final external action

Browser writes use only `RWAExecutionAPI` with mandatory internal risk checks. TP/SL uses one Hyperliquid `normalTpsl` bracket action. TESTNET is always the default.

The Trade advanced section provides **Run ONE-CLICK REAL E2E**. It creates a small resting order, modifies and cancels it, opens a small bracket position, observes position + TP/SL, closes it, and reads history/PnL. After PASS, **Publish E2E Proof** produces a wallet-signed package. GitHub Actions independently checks signature plus live Hyperliquid TESTNET evidence before writing `launch/e2e-registry.json`.

Saving the local wallet E2E gate does **not** unlock mainnet by itself. `exchange-core.js` requires both the local wallet gate and the global `READY_FOR_MAINNET` machine gate.

## 2. Risk Agent — implemented and CI-enforced

Mandatory controls exist in browser execution and 24/7 worker execution: session/daily loss, requested/account leverage, total exposure, per-asset exposure, kill switch, reduce-only exits, and copy-capital cap.

Browser modules outside `execution-api.js` may not instantiate `ExchangeClient`. Worker modules outside `agent-worker/execution.mjs` may not instantiate it. `tools/security-gate.mjs` and `rwa/security-gate` continuously enforce this and prohibit worker fund-movement methods.

## 3. Copy Agent — browser + production worker

Browser mode is Trader → Capital → Max Loss → Copy and runs while the page is open. It follows only source fills after activation, scales by source equity, isolates copied positions, copies reductions as reduce-only, caps allocated capital, and stops at max loss.

24/7 mode is in `agent-worker/`. It never accepts the master-wallet private key. It accepts only an already-approved delegated Hyperliquid API-agent key plus a fresh master-wallet signature bound to master/agent/target/capital/max-loss/source and follower environments/exact HTTPS worker origin/timestamp/nonce.

Production replay safety:

- stable source-fill IDs;
- deterministic 128-bit Hyperliquid CLOID per source fill;
- `orderStatus` reconciliation before resend;
- persistent processed-fill ledger;
- transient failures remain retry-pending with the same CLOID;
- restart cannot intentionally create a second CLOID for the same source fill;
- session equity + PnL max-loss protection;
- regular delegated-agent re-verification;
- browser/worker mutual exclusion.

`rwa/copy-production-sim` permanently tests partial fills, multiple fills, scaling, capital exhaustion, reduce/close, duplicate signals, restart persistence, network ambiguity and max-loss behavior.

## 4. Portfolio + Trader Agent — implemented

Hyperliquid public/account data is the source for account value, withdrawable balance, realized/unrealized P&L, period ROI, win rate, max drawdown, positions, fills and leaderboard ranking. User-entered P&L is not labeled verified.

## 5. Social + Intelligence Agent — implemented

Signed Nostr profile/feed, follow, reply, like, repost, bookmark and signed wallet linkage are implemented. Market intelligence includes breadth, momentum, volume anomaly, live order-flow pressure, large-trade/whale proxy, smart-money proxy and trending score. Proxy labels remain explicit and are not identity or prediction claims.

## 6. RWA Verification Agent — automated verifier, real asset inputs required last

A production asset requires a real issuer/SPV, NAV > 0, ownership evidence, appraisal evidence, legal evidence, KYB and disclosure checks. Only wallets explicitly listed in `rwa-reviewers.json` may sign a VERIFIED approval. GitHub Actions verifies the reviewer signature and allowlist before publishing the asset to `rwa-assets.json`.

Do not insert placeholder reviewer wallets, fake documents, fake NAV or fake VERIFIED assets merely to make the launch gate green.

## 7. 24/7 Infrastructure — production-grade package prepared

`agent-worker/Dockerfile` contains the deployable service. Persistent `/data`, AES-256-GCM delegated-key encryption, exact HTTPS origin binding, nonce replay protection, CORS allowlist, request rate limiting, container healthcheck, `/healthz`, `/readyz`, redacted `/status`, kill switch and mainnet double-lock are implemented.

Required host values are external secrets and are never committed. GitHub Pages remains UI-only.

## 8. Verified Beta Program — machine-enforced

`launch/beta-registry.json` contains only proofs accepted by `.github/workflows/beta-proof-review.yml`.

A beta proof must be:

- signed by the participating wallet;
- TESTNET only;
- tied to the exact enabled official worker URL;
- tied to a matching worker user session and processed source-fill evidence;
- backed by Hyperliquid TESTNET open + close fills within the signed time window;
- validated against worker single-write/idempotency/origin/kill-switch/production-control health.

Minimum launch thresholds are intentionally conservative minimums from the staged plan:

- Internal: 3 verified wallets;
- Closed: 20 verified wallets;
- Public: 100 verified wallets.

A wallet can upgrade its proof phase; downgrade is rejected. Mainnet cannot become READY until the public threshold is satisfied.

## 9. Machine Launch States

`tools/launch-gate.mjs` evaluates source + external facts and automatically publishes `launch/readiness.json`:

1. `BLOCKED` — a prerequisite is absent.
2. `READY_FOR_BETA` — execution/security/E2E/reviewer/asset/worker prerequisites pass; staged beta evidence is still incomplete.
3. `BETA_PASSED_AWAITING_MAINNET` — all beta thresholds pass; explicit owner mainnet control is still OFF.
4. `READY_FOR_MAINNET` — every prerequisite, every beta threshold and explicit mainnet control pass.

The browser itself checks `READY_FOR_MAINNET`; a local browser flag cannot bypass it. Worker mainnet also requires both repository `mainnet_enabled=true` and the host-side `RWA_MAINNET_APPROVED=I_UNDERSTAND_MAINNET_RISK` secret.

## 10. Revenue and Token

Builder/platform revenue remains OFF until the system is stable and a real revenue wallet + fee are explicitly supplied and approved. Token/TGE and token mainnet deployment remain deferred and are not launch prerequisites.

## Owner-last rule

All code, tests, source security, deployment package, machine launch gates, verification pipelines and beta evidence pipelines are completed before owner actions are requested.

Only facts that cannot be fabricated remain for the owner/final participants:

1. real wallet signatures and venue-backed TESTNET E2E;
2. designation/signature of a real reviewer wallet;
3. real RWA issuer/ownership/appraisal/legal/KYB/disclosure evidence;
4. real HTTPS hosting account/secrets needed to deploy the worker;
5. real beta participant wallet sessions/proofs at the staged thresholds;
6. explicit `mainnet_enabled` decision after beta passes;
7. revenue wallet/rate only after stable mainnet operation.

Until those facts exist, the correct safe state is TESTNET default, mainnet locked, worker public config disabled, worker kill switch ON, reviewer/asset registries empty, builder fee OFF and token/TGE deferred.
