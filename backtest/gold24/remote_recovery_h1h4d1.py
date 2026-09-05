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


def pair_stats(primary: pd.DataFrame, cross: pd.DataFrame) -> dict:
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
    return {
        "overlap_rows": int(len(a)),
        "log_return_correlation": corr,
        "direction_agreement": direction,
        "daily_log_return_correlation": daily_corr,
        "daily_direction_agreement": daily_direction,
        "median_absolute_price_delta_fraction": price_delta,
    }


def fetch_tv_contract(tv, symbol: str):
    from tvDatafeed import Interval

    try:
        raw = tv.get_hist(symbol=symbol, exchange="COMEX", interval=Interval.in_1_hour, n_bars=6500, extended_session=False)
        d = normalize_tv(raw, True)
        d["Contract"] = symbol
        print(
            f"H1_CONTRACT={symbol} ROWS={len(d)} START={d['Date'].iloc[0]} END={d['Date'].iloc[-1]}",
            flush=True,
        )
        return d
    except Exception as exc:
        print(f"H1_CONTRACT={symbol} SKIP={type(exc).__name__}:{exc}", flush=True)
        return None


def build_native_contract_continuous(tv) -> tuple[pd.DataFrame, dict]:
    # Gold standard delivery months: Feb/Apr/Jun/Aug/Oct/Dec.
    # Every emitted H1 OHLCV row is copied unchanged from one direct COMEX contract bar.
    # We never aggregate lower timeframe data into H1 and never back-adjust prices.
    month_codes = "GJMQVZ"
    frames: list[pd.DataFrame] = []
    attempted: list[str] = []
    accepted: list[str] = []

    for year in range(2020, 2027):
        for code in month_codes:
            symbols = [f"GC{code}{year}", f"GC{code}{str(year)[2:]}"]
            got = None
            for symbol in symbols:
                attempted.append(symbol)
                got = fetch_tv_contract(tv, symbol)
                if got is not None and len(got) >= 100:
                    accepted.append(symbol)
                    frames.append(got)
                    break

    if not frames:
        raise RuntimeError("no individual COMEX GC H1 contracts available")

    allc = pd.concat(frames, ignore_index=True)
    allc = allc.drop_duplicates(["Contract", "Date"], keep="last").sort_values(["Date", "Contract"])
    allc["Month"] = allc["Date"].dt.to_period("M").astype(str)

    # Deterministic continuous-futures selection: one native contract per UTC calendar month,
    # selected by the greatest total source volume in that month. This avoids hourly flip-flop.
    mv = (
        allc.groupby(["Month", "Contract"], as_index=False)["Volume"]
        .sum()
        .sort_values(["Month", "Volume", "Contract"], ascending=[True, False, True])
    )
    leader = mv.drop_duplicates("Month", keep="first")[["Month", "Contract"]].rename(columns={"Contract": "LeaderContract"})
    chosen = allc.merge(leader, on="Month", how="inner")
    chosen = chosen[chosen["Contract"] == chosen["LeaderContract"]].copy()
    chosen = chosen.sort_values("Date").drop_duplicates("Date", keep="last")

    # Scope enough history while retaining a margin beyond the 4-year hard requirement.
    chosen = chosen[chosen["Date"] >= pd.Timestamp("2020-01-01", tz="UTC")].copy()
    if chosen.empty:
        raise RuntimeError("contract continuous build is empty")

    leader_months = leader.sort_values("Month").to_dict(orient="records")
    contract_switches = int((leader.sort_values("Month")["LeaderContract"] != leader.sort_values("Month")["LeaderContract"].shift()).sum() - 1)
    meta = {
        "attempted_symbols": attempted,
        "accepted_symbols": accepted,
        "accepted_contract_count": len(accepted),
        "leader_month_count": int(len(leader)),
        "contract_switches": max(0, contract_switches),
        "leader_contract_by_month": leader_months,
        "selection_policy": "one direct COMEX H1 contract per UTC calendar month; highest total source volume; OHLCV rows copied unchanged; no resampling; no back-adjustment",
    }
    return chosen[["Date", "Open", "High", "Low", "Close", "Volume"]].reset_index(drop=True), meta


def fetch_h1() -> dict:
    from tvDatafeed import Interval, TvDatafeed

    out = OUT / "H1"
    primary_path = out / "GC_COMEX_TRADINGVIEW_H1_PRIMARY.csv"
    cross_path = out / "XAUUSD_OANDA_TRADINGVIEW_H1_CROSSCHECK.csv"
    gc1_path = out / "GC1_COMEX_TRADINGVIEW_H1_RECENT_CROSSCHECK.csv"
    receipt_path = out / "gate_a_receipt.json"
    receipt: dict = {
        "schema": "copytolive-gold-h1-gate-a-v5",
        "provider": "TradingView",
        "symbol": "GOLD",
        "timeframe": "H1",
        "construction": "DIRECT_NATIVE_COMEX_CONTRACT_H1_CONTINUOUS_NO_RESAMPLING",
        "no_resampling_attested": True,
        "back_adjustment": False,
    }
    try:
        tv = TvDatafeed()

        # First try direct continuous GC1!. Anonymous TradingView currently limits this to ~10k bars.
        direct_gc1 = normalize_tv(
            tv.get_hist(symbol="GC1!", exchange="COMEX", interval=Interval.in_1_hour, n_bars=40000, extended_session=False),
            True,
        )

        if len(direct_gc1) >= 20000 and (direct_gc1["Date"].iloc[-1] - direct_gc1["Date"].iloc[0]).total_seconds() >= 1460 * 86400:
            primary = direct_gc1.copy()
            construction_meta = {
                "selection_policy": "direct TradingView COMEX:GC1! H1 bars",
                "accepted_contract_count": 0,
                "contract_switches": None,
            }
            receipt["construction"] = "DIRECT_SOURCE_GC1_CONTINUOUS_H1_NO_RESAMPLING"
        else:
            print(
                f"GC1_DIRECT_H1_INSUFFICIENT ROWS={len(direct_gc1)} DAYS={(direct_gc1['Date'].iloc[-1]-direct_gc1['Date'].iloc[0]).total_seconds()/86400.0:.3f}; TRY_NATIVE_CONTRACT_STITCH",
                flush=True,
            )
            primary, construction_meta = build_native_contract_continuous(tv)

        cross = normalize_tv(
            tv.get_hist(symbol="XAUUSD", exchange="OANDA", interval=Interval.in_1_hour, n_bars=40000, extended_session=False),
            False,
        )

        primary.to_csv(primary_path, index=False, date_format="%Y-%m-%dT%H:%M:%SZ")
        cross.to_csv(cross_path, index=False, date_format="%Y-%m-%dT%H:%M:%SZ")
        direct_gc1.to_csv(gc1_path, index=False, date_format="%Y-%m-%dT%H:%M:%SZ")

        spot_stats = pair_stats(primary, cross)
        gc1_stats = pair_stats(primary, direct_gc1)

        history_days = float((primary["Date"].iloc[-1] - primary["Date"].iloc[0]).total_seconds() / 86400.0)
        recent_overlap_floor = max(7500, int(len(cross) * 0.75))
        gc1_overlap_floor = max(7500, int(len(direct_gc1) * 0.75))
        criteria = {
            "primary_rows_ge_20000": len(primary) >= 20000,
            "primary_history_ge_4_years": history_days >= 1460,
            "primary_reaches_2026": primary["Date"].iloc[-1].year >= 2026,
            "crosscheck_reaches_2026": cross["Date"].iloc[-1].year >= 2026,
            "recent_spot_overlap_ge_75pct": spot_stats["overlap_rows"] >= recent_overlap_floor,
            "recent_gc1_overlap_ge_75pct": gc1_stats["overlap_rows"] >= gc1_overlap_floor,
            "spot_h1_log_return_corr_ge_0_70": bool(np.isfinite(spot_stats["log_return_correlation"]) and spot_stats["log_return_correlation"] >= 0.70),
            "spot_h1_direction_ge_0_70": spot_stats["direction_agreement"] >= 0.70,
            "spot_daily_corr_ge_0_85": bool(np.isfinite(spot_stats["daily_log_return_correlation"]) and spot_stats["daily_log_return_correlation"] >= 0.85),
            "spot_daily_direction_ge_0_75": spot_stats["daily_direction_agreement"] >= 0.75,
            "spot_median_abs_price_delta_le_0_08": spot_stats["median_absolute_price_delta_fraction"] <= 0.08,
            "gc1_h1_log_return_corr_ge_0_90": bool(np.isfinite(gc1_stats["log_return_correlation"]) and gc1_stats["log_return_correlation"] >= 0.90),
            "gc1_daily_corr_ge_0_95": bool(np.isfinite(gc1_stats["daily_log_return_correlation"]) and gc1_stats["daily_log_return_correlation"] >= 0.95),
            "no_resampling": True,
            "no_back_adjustment": True,
        }
        receipt.update(
            {
                "crosscheck_pass": bool(all(criteria.values())),
                "criteria": criteria,
                "primary_symbol": "COMEX:GC native individual futures contracts / GC1! fallback",
                "crosscheck_symbol": "OANDA:XAUUSD + COMEX:GC1! recent",
                "primary_rows": int(len(primary)),
                "crosscheck_rows": int(len(cross)),
                "gc1_recent_rows": int(len(direct_gc1)),
                "primary_start_utc": str(primary["Date"].iloc[0]),
                "primary_end_utc": str(primary["Date"].iloc[-1]),
                "crosscheck_start_utc": str(cross["Date"].iloc[0]),
                "crosscheck_end_utc": str(cross["Date"].iloc[-1]),
                "primary_history_days": history_days,
                "spot_validation": spot_stats,
                "gc1_recent_validation": gc1_stats,
                "construction_meta": construction_meta,
                "primary_sha256": sha256(primary_path),
                "crosscheck_data_sha256": sha256(cross_path),
                "gc1_recent_sha256": sha256(gc1_path),
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
print(
    json.dumps(
        {
            "D1_PASS": d1.get("crosscheck_pass"),
            "H4_PASS": h4.get("crosscheck_pass"),
            "H1_PASS": h1.get("crosscheck_pass"),
            "H1_ROWS": h1.get("primary_rows"),
            "H1_HISTORY_DAYS": h1.get("primary_history_days"),
            "H1_CONSTRUCTION": h1.get("construction"),
            "ALL_PASS": status["all_pass"],
        },
        indent=2,
    ),
    flush=True,
)
