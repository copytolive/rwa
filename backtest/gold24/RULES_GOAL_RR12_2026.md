# GOLD24 Primary Goal Lock — 2026

Status: CANONICAL GOAL POLICY FOR NEW SEARCHES

## Primary Goal

Search GOLD strategies whose realized backtest characteristics satisfy all of the following before they can be called a PRIMARY-GOAL candidate:

- Win rate >= 50%.
- Risk:Reward fixed at exactly 1:2, meaning `TP = 2 x SL` for every trade and for the entire backtest.
- Average realized entries >= 1.0 trade/week over the tested history. Preferred operating band is 1-2 entries/week; >2/week is allowed, <1/week fails the primary goal.
- Net expectancy after stressed execution cost > 0.
- Backtest reaches the current year 2026.

A win rate >75% is a red flag and is not promoted without separate audit. A 100% win rate from a tiny sample is never treated as evidence of quality.

## Hard Execution Rules

1. Market orders forbidden. Pending orders only: buy_stop, sell_stop, buy_limit, sell_limit.
2. Flat lot only. No compounding.
3. Every simulated config must have a complete per-deal entry+exit ledger.
4. Data must reach 2026.
5. Hyperliquid execution costs must be included with the locked 2.7x stress padding / effective round-trip floor used by GOLD24.
6. Exact canonical config duplicates are forbidden.
7. Python is the discovery/backtest source of truth. MQL5 may be generated only for downstream validation, not discovery ranking.
8. Novelty: new strategy must differ by family/indicator OR a relevant indicator parameter by >=20% OR fixed SL/TP scale by >=30% OR symbol.
9. SL and TP are static. Dynamic ATR exits, nearest-resistance exits, trailing stops, moving stops, and other changing exits are forbidden.
10. No selected portfolio may have >30% from the same strategy family.
11. Selected portfolio must cover candlestick pattern and price structure families.
12. Selected portfolio must cover ATR, Bollinger Bands, and Keltner Channel families.

## Fixed SL/TP Under RR 1:2

For GOLD, both SL and TP must remain inside the existing absolute $5-$25 bounds.

Because `TP = 2 x SL`, the valid search range becomes:

- SL: $5.00 through $12.50.
- TP: $10.00 through $25.00.

Example: SL=$8.00, TP=$16.00 is valid. SL=$11.00, TP=$15.50 is not RR 1:2 and is invalid for the new primary-goal ranking.

## Corrected Uniqueness Model

The old claim `Execution Fingerprint = Symbol + RR + EntryMethod => identical trades` is technically false. Two strategies can share symbol, RR, and order type while entering on different bars because their signals differ.

Under a GOLD-only, fixed-RR-1:2 search, that old fingerprint would also create only two possible values (STOP and LIMIT), which would make a 100/200-strategy portfolio impossible.

The corrected model is:

### A. Config uniqueness

`ConfigHash = canonical hash of symbol + timeframe + family + indicator parameters + entry method + direction + fixed SL + fixed TP + offset + expiry`

Exact ConfigHash duplicate => reject before simulation.

### B. Execution Profile V2

`ExecutionProfileV2 = Symbol + Timeframe + EntryMethod + Direction + FixedSL + FixedTP + Offset + Expiry`

The selected portfolio keeps one higher-quality strategy per identical ExecutionProfileV2.

### C. Actual execution-output uniqueness

Actual identical trading output is determined by the 128-bit execution-output hash as a fast lookup and then exact full-ledger comparison as final authority.

Different indicator names are not enough if the complete execution ledger is actually identical.

## Correlation

Pearson correlation is computed on log-return equity.

- <=0.35: normal.
- >0.35 and <=0.50: warning/review.
- >0.50: lower-quality strategy is excluded from the selected portfolio.

The underlying backtest, config, hashes, metrics, and complete trade ledger are preserved in archive/evidence storage; they are not deleted.

## Ranking

Only strategies that pass the PRIMARY GOAL are eligible for the new goal ranking. Quality ordering remains:

1. Profit Factor descending.
2. Total trades descending.
3. Net Profit descending.

Correlation, execution-profile uniqueness, family cap, and required family coverage are then applied to portfolio membership.

## Governance

DEV results remain DEV while Gate A is blocked. No result may enter TOP100_COMPLIANT until the approved OANDA/TradingView 2026 cross-check and all other canonical governance gates pass.
