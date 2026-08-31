# VectorForge Chat Control

This folder makes GitHub the execution plane for chat-driven historical backtests.

## Flow

1. A chat instruction is converted into a JSON request in `requests/`.
2. `.github/workflows/vectorforge-chat.yml` detects the request.
3. GitHub Actions fetches historical tick/event data from the configured provider.
4. `run_chat_job.py` runs the historical simulation.
5. The result is committed to `results/<request_id>.json` with dataset SHA-256 and evaluation ID.
6. Chat can read the result and present a concise report.

## Supported assets

See `../data/assets.json`. Initial catalog includes major FX pairs, XAUUSD, BTCUSD, BTCUSDT and ETHUSDT.

Dukascopy-backed assets use historical bid/ask quote ticks. Binance-backed assets use official aggregate-trade archives with a configurable simulated spread.

## Request example

```json
{
  "request_id": "example-eurusd",
  "asset": "EURUSD",
  "start": "2024-01-02",
  "end": "2024-01-03",
  "strategy": "sma_cross",
  "trade_side": "both",
  "fast": 50,
  "slow": 1000,
  "stop_points": 15,
  "rr": 2,
  "spread_points": 1,
  "slippage_points": 0,
  "cost_r": 0
}
```

`end` is exclusive. Historical simulation only; this workflow does not place broker/exchange orders.
