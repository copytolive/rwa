#!/usr/bin/env python3
"""CopyToLive production-parity backtest engine for GOLD.

Mirrors the execution contract observed in CopyToLive production
(trading-service/pipeline/wf_common.py), isolated from the legacy GOLD24
fixed-dollar/pending-order engine.
"""
from __future__ import annotations

import argparse
import json
import math
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from copytolive_unified_engine import (
    ENGINE_ID,
    COPYTOLIVE_DEPOSIT_USD,
    COPYTOLIVE_RISK_USD,
    COPYTOLIVE_STRESSED_FEE,
    COPYTOLIVE_WF_TRAIN_PCT,
    CopyToLiveExecutionConfig,
    compute_copytolive_metrics,
    run_copytolive_backtest,
)

DEPOSIT = COPYTOLIVE_DEPOSIT_USD
RISK = COPYTOLIVE_RISK_USD
FEE = COPYTOLIVE_STRESSED_FEE
WALK_FORWARD_TRAIN = COPYTOLIVE_WF_TRAIN_PCT


def _normalize_ohlcv_frame(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    rename = {}
    for c in df.columns:
        lc = str(c).lower()
        if lc in {"open", "high", "low", "close", "volume", "timestamp", "time", "date", "datetime"}:
            rename[c] = lc
    df = df.rename(columns=rename)
    for c in ("open", "high", "low", "close"):
        if c not in df.columns:
            raise ValueError(f"OHLCV missing required column: {c}")
        df[c] = pd.to_numeric(df[c], errors="coerce")
    if "volume" not in df.columns:
        df["volume"] = 0.0
    else:
        df["volume"] = pd.to_numeric(df["volume"], errors="coerce").fillna(0.0)

    ts_col = next((c for c in ("timestamp", "datetime", "date", "time") if c in df.columns), None)
    if ts_col is not None:
        raw = df[ts_col]
        if pd.api.types.is_numeric_dtype(raw):
            vals = pd.to_numeric(raw, errors="coerce")
            med = float(vals.dropna().abs().median()) if vals.notna().any() else 0.0
            unit = "ms" if med > 10_000_000_000 else "s"
            idx = pd.to_datetime(vals, unit=unit, errors="coerce", utc=True)
        else:
            idx = pd.to_datetime(raw, errors="coerce", utc=True)
        df.index = idx
    elif not isinstance(df.index, pd.DatetimeIndex):
        df.index = pd.RangeIndex(len(df))

    df = df.dropna(subset=["open", "high", "low", "close"])
    if isinstance(df.index, pd.DatetimeIndex):
        df = df[~df.index.isna()].sort_index()
        df = df[~df.index.duplicated(keep="last")]
    return df


def load_ohlcv(path: str | Path) -> pd.DataFrame:
    path = Path(path)
    suffix = path.suffix.lower()
    if suffix == ".parquet":
        return _normalize_ohlcv_frame(pd.read_parquet(path))
    if suffix == ".csv":
        return _normalize_ohlcv_frame(pd.read_csv(path))
    if suffix == ".json":
        payload = json.loads(path.read_text())
        bars = payload.get("bars", payload) if isinstance(payload, dict) else payload
        if not isinstance(bars, list):
            raise ValueError("JSON OHLCV must be a list or an object containing bars[]")
        return _normalize_ohlcv_frame(pd.DataFrame(bars))
    raise ValueError(f"unsupported OHLCV format: {suffix}")


def fetch_production_ohlcv(
    *,
    base_url: str = "https://copytolive.com",
    timeframe: str = "1h",
    limit: int = 50_000,
    markets: tuple[str, ...] = ("commodity", "gold", "forex", "stock", "crypto", "index"),
    symbols: tuple[str, ...] = ("GOLD", "XAU/USD", "GC=F"),
) -> tuple[pd.DataFrame, str]:
    errors: list[str] = []
    for market in markets:
        for symbol in symbols:
            encoded = urllib.parse.quote(symbol, safe="/")
            url = (
                f"{base_url.rstrip('/')}/trading/market-data/ohlcv/"
                f"{market}/{encoded}?tf={urllib.parse.quote(timeframe)}&limit={int(limit)}"
            )
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "copytolive-github-parity/1"})
                with urllib.request.urlopen(req, timeout=90) as resp:
                    payload = json.loads(resp.read().decode("utf-8"))
                bars = payload.get("bars") if isinstance(payload, dict) else None
                if isinstance(bars, list) and bars:
                    return _normalize_ohlcv_frame(pd.DataFrame(bars)), url
                errors.append(f"{url}: empty bars")
            except Exception as exc:
                errors.append(f"{url}: {type(exc).__name__}: {exc}")
    raise RuntimeError("CopyToLive OHLCV fetch failed; " + " | ".join(errors[-8:]))


def load_manifest(path: str | Path) -> dict[str, Any]:
    payload = json.loads(Path(path).read_text())
    rows = payload.get("strategies", [])
    if not isinstance(rows, list) or not rows:
        raise ValueError("manifest strategies[] missing/empty")
    return payload


def load_source_pack(path: str | Path) -> dict[str, Any]:
    payload = json.loads(Path(path).read_text())
    scripts = payload.get("scripts", {})
    if not isinstance(scripts, dict) or not scripts:
        raise ValueError("source-pack scripts{} missing/empty")
    return payload


def compile_strategy(strategy_id: str, source_pack: dict[str, Any]) -> dict[str, Any]:
    src = source_pack["scripts"].get(strategy_id)
    if not isinstance(src, str):
        raise KeyError(f"strategy source not found: {strategy_id}")
    ns: dict[str, Any] = {"__name__": f"copytolive_strategy_{abs(hash(strategy_id))}"}
    exec(compile(src, f"<copytolive:{strategy_id}>", "exec"), ns, ns)
    if not callable(ns.get("run")):
        raise RuntimeError(f"strategy {strategy_id} does not expose run(close, high, low)")
    return ns


def strategy_signals(strategy_ns: dict[str, Any], df: pd.DataFrame) -> np.ndarray:
    sigs = strategy_ns["run"](
        df["close"].to_numpy(np.float64),
        df["high"].to_numpy(np.float64),
        df["low"].to_numpy(np.float64),
    )
    sigs = np.asarray(sigs, dtype=np.int8)
    if len(sigs) != len(df):
        raise ValueError(f"signal length mismatch: {len(sigs)} != {len(df)}")
    return sigs


def backtest_signals(
    signals: np.ndarray,
    df: pd.DataFrame,
    sl_pct: float,
    tp_ratio: float,
    *,
    fee: float = FEE,
    deposit: float = DEPOSIT,
    risk_usd: float = RISK,
) -> tuple[list[dict[str, Any]], np.ndarray]:
    """Compatibility wrapper over the single unified execution kernel."""
    result = run_copytolive_backtest(
        df,
        signals,
        CopyToLiveExecutionConfig(
            sl_pct=float(sl_pct),
            tp_ratio=float(tp_ratio),
            deposit_usd=float(deposit),
            risk_usd=float(risk_usd),
            fee=float(fee),
        ),
    )
    return list(result["trades"]), np.asarray(result["bar_pnl"], dtype=float)


def metrics_from_trades(
    trades: list[dict[str, Any]],
    *,
    deposit: float = DEPOSIT,
) -> dict[str, Any]:
    """Compatibility wrapper over unified metric semantics."""
    return compute_copytolive_metrics(trades, float(deposit))


def validate_period(
    trades: list[dict[str, Any]],
    *,
    min_trades: int = 100,
    pf_min: float = 2.0,
    wr_min: float = 40.0,
    wr_max: float = 85.0,
    dd_max: float = 30.0,
) -> dict[str, Any] | None:
    if len(trades) < min_trades:
        return None
    m = metrics_from_trades(trades)
    if (
        m["profitFactor"] < pf_min
        or m["winRate"] < wr_min
        or m["winRate"] > wr_max
        or m["maxDrawdown"] > dd_max
    ):
        return None
    return m


def walk_forward(
    trades: list[dict[str, Any]],
    df: pd.DataFrame,
    *,
    train_pct: float = WALK_FORWARD_TRAIN,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None, dict[str, Any] | None]:
    if not trades or len(df) < 2:
        return None, None, None
    split_i = min(max(int(len(df) * train_pct), 1), len(df) - 1)
    split_ts = df.index[split_i]
    if isinstance(df.index, pd.DatetimeIndex):
        train = [t for t in trades if pd.Timestamp(t["closeTime"]) <= split_ts]
        test = [t for t in trades if pd.Timestamp(t["closeTime"]) > split_ts]
    else:
        train = [t for t in trades if int(t["exitBar"]) <= split_i]
        test = [t for t in trades if int(t["exitBar"]) > split_i]
    return (
        validate_period(train, min_trades=100),
        validate_period(test, min_trades=50),
        validate_period(trades, min_trades=300),
    )


def log_return_equity(bar_pnl: np.ndarray, *, deposit: float = DEPOSIT) -> np.ndarray:
    equity = float(deposit) + np.cumsum(np.asarray(bar_pnl, dtype=float))
    if len(equity) < 2 or np.any(equity <= 0):
        return np.full(max(len(equity) - 1, 0), np.nan)
    return np.diff(np.log(equity))


def pearson_log_equity(a: np.ndarray, b: np.ndarray) -> float:
    aa = log_return_equity(a)
    bb = log_return_equity(b)
    n = min(len(aa), len(bb))
    if n < 3:
        return 0.0
    aa = aa[-n:]
    bb = bb[-n:]
    mask = np.isfinite(aa) & np.isfinite(bb)
    if int(mask.sum()) < 3 or np.std(aa[mask]) == 0 or np.std(bb[mask]) == 0:
        return 0.0
    return float(np.corrcoef(aa[mask], bb[mask])[0, 1])


def _metric_diff(actual: dict[str, Any], expected: dict[str, Any]) -> dict[str, float]:
    pairs = {
        "totalTrades": ("totalTrades", "totalTrades"),
        "winRate": ("winRate", "winRate"),
        "profitFactor": ("profitFactor", "profitFactor"),
        "netProfit": ("netProfit", "netProfit"),
        "maxDrawdown": ("maxDrawdown", "maxDrawdownPercent"),
        "recoveryFactor": ("recoveryFactor", "recoveryFactor"),
        "sqn": ("sqn", "sqn"),
    }
    out = {}
    for name, (ak, ek) in pairs.items():
        av = float(actual.get(ak, 0.0) or 0.0)
        ev = float(expected.get(ek, 0.0) or 0.0)
        out[name] = av - ev
    return out


def run_strategy(manifest_row: dict[str, Any], source_pack: dict[str, Any], df: pd.DataFrame) -> dict[str, Any]:
    sid = str(manifest_row["id"])
    ns = compile_strategy(sid, source_pack)
    sigs = strategy_signals(ns, df)
    trades, bar_pnl = backtest_signals(
        sigs, df, float(manifest_row["sl_pct"]), float(manifest_row["tp_ratio"])
    )
    metrics = metrics_from_trades(trades)
    v_train, v_test, v_full = walk_forward(trades, df)
    return {
        "id": sid,
        "metrics": metrics,
        "diff_vs_production_snapshot": _metric_diff(metrics, manifest_row),
        "walk_forward": {"train": v_train, "test": v_test, "full": v_full},
        "bar_pnl": bar_pnl,
        "trades": trades,
    }


def run_universe(
    manifest: dict[str, Any],
    source_pack: dict[str, Any],
    df: pd.DataFrame,
    *,
    max_strategies: int | None = None,
) -> dict[str, Any]:
    rows = manifest["strategies"]
    if max_strategies is not None:
        rows = rows[: max(0, int(max_strategies))]
    results = [run_strategy(row, source_pack, df) for row in rows]

    bars = {r["id"]: r["bar_pnl"] for r in results}
    pair_rows = []
    ids = list(bars)
    corr_max = {sid: 0.0 for sid in ids}
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            corr = abs(pearson_log_equity(bars[ids[i]], bars[ids[j]]))
            pair_rows.append({"a": ids[i], "b": ids[j], "corr_abs": corr})
            corr_max[ids[i]] = max(corr_max[ids[i]], corr)
            corr_max[ids[j]] = max(corr_max[ids[j]], corr)

    compact = []
    for r in results:
        compact.append({
            "id": r["id"],
            "metrics": r["metrics"],
            "diff_vs_production_snapshot": r["diff_vs_production_snapshot"],
            "walk_forward": r["walk_forward"],
            "corr_max_raw": corr_max[r["id"]],
            "corr_gate_raw": "PASS" if corr_max[r["id"]] <= 0.50 + 1e-12 else "FAIL",
        })

    return {
        "status": "PASS",
        "engine": ENGINE_ID,
        "execution_contract": {
            "deposit_usd": DEPOSIT,
            "risk_usd": RISK,
            "fee": FEE,
            "entry": "signal_bar_close",
            "sl": "entry*sl_pct",
            "tp": "sl_distance*tp_ratio",
            "same_bar_priority": "SL_before_TP",
            "walk_forward_train": WALK_FORWARD_TRAIN,
        },
        "ohlcv_rows": int(len(df)),
        "strategies": compact,
        "correlation_pairs": pair_rows,
    }


def contract_check(manifest: dict[str, Any], source_pack: dict[str, Any]) -> dict[str, Any]:
    rows = manifest["strategies"]
    scripts = source_pack["scripts"]
    ids = [str(r["id"]) for r in rows]
    missing = [sid for sid in ids if sid not in scripts]
    extra = sorted(set(scripts) - set(ids))
    bad = []
    for r in rows:
        sid = str(r["id"])
        src = scripts.get(sid, "")
        compact_src = src.replace(" ", "")
        if (
            r.get("symbol") != "GOLD"
            or r.get("timeframe") != "H1"
            or float(r.get("sl_pct", 0)) <= 0
            or float(r.get("tp_ratio", 0)) <= 0
            or "RISK=200.0" not in compact_src
            or "DEPOSIT=10000" not in compact_src
            or "defrun(" not in compact_src
        ):
            bad.append(sid)
    ok = len(rows) == 118 and len(scripts) == 118 and not missing and not extra and not bad
    return {
        "status": "PASS" if ok else "FAIL",
        "manifest_count": len(rows),
        "source_count": len(scripts),
        "missing_source_count": len(missing),
        "extra_source_count": len(extra),
        "invalid_contract_count": len(bad),
        "missing": missing,
        "extra": extra,
        "invalid": bad,
    }


def main() -> None:
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", default=str(here / "copytolive_active_gold_manifest.json"))
    ap.add_argument("--source-pack", default=str(here / "copytolive_gold_strategy_sources.json"))
    ap.add_argument("--ohlcv")
    ap.add_argument("--fetch-production", action="store_true")
    ap.add_argument("--max-strategies", type=int)
    ap.add_argument("--out")
    ap.add_argument("--contract-only", action="store_true")
    args = ap.parse_args()

    manifest = load_manifest(args.manifest)
    pack = load_source_pack(args.source_pack)
    contract = contract_check(manifest, pack)
    if contract["status"] != "PASS":
        raise SystemExit(json.dumps(contract, indent=2))
    if args.contract_only:
        print(json.dumps(contract, indent=2))
        return

    if args.fetch_production:
        df, source = fetch_production_ohlcv()
    elif args.ohlcv:
        df = load_ohlcv(args.ohlcv)
        source = str(args.ohlcv)
    else:
        raise SystemExit("--ohlcv or --fetch-production required unless --contract-only")

    result = run_universe(manifest, pack, df, max_strategies=args.max_strategies)
    result["contract_check"] = contract
    result["ohlcv_source"] = source
    encoded = json.dumps(result, indent=2, default=lambda x: x.tolist() if isinstance(x, np.ndarray) else str(x))
    if args.out:
        Path(args.out).write_text(encoded + "\n")
    print(encoded)


if __name__ == "__main__":
    main()
