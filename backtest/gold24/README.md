# GOLD24 Continuous Worker

Continuous, fail-closed Python backtest worker for the GOLD v11 program.

## Non-negotiable production locks

- GOLD only; H1/H4/D1 only.
- Pending orders only: buy_stop/sell_stop/buy_limit/sell_limit.
- Flat lot for the entire backtest; no compounding.
- Fixed absolute GOLD SL and TP, each $5-$25; never ATR/dynamic/trailing.
- Hyperliquid stress cost floor >=0.32% round-trip (2.7x governance padding).
- Every simulated config emits a per-deal entry+exit ledger into an immutable Parquet shard.
- Exact canonical config dedup before engine.
- Same-family novelty requires >=20% relevant parameter difference or >=30% SL/TP difference; entry/direction/offset/expiry/seed alone never qualifies.
- 128-bit execution digest after engine; exact ledger remains final duplicate authority.
- Portfolio fingerprint: Symbol + reduced RR + EntryMethod. Duplicate fingerprint never coexists in TOP100; evidence is retained.
- Pearson correlation of log-return equity >0.50 excludes the lower-quality method from TOP100, not from the evidence archive.
- Portfolio family cap <=30%; target coverage includes candlestick, price structure, ATR, Bollinger and Keltner.
- Canonical Gate A fails closed until dataset reaches 2026 and an approved OANDA/TradingView cross-check receipt passes.

## Important

The worker does **not** bypass Gate A. If canonical 2026 integrity/cross-check evidence is not complete, `status.json` reports `RUNNING_FAIL_CLOSED` and the strategy engine stays paused.

## Server environment

Copy `deploy/gold24/env.example` to `/etc/gold24.env`, fill local paths/IDs, and place the Google service-account JSON outside the repository. Share the target Sheet/Drive folder with that service-account email.

## Commands

```bash
python backtest/gold24/worker.py --self-test
python backtest/gold24/worker.py --once
python backtest/gold24/worker.py
```

Production is managed by `gold24.service`; systemd restarts the process after reboot/crash.
