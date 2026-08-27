# RENKO ATR Live-Chart Regression Lock

This file intentionally lives under `renko/**` so changes to the Renko production contract trigger the TradingView documented-contract gate, Ultra Fast UI gate, and ATR Zero Blocking gate on the same source revision.

## Fixed source contract — production

- Production Renko source is **Binance 1-second CLOSED kline, Close value only**.
- `settings.interval` must remain exactly `1s`; `settings.source` must remain exactly `close`.
- There is **no source selector and no timeframe selector** in the production DOM. The internal app may retain generic interval/source capabilities for engine tests, but the product runtime is locked before boot and guarded after boot.
- A confirmed Renko source sample comes only from a closed 1-second kline. The still-open 1-second kline may only contribute realtime projection.
- Switching ATR, Traditional, Percentage, wicks, pairs, zoom, or pan must never unlock another source interval.

## ATR control contract

- `ATR LENGTH` is a real Wilder ATR look-back calculated from ordinary 1-second OHLC source candles; Renko formation consumes the Close values from that fixed source.
- APPLY / Enter / committed input changes must rebuild actual Renko state. A labels-only change, fake geometry, stale cache, silent clamp, or different timeframe is a failure.
- The newest requested ATR value wins.
- Large look-backs are acquired and calculated in a Web Worker so one million source rows are not materialized on the browser main thread.
- Manual zoom/pan must survive ATR APPLY; no automatic snap back to latest unless the user explicitly chooses LIVE/reset or intentionally changes pair context.

## Required zero-blocking matrix

The production proof matrix is now exactly:

`1, 10, 100, 1000, 10000, 100000, 1000000`

For every value above, final production proof must show all of the following on the same exact deployed Git SHA:

- active ATR length equals the requested value;
- runtime source remains `1s` + `close`;
- no timeframe/source selector exists;
- requested Wilder ATR history is satisfied and reports at least the requested number of 1-second source bars;
- the chart uses an exact prepared cache result, not a placeholder;
- measured browser main-thread **Total Blocking Time is 0 ms** for the prepared switch;
- `preparedContext === warmContext === currentContext` for the measured source revision;
- screenshot is captured by the real production browser after the assertion succeeds;
- JSON report has `failure: null`, `errors: []`, `pass: true`.

`0 ms` means **0 ms main-thread Total Blocking Time**, not literal zero wall-clock/frame/network time. Never relabel a non-zero elapsed time as 0 ms.

## Previously successful behavior that must not regress

- Earlier production checkpoint `3621875ae699863bd53fd5d85273eafc2595b5af` passed the TradingView Official Contract Gate, Ultra Fast UI Gate, and the prior ATR zero-blocking matrix `14 / 140 / 500 / 6000 / 10000`.
- Full spot-pair universe stays lazy/worker-parsed/virtualized; opening all pairs must not materialize the full universe in the DOM or freeze the laptop.
- Manual chart zoom/pan remains locked during live updates and settings rebuilds; zoom-out must not snap back to the initial/latest position.
- Traditional continuation 1×, reversal 2×, Percentage (LTP), projection semantics, and directional Close-source wicks remain covered by the TradingView public-contract gate.
- Do not restore the obsolete tick-native/no-timeframe-per-trade contract merely to make an old legacy gate green.

## Release rule

Do not call the new fixed-1s-Close matrix complete until all three current gates pass against the same exact deployed Pages SHA:

1. `RENKO TradingView Official Contract Gate`
2. `RENKO Ultra Fast UI Gate`
3. `RENKO ATR Zero Blocking Gate` for `1 / 10 / 100 / 1000 / 10000 / 100000 / 1000000`

After the gates pass, download and visually inspect all seven real browser screenshots plus `report.json`, then append the final SHA/run IDs/results to this lock and to the existing project Google Doc. Do not generate or synthesize screenshot images.
