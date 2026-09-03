# RWA Commerce RC Status — 2026-08-24

## Code-side completion in this RC

- Completed missing `payment.mjs` with Midtrans create/status/refund/signature verification.
- Completed missing `server.mjs` native HTTP API with health/readiness, auth, verified catalog, quote, order, payment, webhook, seller/admin, refund and audit routes.
- Added backend pricing/quote/payment state helpers.
- Added store-owner authorization and refund persistence without weakening the existing transactional SQLite order/inventory foundation.
- Added unpaid-order expiry to release reserved inventory.
- Added automated unit/integration tests for authoritative quote logic, multi-store rejection, shipping fail-closed, Midtrans order binding/signature/currency, inventory reservation/cancel release and oversell prevention.
- Added Docker + Caddy/env deployment package and CI workflow.
- Added browser commerce API client and live-commerce adapter. It is deliberately disabled until `rwa-commerce-config.json.api_base` is set to a proven HTTPS service.
- Kept existing preview checkout honest when backend is not deployed.

## Gates that must stay red until evidence exists

- `verified_rwa_asset`: requires at least one real reviewed asset and public HTTPS evidence.
- `worker_configured`, `worker_live`, `worker_control`: requires actual 24/7 server deployment/control proof.
- `beta_internal`, `beta_closed`, `beta_public`: requires real wallet/user proofs 3 → 20 → 100.
- `mainnet_control`: remains false until global readiness is genuinely satisfied.
- Commerce production payment: requires actual Midtrans credentials and IDR live products; no fake payment-success flag is permitted.

## Release rule

Do not edit readiness counters or `mainnet_enabled` manually. Merge code only after CI passes. Then deploy commerce service, set the frontend API base, verify `healthz/readyz`, add a real verified store/asset, run an actual sandbox payment/webhook/refund smoke, and only then advance evidence-based launch gates.
