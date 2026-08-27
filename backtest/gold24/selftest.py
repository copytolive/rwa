from __future__ import annotations

import json
import numpy as np
import pandas as pd

from core import Candidate, backtest_candidate, novelty_pass


def run_selftest():
    # Synthetic data is TEST_ONLY and never eligible for production counters.
    n = 1200
    dates = pd.date_range("2022-01-01", periods=n, freq="D", tz="UTC")
    base = 1800 + np.linspace(0, 300, n) + 20 * np.sin(np.arange(n) / 7)
    d = pd.DataFrame({
        "Date": dates,
        "Open": base,
        "High": base + 7,
        "Low": base - 7,
        "Close": base + np.sin(np.arange(n)) * 3,
        "Volume": np.full(n, 1000.0),
    })
    c = Candidate("GOLD", "D1", "ATR_BREAKOUT", 14, 55, 1.2, 55, 1, "STOP", "BOTH", 10, 20, 2, 3)
    r = backtest_candidate(d, c, flat_lot=1.0)
    assert all(x["pending_order"] in {"buy_stop", "sell_stop"} for x in r["ledger"])
    assert all(x["quantity"] == 1.0 for x in r["ledger"])
    assert all(x["fixed_sl"] == 10 and x["fixed_tp"] == 20 for x in r["ledger"])
    near = Candidate("GOLD", "D1", "ATR_BREAKOUT", 14, 55, 1.2, 55, 1, "LIMIT", "SHORT_ONLY", 10.5, 20, 4, 8)
    assert not novelty_pass(near, c), "entry/direction/offset/expiry alone must not establish novelty"
    far = Candidate("GOLD", "D1", "ATR_BREAKOUT", 14, 55, 1.5, 55, 1, "LIMIT", "SHORT_ONLY", 10.5, 20, 4, 8)
    assert novelty_pass(far, c)
    print(json.dumps({"selftest":"PASS", "trades":r["metrics"].get("trades", 0), "execution_hash":r["execution_hash"]}))

if __name__ == "__main__":
    run_selftest()
