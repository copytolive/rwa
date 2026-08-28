# GOLD24 Canonical Goal Policy v2.0 — RR 1:2 Weekly Profit

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
- Average realized trade frequency `>= 2.00 trades/week` over the full calendar-week history.
- Net expectancy per trade `> $0` after Hyperliquid 2.7x stressed execution costs.
- Average weekly NET P&L `> $0`, including zero-trade weeks.
- Median weekly NET P&L `> $0`, including zero-trade weeks.
- Profitable weeks `>= 55%` of all calendar weeks in the tested history; zero-trade weeks are not hidden and are not counted as profitable.
- Backtest data reaches 2026.
- Every deal has a complete entry+exit ledger.

Trade win rate is a diagnostic, not the primary hard target. `WR > 75%` is a red flag that requires separate leakage/sample/OOS audit and cannot auto-promote.

## Gate A — Fail Closed Before Simulation

No new strategy simulation may execute or increment a compliant/search counter until Gate A is PASS.

Gate A requires all of the following together:

1. Primary GOLD dataset reaches 2026.
2. Approved OANDA or TradingView cross-check bytes are present.
3. A verifiable cross-check receipt has `crosscheck_pass=true` and identifies provider, timeframe, symbol, coverage, and primary SHA256.
4. UTC timestamp audit passes.
5. Duplicate/gap/NaN/OHLC/volume audit is recorded.
6. Primary dataset SHA256 and lineage are pinned.
7. H1/H4/D1 data must be real source data for that timeframe; H1/H4 may not be fabricated by resampling D1.

While Gate A is blocked, rules/code/self-tests may be updated, but **strategy simulation remains PAUSED**.

## Hard Execution Rules

1. Market orders are forbidden.
2. Lot size must be constant from first to last trade.
3. Signal uses completed candle information only; pending activates from the next bar.
4. STOP fill is gap-aware: if open gaps through the stop level, fill at open; otherwise fill at the crossing level.
5. LIMIT requires crossing under the engine rule; touch-only is not enough.
6. Same-bar SL+TP ambiguity resolves to SL (worst case).
7. Pending expiry is fixed per config.
8. SL and TP are static and never trail, move, use ATR, or follow support/resistance.
9. Hyperliquid costs use the locked 2.7x stress model / effective round-trip floor used by GOLD24.
10. All metrics and ranking use NET P&L after costs, never gross-only P&L.

## Weekly Metrics

Let `HistoryWeeks` be the complete continuous calendar-week index from the first data timestamp through the last data timestamp.

- `TradesPerWeek = TotalCompletedTrades / HistoryWeeks`
- `WeeklyNet[w] = sum(NetPnL of trades exiting in week w)`
- `AvgWeeklyNet = mean(WeeklyNet)` including zero-trade weeks
- `MedianWeeklyNet = median(WeeklyNet)` including zero-trade weeks
- `ProfitableWeeksPct = count(WeeklyNet > 0) / HistoryWeeks * 100`
- `NetExpectancy = sum(NetPnL) / TotalCompletedTrades`

For approximately 20 years (~1,043 weeks), the frequency floor implies approximately `>= 2,086` completed trades.

## Annual and Risk Stability

These are required for final promotion and are also ranking diagnostics during search:

- Profitable years target `>= 70%`.
- Max drawdown target `<= 25%` on NET equity.
- Profit Factor target `>= 1.20` on NET trade P&L.
- Record maximum weekly loss and longest consecutive losing-week streak.
- Record WR, Sharpe, Sortino, SQN, Recovery, Calmar, and profitable-month ratio.

## Robustness / Anti-Overfit

Before final promotion, a frozen candidate must pass:

- Chronological OOS validation; preferred structure `60% TRAIN -> 20% VALIDATION -> 20% untouched TEST`.
- Walk-forward validation.
- Regime/year-block stability.
- No look-ahead.
- No silent gap interpolation or fabricated bars.

Untouched TEST may not be used for parameter tuning.

## Strategy Uniqueness

### Config uniqueness

`ConfigHash = SHA256(canonical symbol + timeframe + family + indicator parameters + entry method + direction + fixed SL + fixed TP + offset + expiry)`

Exact `ConfigHash` duplicate => reject before simulation.

### Novelty

A new strategy must differ by family/indicator OR at least one relevant indicator parameter by `>=20%`. Entry method/direction/offset/expiry/seed/file name alone do not prove economic novelty.

### Execution Profile V2

`ExecutionProfileV2 = Symbol + Timeframe + EntryMethod + Direction + FixedSL + FixedTP + Offset + Expiry`

The selected portfolio keeps the higher-quality strategy for an identical ExecutionProfileV2.

### Actual execution-output uniqueness

Use the dual/128-bit execution-output hash as a fast lookup, then exact full-ledger comparison as final authority. An execution hash is not final proof by itself.

## Correlation and Diversification

Pearson correlation is computed on log-return equity:

- `<=0.35`: normal.
- `>0.35 and <=0.50`: warning/review; still eligible.
- `>0.50`: lower-quality strategy is excluded from selected portfolio membership.

Correlation exclusion never deletes evidence: preserve config, metrics, hashes, ledger, and receipts.

Portfolio rules:

- Same strategy family concentration `<=30%`.
- Candlestick-pattern strategy must be represented.
- Price-structure strategy must be represented.
- ATR, Bollinger Bands, and Keltner Channel must all be represented.

## Ranking After Hard Economic Pass

Only strategies that pass the weekly economic gate are eligible for the new goal ranking. Recommended ordering:

1. Median Weekly NET Profit descending.
2. Average Weekly NET Profit descending.
3. Profitable Weeks % descending.
4. Net Expectancy / Trade descending.
5. Profit Factor descending.
6. Max Drawdown ascending.
7. Trades / Week: prefer sustainable 2–4/week before very high frequency.
8. OOS / walk-forward stability.

## Promotion Architecture

- **Gate A — Data admissibility:** primary through 2026 + approved OANDA/TradingView bytes/receipt + integrity/SHA/lineage.
- **Gate B — Execution legality:** pending-only, flat lot, fixed SL/TP, no look-ahead, costs, complete ledger.
- **Gate C — Weekly economics:** `>=2/week`, EV>0, average weekly>0, median weekly>0, profitable weeks>=55%.
- **Gate D — Robustness:** OOS + walk-forward + regime/year stability.
- **Gate E — Uniqueness/portfolio:** output uniqueness, correlation<=0.50, family cap<=30%, required coverage.
- **Gate F — Promotion:** reproducible evidence and read-back verification before `TOP100_COMPLIANT`.

## Operational Lock

- Legacy/DEV results remain evidence only and may not populate `TOP100_COMPLIANT`.
- `TOP 200 GOAL` may contain only strategies passing Gate C, and remains DEV until Gate A/D/E are complete.
- No compliant counter increments without exact run receipts and complete ledgers.
- Meaningful checkpoints must be backed up and spreadsheet writes verified by read-back.

**Canonical hard goal:**  
`GOLD | pending-only | flat lot | SL $12.50 | TP $25.00 | RR 1:2 | >=2 trades/week | Net EV >0 | Avg Weekly Net >0 | Median Weekly Net >0 | Profitable Weeks >=55% | Corr <=0.50 | history through 2026 | complete trade ledger`
