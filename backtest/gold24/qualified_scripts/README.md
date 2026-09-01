# GOLD24 Qualified Scripts

This directory contains the executable script pair for every currently selected GOLD24 method:

- 3 strict methods from `runtime_mt5_lot/latest_entry100_net20000_standard_lot.csv`.
- 6 selected Multi-Method v1 methods from `runtime_multimethod_v1/latest_multimethod_v1_discovery.csv`.

Each method has one Python (`.py`) canonical verifier and one MT5 (`.mq5`) Expert Advisor wrapper. The current batch-286 selected package is therefore 9 Python/MT5 pairs.

## Certification contract

`validate_qualified_scripts.py` requires the script method order, exact config hash, SL/TP, trades, WR, PF, Net Profit, EV, Max DD and SQN to match the published runtime CSVs, then re-runs every candidate through the same canonical `core.py` backtester at qty=100 GOLD units.

For the currently selected `DONCHIAN` and `CANDLE_ENGULFING` families, p1/p2/p3 remain part of canonical candidate identity/config hash, but `core.py::signal_series` does not consume those parameters for these two families. MT5 wrappers therefore reproduce the execution-relevant family/fast/slow/direction/entry/SL/TP/offset/expiry configuration and also carry the exact canonical hash in their source fingerprint.

`.github/workflows/gold24-qualified-script-certification.yml` installs native MT5/MetaEditor on Windows, requires every selected EA plus the canonical importer to compile cleanly with `0 errors, 0 warnings`, imports the 6,500-row canonical D1 series into `GOLD24-CANON`, and runs every EA through native MT5 Strategy Tester with operational receipts.

The Python result is exact same-engine canonical parity. Native MT5 certification proves that the translated signal/order configuration compiles and operates on the canonical series. It does **not** claim broker-specific PnL is numerically identical to the canonical stressed cost model, because broker spread, commission, swap, tick ordering and fills can differ.

SL/TP values shown in reporting tables are pips (`0.01` USD per XAUUSD pip under the report convention); EA engine constants use the equivalent USD price distances.
