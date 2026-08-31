# RWA.MS Business & Asset Details — CHAT 03

Reference screens: 63 Public Business Profile, 09 Dedicated RWA Asset Detail, 39 Crypto Asset Detail, 40 Business Token Detail Variant, 41 Regulated RWA Detail Variant.

## Routes

- `/businesses/[business]` — route-driven business profile
- `/rwa/[asset]` — generic or regulated RWA detail variant
- `/markets/[asset]` — crypto asset detail variant
- `/businesses/[business]/token` — business utility token detail variant

## Shared architecture

- `BusinessProfile` composes the existing authenticated `AppShell`, CHAT 00A primitives, and CHAT 00B overlays.
- `AssetDetail` is a single route-driven architecture with `rwa`, `regulated`, `crypto`, and `business-token` variants.
- Shared detail primitives own entity identity, metrics, tabs, chart shell, key/value grids, documents, panels, and trade/subscribe card.
- Route parameters select mock data and variant behavior; screenshot variants are not implemented as duplicated pages.

## Interaction contract

- Business directory cards continue to `/businesses/[business]`.
- RWA directory cards continue to `/rwa/[asset]`.
- Crypto detail resolves at `/markets/[asset]`.
- Business token resolves at `/businesses/[business]/token`.
- Trade and subscription actions hand off to route-safe `/trade/[asset]` destinations for CHAT 04.
- Store, rewards, token, disclosures, documents, community, issuer, legal and transparency actions use their canonical route-safe destinations.
- Watchlist uses `AddWatchlistModal`, alert uses `SetAlertModal`, share uses `ShareModal`, and rewards uses the existing `JoinRewardsModal`.

No duplicate global header, modal, button, input, badge, tab, state, or overlay system is introduced in CHAT 03.

## Interaction QA — continuation hardening

- Every rendered native `button`/shared `Button` has a click, submit, or legitimate disabled behavior.
- Every `Link`/anchor has a non-empty destination; no `#`/`javascript:` dead links are accepted.
- Root route-safe catch-all remains present, so future-batch canonical destinations do not 404.
- Asset detail tabs now route every non-Overview destination (`Activity`, `Community`, `Order Book`, `Disclosures`, `Business`, `Rewards`, `Underlying Asset`, `Documents`, `Cashflows`, `Legal Terms`) instead of leaving inert tabs.
- Shared overlay patterns now provide a visible close fallback when an optional callback is omitted, preventing library-level dead primary actions.
- Wallet system status uses a native keyboard-safe button.
- Chart toolbar controls and ranges produce visible/announced state changes instead of unrelated range mutations.
- `verify-interaction-contract.mjs`: PASS — 263 rendered control tags, 76 links/anchors, 68 direct route actions across 50 TSX files.
- `verify-all-interactions.mjs`: PASS — 256 actionable controls across 38 non-primitive TSX files.
- CHAT 03 detail architecture verifier: PASS.
- TypeScript stub verification: PASS.
- Full Next production build is not claimed in this runtime because the `next` executable/dependencies are not installed.
