# CopyToLive GOLD Parity Backtest

This profile makes the GitHub-hosted GOLD backtest follow the currently active CopyToLive production strategy model instead of the older GOLD24 fixed-dollar pending-order model.

## Source authority

The checked-in snapshot is locked to the CopyToLive production sources captured on 2026-09-03:

- 118/118 active GOLD strategies used by Home.
- Production farm SHA256: `2a954aea39e3c47a4ae56b1a26ce0ddfc6649440ce471dabab3429f881b51308`.
- Production state SHA256: `5436ac0310c4ef015e5fddb48ff44e6f821b6470a7805bd43fc1a84a566b17fc`.
- Production engine `pipeline/wf_common.py` SHA256: `4e6e1d0b1015f994ce8666b04c4da0cbf67d718c913cdfe319db83c8ca4bf13a`.
- All 118 exact production Python strategy sources and their SHA256 values are embedded in `active_gold_snapshot.json`.

No strategy source is reconstructed from names or guessed.

## Production parity contract

The replay engine implements the CopyToLive execution contract:

- GOLD H1.
- Initial deposit USD 10,000.
- Risk USD 200 per trade.
- Entry on the signal-bar close.
- One position at a time per strategy.
- Stop distance = entry price × `SL_PCT`.
- Take-profit distance = stop distance × `TP_RATIO`.
- Position size = USD 200 / stop distance.
- Fee = 0.0016 × entry price × position size.
- If SL and TP are both touched in the same bar, SL wins (conservative).
- Walk-forward split = 70/30.
- Production strategy scripts are executed directly from the checksum-locked snapshot.

The GitHub profile intentionally does **not** use the legacy GOLD24 fixed USD 5–25 SL/TP model.

## GitHub-only strict validation

After CopyToLive-parity replay, GitHub adds validation rather than weakening production semantics:

1. Total Entry >= 300.
2. Net Profit >= USD 20,000.
3. PF >= 1.20.
4. Max DD <= 25%.
5. EV/Trade > 0.
6. OOS PF >= 1.00.
7. Positive Year >= 60%.
8. Monte Carlo positive terminal probability >= 95%.
9. Monte Carlo 95th-percentile Max DD <= 25%.
10. Global absolute Pearson correlation of log-return equity <= 0.50 using quality-ordered greedy selection.

CopyToLive production currently does not expose numerical Corr Max, Monte Carlo, or MT5 evidence for these 118 strategies. Those fields are therefore computed/added by GitHub where possible; they are not silently copied or invented.

## Data

GitHub Actions fetches XAUUSD H1 bid OHLC from Dukascopy with `dukascopy-node@1.50.0`. The data is cached on GitHub-hosted runners and is never delegated to the user's MacBook.

Default replay window:

- from: 2003-05-05
- to (exclusive): 2026-08-28

Every completed run records its dataset SHA256, row count, start/end timestamps, strategy source hashes, and replay outputs.

The production VPS H1 parquet is not checked into this repository. Therefore exact metric parity with the production farm is an evidence target, not an assumption. Metric deltas against the captured production farm are emitted in the JSON output.

## Workflow

`.github/workflows/gold-copytolive-parity.yml`

Runs on `ubuntu-latest`, not a self-hosted Mac.

Outputs:

- `runtime/copytolive_gold_replay.json`
- `runtime/copytolive_gold_replay.csv`

The old `backtest/gold24` system remains as legacy evidence until this parity workflow has passed end-to-end; it should not be treated as the new CopyToLive execution model.
