# RWA Commerce Service

Production-gated commerce gateway for verified RWA physical stores. This service deliberately stays separate from trading authorization and never accepts card/bank credentials.

## Architecture decision

The RWA service keeps the existing transactional SQLite reservation/order foundation and **adapts the proven Midtrans provider pattern from Seablueprint**, instead of copying Seablueprint's marketplace routes wholesale. Audit on 24 Aug 2026 found that the current Seablueprint frontend creates the database order first and then calls a payment-create route that reads the already-cleared cart and generates a different provider order id. Reusing that path unchanged would break order/payment linkage. RWA therefore uses one canonical database order id for Midtrans and a verified-store gate before catalog/quote/order operations.

This is deployment isolation, not a second trading engine. `execution-api.js` remains the trading write owner. Commerce wallet sessions only authorize shopping and seller operations.

## Safety/correctness

- `ONE_TOKEN_ONE_PHYSICAL_STORE_V1` registry sync is mandatory for live store listing.
- Catalog price and inventory are read from the backend database.
- Quotes are server-calculated, expiring, single-store, and bound to the wallet session.
- Order creation reserves inventory transactionally and requires an idempotency key.
- Unpaid orders automatically expire and release reserved inventory.
- Midtrans payment is created **for an existing DB order id**; USD orders fail closed because Midtrans settlement is IDR.
- Midtrans webhook signature and amount are verified; duplicate callbacks are idempotent and stale cancel/expire callbacks cannot regress a paid order.
- Seller mutations require a wallet-to-store ownership mapping created by an admin after verification.
- Refunds are explicit requests; provider execution is admin-gated and audited.
- Shipping is disabled unless an authoritative server-side rate policy is configured.

## Local

```bash
cd commerce-service
npm install
cp .env.example .env
npm run check
npm start
```

Health endpoints: `GET /healthz`, `GET /readyz`. API starts under `/v1/`.

## Deployment

Build from repository root:

```bash
docker build -f commerce-service/Dockerfile -t rwa-commerce:rc .
docker run --env-file commerce-service/.env -p 8788:8788 -v rwa-commerce-data:/data rwa-commerce:rc
```

Put Caddy/Nginx in front of port 8788 and expose HTTPS. Do not put Midtrans server key or the commerce admin bearer token in GitHub Pages/browser config.

`readyz.checkout_ready=false` is expected until at least one real verified store exists and Midtrans is configured. This must not be manually overridden.
