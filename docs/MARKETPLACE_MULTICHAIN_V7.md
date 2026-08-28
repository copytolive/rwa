# RWA Marketplace + MULTI CHAIN V7

## Goal

Provide one consumer trading workspace with broad provider-backed token discovery and a separate verified physical-goods marketplace anchored by the RWA brand/token. The implementation borrows public product patterns, not proprietary code.

## Public reference patterns

Fomo's public product materials describe a single experience across Solana, Base, BNB Chain and Monad, with a unified balance and cross-chain complexity hidden from the user. Its public educational material also identifies low liquidity, large orders, fast markets, network delay and front-running as sources of slippage.

RWA V7 keeps the useful product-level principles while preserving CopyToLive's existing self-custody/fail-closed model. It does not claim Fomo's embedded-wallet, key-sharding, gas sponsorship or internal routing implementation.

Open-source RWA marketplace projects were reviewed as architecture references for catalog/search, asset verification, wallet approval, tokenized asset presentation, and full-stack marketplace separation. Their code is not imported by this change.

## MULTI CHAIN V7

### Dynamic token universe

`rwa-market-universe.js` loads the token catalog from the configured route provider for every route-capable chain in `rwa-multichain-registry.json`.

This replaces a misleading static-pair mindset. The platform does **not** manufacture an N × N list and call every combination executable. A token can appear in discovery when the provider lists it, while a pair becomes actionable only when a real route quote exists.

Current route-capable registry coverage is broader than the four-chain public Fomo baseline and includes:

- Arbitrum
- Ethereum
- Base
- Solana
- BNB Chain
- Polygon
- Avalanche
- Monad

Hyperliquid remains a separate execution/funding venue with its own readiness gate.

### Quote and execution protection

`rwa-trade-protection.js` adds a policy layer around the existing `RWAMultiChainEngine`:

- default slippage: 0.5%
- long-tail default: 1%
- explicit bounds: 0.05%–5%
- minimum received must be positive
- quote must remain fresh (55 seconds)
- price/economic impact >= 1% warns
- impact >= 3% requires explicit acknowledgement
- impact >= 10% hard-blocks
- route simulation remains mandatory
- global `READY_FOR_MAINNET` and MULTI CHAIN `READY` remain mandatory
- wallet confirmation remains mandatory
- MEV protection is never claimed unless a selected provider explicitly supplies it

Slippage and price impact are shown separately because widening slippage does not fix bad price impact.

## Marketplace V2

### One RWA marketplace, many sellers and products

`rwa-marketplace-v2.json` defines:

- one RWA marketplace identity/token surface
- multiple verified sellers
- multiple verified stores
- multiple categories and products
- catalog search
- product variants
- cart
- pickup/shipping
- inventory reservation
- order tracking
- refunds
- seller storefronts

Trading the RWA token and purchasing a physical product are distinct flows. Product purchases are not represented as token trades.

### Evidence-gated catalog

No seller or product is promoted to live simply because it appears in frontend JSON. Live catalog presentation requires the existing verified RWA/store evidence path and a healthy production commerce backend.

The V2 config explicitly forbids fabricated inventory, ratings, sales and prices. Until real seller/product evidence exists, the UI shows labeled blueprints rather than fake merchandise.

### Seller operations

`marketplace-seller.html` provides the operational equivalent of a lightweight merchant console:

- seller wallet login via signed backend challenge
- seller-owned verified stores
- product create/update
- stock updates
- pickup/shipping configuration
- product image and description
- seller order visibility
- fulfillment state transitions

Authorization remains enforced by the backend. The browser cannot grant itself seller ownership.

### Multi-seller checkout

The current commerce backend enforces one store per authoritative quote. V7 does not weaken that invariant. A cart may contain products from multiple sellers, but checkout uses `SELLER_SCOPED_SPLIT_CHECKOUT_V1`: each seller receives an independent authoritative quote/order/payment/refund lifecycle.

Combined Amazon-style multi-seller settlement remains disabled until sub-order allocation, payment split, tax/shipping allocation, seller-specific cancellation/refund, payout reconciliation and dispute rules are implemented and verified.

## Non-goals / external gates

This feature work does not fabricate or bypass:

- production payment credentials
- seller/business evidence
- a verified RWA asset
- token deployment receipts
- LI.FI partner approval
- Hyperliquid builder funding/approval
- real cross-chain receipts
- beta wallet thresholds
- legal approval

Those remain launch evidence gates. The UI and code may be engineering-ready while unrestricted mainnet execution remains locked.
