from __future__ import annotations

import unittest
import numpy as np
import pandas as pd

from copytolive_unified_engine import (
    ENGINE_ID,
    CopyToLiveExecutionConfig,
    apply_production_filter,
    compute_mtf_bias,
    compute_session_mask,
    run_copytolive_backtest,
)


class UnifiedEngineTests(unittest.TestCase):
    def test_engine_id_locked(self):
        self.assertEqual(ENGINE_ID, "copytolive-unified-backtest-v1")

    def test_session_mask_uses_direct_hour_7_to_21(self):
        idx = pd.date_range("2026-01-01", periods=24, freq="h", tz="UTC")
        d = pd.DataFrame(
            {"open": 100.0, "high": 101.0, "low": 99.0, "close": 100.0},
            index=idx,
        )
        m = compute_session_mask(d)
        self.assertEqual(int(m.sum()), 15)
        self.assertFalse(bool(m[6]))
        self.assertTrue(bool(m[7]))
        self.assertTrue(bool(m[21]))
        self.assertFalse(bool(m[22]))

    def test_mtf_bias_uses_integer_row_blocks(self):
        d1n = 240
        h1_per_d1 = 23
        n = d1n * h1_per_d1
        h1idx = pd.date_range("2020-01-01", periods=n, freq="h")
        h1 = pd.DataFrame(
            {"open": 100.0, "high": 101.0, "low": 99.0, "close": 100.0},
            index=h1idx,
        )
        d1idx = pd.date_range("2020-01-01", periods=d1n, freq="D")
        close = np.linspace(100.0, 300.0, d1n)
        d1 = pd.DataFrame(
            {"open": close, "high": close + 1, "low": close - 1, "close": close},
            index=d1idx,
        )
        b = compute_mtf_bias(h1, d1)
        self.assertTrue(np.all(b[: 200 * h1_per_d1] == 0))
        self.assertTrue(np.all(b[200 * h1_per_d1 : 201 * h1_per_d1] == 1))

    def test_mtf_filter_respects_signal_direction(self):
        d1n = 240
        h1_per_d1 = 23
        n = d1n * h1_per_d1
        h1idx = pd.date_range("2020-01-01", periods=n, freq="h")
        h1 = pd.DataFrame(
            {"open": 100.0, "high": 101.0, "low": 99.0, "close": 100.0},
            index=h1idx,
        )
        d1idx = pd.date_range("2020-01-01", periods=d1n, freq="D")
        close = np.linspace(100.0, 300.0, d1n)
        d1 = pd.DataFrame(
            {"open": close, "high": close + 1, "low": close - 1, "close": close},
            index=d1idx,
        )
        sig = np.ones(n, dtype=np.int8)
        sig[200 * h1_per_d1] = -1
        out = apply_production_filter(sig, h1, signal_type="MTF_TEST", d1=d1)
        self.assertEqual(int(out[200 * h1_per_d1]), 0)
        self.assertEqual(int(out[200 * h1_per_d1 + 1]), 1)

    def test_execution_contract_still_stop_first(self):
        idx = pd.date_range("2026-01-01", periods=2, freq="h", tz="UTC")
        d = pd.DataFrame(
            {
                "open": [100.0, 100.0],
                "high": [100.0, 103.0],
                "low": [100.0, 98.0],
                "close": [100.0, 100.0],
            },
            index=idx,
        )
        r = run_copytolive_backtest(
            d,
            np.array([1, 0], dtype=np.int8),
            CopyToLiveExecutionConfig(sl_pct=0.01, tp_ratio=2.0, fee=0.0),
        )
        self.assertEqual(r["engine_id"], ENGINE_ID)
        self.assertEqual(r["trades"][0]["exitType"], "SL")


if __name__ == "__main__":
    unittest.main(verbosity=2)
