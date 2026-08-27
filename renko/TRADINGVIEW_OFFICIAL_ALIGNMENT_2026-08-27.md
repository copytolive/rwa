# TradingView Official Renko Alignment Audit — 2026-08-27

Official references checked:
- https://www.tradingview.com/support/solutions/43000502284-understanding-renko-charts/
- https://www.tradingview.com/support/solutions/43000480330-the-renko-chart-shows-incorrect-values-and-or-is-constantly-being-recalculated/
- https://www.tradingview.com/support/solutions/43000481040-what-do-renko-wicks-mean/
- https://www.tradingview.com/pine-script-docs/concepts/non-standard-charts-data/

## Aligned behavior retained
- Traditional uses a fixed user-defined absolute box.
- Same-direction continuation uses one box.
- Direction reversal requires a two-box move.
- One source event may form multiple valid bricks when several thresholds are crossed.
- Renko body open/close levels are synthetic box levels.
- Wicks retain excursions beyond body levels that were insufficient to form the opposite brick; high wicks belong to down bricks and low wicks to up bricks.
- Percentage (LTP) now calculates `LTP × percentage`, rounds only to the nearest exchange minimum tick, and uses that box consistently across the rebuild. No extra significant-digit rounding is applied.

## Deliberate product-contract differences from TradingView
This application remains the V15 tick-native product defined by the RENKO handoff. Therefore it intentionally does **not** claim exact TradingView historical-output identity:
- TradingView historical Renko approximates tick Renko from the chart timeframe's Close or OHLC bars and may use higher timeframes for deeper history.
- TradingView real-time projection bricks can repaint until the source chart interval closes.
- TradingView ATR derives its Renko brick size from ATR on the regular candlestick chart.
- TradingView exposes Source = Close/OHLC and a chart timeframe.
- V15 instead uses Binance trade events directly, confirms threshold crossings immediately, has no timeframe/candle-close lock, and uses a tick-derived ATR sizing contract.

Exact TradingView output identity and the V15 tick-native/no-timeframe contract are mutually incompatible. The automated browser gate therefore validates the V15 product contract plus the TradingView-compatible geometry/settings that do not conflict with it.
