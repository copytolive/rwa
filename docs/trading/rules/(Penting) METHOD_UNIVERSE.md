# 🟨 GOLD24 — MASTER METHOD / VALIDATION POLICY

Status: **AUTHORITATIVE — 2026-09-03**

Machine-readable source: `backtest/gold24/MASTER_METHOD_UNIVERSE.json`

## 1. Canonical total

- Only finalized canonical backtests count as Total Backtest.
- Candidate cursor is not Total Backtest.
- Strict / Multi / Screening views must never be double-counted when they refer to the same candidate.
- Historical canonical archive is preserved when discovery policy evolves.

## 2. Candidate Gate

A method is CANDIDATE PASS only when all are true:

- Total Entry >= 100
- Net Profit >= USD 20,000
- global per-symbol Corr Max <= 0.50

Correlation is **absolute Pearson(log-return equity)** and is evaluated across the complete selected set. Selection is quality-ordered greedy; if correlation exceeds 0.50, remove the lower-quality/ranking method.

Candidate PASS is not HARD PASS.

## 3. Units

- GOLD pip size = USD 0.01
- SL / TP table values = pips
- Net Profit / EV = USD
- WR / Max DD / MC95 DD / Positive Year = %
- PF / Recovery / SQN / OOS PF / Corr = unitless ratios
- Entry / Max Consecutive Loss = counts
- History = years
- Worst Year = calendar year

Backtest remains flat-lot, no compounding, pending-order only (STOP/LIMIT), fixed SL/TP USD 5–25 = 500–2,500 pips.

## 4. Final 28 columns

Metode → TF → Order → Direction → SL → TP → Total Entry → WR → PF Net → Net Profit → EV/Trade → Avg Win/Loss → Max DD → Recovery Factor → Max Consecutive Loss → SQN → OOS PF → Monte Carlo Pass → MC 95% DD → Positive Year → Worst Year → Periode Backtest → History → Sample v11 → Corr Max → Corr Gate → Python Script → MT5 Script.

## 5. Real script contract

Every displayed final method must have an exact Python/MT5 pair.

### Python
- real `.py` file in GitHub
- real CANDIDATE + EXPECTED
- config hash
- exact canonical replay
- same quantity as the reported backtest
- metric parity PASS

### MT5
- real `.mq5` file in GitHub
- not mockup
- parameters identical to Python
- identical config hash
- real engine/include
- native MetaEditor compile PASS
- native MT5 Strategy Tester PASS

If either side fails, the method must not be labeled VERIFIED.

## 6. Required categories

All 20 categories remain mandatory:

1. Moving Average / Trend
2. Channel / Breakout
3. Momentum
4. Mean Reversion
5. Candlestick
6. Hybrid / Ensemble
7. Chart Pattern
8. Market Structure
9. Support / Resistance
10. Fibonacci
11. Volatility
12. Keltner / Bollinger Hybrid
13. Ichimoku
14. SuperTrend / Adaptive Trend
15. Divergence
16. Volume
17. VWAP
18. Statistical
19. Relative Strength
20. Multi-Timeframe

## 7. Family expansion

Previous implemented engine set: **24 families**.

2026-09-03 expansion adds **22 causal D1-real families**:

- ADX_TREND
- TURTLE_BREAKOUT
- ATR_CHANNEL
- EMA_PULLBACK
- MACD_MOMENTUM
- RSI_MOMENTUM
- RSI_REVERSION
- BOLLINGER_REVERSION_V2
- BOLLINGER_SQUEEZE
- KELTNER_SQUEEZE
- FRACTAL_BREAKOUT
- BOS_CHOCH
- PIVOT_SR
- FIB_PULLBACK
- ICHIMOKU_KUMO_BREAKOUT
- ICHIMOKU_PULLBACK
- SUPERTREND_ATR
- CHANDELIER_TREND
- ROLLING_ZSCORE
- LINEAR_REGRESSION
- VOLATILITY_REGIME
- TREND_MEANREV_ENSEMBLE

Current implemented engine set: **46 families**.

Two additional registered target families remain **DATA_BLOCKED**:

- H4_D1_MTF_NATIVE
- D1_H4_PULLBACK_NATIVE

They MUST NOT be simulated by resampling D1 and then labeled native H4. They become implemented only after real canonical H4 data is imported and independently Gate-A audited.

Target registry: **48 = 46 implemented + 2 data-blocked**.

## 8. Real dataset policy

Every published result must be traceable to:

- provider
- symbol
- timeframe
- rows/bars
- period
- dataset SHA256
- cost model
- quantity/lot
- starting equity
- config hash
- execution hash

Synthetic/resampled H1/H4 must never be presented as real native H1/H4.

## 9. HARD PASS

HARD PASS requires Candidate PASS plus all 8 gates:

1. Total Entry >= 300
2. PF Net >= 1.20
3. Max DD <= 25%
4. EV/Trade > 0
5. OOS PF >= 1.00
6. Monte Carlo PASS / probability-positive >= 95%
7. Positive Year >= 60%
8. Corr Max <= 0.50

Classification:

- HARD PASS = Candidate PASS + 8/8
- WATCH = Candidate PASS + >=5/8
- FAIL = otherwise

## 10. Portfolio Gate

After all candidate sources are combined:

- compute global per-symbol correlation across the complete selected set
- apply quality-ordered greedy Corr <= 0.50
- minimum 6 distinct families
- target >=10 distinct families
- maximum one-family share 25%
- ideal one-family share <=20%
- reduce Candle concentration
- compute portfolio DD and diagnostic PnL
- do not label LIVE READY before broker margin/slippage/commission/swap/tick/simultaneous-position interactions are validated

## 11. BEFORE → AFTER progress

Every update must report:

- Total finalized backtest
- Candidate evaluated
- Candidate PASS
- HARD PASS
- WATCH
- FAIL
- Selected methods
- Distinct family
- Max family concentration
- Corr violations
- Global Corr kept
- Python verified
- MT5 verified
- Sample >=300 count
- Max DD <=25% count
- Portfolio readiness

If no progress occurs: identify the bottleneck, fix engine/data/discovery, rerun, validate, and only then publish.

## 12. Target

**48 registered real-family designs → large-scale candidate discovery → Candidate Gate → HARD PASS → global correlation → diversification → exact Python/MT5 pair → reproducible Portfolio Final.**
