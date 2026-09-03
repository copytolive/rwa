# GOLD24 Qualified Scripts

This directory contains the executable script pair for every currently selected GOLD24 method:

- 3 strict methods from `runtime_mt5_lot/latest_entry100_net20000_standard_lot.csv`.
- 15 selected Multi-Method v1 methods from `runtime_multimethod_v1/latest_multimethod_v1_discovery.csv`.

Each method has one Python (`.py`) canonical verifier and one MT5 (`.mq5`) Expert Advisor wrapper. The current Batch310 / 292,000-cumulative-discovery package is 18 Python/MT5 candidate pairs before the global cross-source correlation filter (3 strict + 15 Multi).

## Selection contract

The published selected set applies the economic floor `Entry >= 100` and `Net Profit >= USD 20,000` before the correlation gate. Correlation is absolute Pearson correlation of log-return equity, selected per symbol with a greedy quality/ranking rule; when correlation exceeds `0.50`, the lower-quality/ranking method is removed.

## Certification contract

`validate_qualified_scripts.py` requires the script method order, exact config hash, SL/TP, trades, WR, PF, Net Profit, EV, Max DD and SQN to match the published runtime CSVs, then re-runs every candidate through the same canonical `core.py` backtester at qty=100 GOLD units.

Every selected MT5 wrapper carries the exact family, fast/slow, p1/p2/p3, entry method, direction, SL/TP, offset, expiry and canonical config hash. DONCHIAN/CANDLE p1/p2/p3 remain identity-only because the canonical Python signal does not consume them; the values are still preserved exactly. VOLATILITY_REGIME has a native MT5 family implementation matching the canonical ATR-ratio / breakout / z-score regime logic.

`.github/workflows/gold24-latest-script-parity.yml` restores the latest authoritative canonical state, requires exact Python/config/hash/metric parity for the selected set, installs official Exness MT5 on Windows, resolves the exact selected wrappers, initializes the MT5 data directory, and requires native MetaEditor clean compilation for every selected EA.

The Python result is exact same-engine canonical parity. The qualified MetaQuotes workflow requires native MetaEditor clean compile and native MT5 Strategy Tester operational PASS for every selected EA on the canonical custom symbol. It still does **not** claim broker-specific PnL equality: broker spread, commission, swap, tick ordering, margin, netting/hedging and fills can differ from the canonical stressed cost model.

SL/TP values shown in reporting tables are pips (`0.01` USD per XAUUSD pip under the report convention); EA engine constants use the equivalent USD price distances.
