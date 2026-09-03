from __future__ import annotations

"""Adaptive GOLD discovery using CopyToLive-compatible execution semantics.

This is the new research path for GOLD24. It keeps the public GOLD24 signal
families and validation/audit machinery, but replaces legacy fixed-dollar
SL/TP + flat-lot execution with the CopyToLive production execution contract:
percentage stop, TP as an R multiple, USD 200 risk per trade, USD 10k deposit,
stressed 0.0016 fee, one position at a time, stop-first same-bar handling.

Private production strategy source is intentionally not copied into this
public repository.
"""

import argparse
import csv
import hashlib
import json
import os
import random
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import numpy as np
import pandas as pd

from core import Candidate, FAMILIES, audit_dataset, generate_candidate, pearson_log_equity
from copytolive_compat import (
    COPYTOLIVE_DEPOSIT_USD,
    COPYTOLIVE_RISK_USD,
    COPYTOLIVE_STRESSED_FEE,
    COPYTOLIVE_SL_PCTS,
    COPYTOLIVE_TP_RATIOS,
    CopyToLiveExecutionConfig,
    adapt_core_candidate_signals,
    compute_copytolive_metrics,
    execution_digest,
    run_copytolive_backtest,
)
from multimethod_v1_full_rescan import annual_stats, monte_carlo_metrics

CORR_MAX = 0.50
MIN_ENTRY = 300
MIN_PF = 1.20
MAX_DD_PCT = 25.0
MIN_OOS_PF = 1.00
MIN_POSITIVE_YEAR_PCT = 60.0
MIN_NET_PROFIT_USD = 0.0

_WORKER_D: pd.DataFrame | None = None


def _stable_signal_candidate(rng: random.Random, family: str, timeframe: str) -> Candidate:
    # generate_candidate already provides family-specific parameter domains.
    # We retry until the requested family is sampled, then normalize fields
    # that do not affect signal_series so execution identity is not polluted by
    # legacy fixed-dollar order settings.
    for _ in range(20_000):
        c = generate_candidate(rng, timeframe=timeframe)
        if c.family != family:
            continue
        d = c.canonical_dict()
        d["entry_method"] = "STOP"
        d["sl"] = 5.0
        d["tp"] = 5.0
        d["offset"] = 0.5
        d["expiry"] = 1
        return Candidate(**d)
    raise RuntimeError(f"could not sample family={family}")


def _combined_hash(c: Candidate, exec_cfg: CopyToLiveExecutionConfig) -> str:
    raw = json.dumps(
        {"signal": c.canonical_dict(), "execution": {
            "sl_pct": exec_cfg.sl_pct,
            "tp_ratio": exec_cfg.tp_ratio,
            "deposit_usd": exec_cfg.deposit_usd,
            "risk_usd": exec_cfg.risk_usd,
            "fee": exec_cfg.fee,
        }},
        sort_keys=True,
        separators=(",", ":"),
    ).encode()
    return hashlib.sha256(raw).hexdigest()


def _worker_init(dataset: str, receipt: str, timeframe: str) -> None:
    global _WORKER_D
    _WORKER_D, _ = audit_dataset(dataset, receipt, timeframe)


def _evaluate(payload: dict) -> dict:
    if _WORKER_D is None:
        raise RuntimeError("worker dataset not initialized")
    c = Candidate(**payload["candidate"])
    ex = CopyToLiveExecutionConfig(
        sl_pct=float(payload["sl_pct"]),
        tp_ratio=float(payload["tp_ratio"]),
    )
    sig = adapt_core_candidate_signals(_WORKER_D, c)
    r = run_copytolive_backtest(_WORKER_D, sig, ex)
    m = r["metrics"]
    out = {
        "candidate": c.canonical_dict(),
        "sl_pct": ex.sl_pct,
        "tp_ratio": ex.tp_ratio,
        "config_hash": _combined_hash(c, ex),
        "execution_hash": execution_digest(r["trades"]),
        "metrics": m,
    }
    if (
        int(m.get("totalTrades", 0)) >= 100
        and float(m.get("netProfit", 0.0)) > 0.0
        and float(m.get("profitFactor", 0.0)) >= 1.05
        and float(m.get("expectancy", 0.0)) > 0.0
    ):
        out["trades"] = r["trades"]
        out["bar_pnl"] = np.asarray(r["bar_pnl"], dtype=float).tolist()
    return out


def _split_oos_metrics(trades: list[dict], d: pd.DataFrame, train_pct: float = 0.70) -> dict:
    if not trades:
        return {"oos_trades": 0, "oos_profit_factor": 0.0, "oos_win_rate_pct": 0.0, "oos_net_profit_usd": 0.0}
    if "Date" in d.columns:
        idx = pd.DatetimeIndex(pd.to_datetime(d["Date"], utc=True))
    elif isinstance(d.index, pd.DatetimeIndex):
        idx = d.index
    else:
        # With no timestamps we cannot claim chronological OOS.
        return {"oos_trades": 0, "oos_profit_factor": 0.0, "oos_win_rate_pct": 0.0, "oos_net_profit_usd": 0.0}
    split_i = min(max(int(len(d) * train_pct), 1), len(d) - 1)
    split_ts = idx[split_i]
    test = []
    for t in trades:
        try:
            ts = pd.Timestamp(t["closeTime"])
        except Exception:
            continue
        if ts > split_ts:
            test.append(t)
    m = compute_copytolive_metrics(test)
    return {
        "oos_trades": int(m["totalTrades"]),
        "oos_profit_factor": float(m["profitFactor"]),
        "oos_win_rate_pct": float(m["winRate"]),
        "oos_net_profit_usd": float(m["netProfit"]),
    }


def _row(d: pd.DataFrame, audit: dict, r: dict, timeframe: str) -> tuple[dict, np.ndarray, np.ndarray]:
    c = Candidate(**r["candidate"])
    m = r["metrics"]
    trades = list(r.get("trades") or [])
    bar_pnl = np.asarray(r.get("bar_pnl") or [], dtype=float)
    pnl = np.asarray([float(x["profit"]) for x in trades], dtype=float)
    oos = _split_oos_metrics(trades, d, 0.70)
    annual = annual_stats(d, bar_pnl)
    row = {
        "config_hash": r["config_hash"],
        "execution_hash": r["execution_hash"],
        "method": (
            f"{c.family} f{c.fast}/s{c.slow} p1={c.p1} p2={c.p2} p3={c.p3} "
            f"SL={float(r['sl_pct'])*100:.3f}% TP={float(r['tp_ratio']):g}R"
        ),
        "family": c.family,
        "timeframe": timeframe,
        "entry_method": "SIGNAL_CLOSE",
        "direction_mode": c.direction_mode,
        "sl_pct": float(r["sl_pct"]),
        "tp_ratio": float(r["tp_ratio"]),
        "total_entry": int(m["totalTrades"]),
        "win_rate_pct": float(m["winRate"]),
        "profit_factor": float(m["profitFactor"]),
        "net_profit_usd": float(m["netProfit"]),
        "ev_per_trade_usd": float(m["expectancy"]),
        "avg_win_loss_ratio": float(m["rr"]),
        "max_dd_pct": float(m["maxDrawdown"]),
        "recovery_factor": float(m["recoveryFactor"]),
        "max_consecutive_loss": int(m["maxConsecLoss"]),
        "sqn": float(m["sqn"]),
        "oos_profit_factor": float(oos["oos_profit_factor"]),
        "oos_trades": int(oos["oos_trades"]),
        "oos_win_rate_pct": float(oos["oos_win_rate_pct"]),
        "oos_net_profit_usd": float(oos["oos_net_profit_usd"]),
        "positive_years_pct": float(annual["positive_years_pct"]),
        "worst_year": int(annual["worst_year"]),
        "worst_year_net_profit_usd": float(annual["worst_year_net_profit_usd"]),
        "backtest_start_utc": str(audit.get("start_utc", "")),
        "backtest_end_utc": str(audit.get("end_utc", "")),
        "history_years": float(m.get("historyYears", 0.0) or 0.0),
        "sample_v11": f"{int(m['totalTrades'])}/300 {'PASS' if int(m['totalTrades']) >= 300 else 'FAIL'}",
        "candidate": c.canonical_dict(),
        "execution": {
            "deposit_usd": COPYTOLIVE_DEPOSIT_USD,
            "risk_usd": COPYTOLIVE_RISK_USD,
            "fee": COPYTOLIVE_STRESSED_FEE,
            "sl_pct": float(r["sl_pct"]),
            "tp_ratio": float(r["tp_ratio"]),
        },
    }
    # If the generic metric helper did not have a history field, calculate it.
    if not row["history_years"] and row["backtest_start_utc"] and row["backtest_end_utc"]:
        try:
            start = pd.Timestamp(row["backtest_start_utc"])
            end = pd.Timestamp(row["backtest_end_utc"])
            row["history_years"] = float((end - start).days / 365.25)
        except Exception:
            pass
    row.update(annual)
    return row, bar_pnl, pnl


def _pre_corr(row: dict) -> bool:
    return (
        int(row["total_entry"]) >= MIN_ENTRY
        and float(row["net_profit_usd"]) > MIN_NET_PROFIT_USD
        and float(row["profit_factor"]) >= MIN_PF
        and float(row["ev_per_trade_usd"]) > 0.0
        and float(row["max_dd_pct"]) <= MAX_DD_PCT
        and float(row["oos_profit_factor"]) >= MIN_OOS_PF
        and float(row["positive_years_pct"]) >= MIN_POSITIVE_YEAR_PCT
    )


def _quality(row: dict) -> tuple:
    return (
        float(row["profit_factor"]),
        float(row["net_profit_usd"]),
        -float(row["max_dd_pct"]),
        int(row["total_entry"]),
        float(row["sqn"]),
    )


def _write_csv(path: Path, rows: list[dict]) -> None:
    fields = [
        "rank","method","family","timeframe","entry_method","direction_mode","sl_pct","tp_ratio",
        "total_entry","win_rate_pct","profit_factor","net_profit_usd","ev_per_trade_usd",
        "avg_win_loss_ratio","max_dd_pct","recovery_factor","max_consecutive_loss","sqn",
        "oos_profit_factor","monte_carlo_pass","mc_95pct_max_drawdown_pct","probability_positive_pct",
        "positive_years_pct","worst_year","worst_year_net_profit_usd","backtest_start_utc",
        "backtest_end_utc","history_years","sample_v11","correlation_max","correlation_gate","config_hash"
    ]
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for row in rows:
            w.writerow({k: row.get(k) for k in fields})


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True)
    ap.add_argument("--receipt", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--timeframe", default="D1", choices=["H1","H4","D1"])
    ap.add_argument("--candidate-count", type=int, default=2000)
    ap.add_argument("--base-seed", type=int, default=2026090307)
    ap.add_argument("--workers", type=int, default=0)
    args = ap.parse_args()

    out = Path(args.out_dir).resolve()
    out.mkdir(parents=True, exist_ok=True)
    d, audit = audit_dataset(args.dataset, args.receipt, args.timeframe)

    rng = random.Random(int(args.base_seed))
    families = sorted(FAMILIES)
    generated = []
    seen = set()
    attempts = 0
    wanted = int(args.candidate_count)
    while len(generated) < wanted:
        attempts += 1
        family = families[len(generated) % len(families)]
        c = _stable_signal_candidate(rng, family, args.timeframe)
        sl_pct = float(rng.choice(COPYTOLIVE_SL_PCTS))
        tp_ratio = float(rng.choice(COPYTOLIVE_TP_RATIOS))
        ex = CopyToLiveExecutionConfig(sl_pct=sl_pct, tp_ratio=tp_ratio)
        h = _combined_hash(c, ex)
        if h in seen:
            if attempts > wanted * 200:
                raise RuntimeError("candidate generation exhausted")
            continue
        seen.add(h)
        generated.append({"candidate": c.canonical_dict(), "sl_pct": sl_pct, "tp_ratio": tp_ratio})

    workers = int(args.workers) if int(args.workers) > 0 else max(1, min(os.cpu_count() or 2, 6))
    simulated = []
    with ProcessPoolExecutor(
        max_workers=workers,
        initializer=_worker_init,
        initargs=(str(args.dataset), str(args.receipt), str(args.timeframe)),
    ) as pool:
        futs = [pool.submit(_evaluate, x) for x in generated]
        for fut in as_completed(futs):
            simulated.append(fut.result())

    # Exact execution deduplication before expensive validation.
    unique = []
    exec_seen = set()
    for r in sorted(simulated, key=lambda x: (
        float(x["metrics"].get("profitFactor",0.0)),
        float(x["metrics"].get("netProfit",0.0)),
    ), reverse=True):
        if "trades" not in r:
            continue
        eh = str(r.get("execution_hash") or "")
        if not eh or eh in exec_seen:
            continue
        exec_seen.add(eh)
        unique.append(r)

    rows = []
    barpnls = {}
    tradepnls = {}
    for r in unique:
        row, bp, tpnl = _row(d, audit, r, args.timeframe)
        if not _pre_corr(row):
            continue
        rows.append(row)
        barpnls[row["config_hash"]] = bp
        tradepnls[row["config_hash"]] = tpnl

    rows.sort(key=_quality, reverse=True)
    selected = []
    removed = []
    for row in rows:
        pairs=[]
        for prior in selected:
            corr=abs(float(pearson_log_equity(barpnls[row["config_hash"]],barpnls[prior["config_hash"]])))
            pairs.append((corr,prior["config_hash"]))
        max_corr,against=max(pairs,default=(0.0,None),key=lambda x:x[0])
        row["correlation_max"]=float(max_corr)
        row["correlation_against"]=against
        if max_corr <= CORR_MAX + 1e-12:
            row["correlation_gate"]="PASS"
            selected.append(row)
        else:
            row["correlation_gate"]="REMOVED >0.50"
            removed.append(row)

    for rank,row in enumerate(selected,1):
        row["rank"]=rank
        row.update(monte_carlo_metrics(tradepnls[row["config_hash"]],row["config_hash"]))
        row["status"]="PASS COPYTOLIVE-COMPAT + CORR<=0.50"

    payload={
        "schema":"gold24-copytolive-compatible-discovery-v1",
        "status":"PASS",
        "engine_mode":"COPYTOLIVE_COMPATIBLE",
        "compatibility_contract":{
            "deposit_usd":COPYTOLIVE_DEPOSIT_USD,
            "risk_usd_per_trade":COPYTOLIVE_RISK_USD,
            "fee":COPYTOLIVE_STRESSED_FEE,
            "stop":"entry_price * sl_pct",
            "target":"stop_distance * tp_ratio",
            "size":"risk_usd / stop_distance",
            "one_position_at_a_time":True,
            "same_bar_precedence":"SL_FIRST",
            "same_bar_entry_exit":False,
            "walk_forward_split":"70/30 chronological",
        },
        "public_signal_source":"GOLD24 public signal families; private CopyToLive strategy source not copied",
        "dataset_audit":audit,
        "timeframe":args.timeframe,
        "base_seed":int(args.base_seed),
        "workers":workers,
        "generated_count":len(generated),
        "simulated_count":len(simulated),
        "execution_unique_count":len(unique),
        "pre_corr_pass_count":len(rows),
        "selected_count":len(selected),
        "removed_by_corr_count":len(removed),
        "selection_gate":{
            "min_entry":MIN_ENTRY,
            "min_pf":MIN_PF,
            "max_dd_pct":MAX_DD_PCT,
            "min_oos_pf":MIN_OOS_PF,
            "min_positive_year_pct":MIN_POSITIVE_YEAR_PCT,
            "max_abs_pearson_log_return_equity":CORR_MAX,
        },
        "ranking":selected,
        "removed_by_correlation":removed,
    }
    (out/"latest_copytolive_compatible_discovery.json").write_text(json.dumps(payload,indent=2,sort_keys=True,default=str)+"\n",encoding="utf-8")
    _write_csv(out/"latest_copytolive_compatible_discovery.csv",selected)
    summary={k:v for k,v in payload.items() if k not in {"ranking","removed_by_correlation"}}
    (out/"latest_copytolive_compatible_discovery_summary.json").write_text(json.dumps(summary,indent=2,sort_keys=True,default=str)+"\n",encoding="utf-8")
    print(json.dumps(summary,indent=2,sort_keys=True,default=str))
    return 0


if __name__=="__main__":
    raise SystemExit(main())
