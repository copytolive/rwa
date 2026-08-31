# RWA Agent Worker — Cloudflare Free Runtime

This directory is the zero-cost deployment target for the 24/7 delegated copy worker. It does not use Replit or Vercel.

## Runtime

- Cloudflare Workers Free
- SQLite-backed Durable Object for encrypted persistent state
- Cron wake-up every minute plus Durable Object alarms for the copy loop
- Existing `RWAWorkerExecutionAPI` remains the only exchange write path
- Existing deterministic CLOID/idempotency logic is reused
- Master wallet private keys are never accepted or stored
- Delegated agent keys are encrypted before Durable Object storage
- MAINNET remains doubly locked: repository control gate plus `RWA_MAINNET_APPROVED` Worker secret

## Public endpoints

- `GET /healthz`
- `GET /readyz`
- `GET /status`
- `GET /metrics`
- `POST /v1/register`
- `POST /v1/stop`

The worker is fail-closed. Free-tier exhaustion or health failure must stop/reject work rather than silently bypass risk controls.

## Required Cloudflare setup

The GitHub workflow `.github/workflows/cloudflare-free-worker.yml` performs a dry-run build automatically and can deploy manually after Cloudflare credentials are stored as GitHub Actions secrets. The workflow creates the encryption secret inside Cloudflare on first deployment if it does not already exist.

Required GitHub Actions secrets for deployment:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

No payment plan, database subscription, Replit, or Vercel deployment is part of this path.

After a successful worker deployment, TESTNET activation must set `agent-worker/public-config.json` to the real HTTPS `workers.dev` URL and set repository control to `enabled=true`, `kill_switch=false`, `production_ready=true`, while keeping `mainnet_enabled=false` until all beta and launch gates pass.
