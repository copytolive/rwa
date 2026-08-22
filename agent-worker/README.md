# RWA 24/7 Delegated Agent Worker

This service keeps copy execution running when the browser is closed without ever accepting the user's master-wallet private key.

## Security model

- Hyperliquid master wallet approves a delegated API/agent wallet once.
- The worker receives only that delegated agent private key after a separate master-wallet authorization signature.
- The worker encrypts the delegated key at rest with AES-256-GCM using `RWA_KEY_ENCRYPTION_SECRET`.
- `ExchangeClient` exists only in `execution.mjs`; `worker.mjs` cannot write directly to Hyperliquid.
- Every non-reduce-only order goes through worker daily-loss, leverage, total-exposure, per-asset, copy-capital and kill-switch checks.
- No withdrawal, transfer, spot-send or fund-management method is exposed by the worker API.
- Testnet is the default. Mainnet requires both repository control `mainnet_enabled=true` and secret `RWA_MAINNET_APPROVED=I_UNDERSTAND_MAINNET_RISK`.
- `control.json` ships with `enabled=false` and `kill_switch=true`.

## Required production environment

`RWA_KEY_ENCRYPTION_SECRET` must be at least 32 random characters. Persist `/data` on encrypted durable storage. Optional settings: `PORT`, `RWA_STATE_PATH`, `RWA_LOOP_MS`, `RWA_RISK_JSON`, `RWA_CONTROL_URL`. Do not put any secret in this repository or in `public-config.json`.

## Deployment

Build the Dockerfile and mount a persistent volume at `/data`. Terminate TLS in front of the worker. After deployment, verify `GET /healthz`, then set `agent-worker/public-config.json.base_url` to the HTTPS origin. Keep `public-config.json.enabled=false` and `control.json.kill_switch=true` until the launch gate reports every external prerequisite satisfied.

The production host must restart the container automatically. GitHub Pages is not the worker host; it only serves the UI and public control/config files.

## API

`POST /v1/register` accepts a delegated agent key plus a fresh master-wallet `personal_sign` authorization for trader wallet, copy capital, max loss and environment. The worker verifies the agent is actually listed in Hyperliquid `extraAgents` for that master wallet before activation.

`POST /v1/stop` requires a fresh master-wallet stop signature. `GET /status` is redacted and never returns private keys or signatures. `GET /healthz` is intended for the launch probe.
