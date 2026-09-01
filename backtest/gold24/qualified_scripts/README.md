# GOLD24 strict-qualified scripts

This directory contains one runnable Python parity script and one MT5 Expert Advisor translation for every method currently in the strict report:

- Total Entry >= 100
- standard-lot Net Profit >= USD 20,000
- Corr Max <= 0.50
- correlation = absolute Pearson(log-return equity), per-symbol greedy; PF first, then net profit, lower DD, larger sample.

## Accuracy contract

### Python
The Python method files import `backtest/gold24/core.py` directly and run `backtest_candidate(..., flat_lot=100.0)` on the canonical Gate-A D1 dataset. They also assert the frozen strict config hash and key reference metrics. This is the authoritative same-model parity path.

Example:

```bash
python backtest/gold24/qualified_scripts/rank01_donchian_f3_s89_off3_exp4.py \
  --state-dir .gold24-canonical-v11
```

### MT5
The `.mq5` files translate the same D1 signal math, direction, LIMIT offset, fixed SL/TP, and bar-count expiry. Donchian uses the same shifted rolling channel and simple rolling RSI as `core.py`; engulfing uses the same candle definition and an explicit pandas-compatible `ewm(adjust=False)` EMA.

The canonical strict report itself states that the audited figures use the **canonical stressed Hyperliquid cost model and are not broker-specific MT5/Exness cost parity**. Therefore identical MT5 PnL requires the same canonical OHLC history plus a parity execution/cost environment. Broker XAUUSD spread, commission, swap, tick sequencing, pending-order touch behavior, and fills can change results.

For signal-data parity in MT5, import the canonical D1 CSV as a custom symbol and set `InpSignalSymbol` to that custom symbol.

## Current strict methods

| Rank | Method | Python | MT5 |
|---:|---|---|---|
| 1 | DONCHIAN f3/s89 p1=66 p2=55 p3=1 off=3 exp=4 | `rank01_donchian_f3_s89_off3_exp4.py` | `rank01_donchian_f3_s89_off3_exp4.mq5` |
| 2 | CANDLE_ENGULFING f34/s144 p1=66 p2=58 p3=1 off=2.75 exp=8 | `rank02_candle_engulfing_f34_s144_off2_75_exp8.py` | `rank02_candle_engulfing_f34_s144_off2_75_exp8.mq5` |
| 3 | DONCHIAN f3/s100 p1=55 p2=58 p3=1 off=1 exp=7 | `rank03_donchian_f3_s100_off1_exp7.py` | `rank03_donchian_f3_s100_off1_exp7.mq5` |
