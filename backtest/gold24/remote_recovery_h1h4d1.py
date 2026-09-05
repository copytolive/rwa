from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
OUT = Path(os.environ.get("RECOVERY", "/tmp/gold-h1-h4-d1-recovery"))
OUT.mkdir(parents=True, exist_ok=True)
for tf in ("D1", "H4", "H1"):
    (OUT / tf).mkdir(parents=True, exist_ok=True)


def run(cmd: list[str]) -> int:
    print("RUN:", " ".join(cmd), flush=True)
    return subprocess.run(cmd, check=False).returncode


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def normalize_tv(df: pd.DataFrame | None, require_volume: bool) -> pd.DataFrame:
    if df is None or df.empty:
        raise RuntimeError("TradingView returned no H1 bars")
    x = df.reset_index() if isinstance(df.index, pd.DatetimeIndex) else df.copy()
    cols = {str(c).lower(): c for c in x.columns}
    dt_col = cols.get("datetime") or cols.get("date") or cols.get("index") or x.columns[0]
    rename: dict[object, str] = {}
    for src, dst in (("open", "Open"), ("high", "High"), ("low", "Low"), ("close", "Close"), ("volume", "Volume")):
        if src in cols:
            rename[cols[src]] = dst
    x = x.rename(columns=rename)
    for col in ("Open", "High", "Low", "Close"):
        if col not in x.columns:
            raise RuntimeError(f"missing H1 {col}")
    r = pd.DataFrame(
        {
            "Date": pd.to_datetime(x[dt_col], utc=True, errors="coerce"),
            "Open": pd.to_numeric(x["Open"], errors="coerce"),
            "High": pd.to_numeric(x["High"], errors="coerce"),
            "Low": pd.to_numeric(x["Low"], errors="coerce"),
            "Close": pd.to_numeric(x["Close"], errors="coerce"),
        }
    )
    if "Volume" in x.columns:
        r["Volume"] = pd.to_numeric(x["Volume"], errors="coerce")
    else:
        r["Volume"] = np.nan
    if require_volume and r["Volume"].isna().any():
        raise RuntimeError("primary H1 futures volume missing")
    if not require_volume:
        r["Volume"] = r["Volume"].fillna(0.0)
    if r[["Date", "Open", "High", "Low", "Close", "Volume"]].isna().any().any():
        raise RuntimeError("NaN H1 data")
    r = r.drop_duplicates("Date", keep="last").sort_values("Date").reset_index(drop=True)
    o, h, l, c = (r[z].to_numpy(float) for z in ("Open", "High", "Low", "Close"))
    if np.any(h < l) or np.any(o < l) or np.any(o > h) or np.any(c < l) or np.any(c > h):
        raise RuntimeError("H1 OHLC consistency violation")
    if len(r) > 1:
        median_hours = float(r["Date"].diff().dropna().dt.total_seconds().median() / 3600.0)
        if median_hours > 2.5:
            raise RuntimeError(f"not H1 cadence: median={median_hours}h")
    return r


def fetch_h1() -> dict:
    from tvDatafeed import Interval, TvDatafeed

    out = OUT / "H1"
    primary_path = out / "GC1_COMEX_TRADINGVIEW_H1_PRIMARY.csv"
    cross_path = out / "XAUUSD_OANDA_TRADINGVIEW_H1_CROSSCHECK.csv"
    receipt_path = out / "gate_a_receipt.json"
    receipt: dict = {
        "schema": "copytolive-gold-h1-gate-a-v4",
        "provider": "TradingView",
        "symbol": "GOLD",
        "timeframe": "H1",
        "construction": "DIRECT_SOURCE_H1_BARS_NO_RESAMPLING",
        "no_resampling_attested": True,
    }
    try:
        tv = TvDatafeed()
        primary = normalize_tv(
            tv.get_hist(symbol="GC1!", exchange="COMEX", interval=Interval.in_1_hour, n_bars=40000, extended_session=False),
            True,
        )
        cross = normalize_tv(
            tv.get_hist(symbol="XAUUSD", exchange="OANDA", interval=Interval.in_1_hour, n_bars=40000, extended_session=False),
            False,
        )
        primary.to_csv(primary_path, index=False, date_format="%Y-%m-%dT%H:%M:%SZ")
        cross.to_csv(cross_path, index=False, date_format="%Y-%m-%dT%H:%M:%SZ")

        a = pd.merge_asof(
            primary[["Date", "Close"]].rename(columns={"Date": "primary_date", "Close": "primary_close"}).sort_values("primary_date"),
            cross[["Date", "Close"]].rename(columns={"Date": "cross_date", "Close": "cross_close"}).sort_values("cross_date"),
            left_on="primary_date",
            right_on="cross_date",
            direction="nearest",
            tolerance=pd.Timedelta(minutes=90),
        ).dropna()
        rp = np.log(a["primary_close"]).diff()
        rx = np.log(a["cross_close"]).diff()
        good = rp.notna() & rx.notna()
        corr = float(rp[good].corr(rx[good])) if good.sum() > 2 else float("nan")
        direction = float((np.sign(rp[good]) == np.sign(rx[good])).mean()) if good.any() else 0.0
        price_delta = float(((a["primary_close"] / a["cross_close"]) - 1.0).abs().median()) if len(a) else float("inf")

        pdaily = primary.assign(day=primary["Date"].dt.floor("D")).groupby("day")["Close"].last()
        xdaily = cross.assign(day=cross["Date"].dt.floor("D")).groupby("day")["Close"].last()
        daily = pd.concat([pdaily.rename("p"), xdaily.rename("x")], axis=1).dropna()
        drp = np.log(daily["p"]).diff()
        drx = np.log(daily["x"]).diff()
        dgood = drp.notna() & drx.notna()
        daily_corr = float(drp[dgood].corr(drx[dgood])) if dgood.sum() > 2 else float("nan")
        daily_direction = float((np.sign(drp[dgood]) == np.sign(drx[dgood])).mean()) if dgood.any() else 0.0

        history_days = float((primary["Date"].iloc[-1] - primary["Date"].iloc[0]).total_seconds() / 86400.0)
        overlap_floor = max(10000, int(min(len(primary), len(cross)) * 0.90))
        criteria = {
            "primary_rows_ge_20000": len(primary) >= 20000,
            "primary_history_ge_4_years": history_days >= 1460,
            "primary_reaches_2026": primary["Date"].iloc[-1].year >= 2026,
            "crosscheck_reaches_2026": cross["Date"].iloc[-1].year >= 2026,
            "overlap_ge_90pct": len(a) >= overlap_floor,
            "h1_log_return_corr_ge_0_70": bool(np.isfinite(corr) and corr >= 0.70),
            "h1_direction_ge_0_70": direction >= 0.70,
            "daily_corr_ge_0_85": bool(np.isfinite(daily_corr) and daily_corr >= 0.85),
            "daily_direction_ge_0_75": daily_direction >= 0.75,
            "median_abs_price_delta_le_0_08": price_delta <= 0.08,
        }
        receipt.update(
            {
                "crosscheck_pass": bool(all(criteria.values())),
                "criteria": criteria,
                "primary_symbol": "COMEX:GC1!",
                "crosscheck_symbol": "OANDA:XAUUSD",
                "primary_rows": int(len(primary)),
                "crosscheck_rows": int(len(cross)),
                "primary_start_utc": str(primary["Date"].iloc[0]),
                "primary_end_utc": str(primary["Date"].iloc[-1]),
                "crosscheck_start_utc": str(cross["Date"].iloc[0]),
                "crosscheck_end_utc": str(cross["Date"].iloc[-1]),
                "primary_history_days": history_days,
                "overlap_rows": int(len(a)),
                "h1_log_return_correlation": corr,
                "h1_direction_agreement": direction,
                "daily_validation_log_return_correlation": daily_corr,
                "daily_validation_direction_agreement": daily_direction,
                "median_absolute_price_delta_fraction": price_delta,
                "primary_sha256": sha256(primary_path),
                "crosscheck_data_sha256": sha256(cross_path),
            }
        )
    except Exception as exc:
        receipt.update({"crosscheck_pass": False, "error": f"{type(exc).__name__}: {exc}"})
    receipt["generated_at"] = pd.Timestamp.now(tz="UTC").isoformat()
    receipt_path.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(receipt, indent=2, sort_keys=True), flush=True)
    return receipt


def load_receipt(path: Path) -> dict:
    if not path.exists():
        return {"crosscheck_pass": False, "error": f"missing receipt: {path.name}"}
    try:
        return json.loads(path.read_text())
    except Exception as exc:
        return {"crosscheck_pass": False, "error": f"invalid receipt: {exc}"}


print("=== D1 ===", flush=True)
d1_rc = run([sys.executable, str(HERE / "tradingview_gate_a.py"), "--out-dir", str(OUT / "D1"), "--bars", "6500"])
print("D1_RC=", d1_rc, flush=True)

print("=== H4 ===", flush=True)
h4_rc = run([sys.executable, str(HERE / "tradingview_native_h4_gate_a.py"), "--out-dir", str(OUT / "H4"), "--bars", "20000"])
print("H4_RC=", h4_rc, flush=True)

print("=== H1 ===", flush=True)
h1 = fetch_h1()
d1 = load_receipt(OUT / "D1" / "gate_a_receipt.json")
h4 = load_receipt(OUT / "H4" / "gate_a_h4_receipt.json")

status = {
    "D1": d1,
    "H4": h4,
    "H1": h1,
    "all_pass": bool(d1.get("crosscheck_pass") and h4.get("crosscheck_pass") and h1.get("crosscheck_pass")),
}
(OUT / "RECOVERY_STATUS.json").write_text(json.dumps(status, indent=2, sort_keys=True) + "\n", encoding="utf-8")
print(json.dumps({"D1_PASS": d1.get("crosscheck_pass"), "H4_PASS": h4.get("crosscheck_pass"), "H1_PASS": h1.get("crosscheck_pass"), "H1_ROWS": h1.get("primary_rows"), "H1_HISTORY_DAYS": h1.get("primary_history_days"), "ALL_PASS": status["all_pass"]}, indent=2), flush=True)
