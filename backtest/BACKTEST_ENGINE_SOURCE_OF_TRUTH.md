# CopyToLive Backtest Engine — Source of Truth

## Canonical ownership

The execution engine is code-owned in GitHub:

`backtest/gold24/copytolive_unified_engine.py`

Engine ID: `copytolive-unified-backtest-v1`.

All GitHub-hosted replay/certification paths must import this file. Legacy
`copytolive_compat.py` is only a compatibility shim and must contain no
execution logic. The production-parity CLI also delegates execution/metrics to
the same module.

## Runtime placement

Production CopyToLive must run the same engine bytes inside the trading service:

`/home/opentrue-platform/backend/trading-service/pipeline/copytolive_unified_engine.py`

The GitHub blob SHA and production SHA256 must be recorded before certification.
Production must not maintain a second independent backtest implementation.

## Data ownership

Canonical production market data remains on the production server. GitHub may
run temporary certified copies/artifacts for parity. Google Drive is evidence,
reports, backups and result tables; it is not the execution engine.

## MacBook role

The MacBook is not a compute source of truth. It can:
- act as an SSH transfer/deploy bridge when hosted Actions cannot reach the VPS;
- run a small deterministic differential/reference test;
- verify GitHub bytes equal production bytes.

Heavy backtests run on GitHub-hosted compute or the production/VPS compute
lane, never as an independent Mac-only engine.

## One-engine rule

Strategy discovery, dataset acquisition and reporting can have adapters, but
these semantics have exactly one implementation:
- signal-bar close entry;
- one position at a time;
- no same-bar entry/exit;
- SL before TP on a bar hitting both;
- stop = entry * sl_pct;
- target = stop_distance * tp_ratio;
- size = USD 200 risk / stop_distance;
- stressed fee = 0.0016 * entry * quantity;
- producer VOL/MTF/VM/VS/ALL filters;
- CopyToLive metrics and execution digest.

Any new lane that re-implements those rules independently is a regression.
