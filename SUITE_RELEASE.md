# RWA Suite Release — Verified Growth Suite v2

Runtime: `suite.js` compatibility loader → `suite-v2.js?v=2`.

## Live product modules

1. **Verified Portfolio + P&L** — Hyperliquid account value, withdrawable balance, realized/unrealized P&L, day/week/month/all-time ROI, win rate, max drawdown, closed-trade count, volume and open positions.
2. **Trader Profile + Leaderboard** — signed Nostr identity, wallet-signature linkage, public Hyperliquid wallet inspection, and daily/weekly/monthly/all-time ranking for signed RWA Network traders.
3. **One-click Copy Trade** — choose trader wallet, copy capital and max loss; API-wallet authorization is handled once when needed; only new source fills after activation are mirrored through `RWAExecutionAPI`, with capital cap, max-loss stop and reduce-only closing logic.
4. **Watchlist + Alerts** — price, move, volume-spike, breakout-high/low, whale-trade proxy, and verified-position TP/SL browser alerts.
5. **Social Trading Feed** — signed posts, follow, reply, like, repost, bookmark, verified wallet/position badges and Copy action from eligible profiles.
6. **Market Intelligence** — breadth, momentum, abnormal-volume ratio, order-flow pressure, large-trade/whale proxy, smart-money proxy and trending markets.
7. **RWA Marketplace** — verified public registry + local UNVERIFIED drafts with NAV, yield, issuer/SPV, ownership evidence, appraisal and legal document fields. Drafts cannot self-verify; authorized reviewer signature + registry publication remain mandatory.
8. **Revenue readiness** — builder-fee infrastructure is already wired into the execution API but remains **OFF** until an approved platform revenue wallet and fee rate are supplied and the trader approves the fee.

## Execution invariant

All product-generated trading writes use:

`UI / Copy → RWAExecutionAPI → Hyperliquid`

`suite-v2.js` and the `suite.js` loader contain no `ExchangeClient` construction. The legacy Suite Trade panel was removed so it cannot bypass the execution API or mandatory risk gate.

## Safety / external gates

- Mainnet trading remains gated by the real-wallet testnet E2E unlock.
- Copy Trade defaults to the current exchange environment; mainnet copy is blocked while mainnet is locked.
- Copy Trade uses a non-withdrawable Hyperliquid agent/API wallet after explicit authorization.
- Revenue fee remains OFF because no approved builder revenue wallet / fee rate has been supplied.
- The public verified RWA registry remains empty until real reviewed assets are published; no asset is fabricated as VERIFIED.
- Token/TGE is separate and remains PRE-TGE; this release does not activate or deploy a token.

## CI gates

`.github/workflows/growth-suite-smoke.yml` permanently verifies source syntax/invariants and the deployed GitHub Pages bundle with:

- `rwa/growth-suite-source`
- `rwa/growth-suite-live`

The release also preserves the existing wallet, chart, execution API and live-browser smoke gates.
