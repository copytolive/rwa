# GOLD Canonical Backtest Policy v11.0 — Sample First, Profit Factor First

Status: **CANONICAL SOURCE OF TRUTH FOR ALL NEW GOLD SEARCHES**  
Effective: **2026-08-28**  
Scope: **GOLD / XAUUSD / Hyperliquid `xyz:GOLD` only**

This policy replaces the previous RR 1:2 / weekly-profit search policy for all new canonical GOLD runs. Old results remain evidence only and must not be mixed into v11 counters or rankings.

## 1. Primary target and ranking

Official TOP candidates are determined in this order:

1. Minimum completed trades: H4/D1 `>=300`; H1 `>=500`.
2. Among strategies that pass the sample floor, sort by **NET Profit Factor descending**.
3. Target zone for new production candidates: `PF 2.0–8.0`.
4. `PF 1.20–<2.0` is a qualified baseline / near-target only.
5. `PF <1.20` is not qualified. `PF >8.0` is a curve-fit red flag.
6. Tie-breakers: Net EV/trade desc, Max DD asc, SQN desc, Sharpe desc, Sortino desc, then OOS/walk-forward stability.

Weekly statistics may be reported as diagnostics but are **not** the v11 primary ranking or hard economic gate.

## 2. GOLD-only scope

- Canonical symbol: `GOLD` / `XAUUSD` / Hyperliquid builder `xyz:GOLD`.
- Python is the discovery/backtest source of truth.
- MQL5/Pine are not required for discovery.
- Data must reach the current year 2026.
- Other instruments may not enter v11 counters, TOP rankings, or promotion.

## 3. Gate A — data admissibility, fail closed

- Approved GOLD primary history: `GC=F` / canonical GOLD futures history.
- Cross-check with at least one approved independent source: OANDA and/or TradingView.
- UTC timestamps only.
- Full OHLC required; close-only is forbidden.
- NaN/null, duplicate timestamps, invalid OHLC, ordering errors, and unexpected gaps must be audited.
- Persist source lineage, SHA256, row count, first/last timestamp, and source receipt.
- H1/H4/D1 must be **true-source** for that timeframe. H1/H4 may not be fabricated from D1 resampling.
- Simulation is fail-closed until Gate A PASS.

Current automation may run D1 while only D1 has approved true-source Gate-A evidence. H4/H1 can be enabled only after equivalent Gate-A proof exists.

## 4. Allowed timeframes

Allowed: `H1`, `H4`, `D1`.  
Forbidden: M1/M5/M15/M30, W1, MN.

H4/D1:
- Total trades `>=300`.
- History `>=3 years`.

H1 additionally:
- Total trades `>=500`.
- History `>=4 years`.
- Profitable months `>=60%`.
- SQN `>=2.0`.
- At least 2 confirmation layers.
- No entry during 00:00–05:59 UTC when treated as low-volume hours.

## 5. Execution rules

- Market orders are forbidden.
- Pending orders only: `buy_stop`, `sell_stop`, `buy_limit`, `sell_limit`.
- Flat quantity for the full backtest. No compounding or martingale.
- Signals use completed candles; pending orders become active from the next bar.
- Signal lock after order placement until completion/expiry.
- Every completed deal must have a complete auditable entry/exit ledger.

STOP realism:
- Gap through trigger fills at open/gap price.
- Otherwise fill only when the level is crossed.

LIMIT realism:
- Crossing only; touch-only is not enough.

Same-bar ambiguity:
- If both SL and TP can be hit without tick ordering, resolve conservatively to the adverse/worst-case outcome.

## 6. GOLD fixed SL/TP search space

- SL and TP are fixed per config and may not change during a trade or backtest.
- GOLD SL allowed: `$5.00–$25.00`.
- GOLD TP allowed: `$5.00–$25.00`.
- Below `$5.00` fails anti-scalping.
- Dynamic ATR stop, trailing stop, moving target, or dynamic support/resistance exits are forbidden.
- RR is **not locked to 1:2**. Different legal fixed SL/TP combinations may be searched.

## 7. Hyperliquid stressed costs

All gates and rankings use NET metrics after costs.

- Use a conservative Hyperliquid/HIP-3 builder model.
- Effective round-trip cost floor must not be below the canonical stress floor (`0.0032` of notional where applicable).
- Include commission floor, spread stress, normal + shock slippage, and funding stress for relevant holding periods.
- Gross-only ranking is forbidden.

## 8. Tier 1 — hard pass (9/9)

A strategy must pass all:

1. H4/D1 trades `>=300`; H1 `>=500`.
2. Win rate `50–75%`.
3. Net Profit Factor `1.20–8.00`.
4. Max Drawdown `<=25%`.
5. Net Profit / Total Trades `>= $0.50/trade`.
6. Flat lot.
7. Pending-only execution.
8. Minimum history met and reaches 2026.
9. Complete per-deal trade log.

Search target: **PF >=2.0**, not merely the legal floor 1.20.

## 9. Tier 2 — quality gate (minimum 6/8)

- SQN `>=1.5`; H1 `>=2.0`.
- Sharpe annualized `>=0.8`.
- Sortino `>=1.0`.
- Recovery Factor `>=3.0`.
- Calmar `>=1.5`.
- Avg Win / Avg Loss `>=1.0`.
- Max consecutive losses `<=15`.
- Profitable months `>=55%`; H1 `>=60%`.

## 10. Tier 3 — data integrity

All mandatory:
- Sufficient equity history for full-period audit.
- SL/TP fixed and reproducible.
- Stressed costs included in every trade/net PnL.

## 11. Tier 4 — robustness for PF >=2 target

Before a target strategy can be considered production candidate:

- Chronological OOS: frozen config; validation/test `PF >=1.3`, `WR >=30%`, positive net.
- Parameter stability: meaningful perturbation around parameters (roughly +/-20–30%) must remain viable/profitable.
- Regime test: bull, bear, sideways, high-volatility.
- Leakage guard: next-bar pending execution; no future candle leakage.
- Extra slippage stress.
- Portfolio interaction: correlation, overlap, combined DD.
- 2–4 week paper/shadow quarantine before live sizing.

## 12. Tier 5 — execution realism

Mandatory:
- Commission floor not below the v11 stressed model.
- p90/p95 spread or a conservative fixed spread.
- Normal + shock slippage.
- Funding stress where relevant.
- Conservative LIMIT crossing-only fill.
- Gap-aware STOP fill.
- Historical OHLC cross-check against approved/live proxy.
- Reject unstable liquidity/spread periods.
- Order size must be compatible with Hyperliquid size decimals/minimum notional.

## 13. Multi-layer confirmation

Every strategy: minimum 2 layers, ideal 3, maximum 4.  
Framework: `TREND -> TIMING -> CONFIRM -> FILTER`.  
One layer is rejected; 5+ layers are forbidden to avoid excessive filtering and tiny samples.

## 14. Diversification

- No more than 30% of selected portfolio from the same family/indicator.
- Each search batch should cover at least 3 categories where possible.
- Target coverage: at least 10 of 15 categories: Trend, Momentum, Volatility, Volume, Candlestick, Price Structure, Fibonacci, Statistical, Mean Reversion, Multi-Timeframe, Ichimoku, SuperTrend/Adaptive, Donchian/Range, Divergence, Hybrid/Advanced.
- Candlestick and Price Structure must be represented.
- Volatility coverage must include ATR, Bollinger, and Keltner families.

## 15. Uniqueness and duplicates

- Exact ConfigHash duplicate: reject before simulation.
- Config identity includes symbol, timeframe, family, parameters, entry method, direction, SL, TP, offset, expiry/filter settings.
- New strategy must differ by family/indicator or a relevant parameter by at least 20%.
- Use a 128-bit execution hash only for narrowing; exact full-ledger comparison is final duplicate authority.
- If two configs produce an identical execution ledger, only the higher-quality member may remain selected.

## 16. Correlation / portfolio

- Pearson correlation on log-return equity must be `<=0.50` for selected portfolio membership.
- Above 0.50, exclude the lower-quality strategy from selected portfolio; preserve its evidence.
- Same-family selected concentration `<=30%`.

## 17. Official TOP 10 GOLD

Filter first:
- H4/D1 trades `>=300`.
- H1 trades `>=500`.

Sort primary:
- Net Profit Factor descending.

Tie-breakers:
1. Net EV/trade descending.
2. Max DD ascending.
3. SQN descending.
4. Sharpe descending.
5. Sortino descending.
6. OOS/walk-forward stability descending.
7. Lower correlation preferred for portfolio.

## 18. Gate architecture

- Gate A: data admissibility / true-source / integrity.
- Gate B: pending-only, flat lot, fixed SL/TP, no look-ahead, complete ledger, stressed costs.
- Gate C: Tier 1 sample + WR + PF + DD + EV/trade + history + log.
- Gate D: Tier 2 quality metrics.
- Gate E: robustness + execution realism.
- Gate F: uniqueness + correlation + diversification.
- Gate G: final promotion only after reproducible evidence/read-back.

## 19. Operational lock

- v11 canonical counters only count runs with exact config, metrics, receipts, and complete ledgers.
- Legacy/DEV/RR1:2 weekly-policy results may not populate v11 counters.
- New v11 state uses an isolated state namespace/artifact and starts fresh.
- Every meaningful checkpoint is persisted and final evidence is read back.

**Canonical hard target:**  
`GOLD only | true-source H1/H4/D1 | pending-only | flat lot | fixed SL/TP $5–$25 | H4/D1 >=300 trades | H1 >=500 trades | PF target 2.0–8.0 | WR 50–75% | Net EV >=$0.50/trade | MDD <=25% | Tier2 >=6/8 | OOS PF >=1.3 | parameter stability +/-20–30% | stressed Hyperliquid costs | complete ledger | corr <=0.50`
