# RWA System — Production Launch Runbook

Status is machine-evaluated by `tools/launch-gate.mjs` and surfaced in the RWA Assets tab. The repository must never claim production readiness from UI state alone.

## 1. Execution Agent — implemented, real-wallet proof required

Browser writes use only `RWAExecutionAPI` with mandatory internal risk checks. TP/SL uses one Hyperliquid `normalTpsl` bracket action. Mainnet is wallet-bound and locked by default.

In the Trade advanced section, connect the intended wallet on TESTNET, add test collateral, then click **Run ONE-CLICK REAL E2E**. The test creates a small resting order, modifies and cancels it, opens a small bracket position, observes position + TP/SL, closes it, and reads history/PnL. After PASS, click **Publish E2E Proof**. GitHub Actions independently checks the wallet signature plus live Hyperliquid testnet fills/orders/account/agent state before writing `launch/e2e-registry.json`.

No wallet may be added manually to the launch registry without this verifier.

## 2. Risk Agent — implemented

Mandatory controls exist in browser execution and 24/7 worker execution: daily max loss, requested/account leverage, total exposure, per-asset exposure, kill switch, reduce-only exits, and copy-capital cap. Browser modules outside `execution-api.js` may not instantiate `ExchangeClient`. Worker loop may not instantiate `ExchangeClient`; worker writes only through `RWAWorkerExecutionAPI`.

## 3. Copy Agent — implemented in two modes

Browser mode is one-click Trader → Capital → Max Loss → Copy and runs while the app is open. It follows only fills after activation, scales by source equity, isolates copied position ledger, copies reductions as reduce-only, caps capital, and stops at max loss.

24/7 mode is implemented in `agent-worker/`. The worker never accepts the master-wallet private key. It accepts only an already-approved delegated Hyperliquid API-agent key plus a fresh master-wallet signature binding target/capital/max-loss/environment. When 24/7 is activated, the browser watcher is stopped to prevent duplicate execution.

## 4. Portfolio + Trader Agent — implemented

Hyperliquid public/account data is the source for account value, withdrawable balance, realized/unrealized P&L, period ROI, win rate, max drawdown, positions, fills and RWA Network leaderboard ranking. User-entered P&L is not labeled verified.

## 5. Social + Intelligence Agent — implemented

Signed Nostr profile/feed, follow, reply, like, repost, bookmark and verified wallet linkage are implemented. Market intelligence includes breadth, momentum, volume anomaly, live order-flow pressure, large-trade/whale proxy, smart-money proxy and trending score. Proxy labels must remain explicit; they are not identity or prediction claims.

## 6. RWA Verification Agent — implemented, real external inputs required

The public registry begins empty. A production asset requires a real issuer/SPV, NAV greater than zero, ownership evidence, appraisal evidence, legal evidence, KYB and disclosure checks. Only wallets explicitly listed in `rwa-reviewers.json` may sign a VERIFIED approval. GitHub Actions verifies the reviewer signature and allowlist before publishing to `rwa-assets.json`.

Do not insert placeholder reviewer wallets, fake documents, fake NAV or fake VERIFIED assets merely to make the launch gate green.

## 7. 24/7 infrastructure — code complete, deployment required

Build `agent-worker/Dockerfile` on a persistent HTTPS host with encrypted durable `/data`. Set a random `RWA_KEY_ENCRYPTION_SECRET` of at least 32 characters. Keep `RWA_MAINNET_APPROVED` unset during testnet validation. Verify `/healthz`, then set `agent-worker/public-config.json` to the real HTTPS origin. The repository control file ships disabled with kill switch ON.

Production activation requires `agent-worker/control.json`: `enabled=true`, `kill_switch=false`, `production_ready=true`. Mainnet still remains blocked until `mainnet_enabled=true` and the worker host also has the explicit mainnet approval secret.

## 8. Launch Gate

`rwa/launch-gate` is intentionally PENDING/BLOCKED until all non-fabricatable production gates pass:

- at least one wallet-bound, venue-backed real TESTNET E2E proof;
- at least one authorized real reviewer;
- at least one fully VERIFIED real RWA asset;
- configured HTTPS worker endpoint;
- live worker health with kill switch off;
- production worker control enabled.

Only after those gates pass may beta readiness become true. Public mainnet readiness additionally requires explicit mainnet control. Builder/platform revenue remains OFF until a real revenue wallet and approved rate are supplied. Token/TGE remains deferred.

## Current safe state

TESTNET default. Mainnet locked. Worker public config disabled. Worker kill switch ON. Reviewer registry empty. Verified asset registry empty. Builder fee OFF. Token/TGE deferred. This is the correct state until the required real-world and wallet-backed proofs exist.
