# RENKO ATR Live-Chart Regression Lock

This file intentionally lives under `renko/**` so changes to the Renko production contract trigger the TradingView documented-contract gate, Ultra Fast UI gate, and ATR Zero Blocking gate on the same source revision.

## Fixed source contract — production

- Production Renko source is **Binance 1-second CLOSED kline, Close value only**.
- `settings.interval` must remain exactly `1s`; `settings.source` must remain exactly `close`.
- There is **no source selector and no timeframe selector** in the production DOM.
- A confirmed Renko source sample comes only from a closed 1-second kline. The still-open 1-second kline may only contribute realtime projection.
- Switching ATR, Traditional, Percentage, wicks, pairs, zoom, or pan must never unlock another source interval.

## ATR control contract

- `ATR LENGTH` is a real Wilder ATR look-back calculated from ordinary 1-second OHLC source candles; Renko formation consumes the Close values from that fixed source.
- For every **positive** Wilder ATR result, the Renko box must equal the raw Wilder ATR value within floating-point tolerance. ATR must **not** be rounded to exchange minimum tick. TradingView's public documentation explicitly describes nearest-minimum-tick rounding for Percentage (LTP), while ATR is described as taking the regular-candlestick ATR value and making that value the brick size.
- If a one-period ATR is exactly zero, the renderer may use the positive market tick only as a safety floor because a zero-size Renko brick is undefined. This fallback must be reported explicitly and must never be used for a positive ATR.
- APPLY / Enter / committed input changes must rebuild actual Renko state. A labels-only change, fake geometry, stale cache, silent clamp, tick-rounded positive ATR, or different timeframe is a failure.
- The newest requested ATR value wins.
- Large look-backs are acquired and calculated in a Web Worker so one million source rows are not materialized on the browser main thread.
- A deep ATR result **must stay deep after subsequent 1-second closes**. The runtime must never apply ATR 10000/100000/1000000 from the deep worker and then silently fall back to the short resident display history on the next source close.
- While the deep worker catches up by one 1-second source bar, the previous exact deep base is held temporarily; the short-history fallback is forbidden.
- Manual zoom/pan must survive ATR APPLY; no automatic snap back to latest unless the user explicitly chooses LIVE/reset or intentionally changes pair context.

## Stable chart / no-heartbeat contract

The fixed 1-second source is allowed—and required—to receive/close source candles continuously. That does **not** mean the visible Renko chart should repaint once per second when no Renko geometry changed.

- Open 1-second kline events that produce the same projected Renko geometry are suppressed from the chart render path while `REAL LAST` may continue updating as text.
- Closed 1-second source bars are never dropped; they always enter the source history and deep ATR worker.
- Identical confirmed/projection `setData` writes are deduplicated.
- Identical auto-follow visible-range writes are deduplicated.
- The chart price line tracks the last Renko close instead of raw trade/1-second price ticks, so it cannot visually pulse merely because `REAL LAST` changed.
- A genuine confirmed or projected Renko brick change must still render immediately.
- Production browser evidence must show skipped redundant chart writes and deep-ATR exact persistence across at least one later 1-second source close.

## Required zero-blocking matrix

The production proof matrix is exactly:

`1, 10, 100, 1000, 10000, 100000, 1000000`

For every value above, final production proof must show all of the following on the same exact deployed Git SHA:

- active ATR length equals the requested value;
- runtime source remains `1s` + `close`;
- no timeframe/source selector exists;
- requested Wilder ATR history is satisfied and reports at least the requested number of 1-second source bars;
- positive `atrRaw` equals the active `box` within strict floating-point tolerance; an exact-zero ATR may use only the explicitly reported tick safety floor;
- the chart uses an exact prepared cache result, not a placeholder;
- measured browser main-thread **Total Blocking Time is 0 ms** for the prepared switch;
- `preparedContext === warmContext === currentContext` for the measured source revision;
- screenshot is captured by the real production browser after the assertion succeeds;
- JSON report has `failure: null`, `errors: []`, `pass: true` and `rawBoxPass: true` for every matrix entry.

After ATR 1,000,000 is applied, the same production browser must additionally wait through later 1-second closes and prove the active box remains the exact current deep-cache raw ATR box and redundant chart writes are suppressed.

`0 ms` means **0 ms main-thread Total Blocking Time**, not literal zero wall-clock/frame/network time. Never relabel a non-zero elapsed time as 0 ms.

## Previously successful behavior that must not regress

- Checkpoint `6aff91c0d0a7af5e71c429e7f68f93b2eeeb7052` passed the three then-current browser gates, but the production artifact exposed a missing assertion: positive deep ATR values such as `0.0175915400…` and `0.0221495886…` were still rounded to `0.02`. Therefore that green run is explicitly **not** accepted as final ATR parity evidence.
- Production checkpoint `4af89542945de88eaf72f700fb76ca31cd8d1b3f` proved the seven ATR values could be applied at 0 ms blocking on fixed 1s Close, but that gate did not yet test persistence after the next live 1-second source close. The later user-observed heartbeat exposed this missing gate.
- Earlier checkpoint `3621875ae699863bd53fd5d85273eafc2595b5af` passed the TradingView Official Contract Gate, Ultra Fast UI Gate, and the prior ATR zero-blocking matrix `14 / 140 / 500 / 6000 / 10000`.
- Full spot-pair universe stays lazy/worker-parsed/virtualized; opening all pairs must not materialize the full universe in the DOM or freeze the laptop.
- Manual chart zoom/pan remains locked during live updates and settings rebuilds; zoom-out must not snap back to the initial/latest position.
- Traditional continuation 1×, reversal 2×, Percentage (LTP) minimum-tick rounding, projection semantics, and directional Close-source wicks remain covered by the TradingView public-contract gate.

## Same-SHA raw ATR validation checkpoint

Engine `1.2.0`, deep cache `2.2.0`, cache-busted production scripts, raw-Wilder browser assertions, and the anti-heartbeat layer are now in the same source tree. The ATR production workflow explicitly installs the same Playwright Chromium dependency used by the other real-browser gates before it executes the seven-value matrix. This checkpoint intentionally triggers all current Renko production gates together; it is not accepted as complete until the resulting exact-SHA production artifacts are downloaded and visually inspected.

## Pages deployment recovery checkpoint

GitHub Pages accepted the verified artifact for `cf0050cc8fd6b581c4253f4e6e69f3ce35bb8719`, but two `actions/deploy-pages@v4` attempts remained in the Pages backend until its 10-minute hard timeout and were canceled. Local browser validation on that source revision remained green. This documentation-only change intentionally creates a **new commit SHA / fresh Pages deployment ID** without altering the Renko runtime contract, so the exact same code behavior can be validated against a fresh deployment record. The new SHA is not accepted as final until all three production browser gates pass and the artifacts are visually inspected.

## Release rule

Do not call the fixed-1s-Close/raw-ATR/no-heartbeat matrix complete until all three current gates pass against the same exact deployed Pages SHA:

1. `RENKO TradingView Official Contract Gate`
2. `RENKO Ultra Fast UI Gate`
3. `RENKO ATR Zero Blocking Gate` for `1 / 10 / 100 / 1000 / 10000 / 100000 / 1000000`, including raw-Wilder box equality and the post-close live-persistence/no-heartbeat assertion.

After the gates pass, download and visually inspect all seven real browser screenshots, the post-close live-stability screenshot, desktop/mobile official screenshots, Ultra Fast screenshots, and the JSON reports. Append the final SHA/run IDs/results to this lock and to the existing project Google Doc. Do not generate or synthesize screenshot images.
