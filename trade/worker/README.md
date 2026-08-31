# 24/7 copy worker

GitHub Pages is intentionally static and cannot keep a copy-trading process alive when the browser is closed.

For production 24/7 copy trading, run a separate audited worker that:

- stores only a delegated API-wallet key, never the master private key;
- verifies the agent against Hyperliquid before every risk-increasing action;
- uses deterministic client order IDs / idempotency;
- enforces the same or stricter exposure, leverage and daily-loss limits as the browser;
- supports an immediate kill switch;
- revokes the delegated agent when copy trading is stopped;
- is testnet-only until a venue-backed E2E test passes.

This GitHub Pages package does not pretend that a browser tab is a 24/7 worker.
