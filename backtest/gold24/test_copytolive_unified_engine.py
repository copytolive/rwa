from __future__ import annotations

import unittest

import numpy as np
import pandas as pd

from copytolive_unified_engine import (
    ENGINE_ID,
    CopyToLiveExecutionConfig,
    bt_filtered,
    compute_mtf_bias,
    compute_session_mask,
    compute_vol_mask,
    run_copytolive_backtest,
    vs,
)


def legacy_vol(c, h, l, period=14, ma_period=50):
    n=len(c); mask=np.zeros(n,dtype=np.int8); tr=np.zeros(n)
    for i in range(1,n):
        tr[i]=max(h[i]-l[i],abs(h[i]-c[i-1]),abs(l[i]-c[i-1]))
    atr=np.zeros(n)
    for i in range(period,n):
        atr[i]=np.mean(tr[i-period+1:i+1])
    atr_ma=np.zeros(n)
    for i in range(ma_period,n):
        atr_ma[i]=np.mean(atr[i-ma_period+1:i+1])
    for i in range(ma_period,n):
        if atr[i]>atr_ma[i]:
            mask[i]=1
    return mask


def legacy_mtf(c_h1, df_d1):
    n=len(c_h1); bias=np.zeros(n,dtype=np.int8)
    if df_d1 is None or len(df_d1)<200:
        return bias
    d1c=df_d1["close"].values.astype(np.float64)
    ema50=pd.Series(d1c).ewm(span=50).mean().values
    ema200=pd.Series(d1c).ewm(span=200).mean().values
    d1_len=len(d1c); h1_per_d1=n//max(d1_len,1)
    for i in range(200,d1_len):
        h1_start=i*h1_per_d1; h1_end=min((i+1)*h1_per_d1,n)
        if h1_start>=n:
            break
        bias[h1_start:h1_end]=1 if ema50[i]>ema200[i] else -1
    return bias


class UnifiedEngineTests(unittest.TestCase):
    def test_engine_id_locked(self):
        self.assertEqual(ENGINE_ID,"copytolive-unified-backtest-v1")

    def test_vol_mask_is_exact_legacy_semantics(self):
        n=240
        c=np.linspace(100,140,n)+np.sin(np.arange(n)/3)
        h=c+1+(np.arange(n)%11)/20
        l=c-1-(np.arange(n)%7)/25
        self.assertTrue(np.array_equal(compute_vol_mask(c,h,l),legacy_vol(c,h,l)))

    def test_mtf_bias_is_exact_legacy_semantics(self):
        d1=pd.DataFrame({"close":np.linspace(100,180,240)+np.sin(np.arange(240)/5)})
        c=np.linspace(90,190,240*20)
        self.assertTrue(np.array_equal(compute_mtf_bias(c,d1),legacy_mtf(c,d1)))

    def test_session_mask_uses_direct_hour_7_to_21(self):
        idx=pd.date_range("2026-01-01",periods=24,freq="h")
        df=pd.DataFrame({"close":np.ones(24)},index=idx)
        m=compute_session_mask(df)
        self.assertEqual(int(m.sum()),15)
        self.assertEqual(int(m[6]),0)
        self.assertEqual(int(m[7]),1)
        self.assertEqual(int(m[21]),1)
        self.assertEqual(int(m[22]),0)

    def test_bt_filtered_contract(self):
        c=np.array([100.,100.,100.])
        h=np.array([100.,103.,103.])
        l=np.array([100.,99.5,99.5])
        sig=np.array([1,0,0],dtype=np.int8)
        one=np.ones(3,dtype=np.int8)
        zero=np.zeros(3,dtype=np.int8)
        arr=bt_filtered(sig,one,zero,c,h,l,0.01,0.02,0.0)
        self.assertEqual(len(arr[-1]),1)
        self.assertAlmostEqual(float(arr[-1][0]),400.0)
        self.assertEqual(int(arr[0][0]),0)
        self.assertEqual(int(arr[1][0]),1)

    def test_vs_rounding_matches_producer(self):
        p=np.array([100.,100.,100.,-50.,-50.])
        m=vs(p,1)
        self.assertIsNotNone(m)
        self.assertEqual(m["totalTrades"],5)
        self.assertEqual(m["winRate"],60.0)
        self.assertEqual(m["profitFactor"],3.0)
        self.assertEqual(m["netProfit"],200.0)

    def test_wrapper_identifies_unified_engine_and_stop_first(self):
        idx=pd.date_range("2026-01-01",periods=2,freq="h")
        df=pd.DataFrame(
            {"open":[100.,100.],"high":[100.,103.],"low":[100.,98.],"close":[100.,100.]},
            index=idx,
        )
        r=run_copytolive_backtest(
            df,
            np.array([1,0],dtype=np.int8),
            CopyToLiveExecutionConfig(sl_pct=0.01,tp_ratio=2.0,fee=0.0),
        )
        self.assertEqual(r["engine_id"],ENGINE_ID)
        self.assertEqual(r["trades"][0]["exitType"],"SL")


if __name__=="__main__":
    unittest.main(verbosity=2)
