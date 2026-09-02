# GOLD24 Qualified Scripts

This directory contains the executable script pair for every currently selected GOLD24 method:

- 3 strict methods from `runtime_mt5_lot/latest_entry100_net20000_standard_lot.csv`.
- 8 selected Multi-Method v1 methods from `runtime_multimethod_v1/latest_multimethod_v1_discovery.csv`.

Each method has one Python (`.py`) canonical verifier and one MT5 (`.mq5`) Expert Advisor wrapper. The current batch-300 selected package is therefore 11 Python/MT5 pairs.

## Selection contract

The published selected set applies the economic floor `Entry >= 100` and `Net Profit >= USD 20,000` before the correlation gate. Correlation is absolute Pearson correlation of log-return equity, selected per symbol with a greedy quality/ranking rule; when correlation exceeds `0.50`, the lower-quality/ranking method is removed.

## Certification contract

`validate_qualified_scripts.py` requires the script method order, exact config hash, SL/TP, trades, WR, PF, Net Profit, EV, Max DD and SQN to match the published runtime CSVs, then re-runs every candidate through the same canonical `core.py` backtester at qty=100 GOLD units.

For the currently selected `DONCHIAN` and `CANDLE_ENGULFING` families, p1/p2/p3 remain part of canonical candidate identity/config hash, but `core.py::signal_series` does not consume those parameters for these two families. MT5 wrappers therefore reproduce the execution-relevant family/fast/slow/direction/entry/SL/TP/offset/expiry configuration and also carry the exact canonical hash in their source fingerprint.

`.github/workflows/gold24-latest-script-parity.yml` restores the latest authoritative canonical state, requires exact Python/config/hash/metric parity for the selected set, installs official Exness MT5 on Windows, resolves the exact selected wrappers, initializes the MT5 data directory, and requires native MetaEditor clean compilation for every selected EA.

The Python result is exact same-engine canonical parity. Native MetaEditor certification proves the translated selected EA sources compile cleanly. This workflow does **not** by itself claim MT5 Strategy Tester PASS or broker-specific PnL equality. Broker spread, commission, swap, tick ordering and fills can differ from the canonical stressed cost model.

SL/TP values shown in reporting tables are pips (`0.01` USD per XAUUSD pip under the report convention); EA engine constants use the equivalent USD price distances.
