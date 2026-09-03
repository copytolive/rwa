# RWA Business Operating Service

Production-side service that binds real businesses, Series, wallets, stores and settled commerce evidence.

## Core rule
A connected wallet is not transaction-validated. Validation requires identity/KYB plus qualifying SETTLED transaction evidence that reconciles to the commerce ledger.

## Runtime
- `GET /healthz`
- `GET /readyz`
- `GET /metrics`
- `GET /v1/businesses`
- admin onboarding/binding/policy/reconciliation/validation endpoints under `/v1/admin/*`
- HMAC terminal ingestion at `POST /v1/transactions/ingest`
- external settlement approval under `/v1/admin/transactions/:id/settle`

## Validation states
`CONNECTED`, `IDENTITY_VERIFIED`, `TRANSACTION_PENDING`, `TRANSACTION_VALIDATED`, `VALIDATION_STALE`, `VALIDATION_SUSPENDED`.

`TRANSACTION_VALIDATED` is fail-closed and requires:
1. business KYB and at least one identity-verified wallet,
2. policy minimum settled count/value,
3. fresh settlement evidence,
4. reconciliation threshold,
5. refund ratio below policy.

## Commerce reconciliation
`RWA_COMMERCE_DB` points to the same SQLite database used by `commerce-service`. Only orders with paid lifecycle state, non-empty provider payment reference and `paid_at` are imported. Successful refunds reduce net settled revenue. A fully refunded order contributes zero eligible revenue.

## Distribution linkage
Distribution preview is allowed only when the business is `TRANSACTION_VALIDATED`. It consumes net settled revenue, applies reserve and investor allocation in integer minor units, hashes the holder snapshot and creates an `AWAITING_AUTHORIZED_FUNDING` manifest. It never moves funds by itself.

## Production deployment
Run behind the existing Seablueprint Caddy edge at `/rwa-business/*`. Mount the commerce DB read-only if possible and the business DB read-write. Admin bearer and terminal HMAC secrets must be injected through a secret manager; never commit them.

Production is not considered ready merely because the process is healthy. `/readyz` reports `production_ready` only when commerce source, admin control, and at least one ACTIVE KYB-verified business exist. Transaction validation remains a separate evidence gate.
