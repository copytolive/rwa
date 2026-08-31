# RWA UI reference repositories

This project uses these repositories as **design and architecture references only**. No repository is treated as the RWA execution owner, and no third-party UI is allowed to bypass `RWAExecutionAPI`.

## Trading / desktop + mobile

| Repository | Useful pattern | RWA implementation |
|---|---|---|
| `tradingview/lightweight-charts` | Fast canvas financial charting and responsive interaction patterns | Existing native RWA chart remains; chart surface is kept lightweight and mobile-first. |
| `TheNewMikeMusic/tbt-paper-terminal` | Dedicated mobile trading UX rather than shrinking desktop UI | RWA Trade now uses dedicated mobile touch targets, sticky actions, compact market metrics and no horizontal layout dependency. |
| `laanito/OpenTerminalUI` | Command palette, terminal navigation, dense professional workspace | Root RWA shell now has a global command palette (`Cmd/Ctrl+K`) across Markets, Trade, Social, Shop, Portfolio, RWA and Launch. |
| `eyemaginative/utt-unified-trading-terminal` | Operator-focused balances, orders, orderbooks and risk guardrails | RWA keeps execution, positions, orders, risk and diagnostics visually separated while preserving the existing single-write-path security model. |

## Ecommerce / physical storefront

| Repository | Useful pattern | RWA implementation |
|---|---|---|
| `saleor/nextjs-commerce` | Product catalog, search, cart and checkout separation | RWA Storefront now has token-store discovery, product grid, local cart and backend-gated checkout. |
| `mirumee/nimara-ecommerce` | Typed integration boundaries and multi-market storefront architecture | Commerce registry is a provider-neutral JSON contract; future backend can replace inventory/payment/order services without changing the token-store UI model. |

## RWA-specific rule added on top

RWA does **not** copy the generic ecommerce model directly. The platform adds a mandatory `ONE_TOKEN_ONE_PHYSICAL_STORE_V1` contract:

1. One RWA token maps to exactly one physical store identity.
2. A live store needs a real store name, full address, geo location, storefront photo, business registration and merchant identity evidence.
3. The store-token must also exist as a VERIFIED RWA asset before the UI can label it LIVE.
4. Ecommerce catalog/cart can render in the frontend, but payment, inventory reservation, taxes, shipping/pickup, refunds and final order creation remain backend-gated.
5. Store commerce and token trading remain separate authorization domains; ecommerce UI cannot create exchange writes.

This separation is deliberate: the UI can be complete before backend integration without inventing a physical store, inventory, ownership claim or payment result.
