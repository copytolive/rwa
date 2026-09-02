# (Penting) GOLD24 MASTER METHOD UNIVERSE

Status: **AUTHORITATIVE METHOD/DIVERSIFICATION REFERENCE**

Machine-readable source: `backtest/gold24/MASTER_METHOD_UNIVERSE.json`

## 1. Purpose

This document prevents GOLD24 discovery from repeatedly concentrating search budget and portfolio selection in one already-successful family.

The canonical archive, candidate cursor, execution ledger, Gate A evidence, historical checkpoints, and cumulative Multi discovery state MUST NOT be reset when this policy evolves.

## 2. Candidate execution rules

- Symbol: GOLD
- Allowed TF: H1 / H4 / D1; current canonical GOLD production: D1
- Pending order only: STOP / LIMIT
- Direction: LONG_ONLY / SHORT_ONLY / BOTH
- Flat-lot backtest; no compounding
- Fixed SL: USD 5–25
- Fixed TP: USD 5–25
- GOLD pip convention: USD 0.01 / pip
- Therefore SL/TP search range: **500–2,500 pips**
- Canonical stressed round-trip cost floor: 0.32%

## 3. Selection labels

### CANDIDATE PASS
Required:
- Entry >= 100
- Net Profit >= USD 20,000
- abs Pearson(log-return equity) Corr <= 0.50
- Correlation selection is per-symbol greedy; when >0.50 remove the lower-quality/ranking method.

### VALIDATED
A separate higher label. CANDIDATE PASS does not imply VALIDATED.
Full BACKTEST_RULES quality, sample, OOS, robustness, execution, and risk gates remain required.

### PORTFOLIO_READY
A selected library may be concentrated while research is incomplete, but it MUST NOT be labeled PORTFOLIO_READY unless:
- at least **6 distinct engine families** are represented; and
- **no single family exceeds 25%** of the final portfolio.

## 4. Discovery policy

Discovery is **family-balanced** across every engine family marked IMPLEMENTED.

For N implemented families and a 5,000-candidate run, candidate generation must differ by no more than one candidate between families.

Seed exploitation is permitted only inside the currently targeted family. A strong Candle seed may not consume the discovery budget allocated to ATR, Bollinger, Momentum, Z-Score, etc.

A workflow run must fail if the engine's implemented family set differs from the implemented family set registered in `MASTER_METHOD_UNIVERSE.json`.

## 5. Master method universe

| # | Category | Status | Engine family now | Method universe |
|---:|---|---|---|---|
| 1 | Moving Average / Trend | IMPLEMENTED | TREND_EMA | SMA Cross, EMA Cross, WMA Cross, HMA Trend, EMA Slope, Triple MA, MA Pullback |
| 2 | Channel / Breakout | IMPLEMENTED | ATR_BREAKOUT, KELTNER_BREAKOUT, PRICE_STRUCTURE, DONCHIAN | Donchian, N-Bar High/Low, Price Structure, ATR/Keltner/Bollinger Breakout |
| 3 | Momentum | IMPLEMENTED | MOMENTUM_RSI_ROC | RSI Momentum, ROC, Stochastic, MACD, CCI, Williams %R, TSI |
| 4 | Mean Reversion | IMPLEMENTED | BOLLINGER_REVERSION, ZSCORE_REVERSION | Bollinger, Z-Score, RSI/Keltner/MA/VWAP deviation |
| 5 | Candlestick | IMPLEMENTED | CANDLE_ENGULFING | Engulfing, Pin Bar, Inside/Outside Bar, Doji, Harami, Morning/Evening Star, 3 Soldiers/Crows |
| 6 | Hybrid / Ensemble | IMPLEMENTED | HYBRID | Trend+Momentum, Trend+Breakout, Mean Reversion+Volatility, Structure+Momentum |
| 7 | Chart Pattern | PLANNED | — | Double Top/Bottom, H&S, Triangle, Wedge, Flag, Pennant, Rectangle |
| 8 | Market Structure | PLANNED | — | HH/HL, LH/LL, Swing Break, BOS, CHoCH, Range Break |
| 9 | Support / Resistance | PLANNED | — | Horizontal, Previous/Daily/Weekly High-Low, Dynamic S/R |
| 10 | Fibonacci | PLANNED | — | 38.2/50/61.8/78.6 pullback, extension breakout |
| 11 | Volatility | PLANNED | — | ATR expansion/compression, Bollinger width, contraction/expansion |
| 12 | Keltner / Bollinger Hybrid | PLANNED | — | Squeeze, expansion, BB+ATR breakout, re-entry |
| 13 | Ichimoku | PLANNED | — | Tenkan/Kijun, Kumo breakout/trend, Chikou |
| 14 | SuperTrend / Adaptive Trend | PLANNED | — | SuperTrend, ATR SuperTrend, KAMA, VIDYA |
| 15 | Divergence | PLANNED | — | RSI/MACD/Stochastic/CCI/Hidden divergence |
| 16 | Volume | PLANNED | — | Volume breakout/spike, OBV, MFI, price+volume |
| 17 | VWAP | PLANNED | — | VWAP reversion/breakout, Anchored VWAP, trend/pullback |
| 18 | Statistical | PLANNED | — | Z-Score, rolling regression, regression channel, percentile breakout |
| 19 | Relative Strength | PLANNED | — | Price/MA RS, cross-asset RS, Gold vs USD/DXY |
| 20 | Multi-Timeframe | PLANNED | — | D1+H4, D1+H1, H4+H1 confirmation |

## 6. Rollout rule for PLANNED methods

A PLANNED method does not enter production merely because it is named here.

For each new engine family:
1. implement deterministic signal logic with no future leakage;
2. add parameter-generation rules and candidate validation;
3. add unit/smoke tests and exact execution-hash checks;
4. run canonical backtest under the same cost/order/SL/TP rules;
5. pass economic floor before correlation;
6. pass correlation authority;
7. generate exact Python and MT5 wrappers if selected;
8. pass native MetaQuotes certification before being considered tradable.

## 7. Current known concentration

At the policy rollout checkpoint, the Multi library was still concentrated in two families and therefore **NOT PORTFOLIO_READY**.

The library is preserved. Family-balanced discovery is responsible for finding alternatives; useful existing rows are not deleted merely to make the portfolio look diversified.
