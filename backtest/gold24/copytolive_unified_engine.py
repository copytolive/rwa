from __future__ import annotations

"""Single canonical CopyToLive backtest engine.

This file mirrors the production Non-DEX BTC+GOLD producer contract and is the
single kernel intended for GitHub, copytolive.com production and local/macOS
reference runs.  Do not duplicate execution/filter/metric logic elsewhere.
"""

from dataclasses import dataclass
import hashlib
import json
import math
from typing import Iterable

import numpy as np
import pandas as pd

try:
    from numba import njit
except ImportError:
    def njit(*a, **k):
        def w(fn):
            return fn
        return w if a and callable(a[0]) else w

ENGINE_ID = "copytolive-unified-backtest-v1"
COPYTOLIVE_DEPOSIT_USD = 10_000.0
COPYTOLIVE_RISK_USD = 200.0
COPYTOLIVE_STRESSED_FEE = 0.0016
COPYTOLIVE_WF_TRAIN_PCT = 0.70
COPYTOLIVE_SL_PCTS = (0.010, 0.012, 0.015, 0.018, 0.020, 0.025, 0.030, 0.040)
COPYTOLIVE_TP_RATIOS = (1.0, 1.2, 1.5, 2.0, 2.5, 3.0)


@dataclass(frozen=True)
class CopyToLiveExecutionConfig:
    sl_pct: float
    tp_ratio: float
    deposit_usd: float = COPYTOLIVE_DEPOSIT_USD
    risk_usd: float = COPYTOLIVE_RISK_USD
    fee: float = COPYTOLIVE_STRESSED_FEE

    def validate(self) -> None:
        if not (0.0 < float(self.sl_pct) < 1.0):
            raise ValueError("sl_pct must be a positive fraction of entry price")
        if float(self.tp_ratio) <= 0.0:
            raise ValueError("tp_ratio must be positive")
        if float(self.deposit_usd) <= 0.0:
            raise ValueError("deposit_usd must be positive")
        if float(self.risk_usd) <= 0.0:
            raise ValueError("risk_usd must be positive")
        if float(self.fee) < 0.0:
            raise ValueError("fee must be non-negative")

    @property
    def config_hash(self) -> str:
        raw = json.dumps(
            {
                "sl_pct": round(float(self.sl_pct), 10),
                "tp_ratio": round(float(self.tp_ratio), 10),
                "deposit_usd": round(float(self.deposit_usd), 10),
                "risk_usd": round(float(self.risk_usd), 10),
                "fee": round(float(self.fee), 10),
            },
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
        return hashlib.sha256(raw).hexdigest()


def _column(df: pd.DataFrame, name: str) -> np.ndarray:
    for candidate in (name, name.lower(), name.capitalize(), name.upper()):
        if candidate in df.columns:
            return pd.to_numeric(df[candidate], errors="coerce").to_numpy(float)
    raise ValueError(f"missing required OHLC column: {name}")


def _time_index(df: pd.DataFrame) -> pd.Index:
    if isinstance(df.index, pd.DatetimeIndex):
        return df.index
    for name in ("Date", "date", "time", "timestamp", "datetime"):
        if name in df.columns:
            return pd.DatetimeIndex(pd.to_datetime(df[name], errors="coerce"))
    return pd.RangeIndex(len(df))


def _as_signals(signals: Iterable[int], n: int) -> np.ndarray:
    out = np.asarray(list(signals) if not isinstance(signals, np.ndarray) else signals, dtype=np.int8)
    if len(out) != n:
        raise ValueError(f"signal length mismatch: signals={len(out)} bars={n}")
    return np.sign(out).astype(np.int8)


@njit(cache=False)
def bt_filtered(sigs, vol_mask, bias_mask, c, h2, l2, sl_pct, tp_pct, fee, dep=10000.0, rsk=200.0):
    """Byte-for-byte semantic port of production wf_nondex_btc_gold.bt_filtered."""
    n=len(c); mx=n//6
    ei=np.zeros(mx,dtype=np.int64); xi=np.zeros(mx,dtype=np.int64)
    dr=np.zeros(mx,dtype=np.int8); ep_arr=np.zeros(mx,dtype=np.float64)
    xp=np.zeros(mx,dtype=np.float64); lt=np.zeros(mx,dtype=np.float64)
    pf=np.zeros(mx,dtype=np.float64); tc=0; ip=False
    pe=0.0; ps_=0.0; pt=0.0; pl=0.0; pd_=0; pst=0
    for i in range(n):
        if not ip:
            if sigs[i]!=0 and vol_mask[i]==1:
                if bias_mask[i]!=0 and sigs[i]!=bias_mask[i]:
                    continue
                pe=c[i]; ps_=pe*sl_pct; pt=pe*tp_pct
                pl=rsk/ps_ if ps_>0 else 0.0
                pd_=sigs[i]; pst=i; ip=True
        else:
            fe=fee*pe*pl; hs=False; ht=False
            if pd_==1:
                if l2[i]<=pe-ps_: hs=True
                elif h2[i]>=pe+pt: ht=True
            else:
                if h2[i]>=pe+ps_: hs=True
                elif l2[i]<=pe-pt: ht=True
            if hs or ht:
                pnl=(-ps_*pl-fe) if hs else (pt*pl-fe)
                if tc<mx:
                    ei[tc]=pst; xi[tc]=i; dr[tc]=pd_; ep_arr[tc]=pe
                    xp[tc]=(pe+pt if (pd_==1 and ht) else pe-pt if (pd_==-1 and ht) else pe-ps_ if pd_==1 else pe+ps_)
                    lt[tc]=pl; pf[tc]=pnl; tc+=1
                ip=False
    return (ei[:tc],xi[:tc],dr[:tc],ep_arr[:tc],xp[:tc],lt[:tc],pf[:tc])


def compute_vol_mask(c, h=None, l=None, period=14, ma_period=50):
    """Exact production volatility mask."""
    if isinstance(c, pd.DataFrame):
        df=c
        c=_column(df,"close"); h=_column(df,"high"); l=_column(df,"low")
    c=np.asarray(c,dtype=np.float64); h=np.asarray(h,dtype=np.float64); l=np.asarray(l,dtype=np.float64)
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


def compute_mtf_bias(c_h1, df_d1):
    """Exact production D1 EMA50/EMA200 block expansion."""
    if isinstance(c_h1, pd.DataFrame):
        c_h1=_column(c_h1,"close")
    c_h1=np.asarray(c_h1,dtype=np.float64)
    n=len(c_h1); bias=np.zeros(n,dtype=np.int8)
    if df_d1 is None or len(df_d1)<200:
        return bias
    d1c=_column(df_d1,"close").astype(np.float64)
    ema50=pd.Series(d1c).ewm(span=50).mean().values
    ema200=pd.Series(d1c).ewm(span=200).mean().values
    d1_len=len(d1c); h1_per_d1=n//max(d1_len,1)
    for i in range(200,d1_len):
        h1_start=i*h1_per_d1; h1_end=min((i+1)*h1_per_d1,n)
        if h1_start>=n:
            break
        bias[h1_start:h1_end]=1 if ema50[i]>ema200[i] else -1
    return bias


def compute_session_mask(df, start_hour=7, end_hour=21):
    """Exact production session mask, including fail-open index behavior."""
    n=len(df); mask=np.ones(n,dtype=np.int8)
    try:
        hours=df.index.hour
        for i in range(n):
            if hours[i]<start_hour or hours[i]>end_hour:
                mask[i]=0
    except Exception:
        pass
    return mask


def vs(profits, mint=100):
    """Exact production metric/gate function from wf_nondex_btc_gold.py."""
    profits=np.asarray(profits,dtype=np.float64)
    n=len(profits)
    if n<mint:
        return None
    w=profits[profits>0]; l=profits[profits<=0]
    if len(w)==0 or len(l)==0:
        return None
    wr=len(w)/n*100; gp=float(w.sum()); gl=float(abs(l.sum()))
    pf_val=gp/gl if gl>0 else 0
    if pf_val<1.4 or wr<35 or wr>80:
        return None
    eq=COPYTOLIVE_DEPOSIT_USD+np.cumsum(profits); peak=np.maximum.accumulate(eq)
    mdd=float(((peak-eq)/np.maximum(peak,1)*100).max())
    if mdd>25:
        return None
    net=gp-gl; aw=float(w.mean()); al=float(abs(l.mean()))
    std=float(profits.std())
    sqn=(profits.mean()/std)*np.sqrt(n) if std>0 else 0
    sharpe=(profits.mean()/std)*np.sqrt(252) if std>0 else 0
    down=profits[profits<0]
    sortino=(profits.mean()/down.std())*np.sqrt(252) if len(down)>1 and down.std()>0 else 0
    recov=net/(mdd/100*COPYTOLIVE_DEPOSIT_USD) if mdd>0.01 else 0
    cal=(net/COPYTOLIVE_DEPOSIT_USD*100)/mdd if mdd>0.01 else 0
    rr=aw/al if al>0 else 0
    cw=mcw=cl=mcl=0
    for p in profits:
        if p>0:
            cw+=1; mcw=max(mcw,cw); cl=0
        else:
            cl+=1; mcl=max(mcl,cl); cw=0
    return {
        "totalTrades":int(n),"winRate":round(wr,1),"profitFactor":round(pf_val,2),
        "maxDrawdown":round(mdd,1),"netProfit":round(net,2),"sqn":round(sqn,2),
        "sharpe":round(sharpe,2),"sortino":round(min(sortino,99),2),
        "calmar":round(min(cal,99),2),"recoveryFactor":round(min(recov,99),2),
        "grossProfit":round(gp,2),"grossLoss":round(gl,2),
        "winningTrades":int(len(w)),"losingTrades":int(len(l)),
        "avgProfit":round(aw,2),"avgLoss":round(al,2),
        "rr":round(rr,2),"maxConsecWin":mcw,"maxConsecLoss":mcl,
    }


def filter_mode_from_signal_type(signal_type: str | None) -> str:
    s=str(signal_type or "").upper()
    for mode in ("VOL","MTF","VM","VS","ALL"):
        if s.startswith(mode+"_"):
            return mode
    return "NONE"


def production_masks(h1: pd.DataFrame, d1: pd.DataFrame | None, signal_type: str | None):
    n=len(h1)
    c=_column(h1,"close"); h=_column(h1,"high"); l=_column(h1,"low")
    vol=compute_vol_mask(c,h,l)
    mtf=compute_mtf_bias(c,d1)
    ses=compute_session_mask(h1)
    mode=filter_mode_from_signal_type(signal_type)
    z=np.zeros(n,dtype=np.int8); o=np.ones(n,dtype=np.int8)
    masks={
        "VOL":(vol,z),
        "MTF":(o,mtf),
        "VM":(vol,mtf),
        "VS":(vol*ses,z),
        "ALL":(vol*ses,mtf),
        "NONE":(o,z),
    }
    return masks[mode]


def apply_production_filter(signals: Iterable[int], h1: pd.DataFrame, *, signal_type: str | None=None, d1: pd.DataFrame | None=None) -> np.ndarray:
    sig=_as_signals(signals,len(h1))
    vmask,bmask=production_masks(h1,d1,signal_type)
    keep=(vmask==1) & ((bmask==0) | (sig==bmask))
    return np.where(keep,sig,0).astype(np.int8)


def _arrays_to_trades(df: pd.DataFrame, arrays, config: CopyToLiveExecutionConfig) -> list[dict]:
    ei,xi,dirs,eps,xps,lots,profits=arrays
    idx=_time_index(df)
    trades=[]
    eq=float(config.deposit_usd)
    for entry_i,exit_i,direction,ep,xp,lot,pnl in zip(ei,xi,dirs,eps,xps,lots,profits):
        eq+=float(pnl)
        gross = float(pnl) + float(config.fee)*float(ep)*float(lot)
        exit_type = "TP" if gross > 0 else "SL"
        trades.append({
            "openTime":str(idx[int(entry_i)])[:32],
            "closeTime":str(idx[int(exit_i)])[:32],
            "type":"BUY" if int(direction)==1 else "SELL",
            "openPrice":float(ep),
            "closePrice":float(xp),
            "quantity":float(lot),
            "lots":float(lot),
            "grossProfit":gross,
            "fee":float(config.fee)*float(ep)*float(lot),
            "profit":float(pnl),
            "balance":eq,
            "exitType":exit_type,
            "entryBar":int(entry_i),
            "exitBar":int(exit_i),
            "slDistance":float(ep)*float(config.sl_pct),
            "tpDistance":float(ep)*float(config.sl_pct)*float(config.tp_ratio),
            "slPct":float(config.sl_pct),
            "tpRatio":float(config.tp_ratio),
            "riskUsd":float(config.risk_usd),
        })
    return trades


def run_copytolive_backtest(df: pd.DataFrame, signals: Iterable[int], config: CopyToLiveExecutionConfig) -> dict:
    """Canonical unfiltered execution wrapper over the production kernel."""
    config.validate()
    c=_column(df,"close"); h=_column(df,"high"); l=_column(df,"low")
    sig=_as_signals(signals,len(df))
    one=np.ones(len(df),dtype=np.int8); zero=np.zeros(len(df),dtype=np.int8)
    arrays=bt_filtered(sig,one,zero,c,h,l,float(config.sl_pct),float(config.sl_pct)*float(config.tp_ratio),float(config.fee),float(config.deposit_usd),float(config.risk_usd))
    trades=_arrays_to_trades(df,arrays,config)
    pnl=np.asarray(arrays[-1],dtype=float)
    bar_pnl=np.zeros(len(df),dtype=float)
    for i,p in zip(arrays[1],pnl):
        bar_pnl[int(i)]+=float(p)
    return {
        "engine_id":ENGINE_ID,
        "trades":trades,
        "bar_pnl":bar_pnl,
        "metrics":compute_copytolive_metrics(trades,float(config.deposit_usd)),
        "producer_metrics":vs(pnl,1) if len(pnl) else None,
        "execution_config":{
            "sl_pct":float(config.sl_pct),"tp_ratio":float(config.tp_ratio),
            "deposit_usd":float(config.deposit_usd),"risk_usd":float(config.risk_usd),
            "fee":float(config.fee),
        },
        "open_position_at_end":None,
    }


def run_copytolive_filtered_backtest(df: pd.DataFrame, d1: pd.DataFrame | None, signals: Iterable[int], signal_type: str, config: CopyToLiveExecutionConfig) -> dict:
    """Canonical filtered production execution using the same masks as producer."""
    config.validate()
    c=_column(df,"close"); h=_column(df,"high"); l=_column(df,"low")
    sig=_as_signals(signals,len(df))
    vmask,bmask=production_masks(df,d1,signal_type)
    arrays=bt_filtered(sig,vmask,bmask,c,h,l,float(config.sl_pct),float(config.sl_pct)*float(config.tp_ratio),float(config.fee),float(config.deposit_usd),float(config.risk_usd))
    trades=_arrays_to_trades(df,arrays,config)
    pnl=np.asarray(arrays[-1],dtype=float)
    bar_pnl=np.zeros(len(df),dtype=float)
    for i,p in zip(arrays[1],pnl):
        bar_pnl[int(i)]+=float(p)
    return {
        "engine_id":ENGINE_ID,
        "trades":trades,
        "bar_pnl":bar_pnl,
        "metrics":compute_copytolive_metrics(trades,float(config.deposit_usd)),
        "producer_metrics":vs(pnl,1) if len(pnl) else None,
        "entry_indices":np.asarray(arrays[0],dtype=np.int64),
        "exit_indices":np.asarray(arrays[1],dtype=np.int64),
        "profits":pnl,
        "execution_config":{
            "sl_pct":float(config.sl_pct),"tp_ratio":float(config.tp_ratio),
            "deposit_usd":float(config.deposit_usd),"risk_usd":float(config.risk_usd),
            "fee":float(config.fee),
        },
    }


def empty_metrics() -> dict:
    return {
        "totalTrades":0,"winRate":0.0,"profitFactor":0.0,"maxDrawdown":0.0,
        "netProfit":0.0,"expectancy":0.0,"sqn":0.0,"sharpe":0.0,"sortino":0.0,
        "recoveryFactor":0.0,"avgProfit":0.0,"avgLoss":0.0,"rr":0.0,"maxConsecLoss":0,
    }


def compute_copytolive_metrics(trades: list[dict], deposit_usd: float=COPYTOLIVE_DEPOSIT_USD) -> dict:
    """Production vs() metric arithmetic without applying the research gate."""
    if not trades:
        return empty_metrics()
    pnl=np.asarray([float(t["profit"]) for t in trades],dtype=np.float64)
    n=len(pnl)
    w=pnl[pnl>0]; l=pnl[pnl<=0]
    if len(w)==0 or len(l)==0:
        out=empty_metrics()
        out["totalTrades"]=int(n)
        return out
    wr=len(w)/n*100
    gp=float(w.sum()); gl=float(abs(l.sum()))
    pf_val=gp/gl if gl>0 else 0
    eq=float(deposit_usd)+np.cumsum(pnl); peak=np.maximum.accumulate(eq)
    mdd=float(((peak-eq)/np.maximum(peak,1)*100).max())
    net=gp-gl; aw=float(w.mean()); al=float(abs(l.mean()))
    std=float(pnl.std())
    sqn=(pnl.mean()/std)*np.sqrt(n) if std>0 else 0
    sharpe=(pnl.mean()/std)*np.sqrt(252) if std>0 else 0
    down=pnl[pnl<0]
    sortino=(pnl.mean()/down.std())*np.sqrt(252) if len(down)>1 and down.std()>0 else 0
    recov=net/(mdd/100*float(deposit_usd)) if mdd>0.01 else 0
    cal=(net/float(deposit_usd)*100)/mdd if mdd>0.01 else 0
    rr=aw/al if al>0 else 0
    cw=mcw=cl=mcl=0
    for p in pnl:
        if p>0:
            cw+=1; mcw=max(mcw,cw); cl=0
        else:
            cl+=1; mcl=max(mcl,cl); cw=0
    return {
        "totalTrades":int(n),"winRate":round(wr,1),"profitFactor":round(pf_val,2),
        "maxDrawdown":round(mdd,1),"netProfit":round(net,2),"expectancy":round(net/n,2),
        "sqn":round(float(sqn),2),"sharpe":round(float(sharpe),2),
        "sortino":round(min(float(sortino),99),2),"calmar":round(min(float(cal),99),2),
        "recoveryFactor":round(min(float(recov),99),2),
        "grossProfit":round(gp,2),"grossLoss":round(gl,2),
        "winningTrades":int(len(w)),"losingTrades":int(len(l)),
        "avgProfit":round(aw,2),"avgLoss":round(al,2),"rr":round(rr,2),
        "maxConsecWin":int(mcw),"maxConsecLoss":int(mcl),
    }

def validate_copytolive_period(trades: list[dict], *, min_trades: int=100, pf_min: float=2.0, wr_min: float=40.0, wr_max: float=85.0, dd_max: float=30.0, deposit_usd: float=COPYTOLIVE_DEPOSIT_USD) -> dict | None:
    metrics=compute_copytolive_metrics(trades,deposit_usd)
    if int(metrics["totalTrades"])<int(min_trades): return None
    if not (float(wr_min)<=float(metrics["winRate"])<=float(wr_max)): return None
    if float(metrics["profitFactor"])<float(pf_min): return None
    if float(metrics["maxDrawdown"])>float(dd_max): return None
    return metrics


def walk_forward_copytolive(trades: list[dict], df: pd.DataFrame, *, train_pct: float=COPYTOLIVE_WF_TRAIN_PCT):
    if not trades or len(df)<2: return None,None,None
    split_i=min(max(int(len(df)*float(train_pct)),1),len(df)-1)
    train=[t for t in trades if int(t.get("exitBar",-1))<=split_i]
    test=[t for t in trades if int(t.get("exitBar",-1))>split_i]
    return (
        validate_copytolive_period(train,min_trades=100),
        validate_copytolive_period(test,min_trades=50),
        validate_copytolive_period(trades,min_trades=300),
    )


def execution_digest(trades: list[dict]) -> str:
    if not trades: return ""
    canonical=[{
        "entryBar":int(t["entryBar"]),"exitBar":int(t["exitBar"]),"type":str(t["type"]),
        "openPrice":round(float(t["openPrice"]),10),"closePrice":round(float(t["closePrice"]),10),
        "quantity":round(float(t.get("quantity",t.get("lots",0.0))),10),
        "profit":round(float(t["profit"]),10),"exitType":str(t["exitType"]),
    } for t in trades]
    raw=json.dumps(canonical,sort_keys=True,separators=(",",":")).encode()
    return hashlib.blake2b(raw,digest_size=16).hexdigest()


def adapt_core_candidate_signals(df: pd.DataFrame, candidate) -> np.ndarray:
    from core import signal_series
    return np.asarray(signal_series(df,candidate),dtype=np.int8)
