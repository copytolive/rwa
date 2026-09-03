# GOLD24 CopyToLive Exact Backtest Mode

Status: **DEFAULT GOLD RESEARCH PATH**

The GitHub GOLD backtest now follows the current CopyToLive production model.
The legacy `core.py` / Batch310 fixed-dollar engine is retained only for
historical reproducibility and comparison.

## Authoritative CopyToLive baseline

Current checked-in production snapshot:

- Active GOLD strategies used by Home: **118**
- Timeframe: **118/118 H1**
- Farm SHA256: `2a954aea39e3c47a4ae56b1a26ce0ddfc6649440ce471dabab3429f881b51308`
- State SHA256: `5436ac0310c4ef015e5fddb48ff44e6f821b6470a7805bd43fc1a84a566b17fc`
- Production execution engine SHA256:
  `4e6e1d0b1015f994ce8666b04c4da0cbf67d718c913cdfe319db83c8ca4bf13a`

GitHub keeps:

- `copytolive_active_gold_manifest.json` — 118 strategy configurations and expected production metrics.
- `copytolive_gold_strategy_sources.json` — checksum-locked exact strategy source pack.
- `copytolive_active_replay.py` — exact 118-strategy replay + GitHub validation.
- `copytolive_compat.py` — production execution contract.
- `fetch_copytolive_gold_h1.cjs` — GitHub-hosted Dukascopy XAUUSD H1 data fetch.
- `.github/workflows/gold24-copytolive-compatible.yml` — default end-to-end workflow.

## Exact execution contract

- Initial deposit: **USD 10,000**
- Risk budget: **USD 200 per trade**
- Entry: current signal-bar close
- SL distance: `entry_price * sl_pct`
- TP distance: `SL distance * tp_ratio`
- Position size: `risk_usd / SL distance`
- Stressed fee: **0.0016 × entry price × quantity**
- One position at a time per strategy
- No entry-and-exit on the newly opened bar
- If SL and TP are both touched on a later bar: **SL first**
- Walk-forward split: **70/30 chronological**
- Open position at end of history is discarded, matching production behavior

This replaces the legacy GOLD24 fixed USD 5–25 SL/TP model for new GOLD
research.

## GitHub validation added after parity replay

The CopyToLive execution logic is not weakened. GitHub adds portfolio gates:

1. Total Entry >= 300
2. Net Profit >= USD 20,000
3. PF >= 1.20
4. EV/Trade > 0
5. Max DD <= 25%
6. OOS PF >= 1.00
7. Positive Year >= 60%
8. Global absolute Pearson(log-return equity) <= 0.50
9. Monte Carlo probability of positive terminal PnL >= 95%

Correlation is calculated globally on the replayed H1 equity series and
quality-ordered greedy selection removes the lower-ranked conflicting
strategy.

## GitHub compute only

The default workflow runs on **GitHub-hosted Ubuntu**, not the user's MacBook.
XAUUSD M1 is fetched directly on the hosted runner, then resampled exactly like production, through
`dukascopy-node@1.50.0` and cached between runs.

Default data window:

- Start: `2003-05-05`
- End exclusive: `2026-05-01`
- Provider instrument: `xauusd`
- Timeframe: `h1`
- Price side: `bid`

Each successful run records the exact data SHA256 and period. The production
VPS H1 parquet is not silently assumed to be byte-identical to the GitHub
Dukascopy fetch, so the replay report also records metric deltas versus the
captured CopyToLive production farm.

## Outputs

Successful runs publish:

- `backtest/gold24/runtime_copytolive_active/latest_copytolive_active_replay.json`
- `backtest/gold24/runtime_copytolive_active/latest_copytolive_active_replay.csv`
- `backtest/gold24/runtime_copytolive_active/latest_copytolive_active_replay_summary.json`

The CSV uses the requested 28-column reporting model:

`Metode → TF → Order → Direction → SL → TP → Total Entry → WR → PF Net →
Net Profit → EV/Trade → Avg Win/Loss → Max DD → Recovery Factor →
Max Consecutive Loss → SQN → OOS PF → Monte Carlo Pass → MC 95% DD →
Positive Year → Worst Year → Periode Backtest → History → Sample v11 →
Corr Max → Corr Gate → Python Script → MT5 Script`

## Legacy paths

- `copytolive_discovery.py` remains available for experimental discovery of
  new signal candidates, but it is not the authoritative 118-strategy parity
  replay.
- `core.py` and Batch310 remain frozen legacy evidence.
- D1 random discovery must not be described as CopyToLive active-strategy
  parity.
