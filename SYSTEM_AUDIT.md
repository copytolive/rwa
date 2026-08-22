# RWA System Readiness Audit

Updated: 2026-08-23

## Authentication
- Login/logout: wallet signature only.
- No username/password/email authentication.
- Social relay is optional publishing infrastructure, not a login method.
- Wallet account changes invalidate the current session and require login again.
- Wallet-scoped local data is isolated per connected wallet.

## Operational modules
1. Market terminal — live Binance public market data, TradingView chart, fallback candles, order book, live trades.
2. Trader profile + P&L — wallet-linked profile and Hyperliquid venue-derived performance.
3. Leaderboard — verified public wallet profiles when users opt into public social discovery.
4. Copy trade — source wallet monitoring, allocation, max notional, stop-based max-loss guard, manual wallet signature before execution.
5. Watchlist + alerts — local watchlist and browser notifications while the app is active.
6. Portfolio — Hyperliquid account value, withdrawable balance, ROI, positions, unrealized P&L.
7. Social feed — local thesis plus optional signed public relay publishing, reply, like, repost, bookmark, follow.
8. Market intelligence — breadth, momentum, volume-spike ratio, order-flow pressure, trending markets.
9. RWA registry/marketplace shell — verified public registry plus explicitly unverified local drafts.
10. Execution — wallet-signed Hyperliquid limit orders, testnet by default, max-notional guard, explicit mainnet confirmation.
11. System Health — checks market engine, chart, wallet session, Hyperliquid API, storage, browser alerts, RWA registry, and optional social relay.

## Known architecture limits of the all-free static setup
- Copy monitoring and market alerts are not guaranteed 24/7 when the browser/app is closed.
- Public social discovery/leaderboard publication requires the optional decentralized social relay layer; wallet remains the only login.
- The RWA marketplace cannot mark assets verified until real legal/asset documents are reviewed and added to `rwa-assets.json`.
- External mobile wallets outside an injected wallet browser may require a future WalletConnect/Reown integration.

## Highest-priority next systems
1. Order management: open orders, cancel/replace, TP/SL and order history.
2. Global risk engine: daily loss cap, max leverage, max total exposure, per-asset cap, emergency kill switch.
3. Activity/audit log: every login, profile change, copy signal, alert trigger and submitted order.
4. WalletConnect/Reown mobile connection path for browsers without an injected EVM wallet.
5. RWA verification workflow: document checklist, issuer review, legal status, NAV history and verification approvals.
6. Social moderation/spam controls for a larger public network.
7. Provider failover/health routing for market data and venue APIs.
