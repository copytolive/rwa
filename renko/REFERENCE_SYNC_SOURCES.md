# External RENKO reference sources

Reviewed for architecture on 2026-09-02:

- Abhi-AlgoForge/renko-charts — deterministic append-only Renko and dense display-time concepts. No repository license declared when reviewed; architecture reference only.
- tejred213/StockGenius — pure/cached Renko derivation and chart-selector separation. No repository license declared when reviewed; architecture reference only.
- 123DS9472396/FinPulse-AI — chart-controller and chart-type selector patterns. MIT licensed.
- Soham-Moholkar/NSE-TradeHub-Pro — clean/sorted source and simple dense synthetic Renko chronology. No repository license declared when reviewed; architecture reference only.
- ranjithprabhuk/wealth-wings — incremental websocket Renko pattern. No repository license declared when reviewed; architecture reference only; external websocket feed is not enabled for canonical GOLD.

No third-party engine is used as the canonical source of truth. CopyToLive keeps its Dukascopy XAUUSD fixed-1s identity, deterministic engine, bounded history pipeline, geometry stitch, and certification contracts.
