# Native MT5 GitHub Actions Smoke Test

Public, non-sensitive infrastructure proof only. It uses a synthetic EURUSD-like custom symbol and two deterministic pending-order trades. No production strategy, broker credentials, or private market data is included.

Pass condition: official MT5 installs on `windows-latest`, MQL5 compiles with zero errors, custom Bid/Ask ticks are imported, Strategy Tester runs with `Model=4`, and native MT5 trade ledger matches the independent Python reference at exactly 100%.

A PASS proves GitHub-hosted native MT5 execution and same-dataset parity plumbing. It does not certify live-broker fills or any profitable strategy.
