#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import json

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("ctl_parity", HERE / "copytolive_parity_engine.py")
mod = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(mod)


def test_contract_files():
    manifest = mod.load_manifest(HERE / "copytolive_active_gold_manifest.json")
    pack = mod.load_source_pack(HERE / "copytolive_gold_strategy_sources.json")
    result = mod.contract_check(manifest, pack)
    assert result["status"] == "PASS", result
    assert result["manifest_count"] == 118
    assert result["source_count"] == 118
    assert {x["timeframe"] for x in manifest["strategies"]} == {"H1"}
    assert {x["symbol"] for x in manifest["strategies"]} == {"GOLD"}


def test_long_same_bar_sl_priority():
    df = pd.DataFrame(
        {
            "open": [100, 100, 100],
            "high": [100, 103, 100],
            "low": [100, 98, 100],
            "close": [100, 100, 100],
            "volume": [1, 1, 1],
        },
        index=pd.date_range("2026-01-01", periods=3, freq="h", tz="UTC"),
    )
    trades, pnl = mod.backtest_signals(np.array([1, 0, 0], dtype=np.int8), df, 0.01, 2.0)
    assert len(trades) == 1
    t = trades[0]
    assert t["exitType"] == "SL"
    assert t["profit"] == -232.0, t
    assert t["lots"] == 200.0
    assert round(float(pnl.sum()), 2) == -232.0


def test_short_take_profit_and_position_size():
    df = pd.DataFrame(
        {
            "open": [200, 200, 200],
            "high": [200, 200.5, 200],
            "low": [200, 195, 200],
            "close": [200, 200, 200],
            "volume": [1, 1, 1],
        },
        index=pd.date_range("2026-01-01", periods=3, freq="h", tz="UTC"),
    )
    trades, _ = mod.backtest_signals(np.array([-1, 0, 0], dtype=np.int8), df, 0.01, 2.0)
    assert len(trades) == 1
    t = trades[0]
    assert t["exitType"] == "TP"
    assert t["lots"] == 100.0
    assert t["profit"] == 368.0, t


def test_no_same_bar_exit_on_entry_bar():
    df = pd.DataFrame(
        {
            "open": [100, 100],
            "high": [110, 100],
            "low": [90, 100],
            "close": [100, 100],
            "volume": [1, 1],
        },
        index=pd.date_range("2026-01-01", periods=2, freq="h", tz="UTC"),
    )
    trades, _ = mod.backtest_signals(np.array([1, 0], dtype=np.int8), df, 0.01, 2.0)
    assert trades == []


def main():
    tests = [
        test_contract_files,
        test_long_same_bar_sl_priority,
        test_short_take_profit_and_position_size,
        test_no_same_bar_exit_on_entry_bar,
    ]
    for fn in tests:
        fn()
        print("PASS", fn.__name__)
    print(json.dumps({"status": "PASS", "tests": len(tests), "engine": "copytolive-production-parity"}))


if __name__ == "__main__":
    main()
