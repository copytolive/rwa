# RWA System Readiness Audit

Updated: 2026-08-23

## Authentication and custody

- Login/logout uses wallet signatures; no username/password authentication is required for trading identity.
- `wallet-core.js v3` is the single runtime auth owner.
- Wallet account changes invalidate the active session and require a fresh login.
- Hyperliquid master private keys are never accepted by the RWA application or 24/7 worker.
- Fast/24/7 execution uses an explicitly approved delegated Hyperliquid API-agent wallet, re-verified against `extraAgents`.
- Delegated worker keys are AES-256-GCM encrypted at rest and removed from active records on stop/revocation failure/max-loss hard stop.

## Trading write architecture

Browser:

`UI / Exchange / Copy / Ops → RWAExecutionAPI → mandatory internal Risk Gate → Hyperliquid`

24/7 worker:

`Copy loop → RWAWorkerExecutionAPI → mandatory worker Risk Gate → Hyperliquid`

`ExchangeClient` may exist only in `execution-api.js` and `agent-worker/execution.mjs`. `rwa/security-gate` scans runtime source and fails if a secondary owner appears.

## Execution Agent

- TESTNET default.
- Market and limit entries.
- Atomic parent entry + TP/SL using Hyperliquid `normalTpsl`.
- Open positions, open orders, history and P&L refresh.
- Modify, cancel, cancel-all and reduce-only close.
- Browser-native ethers signer path for wallet typed-data compatibility.
- One-click real TESTNET E2E covers API-agent authorization, resting order, modify, cancel, bracket entry, position observation, TP/SL observation, close, history and P&L.
- Signed E2E proof is independently verified by GitHub + Hyperliquid before entering `launch/e2e-registry.json`.

## Mainnet safety

A local E2E PASS does not unlock production by itself.

Browser mainnet requires:

1. wallet-bound local real E2E gate; **and**
2. global `launch/readiness.json.status === READY_FOR_MAINNET`.

Worker mainnet additionally requires repository `mainnet_enabled=true` and host secret `RWA_MAINNET_APPROVED=I_UNDERSTAND_MAINNET_RISK`.

## Risk Agent

Browser and worker enforce non-reduce-only risk controls before order write:

- loss cap;
- requested/account leverage;
- total exposure;
- per-asset exposure;
- kill switch;
- copy-capital allocation;
- reduce-only exit path.

24/7 copy also uses session equity loss in addition to day P&L to prevent a daily reset from reopening risk.

## Copy Agent

Browser mode:

- Trader → Capital → Max Loss → Copy.
- Source equity sizing.
- Source fill monitoring.
- Copied position ledger.
- Reduce-only source closes.
- Capital cap and max-loss stop.

24/7 mode adds:

- persistent state;
- explicit source/follower network selection;
- exact worker-origin signature binding;
- one-time authorization nonces;
- stable source-fill IDs;
- deterministic 128-bit Hyperliquid CLOID per source fill;
- venue `orderStatus` reconciliation before retries;
- network-ambiguity retry with identical CLOID;
- restart duplicate protection;
- API-agent re-verification;
- browser/worker mutual exclusion;
- CORS allowlist, POST rate limiting, `/healthz` and `/readyz`.

`rwa/copy-production-sim` tests partial/multiple fills, scaling, reduce/close, capital exhaustion, duplicate signals, persistent restart state, max-loss and network retry behavior.

## Portfolio + Trader

Hyperliquid is the source for account value, withdrawable balance, positions, realized/unrealized P&L, period ROI, win rate, max drawdown, fills and leaderboard metrics. User-entered performance is never labeled venue-verified.

## Social + Intelligence

- Signed Nostr profile/feed.
- Follow, reply, like, repost, bookmark.
- Signed social-wallet linkage.
- Verified-position indicator when backed by venue position data.
- Breadth, momentum, volume anomaly, order-flow pressure, trending, whale/large-trade proxy and smart-money proxy.
- Social safety/moderation controls remain separate from wallet authentication.

## RWA Verification

- Local drafts stay explicitly UNVERIFIED.
- VERIFIED publication requires issuer/SPV, NAV > 0, ownership evidence, appraisal evidence, legal evidence, KYB and disclosure checks.
- Reviewer must be explicitly allowlisted in `rwa-reviewers.json`.
- Reviewer approval is wallet-signed.
- GitHub workflow verifies signature + allowlist + complete evidence fields before writing `rwa-assets.json`.

## 24/7 deployment package

- Docker service prepared in `agent-worker/`.
- Persistent `/data` expected.
- Secrets are host-only, never public repository values.
- Exact HTTPS production origin is mandatory.
- Public worker config ships disabled and repository kill switch ships ON.
- `/healthz` exposes liveness and safety contract only.
- `/readyz` fails closed until encryption/origin/production controls are valid.

## Verified staged beta

Beta evidence is not a manually editable dashboard metric. `tools/beta-proof.mjs` verifies:

- wallet signature;
- official enabled worker URL;
- worker production health + single-write/idempotency contract;
- matching worker wallet session + processed source fills;
- Hyperliquid TESTNET open and close fills in the signed session window.

Minimum verified-wallet thresholds:

- Internal: 3
- Closed: 20
- Public: 100

Mainnet stays locked until all three thresholds and explicit mainnet control pass.

## Machine launch states

- `BLOCKED`
- `READY_FOR_BETA`
- `BETA_PASSED_AWAITING_MAINNET`
- `READY_FOR_MAINNET`

`launch/readiness.json` is generated by CI rather than trusted as handwritten UI state.

## Current factual blockers

The software safety checks are implemented, but production must remain blocked while any of these real facts are absent:

- no registered real-wallet E2E proof;
- no authorized real reviewer;
- no real VERIFIED RWA asset;
- no deployed official HTTPS worker;
- worker production controls remain safe/off;
- staged beta proof thresholds are not met;
- explicit mainnet control remains OFF.

Revenue builder fee remains OFF. Token/TGE and token mainnet deployment remain deferred.
