# TradingView Official Renko Alignment Audit — 2026-08-27

Official TradingView references checked:
- https://www.tradingview.com/support/solutions/43000502284-understanding-renko-charts/
- https://www.tradingview.com/support/solutions/43000480330-the-renko-chart-shows-incorrect-values-and-or-is-constantly-being-recalculated/
- https://www.tradingview.com/support/solutions/43000481040-what-do-renko-wicks-mean/
- https://www.tradingview.com/blog/en/renko-charts-based-on-ohlc-17013/
- https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.ChartPropertiesOverrides/

## Audit finding

The previous V15 production implementation was **not** TradingView Renko parity. It was deliberately tick-native: no source timeframe, direct trade-event formation, immediate trade confirmation, and tick-derived ATR. TradingView's official documentation instead states that historical Renko uses the chart resolution's Close or OHLC data, confirmed bricks are locked when that source interval closes, and realtime movement is represented by provisional projection bricks. The production `/renko/` implementation has therefore been replaced with a source-interval model rather than continuing to label the old tick-native contract as parity.

## TradingView documented behavior now implemented

- Source selector: **Close** or **OHLC**.
- Source interval selector: 1 second, 1/3/5/15/30 minutes, 1 hour, 4 hours, or 1 day for the Binance implementation.
- Historical input is regular source-interval OHLC/Close data from Binance klines, not aggregate trades.
- Confirmed Renko history changes only from closed source-interval bars.
- The still-open source interval generates a separate **projection** Renko series; it may change or disappear before the interval closes.
- **Traditional** uses the user-defined absolute box size.
- Same-direction continuation requires **1× box**.
- Reversal requires a **2× box** movement and the reversal brick opens one box back from the prior close so corners touch.
- **Percentage (LTP)** uses the most recent closed source price × percentage, rounds to the nearest exchange minimum tick, and applies the resulting box consistently across the rebuild.
- **ATR** uses Wilder ATR calculated from ordinary source-interval OHLC candles; default ATR length is 14.
- Wicks are enabled by default. With Source=Close, discarded close extrema feed wick values. With Source=OHLC, actual High/Low extrema are used. High wicks are constrained to down bricks and low wicks to up bricks.
- Confirmed colors use TradingView defaults `#089981` / `#F23645`; projection colors use `#a9dcc3` / `#f5a6ae`.
- Renko body prices remain synthetic box-grid levels; the UI keeps a separate real-market price reference.
- Older same-interval Binance bars load progressively as the user pans left. TradingView may substitute higher intervals when its own lower-timeframe history ends; Binance's retained history differs by market/provider, so the exact historical boundary need not coincide with TradingView's data boundary.

## Automated validation

`tools/renko-tradingview-official-report.mjs` validates the deployed page in Chromium at desktop (1900×1000) and mobile (390×844). It checks:

- source and interval controls;
- all ATR / Traditional / Percentage (LTP) methods;
- Traditional 1× continuation and 2× reversal matrix;
- Percentage latest-close × percent → minimum-tick formula;
- Wilder ATR calculation;
- projection bricks appearing and disappearing without mutating confirmed history;
- Close-source wick ON/OFF behavior;
- OHLC source path availability;
- removal of old `every trade locks` / `no timeframe` production claims;
- no desktop/mobile instrument-stat overlap;
- live UI mutations across Close/OHLC and all three methods;
- exact deployed Git SHA before the production browser run.

The GitHub Pages workflow blocks deployment if either the unit matrix or desktop/mobile browser report fails.

## Exact-output boundary

Status terminology is intentionally precise:

- **TradingView public-documentation contract parity:** target and automated gate.
- **Byte-for-byte / brick-for-brick proprietary TradingView identity:** not claimed.

TradingView publicly describes the Close/OHLC inputs, projection lifecycle, box methods, wick semantics, and deep-history fallback policy, but it does not publish every internal historical OHLC traversal/anchoring implementation detail or its private data-retention boundary. `renko-tv-engine.js` therefore marks the implementation as `tradingview-public-documentation-compatible` and the runtime explicitly records `exactProprietaryOutputParity:false` instead of presenting an unverifiable 100% proprietary-output claim.
