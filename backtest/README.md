# VectorForge Historical Simulation Lab

Public GitHub Pages URL:

`https://narzulalistiqlal.github.io/rwa/backtest/`

VectorForge is a browser-native historical market research and simulation lab. It does not require Visual Studio Code or a locally running server.

## Interactive browser engine

The page currently supports:

- Public EURUSD 1-second source catalog: 2009-05 through 2018-07.
- 111 monthly source-file references, all indexed in `data/manifest.json`.
- Local custom TXT / CSV / TSV upload without uploading the file to the repository.
- Configurable 1-based Bid column and optional Ask column for custom files.
- Configurable sample interval and point size.
- Models:
  - Price / SMA cross
  - SMA fast / slow cross
  - EMA fast / slow cross
  - RSI mean reversion
  - Donchian breakout
- Direction filters: long + short, long only, short only.
- Stop distance and target ratio.
- Bid / ask handling with fallback spread.
- Slippage per side.
- Round-trip cost in R.
- Results including net R, positive-outcome rate, gain/loss ratio, drawdown, expectancy, frequency, loss streak, long/short counts, signals and sample count.
- SHA-256 fingerprint for every interactive run.
- JSON export for the latest interactive result.
- Responsive desktop/mobile interface.

## Tick-data architecture

The multi-gigabyte monthly raw files are deliberately not duplicated into this GitHub Pages repository. Instead, every verified available source file is indexed and the browser streams the selected raw files directly from:

`https://github.com/zcbmlijygrdwa/fx_EUR_USD_tick`

This gives the site access to the complete verified upstream file set without bloating the Pages repository or violating GitHub single-file/repository-size limits.

The upstream README describes the dataset as EUR/USD sell/buy prices sampled once per second, five days per week. The verified upstream coverage used by VectorForge is May 2009 through July 2018. VectorForge does not invent later files.

For another instrument or a different tick format, choose **Custom tick/quote TXT or CSV** in the page and set Bid/Ask columns, point size and sample interval.

## Verified GitHub batch factory

`.github/workflows/vectorforge-batch.yml` runs `factory/run_batch.py` on GitHub-hosted compute. The verified baseline factory currently evaluates SMA periods 50 through 1500 in steps of 25 against one source month at a time.

Each verified factory evaluation receives a deterministic ID based on:

`SHA256(dataset hash + month + model + parameters + engine version)`

Persistent outputs:

- `results/latest_batch.json` — full latest verified batch.
- `results/evaluation_ids.json` — unique evaluation-ID ledger.
- `results/batches.json` — append-only batch/source history.
- `results/campaign.json` — campaign totals, source coverage and latest batch status.

Duplicate evaluation IDs do not increase the verified count.

## Automatic source campaign

The workflow can be started manually with a specific `YYYY-MM` source month or with `auto`.

`auto` selects the next source month that has not yet been processed. The scheduled campaign runs every 6 hours and can process up to four sequential source months per scheduled workflow run. All changes are committed back to the repository by `vectorforge-bot`.

The GitHub Pages dashboard reads the campaign ledger and shows:

- target evaluations,
- verified completed evaluations,
- processed source-month coverage,
- verified source samples,
- latest batch,
- latest dataset SHA-256,
- latest verified batch research table.

## Deployment QA

`.github/workflows/pages.yml` checks the RWA site and VectorForge before deployment. VectorForge QA includes JavaScript syntax, required production files, JSON integrity, the exact 111-file source catalog, unique source months, source coverage boundaries, and consistency between `verified_completed` and the unique evaluation-ID ledger.

## One-trillion rule

`target_evaluations = 1,000,000,000,000` is a research campaign objective. It is **not** presented as completed until that many unique evaluation hashes have actually been computed and persisted.

GitHub Pages itself is static hosting. Free GitHub-hosted Actions are appropriate for control, verification and bounded batches, but a genuine one-trillion full-history campaign requires distributed compute/self-hosted runners while preserving the same dataset hashes, evaluation IDs and audit ledger.
