# CopyToLive GOLD Backtest Parity

This directory contains a separate CopyToLive production-parity path. It does
not rewrite the legacy GOLD24 engine in-place.

Production execution contract mirrored here:

- initial deposit: USD 10,000
- fixed risk: USD 200 per trade
- entry: signal-bar close
- SL distance: entry x SL percent
- TP distance: SL distance x TP ratio
- position size: USD 200 / SL distance
- stress-padded round-trip fee: 0.0016 x entry x size
- one open position per strategy
- on an exit bar, SL is checked before TP
- no forced close at end-of-data
- walk-forward split: 70/30

Production snapshot:
- active GOLD strategies: 118
- timeframe: 118/118 H1
- manifest: copytolive_active_gold_manifest.json
- exact source pack: copytolive_gold_strategy_sources.json
- engine: copytolive_parity_engine.py

Validation commands:

python backtest/gold24/test_copytolive_parity_engine.py

python backtest/gold24/copytolive_parity_engine.py --contract-only

For a supplied canonical H1 dataset:

python backtest/gold24/copytolive_parity_engine.py --ohlcv /path/to/GOLD_H1.parquet --out /tmp/copytolive-gold-parity.json

The optional --fetch-production mode uses the public CopyToLive market-data API
for a current-data check. Frozen OHLCV artifacts remain preferable for
reproducible certification.

Legacy GOLD24 correlation, Monte Carlo and MT5 gates should be applied after
execution/signal parity is established; they must not silently alter this
CopyToLive execution model.
