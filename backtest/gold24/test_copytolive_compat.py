from __future__ import annotations

import math
import unittest

import numpy as np
import pandas as pd

from copytolive_compat import (
    COPYTOLIVE_DEPOSIT_USD,
    COPYTOLIVE_RISK_USD,
    COPYTOLIVE_STRESSED_FEE,
    CopyToLiveExecutionConfig,
    compute_copytolive_metrics,
    execution_digest,
    run_copytolive_backtest,
)


def frame(close, high=None, low=None):
    close=np.asarray(close,dtype=float)
    if high is None: high=close.copy()
    if low is None: low=close.copy()
    idx=pd.date_range("2025-01-01",periods=len(close),freq="h",tz="UTC")
    return pd.DataFrame({"open":close,"high":np.asarray(high,float),"low":np.asarray(low,float),"close":close},index=idx)


class CopyToLiveCompatTests(unittest.TestCase):
    def test_fixed_risk_and_tp_ratio(self):
        df=frame([100,100,100],high=[100,103,103],low=[100,99,99])
        sig=np.array([1,0,0],dtype=np.int8)
        cfg=CopyToLiveExecutionConfig(sl_pct=0.01,tp_ratio=2.0,fee=0.0)
        r=run_copytolive_backtest(df,sig,cfg)
        self.assertEqual(len(r["trades"]),1)
        t=r["trades"][0]
        self.assertAlmostEqual(t["slDistance"],1.0)
        self.assertAlmostEqual(t["tpDistance"],2.0)
        self.assertAlmostEqual(t["quantity"],200.0)
        self.assertAlmostEqual(t["grossProfit"],400.0)
        self.assertAlmostEqual(t["profit"],400.0)
        self.assertEqual(t["exitType"],"TP")

    def test_stop_first_when_same_bar_hits_both(self):
        df=frame([100,100],high=[100,103],low=[100,98])
        sig=np.array([1,0],dtype=np.int8)
        cfg=CopyToLiveExecutionConfig(sl_pct=0.01,tp_ratio=2.0,fee=0.0)
        r=run_copytolive_backtest(df,sig,cfg)
        self.assertEqual(len(r["trades"]),1)
        t=r["trades"][0]
        self.assertEqual(t["exitType"],"SL")
        self.assertAlmostEqual(t["grossProfit"],-COPYTOLIVE_RISK_USD)

    def test_no_same_bar_exit(self):
        df=frame([100,100],high=[103,100],low=[98,100])
        sig=np.array([1,0],dtype=np.int8)
        cfg=CopyToLiveExecutionConfig(sl_pct=0.01,tp_ratio=2.0,fee=0.0)
        r=run_copytolive_backtest(df,sig,cfg)
        self.assertEqual(r["trades"],[])
        self.assertIsNotNone(r["open_position_at_end"])

    def test_fee_matches_production_contract(self):
        df=frame([100,100],high=[100,103],low=[100,99])
        sig=np.array([1,0],dtype=np.int8)
        cfg=CopyToLiveExecutionConfig(sl_pct=0.01,tp_ratio=2.0)
        r=run_copytolive_backtest(df,sig,cfg)
        t=r["trades"][0]
        expected_qty=200.0
        expected_fee=COPYTOLIVE_STRESSED_FEE*100.0*expected_qty
        self.assertAlmostEqual(t["fee"],expected_fee)
        self.assertAlmostEqual(t["profit"],400.0-expected_fee)

    def test_short_side(self):
        df=frame([100,100],high=[100,101],low=[100,97])
        sig=np.array([-1,0],dtype=np.int8)
        cfg=CopyToLiveExecutionConfig(sl_pct=0.01,tp_ratio=2.0,fee=0.0)
        r=run_copytolive_backtest(df,sig,cfg)
        self.assertEqual(r["trades"][0]["type"],"SELL")
        self.assertEqual(r["trades"][0]["exitType"],"TP")
        self.assertAlmostEqual(r["trades"][0]["profit"],400.0)

    def test_single_position_ignores_new_signal_until_closed(self):
        df=frame([100,100,100],high=[100,100.5,103],low=[100,99.5,99])
        sig=np.array([1,-1,-1],dtype=np.int8)
        cfg=CopyToLiveExecutionConfig(sl_pct=0.01,tp_ratio=2.0,fee=0.0)
        r=run_copytolive_backtest(df,sig,cfg)
        self.assertEqual(len(r["trades"]),1)
        self.assertEqual(r["trades"][0]["type"],"BUY")
        self.assertEqual(r["trades"][0]["entryBar"],0)
        self.assertEqual(r["trades"][0]["exitBar"],2)

    def test_metrics(self):
        trades=[
            {"profit":100.0},{"profit":100.0},{"profit":-50.0},{"profit":-50.0}
        ]
        m=compute_copytolive_metrics(trades)
        self.assertEqual(m["totalTrades"],4)
        self.assertAlmostEqual(m["winRate"],50.0)
        self.assertAlmostEqual(m["profitFactor"],2.0)
        self.assertAlmostEqual(m["netProfit"],100.0)
        self.assertAlmostEqual(m["expectancy"],25.0)
        self.assertEqual(m["maxConsecLoss"],2)

    def test_digest_is_stable(self):
        df=frame([100,100,100],high=[100,103,103],low=[100,99,99])
        sig=np.array([1,0,0],dtype=np.int8)
        cfg=CopyToLiveExecutionConfig(sl_pct=0.01,tp_ratio=2.0,fee=0.0)
        a=run_copytolive_backtest(df,sig,cfg)["trades"]
        b=run_copytolive_backtest(df,sig,cfg)["trades"]
        self.assertTrue(execution_digest(a))
        self.assertEqual(execution_digest(a),execution_digest(b))

    def test_defaults_are_locked(self):
        cfg=CopyToLiveExecutionConfig(sl_pct=0.02,tp_ratio=2.5)
        self.assertEqual(cfg.deposit_usd,COPYTOLIVE_DEPOSIT_USD)
        self.assertEqual(cfg.risk_usd,COPYTOLIVE_RISK_USD)
        self.assertEqual(cfg.fee,COPYTOLIVE_STRESSED_FEE)
        self.assertTrue(math.isclose(cfg.deposit_usd,10000.0))
        self.assertTrue(math.isclose(cfg.risk_usd,200.0))
        self.assertTrue(math.isclose(cfg.fee,0.0016))


if __name__=="__main__":
    unittest.main(verbosity=2)
