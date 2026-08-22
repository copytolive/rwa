# VectorForge Historical Simulation Lab

Public URL (GitHub Pages):

`https://narzulalistiqlal.github.io/rwa/backtest/`

## What is included

- Browser-native historical simulation; no local IDE is required.
- EURUSD public 1-second quote data catalog from 2009-05 through 2018-07.
- 111 monthly source-file references in `data/manifest.json`.
- Streaming Web Worker engine so monthly data does not need to be committed into this repository.
- Models: Price/SMA cross, SMA fast/slow cross, EMA fast/slow cross, RSI mean reversion, Donchian breakout.
- Fixed exit-distance and target-ratio simulation with bid/ask handling when the source provides both columns.
- Results: net R, positive-event rate, gain/loss ratio, max drawdown in R, event count, events/week and evaluated samples.
- SHA-256 fingerprint for each interactive run.
- GitHub Actions batch evaluator with dataset SHA-256 and unique evaluation IDs.
- Campaign ledger in `results/campaign.json` with a 1,000,000,000,000-evaluation research target. Target and completed counts are intentionally separate.

## Data architecture

The large historical files are not copied into this repo. The page fetches them directly from:

`https://github.com/zcbmlijygrdwa/fx_EUR_USD_tick`

This avoids duplicating several gigabytes of public data inside a GitHub Pages repository and avoids GitHub single-file/repository-size problems. Every available monthly file is indexed in `data/manifest.json`.

The upstream README describes the data as EUR/USD sell/buy prices sampled once a second, five days per week. The verified available range used here ends at 2018-07; the application does not invent later files.

## Verified batch

`.github/workflows/vectorforge-batch.yml` runs `factory/run_batch.py` on GitHub-hosted compute. The first batch evaluates SMA periods 50 through 1500 in steps of 25 against a selected source month. Each evaluation gets a deterministic SHA-256 ID based on dataset hash, month, model, parameters and engine version.

Outputs:

- `results/latest_batch.json`
- `results/evaluation_ids.json`
- `results/campaign.json`

Re-running the same batch does not increase the unique verified count because identical evaluation IDs are deduplicated.

## Trillion-scale rule

`target_evaluations = 1,000,000,000,000` is a campaign objective, not a claim that one trillion evaluations have already completed. GitHub Pages is static hosting. Actual trillion-scale execution requires distributed runners/compute while preserving the same evaluation-ID and dataset-hash scheme.
