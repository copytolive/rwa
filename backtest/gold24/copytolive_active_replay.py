from __future__ import annotations

"""Replay the exact 118 GOLD strategies active on CopyToLive Home.

Unlike copytolive_discovery.py, this file does not generate substitute GOLD24
signals. It executes the checksum-locked strategy sources captured from
CopyToLive production, on GOLD H1, through copytolive_compat.py.

The CopyToLive execution contract is preserved exactly. GitHub then adds the
existing portfolio gates: sample, PF, net profit, DD, OOS, positive years,
global absolute Pearson(log-equity) and Monte Carlo.
"""

import argparse
import csv
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

from core import pearson_log_equity
from copytolive_compat import (
    COPYTOLIVE_DEPOSIT_USD,
    COPYTOLIVE_RISK_USD,
    COPYTOLIVE_STRESSED_FEE,
    CopyToLiveExecutionConfig,
    compute_copytolive_metrics,
    execution_digest,
    run_copytolive_backtest,
)
from multimethod_v1_full_rescan import annual_stats, monte_carlo_metrics

MIN_ENTRY = 300
MIN_NET_PROFIT_USD = 20_000.0
MIN_PF = 1.20
MAX_DD_PCT = 25.0
MIN_OOS_PF = 1.00
MIN_POSITIVE_YEAR_PCT = 60.0
CORR_MAX = 0.50

HERE = Path(__file__).resolve().parent
DEFAULT_MANIFEST = HERE / "copytolive_active_gold_manifest.json"
DEFAULT_SOURCES = HERE / "copytolive_gold_strategy_sources.json"


def sha256_bytes(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def finite(value, default=0.0) -> float:
    try:
        x = float(value)
        return x if math.isfinite(x) else float(default)
    except Exception:
        return float(default)


def load_ohlcv(path: Path, *, label: str, min_rows: int) -> pd.DataFrame:
    """Load production-style OHLCV from CSV or parquet without changing wall-clock timestamps."""
    if path.suffix.lower() in {".parquet", ".pq"}:
        raw = pd.read_parquet(path)
    else:
        raw = pd.read_csv(path)

    rename = {}
    for col in raw.columns:
        lo = str(col).lower()
        if lo in {"date", "time", "timestamp", "datetime"}:
            rename[col] = "Date"
        elif lo in {"open", "high", "low", "close", "volume"}:
            rename[col] = lo
    d = raw.rename(columns=rename).copy()

    # Canonical production parquets store the timestamp in a DatetimeIndex.
    if "Date" not in d.columns and isinstance(d.index, pd.DatetimeIndex):
        d.insert(0, "Date", pd.DatetimeIndex(d.index))

    required = {"Date", "open", "high", "low", "close"}
    missing = required - set(d.columns)
    if missing:
        raise RuntimeError(f"{label} dataset missing columns: {sorted(missing)}")
    if "volume" not in d:
        d["volume"] = 0.0

    if pd.api.types.is_numeric_dtype(d["Date"]):
        dt = pd.to_datetime(d["Date"], unit="ms", errors="coerce")
    else:
        dt = pd.to_datetime(d["Date"], errors="coerce")
    if dt.isna().any():
        raise RuntimeError(f"invalid {label} timestamps")

    # The producer uses the parquet index's wall-clock hour directly.  Do not
    # apply a timezone conversion here; only remove an existing timezone while
    # preserving the represented UTC wall clock from the canonical dataset.
    if getattr(dt.dt, "tz", None) is not None:
        dt = dt.dt.tz_convert("UTC").dt.tz_localize(None)
    d["Date"] = dt

    for col in ("open", "high", "low", "close", "volume"):
        d[col] = pd.to_numeric(d[col], errors="coerce")
    d = d.dropna(subset=["open", "high", "low", "close"])
    d = d.drop_duplicates(subset=["Date"], keep="last").sort_values("Date").reset_index(drop=True)

    if len(d) < min_rows:
        raise RuntimeError(f"{label} dataset unexpectedly short: {len(d)}")
    if (d["high"] < d["low"]).any():
        raise RuntimeError(f"high < low in {label} dataset")
    if ((d["open"] < d["low"]) | (d["open"] > d["high"]) |
        (d["close"] < d["low"]) | (d["close"] > d["high"])).any():
        raise RuntimeError(f"open/close outside {label} bar range")
    return d


def load_h1(path: Path) -> pd.DataFrame:
    return load_ohlcv(path, label="H1", min_rows=10_000)


def load_d1(path: Path) -> pd.DataFrame:
    return load_ohlcv(path, label="D1", min_rows=1_000)


def load_sources(manifest_path: Path, sources_path: Path):
    manifest = json.loads(manifest_path.read_text())
    pack = json.loads(sources_path.read_text())
    strategies = manifest.get("strategies") or []
    scripts = pack.get("scripts") or {}

    expected = int(manifest.get("snapshot", {}).get("active_gold_count", 0))
    if expected != 118 or len(strategies) != 118 or len(scripts) != 118:
        raise RuntimeError(
            f"active GOLD snapshot must be 118/118: expected={expected}, "
            f"manifest={len(strategies)}, scripts={len(scripts)}"
        )
    if pack.get("farm_sha256") != manifest["snapshot"]["farm_sha256"]:
        raise RuntimeError("farm SHA mismatch between manifest and source pack")
    if pack.get("state_sha256") != manifest["snapshot"]["state_sha256"]:
        raise RuntimeError("state SHA mismatch between manifest and source pack")

    seen = set()
    for s in strategies:
        sid = str(s["id"])
        if sid in seen:
            raise RuntimeError(f"duplicate strategy id: {sid}")
        seen.add(sid)
        if s.get("symbol") != "GOLD" or s.get("timeframe") != "H1" or s.get("homeUniverse") is not True:
            raise RuntimeError(f"invalid active GOLD manifest row: {sid}")
        src = scripts.get(sid)
        if src is None:
            raise RuntimeError(f"missing exact strategy source: {sid}")
        expected_sha = s["source_script"]["sha256"]
        if sha256_bytes(src.encode("utf-8")) != expected_sha:
            raise RuntimeError(f"source SHA mismatch: {sid}")
    return manifest, scripts


def compile_signal(s: dict, source: str):
    ns = {"__name__": f"copytolive_active_{s['id']}"}
    exec(compile(source, s["source_script"]["path"], "exec"), ns, ns)
    run = ns.get("run")
    if not callable(run):
        raise RuntimeError(f"no run() in source: {s['id']}")
    for key in ("SL_PCT", "TP_RATIO", "RISK", "DEPOSIT"):
        if key not in ns:
            raise RuntimeError(f"{key} missing from source: {s['id']}")
    if not math.isclose(float(ns["SL_PCT"]), float(s["sl_pct"]), abs_tol=1e-12):
        raise RuntimeError(f"SL mismatch source/manifest: {s['id']}")
    if not math.isclose(float(ns["TP_RATIO"]), float(s["tp_ratio"]), abs_tol=1e-12):
        raise RuntimeError(f"TP mismatch source/manifest: {s['id']}")
    if not math.isclose(float(ns["RISK"]), COPYTOLIVE_RISK_USD, abs_tol=1e-12):
        raise RuntimeError(f"risk mismatch: {s['id']}")
    if not math.isclose(float(ns["DEPOSIT"]), COPYTOLIVE_DEPOSIT_USD, abs_tol=1e-12):
        raise RuntimeError(f"deposit mismatch: {s['id']}")
    return run


def production_filter_mode(strategy_id: str) -> str:
    parts = str(strategy_id).split("_", 2)
    if len(parts) < 3 or parts[0] != "ND" or parts[1] not in {"VOL","MTF","VM","VS","ALL"}:
        raise RuntimeError(f"unsupported CopyToLive Non-DEX filter mode: {strategy_id}")
    return parts[1]


def build_production_masks(
    d: pd.DataFrame,
    d1: pd.DataFrame,
) -> dict[str, tuple[np.ndarray, np.ndarray]]:
    """Reproduce pipeline/wf_nondex_btc_gold.py filter construction exactly.

    Critical lineage detail: production reads GOLD_H1.parquet and
    GOLD_D1.parquet independently.  The MTF bias therefore MUST use the
    canonical D1 parquet, not a D1 series reconstructed from H1.
    """
    c = d["close"].to_numpy(np.float64)
    h = d["high"].to_numpy(np.float64)
    l = d["low"].to_numpy(np.float64)
    n = len(c)

    # compute_vol_mask(c,h,l, period=14, ma_period=50)
    vol_mask = np.zeros(n, dtype=np.int8)
    tr = np.zeros(n, dtype=np.float64)
    for i in range(1, n):
        tr[i] = max(h[i]-l[i], abs(h[i]-c[i-1]), abs(l[i]-c[i-1]))
    atr = np.zeros(n, dtype=np.float64)
    for i in range(14, n):
        atr[i] = np.mean(tr[i-14+1:i+1])
    atr_ma = np.zeros(n, dtype=np.float64)
    for i in range(50, n):
        atr_ma[i] = np.mean(atr[i-50+1:i+1])
    for i in range(50, n):
        if atr[i] > atr_ma[i]:
            vol_mask[i] = 1

    # compute_mtf_bias(c_h1, df_d1) from the canonical, separate D1 parquet.
    mtf_bias = np.zeros(n, dtype=np.int8)
    if len(d1) >= 200:
        d1c = d1["close"].to_numpy(np.float64)
        ema50 = pd.Series(d1c).ewm(span=50).mean().to_numpy()
        ema200 = pd.Series(d1c).ewm(span=200).mean().to_numpy()
        h1_per_d1 = n // max(len(d1c), 1)
        for i in range(200, len(d1c)):
            h1_start = i * h1_per_d1
            h1_end = min((i + 1) * h1_per_d1, n)
            if h1_start >= n:
                break
            mtf_bias[h1_start:h1_end] = 1 if ema50[i] > ema200[i] else -1

    # GOLD session filter in production: parquet-index hour 07..21 inclusive.
    session = np.ones(n, dtype=np.int8)
    hours = d["Date"].dt.hour.to_numpy()
    session[(hours < 7) | (hours > 21)] = 0
    zeros = np.zeros(n, dtype=np.int8)
    ones = np.ones(n, dtype=np.int8)
    return {
        "VOL": (vol_mask, zeros),
        "MTF": (ones, mtf_bias),
        "VM": (vol_mask, mtf_bias),
        "VS": (vol_mask * session, zeros),
        "ALL": (vol_mask * session, mtf_bias),
    }


def apply_production_filter(strategy_id: str, sig: np.ndarray, masks: dict[str, tuple[np.ndarray, np.ndarray]]) -> np.ndarray:
    mode = production_filter_mode(strategy_id)
    vol_mask, bias_mask = masks[mode]
    out = np.asarray(sig, dtype=np.int8).copy()
    out[vol_mask != 1] = 0
    reject_bias = (bias_mask != 0) & (out != 0) & (out != bias_mask)
    out[reject_bias] = 0
    return out


def producer_metrics(profits: np.ndarray) -> dict:
    """Exact metric arithmetic/rounding from pipeline/wf_nondex_btc_gold.py::vs."""
    profits = np.asarray(profits, dtype=np.float64)
    n = len(profits)
    if n == 0:
        return {
            "totalTrades":0,"winRate":0.0,"profitFactor":0.0,"maxDrawdown":0.0,
            "netProfit":0.0,"sqn":0.0,"sharpe":0.0,"sortino":0.0,"calmar":0.0,
            "recoveryFactor":0.0,"grossProfit":0.0,"grossLoss":0.0,
            "winningTrades":0,"losingTrades":0,"avgProfit":0.0,"avgLoss":0.0,
            "rr":0.0,"maxConsecWin":0,"maxConsecLoss":0,
        }
    w = profits[profits > 0]
    loss = profits[profits <= 0]
    wr = len(w) / n * 100.0
    gp = float(w.sum()) if len(w) else 0.0
    gl = float(abs(loss.sum())) if len(loss) else 0.0
    pf_val = gp / gl if gl > 0 else 0.0
    eq = COPYTOLIVE_DEPOSIT_USD + np.cumsum(profits)
    peak = np.maximum.accumulate(eq)
    mdd = float(((peak-eq)/np.maximum(peak,1)*100).max()) if len(eq) else 0.0
    net = gp - gl
    aw = float(w.mean()) if len(w) else 0.0
    al = float(abs(loss.mean())) if len(loss) else 0.0
    std = float(profits.std())
    sqn = (float(profits.mean())/std)*np.sqrt(n) if std > 0 else 0.0
    sharpe = (float(profits.mean())/std)*np.sqrt(252) if std > 0 else 0.0
    down = profits[profits < 0]
    dstd = float(down.std()) if len(down) > 1 else 0.0
    sortino = (float(profits.mean())/dstd)*np.sqrt(252) if dstd > 0 else 0.0
    recov = net/(mdd/100*COPYTOLIVE_DEPOSIT_USD) if mdd > 0.01 else 0.0
    cal = (net/COPYTOLIVE_DEPOSIT_USD*100)/mdd if mdd > 0.01 else 0.0
    rr = aw/al if al > 0 else 0.0
    cw=mcw=cl=mcl=0
    for p in profits:
        if p > 0:
            cw += 1; mcw=max(mcw,cw); cl=0
        else:
            cl += 1; mcl=max(mcl,cl); cw=0
    return {
        "totalTrades":int(n),"winRate":round(wr,1),"profitFactor":round(pf_val,2),
        "maxDrawdown":round(mdd,1),"netProfit":round(net,2),"sqn":round(float(sqn),2),
        "sharpe":round(float(sharpe),2),"sortino":round(min(float(sortino),99),2),
        "calmar":round(min(float(cal),99),2),"recoveryFactor":round(min(float(recov),99),2),
        "grossProfit":round(gp,2),"grossLoss":round(gl,2),
        "winningTrades":int(len(w)),"losingTrades":int(len(loss)),
        "avgProfit":round(aw,2),"avgLoss":round(al,2),"rr":round(rr,2),
        "maxConsecWin":int(mcw),"maxConsecLoss":int(mcl),
    }


def oos_metrics(trades: list[dict], d: pd.DataFrame) -> dict:
    # Production split is positional and classifies by EXIT index: xi <= int(n*.70).
    split_i = int(len(d) * 0.70)
    test_pnl = np.asarray(
        [float(t["profit"]) for t in trades if int(t.get("exitBar", -1)) > split_i],
        dtype=np.float64,
    )
    m = producer_metrics(test_pnl)
    return {
        "oos_trades": int(m["totalTrades"]),
        "oos_profit_factor": finite(m["profitFactor"]),
        "oos_win_rate_pct": finite(m["winRate"]),
        "oos_net_profit_usd": finite(m["netProfit"]),
    }


def parity_expected(s: dict, m: dict, oos: dict) -> dict:
    mapping = {
        "totalTrades": (int(s.get("totalTrades", 0)), int(m.get("totalTrades", 0))),
        "winRate": (finite(s.get("winRate")), finite(m.get("winRate"))),
        "profitFactor": (finite(s.get("profitFactor")), finite(m.get("profitFactor"))),
        "netProfit": (finite(s.get("netProfit")), finite(m.get("netProfit"))),
        "maxDrawdownPercent": (finite(s.get("maxDrawdownPercent")), finite(m.get("maxDrawdown"))),
        "sqn": (finite(s.get("sqn")), finite(m.get("sqn"))),
        "recoveryFactor": (finite(s.get("recoveryFactor")), finite(m.get("recoveryFactor"))),
        "wf_test_pf": (finite(s.get("wf_test_pf")), finite(oos.get("oos_profit_factor"))),
    }
    return {
        k: {"expected": exp, "actual": act, "delta": float(act) - float(exp)}
        for k, (exp, act) in mapping.items()
    }


def replay_one(s: dict, source: str, d: pd.DataFrame, masks: dict[str, tuple[np.ndarray, np.ndarray]]):
    run = compile_signal(s, source)
    close = d["close"].to_numpy(np.float64)
    high = d["high"].to_numpy(np.float64)
    low = d["low"].to_numpy(np.float64)
    raw_sig = np.asarray(run(close, high, low), dtype=np.int8)
    if len(raw_sig) != len(d):
        raise RuntimeError(f"signal length mismatch: {s['id']}")
    if not np.isin(raw_sig, [-1, 0, 1]).all():
        raise RuntimeError(f"non -1/0/+1 signal: {s['id']}")
    sig = apply_production_filter(s["id"], raw_sig, masks)

    cfg = CopyToLiveExecutionConfig(sl_pct=float(s["sl_pct"]), tp_ratio=float(s["tp_ratio"]))
    result = run_copytolive_backtest(d, sig, cfg)
    trades = list(result["trades"])
    pnl = np.asarray([float(t["profit"]) for t in trades], dtype=float)
    m = producer_metrics(pnl)
    bar_pnl = np.asarray(result["bar_pnl"], dtype=float)
    oos = oos_metrics(trades, d)
    ann = annual_stats(d, bar_pnl)

    start = pd.Timestamp(d["Date"].iloc[0])
    end = pd.Timestamp(d["Date"].iloc[-1])
    years = max((end - start).total_seconds() / (365.25 * 86400), 0.0)

    row = {
        "strategy_id": s["id"],
        "production_filter_mode": production_filter_mode(s["id"]),
        "raw_signal_nonzero": int(np.count_nonzero(raw_sig)),
        "filtered_signal_nonzero": int(np.count_nonzero(sig)),
        "signal_type": s.get("signalType"),
        "timeframe": "H1",
        "order": "PENDING",
        "direction": (
            "BOTH" if any(t["type"] == "BUY" for t in trades) and any(t["type"] == "SELL" for t in trades)
            else "LONG_ONLY" if any(t["type"] == "BUY" for t in trades)
            else "SHORT_ONLY" if any(t["type"] == "SELL" for t in trades)
            else "N/A"
        ),
        "sl_pct": float(s["sl_pct"]),
        "tp_ratio": float(s["tp_ratio"]),
        "total_entry": int(m["totalTrades"]),
        "win_rate_pct": finite(m["winRate"]),
        "profit_factor": finite(m["profitFactor"]),
        "net_profit_usd": finite(m["netProfit"]),
        "ev_per_trade_usd": finite(m["netProfit"]) / int(m["totalTrades"]) if int(m["totalTrades"]) else 0.0,
        "avg_win_loss_ratio": finite(m.get("rr")),
        "max_dd_pct": finite(m["maxDrawdown"]),
        "recovery_factor": finite(m["recoveryFactor"]),
        "max_consecutive_loss": int(m["maxConsecLoss"]),
        "sqn": finite(m["sqn"]),
        **oos,
        **ann,
        "backtest_start_utc": str(start),
        "backtest_end_utc": str(end),
        "history_years": years,
        "sample_v11": f"{int(m['totalTrades'])}/300 {'PASS' if int(m['totalTrades']) >= 300 else 'FAIL'}",
        "execution_hash": execution_digest(trades),
        "source_script_path": s["source_script"]["path"],
        "source_script_sha256": s["source_script"]["sha256"],
        "expected_production": {
            "totalTrades": s.get("totalTrades"),
            "winRate": s.get("winRate"),
            "profitFactor": s.get("profitFactor"),
            "netProfit": s.get("netProfit"),
            "maxDrawdownPercent": s.get("maxDrawdownPercent"),
            "sqn": s.get("sqn"),
            "recoveryFactor": s.get("recoveryFactor"),
            "wf_test_pf": s.get("wf_test_pf"),
        },
        "parity_delta": parity_expected(s, m, oos),
    }
    pre = (
        row["total_entry"] >= MIN_ENTRY
        and row["net_profit_usd"] >= MIN_NET_PROFIT_USD
        and row["profit_factor"] >= MIN_PF
        and row["ev_per_trade_usd"] > 0.0
        and row["max_dd_pct"] <= MAX_DD_PCT
        and row["oos_profit_factor"] >= MIN_OOS_PF
        and row["positive_years_pct"] >= MIN_POSITIVE_YEAR_PCT
    )
    row["pre_corr_gate"] = bool(pre)
    return row, bar_pnl, pnl


def quality(row: dict):
    return (
        float(row["profit_factor"]),
        float(row["net_profit_usd"]),
        -float(row["max_dd_pct"]),
        int(row["total_entry"]),
        float(row["sqn"]),
        row["strategy_id"],
    )


def apply_correlation(rows: list[dict], barpnls: dict[str, np.ndarray]):
    eligible = sorted([r for r in rows if r["pre_corr_gate"]], key=quality, reverse=True)
    selected = []
    removed = []
    for row in eligible:
        pairs = []
        for prior in selected:
            corr = abs(float(pearson_log_equity(barpnls[row["strategy_id"]], barpnls[prior["strategy_id"]])))
            pairs.append((corr, prior["strategy_id"]))
        max_corr, against = max(pairs, default=(0.0, None), key=lambda x: x[0])
        row["correlation_max"] = float(max_corr)
        row["correlation_against"] = against
        if max_corr <= CORR_MAX + 1e-12:
            row["correlation_gate"] = "PASS"
            selected.append(row)
        else:
            row["correlation_gate"] = "REMOVED >0.50"
            removed.append(row)

    for row in rows:
        if not row["pre_corr_gate"]:
            row["correlation_max"] = None
            row["correlation_against"] = None
            row["correlation_gate"] = "BASE FAIL"
    return selected, removed


def row28(row: dict) -> dict:
    avg_win = finite(row.get("expected_production", {}).get("avgProfit", 0.0))
    avg_loss = finite(row.get("expected_production", {}).get("avgLoss", 0.0))
    return {
        "Metode": row["strategy_id"],
        "TF": row["timeframe"],
        "Order": row["order"],
        "Direction": row["direction"],
        "SL": row["sl_pct"],
        "TP": row["tp_ratio"],
        "Total Entry": row["total_entry"],
        "WR": row["win_rate_pct"],
        "PF Net": row["profit_factor"],
        "Net Profit": row["net_profit_usd"],
        "EV/Trade": row["ev_per_trade_usd"],
        "Avg Win/Loss": row["avg_win_loss_ratio"],
        "Max DD": row["max_dd_pct"],
        "Recovery Factor": row["recovery_factor"],
        "Max Consecutive Loss": row["max_consecutive_loss"],
        "SQN": row["sqn"],
        "OOS PF": row["oos_profit_factor"],
        "Monte Carlo Pass": "PASS" if row.get("monte_carlo_pass") else "FAIL",
        "MC 95% DD": row.get("mc_95pct_max_drawdown_pct"),
        "Positive Year": row["positive_years_pct"],
        "Worst Year": row["worst_year"],
        "Periode Backtest": f"{row['backtest_start_utc'][:10]} – {row['backtest_end_utc'][:10]}",
        "History": row["history_years"],
        "Sample v11": row["sample_v11"],
        "Corr Max": row.get("correlation_max"),
        "Corr Gate": row.get("correlation_gate"),
        "Python Script": row["source_script_path"],
        "MT5 Script": "NOT PRESENT",
    }


def write_csv(path: Path, rows: list[dict]):
    fields = [
        "Metode","TF","Order","Direction","SL","TP","Total Entry","WR","PF Net","Net Profit",
        "EV/Trade","Avg Win/Loss","Max DD","Recovery Factor","Max Consecutive Loss","SQN","OOS PF",
        "Monte Carlo Pass","MC 95% DD","Positive Year","Worst Year","Periode Backtest","History",
        "Sample v11","Corr Max","Corr Gate","Python Script","MT5 Script"
    ]
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for row in rows:
            w.writerow(row28(row))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True)
    ap.add_argument("--d1-dataset", required=True)
    ap.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    ap.add_argument("--sources", default=str(DEFAULT_SOURCES))
    ap.add_argument("--out-dir", required=True)
    args = ap.parse_args()

    manifest, scripts = load_sources(Path(args.manifest), Path(args.sources))
    d = load_h1(Path(args.dataset))
    d1 = load_d1(Path(args.d1_dataset))
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    production_masks = build_production_masks(d, d1)

    rows = []
    barpnls = {}
    tradepnls = {}
    errors = []
    for i, s in enumerate(manifest["strategies"], 1):
        try:
            row, bp, pnl = replay_one(s, scripts[s["id"]], d, production_masks)
            rows.append(row)
            barpnls[s["id"]] = bp
            tradepnls[s["id"]] = pnl
            print(
                f"[{i:03d}/118] {s['id']} entries={row['total_entry']} "
                f"pf={row['profit_factor']:.3f} dd={row['max_dd_pct']:.2f}% "
                f"oos={row['oos_profit_factor']:.3f}"
            )
        except Exception as exc:
            errors.append({"strategy_id": s.get("id"), "error": f"{type(exc).__name__}: {exc}"})
            print(f"[{i:03d}/118] ERROR {s.get('id')}: {exc}")

    if errors:
        (out / "active_gold_errors.json").write_text(json.dumps(errors, indent=2) + "\n")
        raise RuntimeError(f"{len(errors)} active strategy replay errors")
    if len(rows) != 118:
        raise RuntimeError(f"expected 118 successful replays, got {len(rows)}")

    selected, removed = apply_correlation(rows, barpnls)
    for rank, row in enumerate(selected, 1):
        row["rank"] = rank
        row.update(monte_carlo_metrics(tradepnls[row["strategy_id"]], row["source_script_sha256"]))
        row["final_gate"] = "HARD PASS" if row["monte_carlo_pass"] else "WATCH"
    for row in removed:
        row["monte_carlo_pass"] = False
        row["mc_95pct_max_drawdown_pct"] = None
        row["probability_positive_pct"] = None
        row["final_gate"] = "CORR REMOVED"
    for row in rows:
        if not row["pre_corr_gate"]:
            row["monte_carlo_pass"] = False
            row["mc_95pct_max_drawdown_pct"] = None
            row["probability_positive_pct"] = None
            row["final_gate"] = "BASE FAIL"

    hard = [r for r in selected if r.get("monte_carlo_pass")]
    parity_abs = {}
    for metric in ("totalTrades","winRate","profitFactor","netProfit","maxDrawdownPercent","sqn","recoveryFactor","wf_test_pf"):
        vals = [abs(float(r["parity_delta"][metric]["delta"])) for r in rows if metric in r["parity_delta"]]
        parity_abs[metric] = float(np.mean(vals)) if vals else None

    payload = {
        "schema": "gold24-copytolive-active-replay-v1",
        "status": "PASS",
        "engine_mode": "COPYTOLIVE_EXACT_ACTIVE_REPLAY",
        "producer_reference": "pipeline/wf_nondex_btc_gold.py",
        "producer_filter_modes": ["VOL","MTF","VM","VS","ALL"],
        "active_gold_input": len(rows),
        "source": manifest["snapshot"],
        "dataset": {
            "path": str(Path(args.dataset)),
            "sha256": sha256_file(Path(args.dataset)),
            "rows": int(len(d)),
            "start_utc": str(d["Date"].iloc[0]),
            "end_utc": str(d["Date"].iloc[-1]),
        },
        "d1_dataset": {
            "path": str(Path(args.d1_dataset)),
            "sha256": sha256_file(Path(args.d1_dataset)),
            "rows": int(len(d1)),
            "start_utc": str(d1["Date"].iloc[0]),
            "end_utc": str(d1["Date"].iloc[-1]),
        },
        "execution_contract": {
            "deposit_usd": COPYTOLIVE_DEPOSIT_USD,
            "risk_usd_per_trade": COPYTOLIVE_RISK_USD,
            "fee": COPYTOLIVE_STRESSED_FEE,
            "entry": "signal-bar close",
            "stop": "entry_price * sl_pct",
            "target": "stop_distance * tp_ratio",
            "size": "risk_usd / stop_distance",
            "one_position_at_a_time": True,
            "same_bar_entry_exit": False,
            "same_bar_precedence": "SL_FIRST",
            "walk_forward_split": "70/30 chronological",
        },
        "github_gate": {
            "min_entry": MIN_ENTRY,
            "min_net_profit_usd": MIN_NET_PROFIT_USD,
            "min_pf": MIN_PF,
            "max_dd_pct": MAX_DD_PCT,
            "min_oos_pf": MIN_OOS_PF,
            "min_positive_year_pct": MIN_POSITIVE_YEAR_PCT,
            "max_abs_pearson_log_return_equity": CORR_MAX,
            "monte_carlo_probability_positive_pct": 95.0,
        },
        "pre_corr_pass_count": sum(bool(r["pre_corr_gate"]) for r in rows),
        "corr_kept_count": len(selected),
        "corr_removed_count": len(removed),
        "hard_pass_count": len(hard),
        "parity_mean_abs_delta": parity_abs,
        "ranking": sorted(rows, key=lambda r: (r.get("final_gate") == "HARD PASS", quality(r)), reverse=True),
    }
    (out / "latest_copytolive_active_replay.json").write_text(
        json.dumps(payload, indent=2, sort_keys=True, default=str) + "\n",
        encoding="utf-8",
    )
    write_csv(out / "latest_copytolive_active_replay.csv", rows)
    summary = {k: v for k, v in payload.items() if k != "ranking"}
    (out / "latest_copytolive_active_replay_summary.json").write_text(
        json.dumps(summary, indent=2, sort_keys=True, default=str) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(summary, indent=2, sort_keys=True, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
