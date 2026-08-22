# VectorForge Backtest Lab

Public GitHub Pages research lab for browser-native backtesting without VS Code.

## Live path

`https://narzulalistiqlal.github.io/rwa/backtest/`

## Included

- Browser Web Worker engine that streams large tick files instead of loading the full archive into page memory.
- Remote EURUSD one-second selector plus local TXT/CSV upload.
- SMA Cross, EMA Cross, RSI mean reversion, rolling breakout and Bollinger mean reversion.
- Spread, slippage, commission, stop-loss and risk:reward controls.
- Equity curve, win rate, profit factor, drawdown, expectancy, trades/month and per-trade evidence.
- Deterministic SHA-256 run fingerprint.
- JSON and CSV export.
- GitHub Actions batch workflow for parameter sweeps.
- Tick-catalog workflow that inventories every `_converted.txt` upstream file without duplicating the archive.

## Data policy

The integrated source is `zcbmlijygrdwa/fx_EUR_USD_tick`. Its README states EUR/USD sell/buy prices are sampled once per second and measurement begins in May 2009. No explicit license file was detected during integration, so this repository does **not republish the third-party archive**. The UI streams source files from the original repository. Users can also upload data they have rights to use.

## Integrity

A large evaluation counter is never incremented just for display. Batch records include engine version, configuration, data descriptor and a run hash. Any future “1 trillion backtests” claim must be derived from stored unique evaluation records/manifests, not a hard-coded number.

## Limitation

VectorForge is a research simulator. VF-1.0.0 does not claim MT5-identical fills; swap, latency, queue position, partial fills and order-book depth are not modeled.
