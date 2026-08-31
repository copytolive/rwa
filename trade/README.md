# RWA Trade — Professional Release Candidate

RWA Trade is the non-custodial execution surface for the RWA network. The public build is intentionally **PUBLIC TESTNET BETA** while the mainnet launch gate remains locked.

## Product experience

The `/trade/` interface now provides a professional single-screen trading workflow:

- searchable/favorite perpetual-market picker;
- native live candlestick chart with 1m, 5m, 15m, 1h, 4h and 1d intervals;
- mark price, 24h change, volume, open interest and funding;
- live order book and trade tape;
- BUY/SELL and MARKET/LIMIT controls;
- USD/equity quick sizing and leverage slider;
- entry TP/SL plus direction-aware percentage presets;
- estimated margin, risk-at-SL, reward-at-TP and R:R preview;
- user risk limits constrained by platform hard caps and a kill switch;
- open-position manager with 25/50/100% reduce-only closes, break-even helper and post-entry TP/SL triggers;
- open-order modify/cancel controls;
- account positions, orders, fills and P&L;
- responsive mobile BUY/SELL action bar;
- Advanced diagnostics and venue-backed release verification.

## User flow

1. Connect wallet.
2. Click **Get test balance** when TESTNET equity is zero.
3. Click **Enable trading** once. The master wallet authorizes a delegated trade-only agent.
4. Place BUY/SELL orders without a master-wallet popup for each order.
5. Optional entry TP/SL is submitted atomically with the parent entry.
6. Manage positions, protection, open orders and closes from RWA Trade.
7. Venue state remains the source of truth for positions, fills and P&L.

## Single-write-path security

- Browser write owner: root `execution-api.js` only.
- Professional UI code performs **read-only** market-data queries and delegates every write to `RWAExecutionAPI`.
- Risk-increasing writes are delegated-agent-only and fail closed.
- Reduce-only exits and cancellations may use the master-wallet fallback only to reduce risk.
- Agent secret is encrypted browser-side with AES-GCM and a non-extractable WebCrypto key.
- Master seed/private key is never requested or stored.
- Platform caps enforce leverage, order size, total exposure, per-asset exposure and daily loss.
- Local risk settings may only make those limits stricter.
- Kill switch blocks new risk-increasing writes while preserving exits/cancellations.
- Builder/platform fee remains OFF.
- Withdrawal remains disabled in this TESTNET terminal.

## Verified execution

A real-wallet venue-backed TESTNET lifecycle has passed and is independently registered in `launch/e2e-registry.json`. The lifecycle covers resting-order modify/cancel, delegated market entry, observed position, atomic TP/SL, close, fill history and P&L.

The in-app verifier refuses to start with pre-existing TESTNET positions/orders and attempts cleanup on failure. Published proof is independently rechecked by `tools/e2e-proof.mjs`; it must never be manually marked PASS.

## Mainnet and server rollout

The code contains the mainnet execution path but the public build keeps `mainnetEnabled: false`. MAINNET must not be enabled until `launch/readiness.json` reaches `READY_FOR_MAINNET` from real evidence.

The production worker is intentionally separate from GitHub Pages. The repository includes the `agent-worker/` Docker/runtime package for later deployment to the project-owned 24/7 server. The server must never receive a master-wallet private key.

Current public path:

`https://narzulalistiqlal.github.io/rwa/trade/`
