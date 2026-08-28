# GOLD24 Canonical Goal Policy v3.0 — RR 1:2 Weekly Profit + Full Screening

Status: **CANONICAL POLICY FOR ALL NEW GOLD24 SEARCHES**  
Effective: **2026-08-28**

## Primary Economic Goal

A strategy may become a `WEEKLY_GOAL_CANDIDATE` only if all hard gates pass on the tested history:

- GOLD / XAUUSD only.
- Python is the discovery/backtest source of truth.
- Pending orders only: `buy_stop`, `sell_stop`, `buy_limit`, `sell_limit`.
- Flat lot only; no compounding.
- Fixed `SL = $12.50` and fixed `TP = $25.00` for the full backtest.
- Exact reward:risk = `1:2` (`TP / SL = 2.0`).
- Average realized trade frequency `>= 2.00 trades/week` over the full continuous calendar-week history.
- Net expectancy per trade `> $0` after Hyperliquid 2.7x stressed execution costs.
- Average weekly NET P&L `> $0`, including zero-trade weeks.
- Median weekly NET P&L `> $0`, including zero-trade weeks.
- Profitable weeks `>= 55%`; zero-trade weeks remain in the denominator and are not profitable.
- Backtest data reaches 2026.
- Every deal has a complete entry+exit ledger.

Trade win rate is a diagnostic at Gate C. For final promotion, Tier1 and red-flag rules below apply. `WR > 75%` is a red flag and cannot auto-promote.

## Gate A — Data Admissibility, Fail Closed

No new strategy simulation may execute or increment a compliant/search counter until Gate A is PASS.

Gate A requires:

1. Primary GOLD dataset reaches 2026.
2. Approved OANDA or TradingView cross-check bytes are present.
3. Cross-check receipt has `crosscheck_pass=true` and identifies provider, symbol, timeframe, coverage, primary SHA256 and cross-check SHA256.
4. UTC timestamp audit passes.
5. Duplicate/ordering/NaN/OHLC/volume audit is recorded.
6. Primary dataset SHA256 and lineage are pinned.
7. H1/H4/D1 data must be true source data for that timeframe. H1/H4 may not be fabricated by resampling D1.

Current canonical automation uses true-source D1 material. H1/H4 may only be enabled when equivalent true-source Gate-A evidence exists.

## Gate B — Execution Legality

All of the following are hard requirements:

1. Market orders forbidden.
2. Lot size constant from first through last trade.
3. Signal uses completed candle only; pending activates on the next bar.
4. STOP fill is gap-aware: gap through the level fills at open; otherwise crossing level.
5. LIMIT requires crossing, not touch-only.
6. Same-bar SL+TP ambiguity resolves to SL (worst case).
7. Pending expiry is fixed per config.
8. SL/TP are static; no ATR exit, trailing stop, moving target, support/resistance exit or other dynamic SL/TP.
9. Every ledger row must contain config hash, execution profile, entry/exit bar and time, side, pending type, entry/exit price, fixed SL/TP, quantity, gross P&L, cost, net P&L and exit reason.
10. Effective stressed round-trip cost floor must be at least `0.0032` of notional, representing the locked Hyperliquid 2.7x stress floor used by GOLD24.
11. All ranking and screening uses NET P&L after costs.
12. On H1, final Tier1 promotion forbids entries during 00:00–05:59 UTC.

## Gate C — Weekly Economics

Let `HistoryWeeks` be the complete continuous calendar-week index from the first through final dataset timestamp.

- `TradesPerWeek = TotalCompletedTrades / HistoryWeeks`
- `WeeklyNet[w] = sum(NetPnL of trades exiting in week w)`
- `AvgWeeklyNet = mean(WeeklyNet)` including zero-trade weeks
- `MedianWeeklyNet = median(WeeklyNet)` including zero-trade weeks
- `ProfitableWeeksPct = count(WeeklyNet > 0) / HistoryWeeks * 100`
- `NetExpectancy = sum(NetPnL) / TotalCompletedTrades`

Gate C PASS requires all:

- `TradesPerWeek >= 2.00`
- `TotalCompletedTrades >= ceil(2.00 * HistoryWeeks)`
- `NetExpectancy > 0`
- `AvgWeeklyNet > 0`
- `MedianWeeklyNet > 0`
- `ProfitableWeeksPct >= 55%`
- `WR <= 75%` for automatic candidacy; above 75% is red-flag audit territory.

For approximately 20 years (~1,043 weeks), the frequency floor is approximately `>= 2,086` completed trades.

`TOP 200 GOAL` may contain Gate-C candidates, but this is **not** final/compliant status.

## Gate 4 — Minimum Sample

Before quality ranking or promotion:

- H1: `>=500` completed trades.
- H4/D1: `>=300` completed trades.

Tiny-sample results such as `100% WR (1/1)` or `100% WR (2/2)` are `INSUFFICIENT_SAMPLE`, never promoted as a best strategy.

## Gate 5 — Tier1, 9/9 Hard Metrics

A final candidate must satisfy all applicable Tier1 requirements:

- Minimum trades above.
- WR between `50%` and `75%`.
- Profit Factor between `1.20` and `8.00`.
- Max Drawdown between `2%` and `25%`.
- Net expectancy `>= $0.50/trade`.
- Flat lot.
- Pending-only execution.
- History at least 3 years; H1 at least 4 years.
- Complete per-deal ledger.

H1 additionally requires:

- Profitable months `>=60%`.
- SQN `>=2.0`.
- No entry during 00:00–05:59 UTC.

## Gate 6 — Tier2, Minimum 6/8

At least six of eight must pass:

1. SQN `>=1.5`; H1 `>=2.0`.
2. Sharpe `>=0.8`.
3. Sortino `>=1.0`.
4. Recovery `>=3.0`.
5. Calmar `>=1.5`.
6. Average Win/Loss `>=1.0`, unless WR `>60%`.
7. Max consecutive losses `<=15`.
8. Profitable months `>=55%`; H1 `>=60%`.

## Gate 7 — Automatic Red Flags

A final promotion is blocked when any of these are present:

- WR `>75%`.
- PF `>8`.
- Growth `>100,000%`.
- Max DD `<2%`.
- Net expectancy `<$0.50/trade`.
- A sufficiently sampled calendar year with zero losing trades.
- OOS test WR `<30%`.
- SQN `<1.5`.
- OOS test/train expectancy ratio `<0.40`.

Red flags do not delete evidence; they block promotion.

## Gate D — Robustness / Anti-Overfit

### Chronological OOS

Use a frozen configuration and chronological `60% TRAIN -> 20% VALIDATION -> 20% untouched TEST`.

- No parameter optimization may consume TEST metrics.
- TRAIN must pass weekly goal + Tier1 + Tier2.
- VALIDATION and TEST must each remain weekly-goal positive, have net expectancy >0, PF >=1.0 and WR >=30%.
- TEST/TRAIN net-expectancy ratio must be `>=0.40`.

### Walk-forward

Use five chronological blocks. A fold is positive only if it has trades, net expectancy >0, net profit >0, PF >=1.0 and WR >=30%.

- At least `4/5` folds must be positive.
- Aggregate fold net profit must remain positive.

### Regime / Year Stability

Evaluate high-volatility, low-volatility, bull and bear buckets using the actual full-history exit ledger.

- At least `3/4` regime buckets must have sufficient trades and positive NET P&L.
- Profitable calendar years target must be `>=70%`.
- Max weekly loss and longest losing-week streak are recorded.

Gate D PASS requires OOS + walk-forward + regime/year stability.

## Strategy Uniqueness

### Config uniqueness

`ConfigHash = SHA256(canonical symbol + timeframe + family + indicator parameters + entry method + direction + fixed SL + fixed TP + offset + expiry)`

Exact ConfigHash duplicate is rejected before simulation.

### Novelty

A new strategy must differ by family/indicator OR at least one relevant indicator parameter by `>=20%`. Entry method/direction/offset/expiry/seed/file name alone do not prove economic novelty.

### Execution Profile V2

`ExecutionProfileV2 = Symbol + Timeframe + EntryMethod + Direction + FixedSL + FixedTP + Offset + Expiry`

Only the higher-quality member of an identical profile may remain in the selected portfolio.

### Actual execution-output uniqueness

Use a 128-bit execution-output hash for fast narrowing, then exact full-ledger comparison as final authority. Hash equality alone is not final proof.

## Gate E — Correlation and Diversification

Pearson correlation is computed on log-return equity:

- `<=0.35`: normal.
- `>0.35 and <=0.50`: warning/review.
- `>0.50`: lower-quality strategy is excluded from selected portfolio membership.

Correlation exclusion never deletes config, metrics, hashes, ledger or receipts.

Final portfolio rules:

- Same strategy family concentration `<=30%`.
- Candlestick-pattern family represented.
- Price-structure family represented.
- ATR family represented.
- Bollinger family represented.
- Keltner family represented.

If required family coverage is incomplete, `TOP100_COMPLIANT` remains empty even when individual pre-portfolio candidates exist.

## Ranking

After hard economic pass, rank in this order:

1. Median Weekly NET Profit descending.
2. Average Weekly NET Profit descending.
3. Profitable Weeks % descending.
4. Net Expectancy / Trade descending.
5. Profit Factor descending.
6. Max Drawdown ascending.
7. Prefer sustainable 2–4 trades/week over unnecessary hyper-frequency.
8. OOS / walk-forward stability.

## Gate F — Final Promotion / Reproducibility

`TOP100_COMPLIANT` may contain a strategy only after:

- Gate A PASS.
- Gate B PASS.
- Gate C PASS.
- Gate 4 sample PASS.
- Gate 5 Tier1 PASS.
- Gate 6 Tier2 PASS.
- Gate 7 red flags clear.
- Gate D OOS/walk-forward/regime PASS.
- Gate E correlation/profile/family/required-coverage PASS.
- Config hash, execution hash and ledger SHA256 are recorded.
- Canonical data SHA256 and cross-check receipt are recorded.
- Runtime receipt is written and read-back verification passes.

## Operational Lock

- Legacy/DEV results remain evidence only and may not populate `TOP100_COMPLIANT`.
- `TOP 200 GOAL` may contain Gate-C strategies and remains non-final until Gates D/E/F complete.
- No compliant counter increments without exact run receipts and complete ledgers.
- State is resumable from durable SQLite/artifact checkpoints; a normal run must not reset prior search state.
- Meaningful runtime evidence is published to `backtest/gold24/runtime/` and uploaded as a GitHub Actions artifact.
- Scheduled canonical automation runs hourly; GitHub Actions scheduling is best-effort, not guaranteed continuous CPU.

**Canonical hard goal:**  
`GOLD | pending-only | flat lot | SL $12.50 | TP $25.00 | RR 1:2 | >=2 trades/week | Net EV >0 | Avg Weekly Net >0 | Median Weekly Net >0 | Profitable Weeks >=55% | Corr <=0.50 | history through 2026 | complete trade ledger`
