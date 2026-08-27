# RENKO ATR Live-Chart Regression Lock

This file intentionally lives under `renko/**` so every change to this lock is covered by both the TradingView documented-contract gate and the Ultra Fast UI gate.

## ATR control contract

- `ATR LENGTH` is the real Wilder ATR look-back consumed by `RWARenkoTVEngine`.
- APPLY / Enter / committed input changes rebuild the actual chart state; changing only the label is a failure.
- Regression case `14 -> 140` must update `settings.atrLength` to `140` and the live `box`, `atr`, and confirmed-brick geometry must exactly match an independent `RWARenkoTVEngine.build(... atrLength: 140)` rebuild.
- Large ATR values load older available source candles progressively instead of silently clamping the requested length.
- The newest requested ATR length wins if an older history request is still in progress.

## Previously successful behavior that must not regress

- Full spot-pair universe stays lazy/worker-parsed/virtualized; the sidebar must not materialize every pair in the DOM or freeze the laptop.
- Manual chart zoom/pan remains locked while settings are applied; ATR/Traditional/Percentage APPLY must not snap the chart back to the initial/latest position.
- Only explicit LIVE/reset or an intentional symbol/source-interval context change may restore auto-follow.
- Main-thread long-task/blocking regressions remain gated by `RENKO Ultra Fast UI Gate`.
- TradingView public Renko contract (source Close/OHLC, source interval close confirmation, realtime projection, 1x continuation, 2x reversal, ATR/Traditional/Percentage, directional wicks) remains gated by `RENKO TradingView Official Contract Gate`.

## Release rule

Do not call this behavior production-complete unless BOTH gates pass against the same exact deployed Pages SHA:

1. `RENKO TradingView Official Contract Gate`
2. `RENKO Ultra Fast UI Gate`
