# GOLD24 CopyToLive-Compatible Backtest Mode

Status: **CopyToLive execution model adopted**

## Canonical paths

There are now two intentionally separate paths:

1. **Exact active-strategy parity / certification**
   - `backtest/copytolive_gold/active_gold_snapshot.json`
   - `backtest/copytolive_gold/engine.py`
   - `backtest/copytolive_gold/test_engine.py`
   - `backtest/copytolive_gold/fetch_dukascopy_h1.cjs`
   - `.github/workflows/gold-copytolive-parity.yml`

   This is the canonical path for replaying the **118 GOLD strategies currently
   active on CopyToLive Home**.

2. **New-strategy discovery using the same execution semantics**
   - `backtest/gold24/copytolive_compat.py`
   - `backtest/gold24/copytolive_discovery.py`
   - `backtest/gold24/test_copytolive_compat.py`
   - `.github/workflows/gold24-copytolive-compatible.yml`

   This path is for searching new public GOLD24 signal families under the
   CopyToLive execution/risk model. It must not be confused with exact replay
   of the current 118 production strategies.

The legacy fixed-dollar GOLD24 engine in `core.py` remains only so historical
Batch310/canonical outputs can still be reproduced. It is **not** the preferred
execution model for new CopyToLive-aligned research.

## Execution contract

- Initial deposit: **USD 10,000**
- Risk budget: **USD 200 per trade**
- SL distance: `entry_price * sl_pct`
- TP distance: `SL distance * tp_ratio`
- Position quantity: `risk_usd / SL distance`
- Stressed fee: **0.0016 × entry price × quantity**
- One open position per strategy
- Signal entry uses the current close
- A newly opened position cannot exit on the same bar
- If SL and TP are both inside a later bar, **SL is evaluated first**
- Walk-forward reference split: **70/30 chronological**
- Open position at end-of-data is not force-closed

## Strict portfolio gate layered after parity

- Total Entry >= 300
- Net Profit >= USD 20,000 for the strict final active-set gate
- PF >= 1.20
- EV/Trade > 0
- Max DD <= 25%
- OOS PF >= 1.00
- Positive Year >= 60%
- Global absolute Pearson(log-return equity) <= 0.50
- Monte Carlo positive-terminal probability >= 95%
- MC 95% DD <= 25%

## GitHub-only compute

The canonical replay workflow runs on a GitHub-hosted Ubuntu runner. The
MacBook is not required for the backtest. H1 data is fetched/cached on the
hosted runner, the 118 strategy scripts are replayed, correlation and Monte
Carlo are calculated, and the resulting JSON/CSV evidence is published.

## Data and source integrity

The active snapshot carries production source hashes and per-strategy script
hashes. Every replay validates the 118-strategy count and script checksums
before execution.

This file describes the intended authority order:

**CopyToLive production snapshot → exact GitHub replay → strict portfolio gate**

not:

**legacy GOLD24 fixed-dollar engine → production**.
