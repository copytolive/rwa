# Native MT5 GitHub-Only Certification

This is the public/free execution lane for the Backtest Factory. It is intentionally isolated from the private `opentrue-platform` production repository.

## What stays public

- workflow and runner scripts
- MQL5 certification harness
- deterministic synthetic/custom-symbol datasets used for infrastructure tests
- compact non-sensitive results, hashes, compiler status, and parity evidence

Never commit broker/demo passwords, API keys, private datasets, or production secrets.

## GitHub Actions cost model

The workflow uses a standard GitHub-hosted Windows runner (`windows-2022`) in this public repository. Raw/large datasets should be downloaded/generated during the job and discarded afterwards. Only compact evidence should be committed. Artifacts are short-lived so the project does not depend on paid storage.

## One-time MT5 prerequisite

Native MetaTrader 5 Strategy Tester requires a valid account context even when testing a local custom symbol. Use a **demo account only** for this CI lane; no real money account is needed.

Add these values under repository **Settings -> Secrets and variables -> Actions -> New repository secret**:

- `MT5_LOGIN` — demo account number
- `MT5_PASSWORD` — demo account password
- `MT5_SERVER` — exact demo server name, e.g. `MetaQuotes-Demo` when applicable

The workflow injects them only as GitHub Actions secrets. `tester.ini` containing credentials is ephemeral and is never uploaded or committed. Public diagnostics redact the login/password.

## Certification gates

A smoke run is PASS only when all are true:

1. official MT5 installs on GitHub-hosted Windows;
2. both MQL5 programs compile with zero errors;
3. the frozen Bid/Ask tick tape is loaded;
4. deterministic M1 OHLC history is built from the same tick tape;
5. Strategy Tester runs with `Model=4` (real ticks);
6. MT5 emits its native deal ledger;
7. the native ledger matches the independent Python reference trade-by-trade;
8. `parity_pct == 100.0` exactly.

Anything less is `NOT FINAL`.

## Accuracy boundary

A 100% result certifies same-dataset parity between the independent reference and native MT5 for the frozen test rules. It does **not** promise identical live broker fills because live spread, latency, slippage, rejects, liquidity, symbol specifications, commission, and swap can differ.

The synthetic smoke test validates infrastructure only. Production strategies still need the full strict strategy gates (full +2R wins, >=60% win rate, >=2 fills/week, >=15 years where data exists, no lookahead, OOS/stress, and final native parity) before promotion.
