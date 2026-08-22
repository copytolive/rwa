# RWA 24/7 Delegated Agent Worker

This service keeps copy execution running when the browser is closed without accepting the user's master-wallet private key.

## Security model

- Hyperliquid master wallet approves a delegated API/agent wallet once.
- The worker receives only that delegated agent private key after a fresh master-wallet authorization signature.
- The authorization is bound to master, agent, source trader, capital, max loss, follower environment, source environment, exact HTTPS worker origin, timestamp and one-time nonce.
- Nonces are persisted to prevent replay of signed register/stop requests.
- The worker encrypts the delegated key at rest with AES-256-GCM using `RWA_KEY_ENCRYPTION_SECRET`.
- `ExchangeClient` exists only in `execution.mjs`; `worker.mjs` cannot write directly to Hyperliquid.
- Every non-reduce-only order goes through worker loss, leverage, total-exposure, per-asset, copy-capital and kill-switch checks.
- No withdrawal, transfer, spot-send or fund-management method is exposed by the worker API.
- Source fills are persisted by stable fill ID. Each executable source fill maps to one deterministic 128-bit Hyperliquid CLOID.
- On retry/restart, the worker checks Hyperliquid `orderStatus` for the same CLOID. An already accepted order is reconciled instead of sent again; a transient network failure remains pending and is retried with the same CLOID.
- Max-loss uses both session equity drawdown and PnL delta, preventing a daily-PnL reset from silently reopening risk.
- Delegated agent authorization is rechecked. A stale/revoked agent disables copy and its encrypted key is removed from the active record.
- Browser and worker copy modes are mutually exclusive from the client UI to prevent double-copy.
- Testnet is the default. Mainnet requires repository launch control plus the host-side `RWA_MAINNET_APPROVED=I_UNDERSTAND_MAINNET_RISK` secret.

## Required production environment

Required:

- `RWA_KEY_ENCRYPTION_SECRET`: random secret of at least 32 characters.
- `RWA_PUBLIC_ORIGIN`: exact public HTTPS worker origin, e.g. `https://worker.example.com`.
- persistent encrypted/durable storage mounted for `/data`.

Recommended/optional:

- `RWA_ALLOWED_ORIGINS`: comma-separated browser origins allowed to call POST endpoints. Default is the RWA GitHub Pages origin.
- `PORT`
- `RWA_STATE_PATH`
- `RWA_LOOP_MS`
- `RWA_RISK_JSON`
- `RWA_CONTROL_URL`

Do not put any secret, API-agent key, encryption secret or mainnet approval secret in this repository or `public-config.json`.

## Deployment

Build `agent-worker/Dockerfile`, mount a persistent volume at `/data`, and terminate TLS at the production host. The container includes a `/healthz` healthcheck.

After deployment:

1. verify `GET /healthz` reports `single_write_path=RWAWorkerExecutionAPI`, `idempotency=deterministic-cloid-v1`, and `origin_bound=true`;
2. verify `GET /readyz` remains false while safe launch controls are disabled;
3. set `agent-worker/public-config.json.base_url` to the exact HTTPS origin and enable the public config only when the endpoint is real;
4. keep `agent-worker/control.json.kill_switch=true` until all pre-beta launch prerequisites pass;
5. turn worker production control on for beta only after the machine launch gate allows it.

The production host must automatically restart the container and preserve `/data`. GitHub Pages is not the worker host; it serves only the UI and public control/config files.

## API

- `POST /v1/register`: delegated agent key + fresh master-wallet signature. Worker independently verifies the delegated agent in Hyperliquid `extraAgents` before activation.
- `POST /v1/stop`: requires a fresh master-wallet stop signature and deletes the active encrypted agent secret.
- `GET /healthz`: liveness + safety-contract information.
- `GET /readyz`: production readiness; fails closed unless encryption/origin/control gates are valid.
- `GET /status`: redacted operational state and metrics. It never returns private keys or signatures.

Browser POST calls are origin-allowlisted and rate-limited. Mainnet remains doubly locked by repository control and the host-side explicit mainnet approval secret. The public browser also requires the global `READY_FOR_MAINNET` launch gate before mainnet can be selected.
