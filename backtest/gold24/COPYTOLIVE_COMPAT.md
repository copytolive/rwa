# GOLD24 CopyToLive-Compatible Backtest Mode

Status: **NEW DEFAULT RESEARCH PATH**

The legacy GOLD24 engine remains in `core.py` so historical Batch310/canonical
results can still be reproduced. New discovery should use
`copytolive_compat.py` + `copytolive_discovery.py`.

## Execution contract

- Initial deposit: **USD 10,000**
- Risk budget: **USD 200 per trade**
- SL distance: `entry_price * sl_pct`
- TP distance: `SL distance * tp_ratio`
- Position quantity: `risk_usd / SL distance`
- Stressed fee: **0.0016 × entry price × quantity**
- One open position at a time
- Signal entry uses the current close
- A newly opened position cannot exit on the same bar
- If SL and TP are both inside a later bar, **SL is evaluated first**
- Walk-forward reference split: **70/30 chronological**

These are the execution semantics screened from the CopyToLive production
research pipeline. Private production strategy source is **not copied** into
this public repository.

## Discovery gate

Current CopyToLive-compatible GOLD discovery keeps the stronger portfolio
validation layer:

- Total Entry >= 300
- PF >= 1.20
- Net Profit > 0
- EV/Trade > 0
- Max DD <= 25%
- OOS PF >= 1.00
- Positive Year >= 60%
- Global absolute Pearson(log-return equity) <= 0.50
- Monte Carlo evidence produced after correlation selection

## Files

- `backtest/gold24/copytolive_compat.py` — execution/metric contract
- `backtest/gold24/copytolive_discovery.py` — adaptive discovery
- `backtest/gold24/test_copytolive_compat.py` — parity tests
- `.github/workflows/gold24-copytolive-compatible.yml` — CI/discovery gate
- `backtest/gold24/runtime_copytolive_compat/` — published run evidence

## Data note

The automatic GitHub workflow currently reuses the existing audited canonical
GOLD D1 artifact to prove the engine and discovery pipeline end-to-end.

The CopyToLive production server also has native GOLD H1/H4 datasets. Those
datasets are not copied into this public repository. H1/H4 runs are supported
by the engine when an audited H1/H4 dataset and receipt are supplied.

This separation prevents private production strategy/data assets from being
silently published while still making GitHub's backtest execution model match
CopyToLive.
