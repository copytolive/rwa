from __future__ import annotations

import importlib.util
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("copytolive_gold_engine", HERE / "engine.py")
engine = importlib.util.module_from_spec(spec)
assert spec and spec.loader
import sys
sys.modules[spec.name] = engine
spec.loader.exec_module(engine)


def frame(high2: float, low2: float) -> pd.DataFrame:
    idx = pd.date_range("2026-01-01", periods=3, freq="h", tz="UTC")
    return pd.DataFrame(
        {
            "open": [100.0, 100.0, 100.0],
            "high": [100.0, high2, 100.0],
            "low": [100.0, low2, 100.0],
            "close": [100.0, 100.0, 100.0],
            "volume": [1.0, 1.0, 1.0],
        },
        index=idx,
    )


def test_copytolive_loss_contract():
    sig = np.array([1, 0, 0], dtype=np.int8)
    trades, _ = engine.bt_copytolive(sig, frame(101.0, 97.0), sl_pct=0.02, tp_ratio=2.5)
    assert len(trades) == 1
    t = trades[0]
    # entry=100; SL distance=2; lot=200/2=100; fee=.0016*100*100=16.
    assert abs(t["lots"] - 100.0) < 1e-12
    assert t["exitType"] == "SL"
    assert abs(t["profit"] - (-216.0)) < 1e-9


def test_copytolive_take_profit_contract():
    sig = np.array([1, 0, 0], dtype=np.int8)
    trades, _ = engine.bt_copytolive(sig, frame(106.0, 99.0), sl_pct=0.02, tp_ratio=2.5)
    assert len(trades) == 1
    t = trades[0]
    # TP distance=2*2.5=5; gross=500; fee=16.
    assert t["exitType"] == "TP"
    assert abs(t["profit"] - 484.0) < 1e-9


def test_same_bar_is_conservative_sl_first():
    sig = np.array([1, 0, 0], dtype=np.int8)
    trades, _ = engine.bt_copytolive(sig, frame(106.0, 97.0), sl_pct=0.02, tp_ratio=2.5)
    assert len(trades) == 1
    assert trades[0]["exitType"] == "SL"
    assert abs(trades[0]["profit"] - (-216.0)) < 1e-9


def test_identical_equity_correlation_is_one():
    a = np.zeros(1000)
    a[100] = 10.0
    a[500] = -5.0
    a[900] = 20.0
    assert abs(engine.abs_pearson(a, a) - 1.0) < 1e-12


def test_snapshot_is_exact_118_and_checksum_locked():
    snap = engine.load_snapshot(HERE / "active_gold_snapshot.json")
    assert snap["contract"]["active_gold_count"] == 118
    assert len(snap["strategies"]) == 118
    ids = {x["id"] for x in snap["strategies"]}
    assert len(ids) == 118
    for x in snap["strategies"]:
        assert x["symbol"] == "GOLD"
        assert x["timeframe"] == "H1"
        assert x["homeUniverse"] is True
        assert "content_b64" in x["script"]
        assert len(x["script"]["sha256"]) == 64


def test_snapshot_scripts_expose_copytolive_risk_contract():
    snap = engine.load_snapshot(HERE / "active_gold_snapshot.json")
    import base64
    for x in snap["strategies"]:
        src = base64.b64decode(x["script"]["content_b64"]).decode("utf-8")
        assert "SL_PCT" in src
        assert "TP_RATIO" in src
        assert "RISK=200.0" in src or "RISK = 200.0" in src
        assert "DEPOSIT=10000" in src or "DEPOSIT = 10000" in src
        assert "def run(" in src


if __name__ == "__main__":
    tests = [
        test_copytolive_loss_contract,
        test_copytolive_take_profit_contract,
        test_same_bar_is_conservative_sl_first,
        test_identical_equity_correlation_is_one,
        test_snapshot_is_exact_118_and_checksum_locked,
        test_snapshot_scripts_expose_copytolive_risk_contract,
    ]
    for t in tests:
        t()
        print("PASS", t.__name__)
