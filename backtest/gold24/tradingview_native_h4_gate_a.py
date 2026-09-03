from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def normalize_h4(df: pd.DataFrame, *, require_volume: bool) -> pd.DataFrame:
    if df is None or df.empty:
        raise RuntimeError("TradingView returned no H4 bars")
    out = df.copy()
    if isinstance(out.index, pd.DatetimeIndex):
        out = out.reset_index()
    cols = {str(c).lower(): c for c in out.columns}
    dt_col = cols.get("datetime") or cols.get("date") or cols.get("index") or out.columns[0]
    rename = {}
    for low, canonical in [("open","Open"),("high","High"),("low","Low"),("close","Close"),("volume","Volume")]:
        if low in cols:
            rename[cols[low]] = canonical
    out = out.rename(columns=rename)
    if not all(c in out.columns for c in ["Open","High","Low","Close"]):
        raise RuntimeError(f"missing H4 OHLC columns: {list(out.columns)}")
    dt = pd.to_datetime(out[dt_col], errors="coerce", utc=True)
    if dt.isna().any():
        raise RuntimeError("invalid H4 timestamps")
    result = pd.DataFrame({
        "Date": dt,
        "Open": pd.to_numeric(out["Open"], errors="coerce"),
        "High": pd.to_numeric(out["High"], errors="coerce"),
        "Low": pd.to_numeric(out["Low"], errors="coerce"),
        "Close": pd.to_numeric(out["Close"], errors="coerce"),
        "Volume": pd.to_numeric(out["Volume"], errors="coerce") if "Volume" in out.columns else np.nan,
    })
    if require_volume and result["Volume"].isna().any():
        raise RuntimeError("primary H4 futures volume missing")
    if not require_volume:
        result["Volume"] = result["Volume"].fillna(0.0)
    if result[["Open","High","Low","Close","Volume"]].isna().any().any():
        raise RuntimeError("NaN/null H4 OHLCV")
    result = result.drop_duplicates("Date", keep="last").sort_values("Date").reset_index(drop=True)
    o,h,l,c = (result[x].to_numpy(float) for x in ["Open","High","Low","Close"])
    if np.any(h < l) or np.any(o < l) or np.any(o > h) or np.any(c < l) or np.any(c > h):
        raise RuntimeError("H4 OHLC consistency violation")
    if len(result) > 1:
        delta = result["Date"].diff().dropna().dt.total_seconds() / 3600.0
        if float(delta.median()) > 8.0:
            raise RuntimeError(f"H4 median spacing too wide: {float(delta.median())}h")
    return result


def fetch_h4(n_bars: int) -> tuple[pd.DataFrame,pd.DataFrame,dict]:
    from tvDatafeed import Interval, TvDatafeed
    tv = TvDatafeed()
    primary_raw = tv.get_hist(symbol="GC1!", exchange="COMEX", interval=Interval.in_4_hour, n_bars=n_bars, extended_session=False)
    cross_raw = tv.get_hist(symbol="XAUUSD", exchange="OANDA", interval=Interval.in_4_hour, n_bars=n_bars, extended_session=False)
    primary = normalize_h4(primary_raw, require_volume=True)
    cross = normalize_h4(cross_raw, require_volume=False)
    return primary, cross, {
        "transport": "TradingView websocket via tvDatafeed anonymous/no-login",
        "primary_symbol": "COMEX:GC1!",
        "crosscheck_symbol": "OANDA:XAUUSD",
        "source_interval": "H4",
        "requested_bars": int(n_bars),
        "construction": "DIRECT_SOURCE_H4_BARS_NO_RESAMPLING",
    }


def evaluate(primary: pd.DataFrame, cross: pd.DataFrame) -> dict:
    p = primary[["Date","Close"]].rename(columns={"Close":"primary_close"})
    x = cross[["Date","Close"]].rename(columns={"Close":"cross_close"})
    overlap = p.merge(x, on="Date", how="inner").sort_values("Date")
    if len(overlap) >= 3:
        rp = np.log(overlap["primary_close"]).diff()
        rx = np.log(overlap["cross_close"]).diff()
        valid = rp.notna() & rx.notna()
        corr = float(rp[valid].corr(rx[valid])) if valid.sum() >= 2 else float("nan")
        direction = float((np.sign(rp[valid]) == np.sign(rx[valid])).mean()) if valid.any() else 0.0
        ratio = overlap["primary_close"] / overlap["cross_close"]
        med_delta = float((ratio - 1.0).abs().median())
    else:
        corr, direction, med_delta = float("nan"), 0.0, float("inf")
    min_rows = min(len(primary), len(cross))
    overlap_floor = min(3000, max(1500, int(min_rows * 0.55)))
    span_days = float((primary["Date"].iloc[-1] - primary["Date"].iloc[0]).total_seconds() / 86400.0)
    criteria = {
        "primary_rows_ge_3000": len(primary) >= 3000,
        "crosscheck_rows_ge_3000": len(cross) >= 3000,
        "primary_reaches_2026": int(primary["Date"].iloc[-1].year) >= 2026,
        "crosscheck_reaches_2026": int(cross["Date"].iloc[-1].year) >= 2026,
        "primary_history_ge_2_years": span_days >= 730,
        "direct_h4_overlap_sufficient": len(overlap) >= overlap_floor,
        "h4_log_return_corr_ge_0_75": bool(np.isfinite(corr) and corr >= 0.75),
        "h4_direction_agreement_ge_0_65": direction >= 0.65,
        "median_abs_price_delta_le_0_08": med_delta <= 0.08,
    }
    return {
        "crosscheck_pass": bool(all(criteria.values())),
        "criteria": criteria,
        "overlap_rows": int(len(overlap)),
        "overlap_floor": int(overlap_floor),
        "h4_log_return_correlation": corr,
        "h4_direction_agreement": direction,
        "median_absolute_price_delta_fraction": med_delta,
        "primary_history_days": span_days,
    }


def main() -> int:
    ap=argparse.ArgumentParser()
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--bars", type=int, default=20000)
    a=ap.parse_args()
    out=Path(a.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    primary_path=out/"GC1_COMEX_TRADINGVIEW_H4_PRIMARY.csv"
    cross_path=out/"XAUUSD_OANDA_TRADINGVIEW_H4_CROSSCHECK.csv"
    receipt_path=out/"gate_a_h4_receipt.json"
    now=pd.Timestamp.now(tz="UTC").isoformat()
    try:
        primary,cross,source=fetch_h4(max(3000,int(a.bars)))
        primary.to_csv(primary_path,index=False,date_format="%Y-%m-%dT%H:%M:%SZ")
        cross.to_csv(cross_path,index=False,date_format="%Y-%m-%dT%H:%M:%SZ")
        verdict=evaluate(primary,cross)
        receipt={
            "schema":"gold10b-native-h4-gate-a-v1",
            "provider":"TradingView",
            "crosscheck_pass":verdict["crosscheck_pass"],
            "approved_method":"DIRECT_NATIVE_H4_FUTURES_SPOT_CROSSCHECK_V1",
            "symbol":"GOLD","timeframe":"H4",
            "primary_provider":"TradingView",
            "primary_symbol":source["primary_symbol"],
            "crosscheck_symbol":source["crosscheck_symbol"],
            "source_transport":source["transport"],
            "source_interval":"H4",
            "construction":source["construction"],
            "no_resampling_attested":True,
            "primary_rows":int(len(primary)),
            "primary_start_utc":str(primary["Date"].iloc[0]),
            "primary_end_utc":str(primary["Date"].iloc[-1]),
            "crosscheck_rows":int(len(cross)),
            "crosscheck_start_utc":str(cross["Date"].iloc[0]),
            "crosscheck_end_utc":str(cross["Date"].iloc[-1]),
            "primary_sha256":sha256(primary_path),
            "crosscheck_data_sha256":sha256(cross_path),
            "primary_zero_volume_rows":int((primary["Volume"]<=0).sum()),
            **verdict,
            "generated_at":now,
        }
    except Exception as exc:
        receipt={
            "schema":"gold10b-native-h4-gate-a-v1","provider":"TradingView",
            "crosscheck_pass":False,"approved_method":"DIRECT_NATIVE_H4_FUTURES_SPOT_CROSSCHECK_V1",
            "symbol":"GOLD","timeframe":"H4","source_interval":"H4",
            "construction":"DIRECT_SOURCE_H4_BARS_NO_RESAMPLING","no_resampling_attested":True,
            "error":f"{type(exc).__name__}: {exc}","generated_at":now,
        }
    receipt_path.write_text(json.dumps(receipt,indent=2,sort_keys=True)+"\n")
    print(receipt_path.read_text())
    return 0 if receipt.get("crosscheck_pass") else 2


if __name__=="__main__":
    raise SystemExit(main())
