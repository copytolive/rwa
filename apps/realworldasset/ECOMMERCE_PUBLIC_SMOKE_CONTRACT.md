# Canonical Ecommerce Public Smoke Contract

This marker keeps the public Ecommerce acceptance test aligned with the canonical Next.js application deployed from `apps/realworldasset`.

The public smoke must validate these canonical Pages routes:

- `/rwa/businesses/kopi-nusantara/store/`
- `/rwa/checkout/`

While the production commerce API is not configured, the public contract is intentionally fail-closed:

- `data-backend-connected="false"`
- `data-mainnet-ready="false"`
- `Confirm Purchase` must not fabricate payment success or navigate to a paid order.

Changing this file is deployment-relevant because it lives under `apps/realworldasset/**`; therefore the canonical Pages workflow publishes an exact SHA that the public smoke can verify.
