# RWA Renko V5 — raw-tick lifetime history policy

- Historical construction source: Binance Vision `spot/*/trades` raw individual trade archives only.
- Live continuation source: Binance Spot `@trade` individual trade stream only.
- Forbidden for Renko construction: candle, OHLC, kline, aggTrade, ATR-derived history, Hyperliquid H1 archive.
- Traditional fixed-box Renko: one-box continuation, two-box reversal.
- Universe: at least the top 500 eligible crypto markets by 24h USD-equivalent liquidity; all eligible markets searchable.
- Full-history semantics: for a selected market, history coverage is reported from the oldest raw trade archive actually available through the latest live raw trade. The UI must expose coverage/progress and must not claim COMPLETE until all archive segments for that market have been processed successfully.
- Storage/performance: archive segments are processed incrementally and persisted locally; raw tick files are not committed to this GitHub repository.
- Trading fills remain venue-backed; synthetic Renko brick prices are never used as execution receipts.
