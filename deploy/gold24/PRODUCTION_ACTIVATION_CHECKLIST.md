# GOLD24 Production Activation — one-time external steps

The worker source is CI-tested and fail-closed. Do not paste private key, Google credential JSON, passwords, or tokens into GitHub issues or source files.

## 1. Oracle persistent VM

Create one Oracle Cloud Always Free Ubuntu ARM/Ampere A1 VM. Use `deploy/gold24/cloud-init.yaml` as user-data where supported, or SSH once and run:

```bash
sudo bash /opt/rwa/deploy/gold24/install.sh
```

The systemd unit restarts automatically after reboot/crash.

## 2. GitHub production environment

Create environment `gold24-production` and secrets:

- `GOLD24_HOST` — VM public IP/host.
- `GOLD24_USER` — SSH user (normally `ubuntu`).
- `GOLD24_SSH_KEY` — private SSH deployment key.

Never expose secret values in commits/issues.

## 3. Google Drive + Sheets credential

Create a Google Cloud service account, enable Google Drive API + Google Sheets API, and place its JSON credential on the VM at:

`/etc/gold24-google-service-account.json`

Set restrictive permissions. Share the target GOLD Sheet and GOLD24 Drive evidence folders with the service-account email. Do not commit this JSON.

## 4. Canonical data Gate A

Place ONLY approved canonical inputs on the VM:

- `/var/lib/gold24/data/GOLD_CANONICAL_2026.csv`
- `/var/lib/gold24/data/OANDA_OR_TRADINGVIEW_CROSSCHECK.json`

The receipt must assert `crosscheck_pass=true` and provider `OANDA` or `TradingView`; its `primary_sha256`, when present, must match the canonical CSV. Until Gate A passes, the worker remains `RUNNING_FAIL_CLOSED` and does not run strategy backtests.

## 5. Activate

Run GitHub Actions workflow `GOLD24 Deploy Oracle`, then `GOLD24 Health`.

Production acceptance requires:

- service active,
- Gate A PASS,
- `strategy_engine=RUNNING`,
- Google sync PASS,
- ledger/receipt/checkpoint evidence visible in Drive,
- TOP100_COMPLIANT only contains fully rules-compliant rows.
