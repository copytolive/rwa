from __future__ import annotations

import json
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd

from core import Candidate, backtest_candidate, novelty_pass
from store import Store
from worker import load_bar_pnl


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

    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        shard = td / "shared.parquet"
        rows = list(r["ledger"])
        # Add a second config into the same shard with deliberately different PnL.
        second_hash = "f" * 64
        second_rows = []
        for x in r["ledger"]:
            y = dict(x)
            y["config_hash"] = second_hash
            y["net_pnl"] = float(y["net_pnl"]) * 2.0
            second_rows.append(y)
        pd.DataFrame(rows + second_rows).to_parquet(shard, index=False)
        a = load_bar_pnl(str(shard), c.config_hash, n)
        b = load_bar_pnl(str(shard), second_hash, n)
        assert not np.array_equal(a, b), "correlation reconstruction must isolate config_hash inside shared shards"

        db = Store(td / "test.db")
        db.insert_result(r, str(shard), counted=False)
        assert db.exact_execution_duplicate(r), "same execution hash must be confirmed by exact ledger equality"

        duplicate = dict(r)
        duplicate["config_hash"] = second_hash
        duplicate["candidate"] = dict(r["candidate"])
        duplicate["candidate"]["p1"] = 1.5
        duplicate["ledger"] = [dict(x, config_hash=second_hash) for x in r["ledger"]]
        # Duplicate evidence must be archivable; no UNIQUE execution-hash DB constraint is allowed.
        db.insert_result(duplicate, str(shard), counted=False)
        assert db.execution_seen(r["execution_hash"])
        db.set_state("candidate_cursor", 12345)
        assert db.get_state("candidate_cursor") == 12345
        snap = db.snapshot(td / "snapshot.db")
        assert snap.exists() and snap.stat().st_size > 0
        db.close()

    print(json.dumps({
        "selftest": "PASS",
        "trades": r["metrics"].get("trades", 0),
        "execution_hash": r["execution_hash"],
        "locks": ["pending", "flat_lot", "fixed_sl_tp", "20_30_novelty", "ledger_isolation", "exact_duplicate_archive", "restart_cursor"],
    }))


if __name__ == "__main__":
    run_selftest()
