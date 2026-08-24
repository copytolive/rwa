# RWA Commerce Architecture Decision — 2026-08-24

## Decision

Use `rwa/commerce-service` as the RWA-specific commerce gateway and reuse/adapt the **Midtrans provider implementation pattern** from private Seablueprint. Do **not** route live RWA checkout through the current Seablueprint `POST /api/market/payment/create` unchanged.

## Why this differs from the handoff default

The handoff correctly prefers reuse over duplicate ecommerce code. Actual code audit found a correctness mismatch that makes blind reuse unsafe:

1. `frontend-seablueprint.com/src/CheckoutFlow.jsx` calls `checkout(...)` first and then `createPayment(orderId)`.
2. Seablueprint checkout creates the database order, decrements stock, and clears the cart.
3. Current `backend/src/routes/market.js` payment-create route does not bind payment to that existing database order id. It reads the current cart again and generates a new `OT-*` provider order id.
4. Because checkout has already cleared the cart, payment-create can observe an empty cart. Even when it succeeds, the generated payment id does not match the database order number expected by the webhook lookup.
5. The current Midtrans cancel/expire webhook restores stock before proving the transition is new, so a repeated callback can restore inventory more than once.

Therefore the safe reuse boundary is the provider integration, not the current Seablueprint order/payment route.

## RWA final contract

- Registry verification: `ONE_TOKEN_ONE_PHYSICAL_STORE_V1` remains the live-store gate.
- Commerce identity: wallet challenge/session dedicated to commerce; it is not the delegated trading signer.
- Catalog/stock/price: backend authoritative.
- Quote: expiring, wallet-bound, one physical store per order, server-calculated.
- Inventory: reserve transactionally on order creation; release on cancel/payment expiry.
- Payment: use the existing RWA database order id as Midtrans `order_id`.
- Currency: Midtrans adapter is IDR-only and fails closed for USD/non-IDR orders.
- Webhook: signature + amount verification, idempotency, and no paid→cancelled regression.
- Seller: wallet must be explicitly mapped to a verified store before mutating product/inventory/order state.
- Refund: explicit request + admin/provider execution + audit trail.
- Trading: `execution-api.js` and agent-worker ownership remain unchanged.

## Deployment boundary

This isolation is intentional because RWA requires wallet identity, strict store/asset verification, and stronger reservation/idempotency semantics. It must not become a second trading engine and must not modify `copytolive.com`, `land`, or `seablueprint.com` production routing.

## Still externally blocked

The API can be code-complete while launch remains blocked. `rwa-commerce-config.json.api_base` stays empty until a real HTTPS deployment exists. A live store still requires real RWA evidence/reviewer approval. Midtrans requires real credentials and an IDR catalog. Worker, beta-wallet cohorts, and mainnet canary remain evidence-gated by `launch/readiness.json`.
