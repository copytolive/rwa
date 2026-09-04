from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd


def sha256(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def _trim_to_dense_native_h4(raw: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Keep only the contiguous era where the broker actually exposes H4 cadence.

    Some MT5 servers return one 00:00 bar/day for old history even when the API
    request is TIMEFRAME_H4. Those rows are direct broker data but they are not a
    complete H4 history and must not be presented as canonical H4. No bar is
    created, aggregated, or resampled here: sparse pre-H4 history is only removed.
    """
    x = raw.sort_values("Date").drop_duplicates("Date", keep="last").reset_index(drop=True)
    years = []
    for year, g in x.groupby(x["Date"].dt.year):
        delta = g["Date"].diff().dt.total_seconds().div(3600).dropna()
        four_share = float((delta == 4.0).mean()) if len(delta) else 0.0
        median = float(delta.median()) if len(delta) else float("inf")
        years.append({"year": int(year), "rows": int(len(g)), "four_hour_gap_share": four_share, "median_gap_hours": median})
    qualifying = [r["year"] for r in years if r["rows"] >= 1000 and r["four_hour_gap_share"] >= 0.90 and r["median_gap_hours"] <= 4.0]
    if not qualifying:
        raise RuntimeError(f"no dense native-H4 era found: {years}")
    start_year = min(qualifying)
    # Every complete year from the first dense year onward must remain H4-dense;
    # the partial current year is allowed provided its median cadence is H4.
    for r in years:
        if r["year"] < start_year:
            continue
        if r["rows"] >= 250 and r["median_gap_hours"] > 4.0:
            raise RuntimeError(f"native H4 cadence degrades after dense start: {r}")
    trimmed = x[x["Date"].dt.year >= start_year].copy().reset_index(drop=True)
    dgap = trimmed["Date"].diff().dt.total_seconds().div(3600).dropna()
    diagnostics = {
        "raw_rows": int(len(x)),
        "raw_start_utc": str(x["Date"].iloc[0]),
        "raw_end_utc": str(x["Date"].iloc[-1]),
        "canonical_dense_h4_start_year": int(start_year),
        "canonical_rows": int(len(trimmed)),
        "canonical_four_hour_gap_share": float((dgap == 4.0).mean()) if len(dgap) else 0.0,
        "canonical_median_gap_hours": float(dgap.median()) if len(dgap) else float("inf"),
        "yearly_cadence": years,
        "trim_policy": "DROP_SPARSE_PRE_H4_HISTORY_ONLY; NO RESAMPLING/AGGREGATION/IMPUTATION",
    }
    return trimmed, diagnostics


def main() -> int:
    ap = argparse.ArgumentParser(description="Fetch source-native broker H4 bars through MetaTrader5; never resample")
    ap.add_argument("--terminal", required=True)
    ap.add_argument("--crosscheck", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--symbol", default="XAUUSD")
    a = ap.parse_args()

    import MetaTrader5 as mt5

    login = int(os.environ["MT5_LOGIN"])
    password = os.environ["MT5_PASSWORD"]
    server = os.environ["MT5_SERVER"]
    if not mt5.initialize(path=a.terminal, login=login, password=password, server=server, timeout=60000):
        raise SystemExit(f"MT5_INITIALIZE_FAIL {mt5.last_error()}")
    try:
        names = [x.name for x in (mt5.symbols_get() or [])]
        if a.symbol in names:
            symbol = a.symbol
        else:
            candidates = sorted([x for x in names if "XAUUSD" in x.upper()], key=lambda x: (len(x), x))
            if not candidates:
                raise RuntimeError("broker has no XAUUSD-like symbol")
            symbol = candidates[0]
        if not mt5.symbol_select(symbol, True):
            raise RuntimeError(f"symbol_select failed {symbol}: {mt5.last_error()}")

        attempts = []
        utc = dt.timezone.utc
        rates = mt5.copy_rates_range(symbol, mt5.TIMEFRAME_H4, dt.datetime(2000, 1, 1, tzinfo=utc), dt.datetime.now(tz=utc))
        attempts.append({"api":"copy_rates_range","count":0 if rates is None else int(len(rates)),"last_error":mt5.last_error()})
        if rates is None or len(rates) == 0:
            for count in (50000, 20000, 10000, 5000, 2000):
                rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_H4, 0, count)
                attempts.append({"api":"copy_rates_from_pos","requested":count,"count":0 if rates is None else int(len(rates)),"last_error":mt5.last_error()})
                if rates is not None and len(rates) > 0:
                    break
        if rates is None or len(rates) == 0:
            raise RuntimeError(f"native H4 returned no bars after bounded direct-H4 fallbacks: {attempts}")

        d = pd.DataFrame(rates)
        d["Date"] = pd.to_datetime(d["time"], unit="s", utc=True)
        vol = d["real_volume"].where(d["real_volume"] > 0, d["tick_volume"]).fillna(0)
        raw_primary = pd.DataFrame({
            "Date": d["Date"], "Open": pd.to_numeric(d["open"], errors="raise"),
            "High": pd.to_numeric(d["high"], errors="raise"), "Low": pd.to_numeric(d["low"], errors="raise"),
            "Close": pd.to_numeric(d["close"], errors="raise"), "Volume": pd.to_numeric(vol, errors="raise"),
        })
        primary, cadence = _trim_to_dense_native_h4(raw_primary)
        o,h,l,c = (primary[x].to_numpy(float) for x in ["Open","High","Low","Close"])
        if np.any(h < l) or np.any(o < l) or np.any(o > h) or np.any(c < l) or np.any(c > h):
            raise RuntimeError("native broker H4 OHLC consistency violation")

        out = Path(a.out_dir); out.mkdir(parents=True, exist_ok=True)
        primary_path = out / "XAUUSD_MT5_NATIVE_H4_PRIMARY.csv"
        receipt_path = out / "gate_a_h4_receipt.json"
        primary.to_csv(primary_path, index=False, date_format="%Y-%m-%dT%H:%M:%SZ")

        cross = pd.read_csv(a.crosscheck)
        cross["Date"] = pd.to_datetime(cross["Date"], utc=True, errors="raise")
        cross = cross.sort_values("Date").drop_duplicates("Date", keep="last")
        left = primary[["Date","Close"]].rename(columns={"Date":"primary_date","Close":"primary_close"}).sort_values("primary_date")
        right = cross[["Date","Close"]].rename(columns={"Date":"cross_date","Close":"cross_close"}).sort_values("cross_date")
        left["_date_ns"] = left["primary_date"].map(lambda z: int(pd.Timestamp(z).value)).astype("int64")
        right["_date_ns"] = right["cross_date"].map(lambda z: int(pd.Timestamp(z).value)).astype("int64")
        aligned = pd.merge_asof(left.sort_values("_date_ns"), right.sort_values("_date_ns"), on="_date_ns", direction="nearest", tolerance=int(pd.Timedelta(hours=2).value)).dropna(subset=["cross_close"])
        rp=np.log(aligned["primary_close"]).diff(); rx=np.log(aligned["cross_close"]).diff(); valid=rp.notna() & rx.notna()
        corr=float(rp[valid].corr(rx[valid])) if int(valid.sum())>=2 else float("nan")
        direction=float((np.sign(rp[valid])==np.sign(rx[valid])).mean()) if valid.any() else 0.0
        med_delta=float(((aligned["primary_close"] / aligned["cross_close"] - 1.0).abs()).median()) if len(aligned) else float("inf")

        pdaily=primary.set_index("Date")["Close"].groupby(primary["Date"].dt.floor("D").to_numpy()).last()
        xdaily=cross.set_index("Date")["Close"].groupby(cross["Date"].dt.floor("D").to_numpy()).last()
        daily=pd.concat([pdaily.rename("p"),xdaily.rename("x")],axis=1,join="inner").dropna()
        if len(daily)>=3:
            drp=np.log(daily["p"]).diff(); drx=np.log(daily["x"]).diff(); dv=drp.notna() & drx.notna()
            daily_corr=float(drp[dv].corr(drx[dv])) if int(dv.sum())>=2 else float("nan")
            daily_direction=float((np.sign(drp[dv])==np.sign(drx[dv])).mean()) if dv.any() else 0.0
        else:
            daily_corr,daily_direction=float("nan"),0.0

        start=primary["Date"].iloc[0]; end=primary["Date"].iloc[-1]
        criteria={
            "primary_rows_ge_12000":len(primary)>=12000,
            "primary_dense_h4_history_ge_8y":(end-start).days>=2920,
            "primary_reaches_2026":int(end.year)>=2026,
            "canonical_median_gap_eq_4h":abs(float(cadence["canonical_median_gap_hours"])-4.0)<1e-12,
            "canonical_four_hour_gap_share_ge_0_90":float(cadence["canonical_four_hour_gap_share"])>=0.90,
            "crosscheck_overlap_ge_3000":len(aligned)>=3000,
            "h4_direction_agreement_ge_0_70":direction>=0.70,
            "daily_validation_return_corr_ge_0_90":bool(np.isfinite(daily_corr) and daily_corr>=0.90),
            "daily_validation_direction_ge_0_80":daily_direction>=0.80,
            "median_abs_price_delta_le_0_08":med_delta<=0.08,
        }
        receipt={
            "schema":"gold10b-mt5-native-h4-gate-a-v3-dense-session-aware","provider":"TradingView",
            "crosscheck_pass":bool(all(criteria.values())),
            "approved_method":"BROKER_NATIVE_MT5_DENSE_H4_PLUS_TRADINGVIEW_OANDA_SESSION_AWARE_CROSSCHECK_V3",
            "symbol":"GOLD","timeframe":"H4","primary_provider":"MetaTrader5 broker server","primary_broker_server":server,
            "primary_symbol":symbol,"crosscheck_symbol":"TradingView OANDA:XAUUSD","source_interval":"H4",
            "construction":"DIRECT_BROKER_NATIVE_H4_DENSE_SEGMENT_NO_RESAMPLING","no_resampling_attested":True,
            "primary_rows":int(len(primary)),"primary_start_utc":str(start),"primary_end_utc":str(end),"primary_sha256":sha256(primary_path),
            "crosscheck_data_sha256":sha256(Path(a.crosscheck)),"overlap_rows":int(len(aligned)),
            "h4_log_return_correlation_diagnostic":corr,"h4_direction_agreement":direction,
            "daily_validation_rows":int(len(daily)),"daily_validation_log_return_correlation":daily_corr,"daily_validation_direction_agreement":daily_direction,
            "daily_validation_policy":"last native H4 close per UTC date for cross-check only; never used as backtest bars",
            "crosscheck_alignment_policy":"nearest source H4 timestamp within 2h; no OHLCV resampling",
            "median_absolute_price_delta_fraction":med_delta,"criteria":criteria,"broker_fetch_attempts":attempts,
            "cadence_audit":cadence,"generated_at":pd.Timestamp.now(tz="UTC").isoformat(),
        }
        receipt_path.write_text(json.dumps(receipt,indent=2,sort_keys=True)+"\n",encoding="utf-8")
        print(json.dumps(receipt,indent=2,sort_keys=True))
        return 0 if receipt["crosscheck_pass"] else 2
    finally:
        mt5.shutdown()

if __name__ == "__main__":
    raise SystemExit(main())
