from __future__ import annotations

import argparse
import csv
import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
QDIR = HERE / "qualified_scripts"
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
if str(QDIR) not in sys.path:
    sys.path.insert(0, str(QDIR))

from core import audit_dataset, backtest_candidate, compute_metrics  # noqa:E402
from mt5_standard_lot_full_metrics import monte_carlo_metrics  # noqa:E402
import validate_qualified_scripts as vqs  # noqa:E402

STANDARD_LOT_GOLD_UNITS = 100.0
PIP_SIZE_USD = 0.01
RECENT_START = pd.Timestamp("2019-01-01", tz="UTC")
REQUESTED_TODAY = pd.Timestamp("2026-09-03", tz="UTC")

FIELDS = [
    "recent_rank", "selected_origin", "selected_tier", "full_history_rank",
    "config_hash", "method", "timeframe", "entry_method", "direction_mode",
    "sl_pips", "tp_pips", "period_start_utc", "period_end_utc",
    "requested_through_today_utc", "coverage_gap_days", "total_entry",
    "trades_per_year", "win_rate_pct", "profit_factor_net", "net_profit_usd",
    "ev_per_trade_usd", "avg_win_loss_ratio", "max_dd_pct", "recovery_factor",
    "max_consecutive_loss", "sqn", "sharpe", "sortino", "calmar",
    "oos_profit_factor", "oos_net_profit_usd", "oos_trades",
    "monte_carlo_pass", "mc_95pct_max_drawdown_pct", "positive_years_pct",
    "worst_year", "worst_year_net_profit_usd", "profitable_months_pct",
    "full_history_corr_max", "full_history_corr_gate",
    "trading_score_0_9", "trading_gate", "python_script", "mt5_script",
]


def read_csv(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def pf_from_pnl(pnl: np.ndarray) -> float:
    pnl = np.asarray(pnl, dtype=float)
    if pnl.size == 0:
        return 0.0
    gp = float(pnl[pnl > 0].sum())
    gl = float(-pnl[pnl <= 0].sum())
    if gl <= 0:
        return float("inf") if gp > 0 else 0.0
    return gp / gl


def annual_stats_from_ledger(ledger: pd.DataFrame, start_year: int, end_year: int) -> dict:
    years = list(range(start_year, end_year + 1))
    annual = pd.Series(0.0, index=years, dtype=float)
    if not ledger.empty:
        exit_year = pd.to_datetime(ledger["exit_time"], utc=True).dt.year
        g = pd.DataFrame({
            "year": exit_year,
            "net": pd.to_numeric(ledger["net_pnl"], errors="raise"),
        }).groupby("year")["net"].sum()
        annual = annual.add(g, fill_value=0.0).reindex(years, fill_value=0.0)
    worst_year = int(annual.idxmin()) if len(annual) else 0
    return {
        "positive_years_pct": float(100.0 * (annual > 0).sum() / len(annual)) if len(annual) else 0.0,
        "worst_year": worst_year,
        "worst_year_net_profit_usd": float(annual.loc[worst_year]) if worst_year else 0.0,
    }


def score_row(row: dict) -> tuple[int, str]:
    checks = [
        int(row["total_entry"]) >= 20,
        float(row["profit_factor_net"]) >= 1.10,
        float(row["net_profit_usd"]) > 0,
        float(row["ev_per_trade_usd"]) > 0,
        float(row["recovery_factor"]) >= 1.0,
        float(row["sqn"]) >= 1.0,
        float(row["oos_profit_factor"]) >= 1.0,
        float(row["positive_years_pct"]) >= 60.0,
        bool(row["monte_carlo_pass"]),
    ]
    score = sum(bool(x) for x in checks)
    gate = "PASS" if (
        score >= 7
        and float(row["profit_factor_net"]) >= 1.10
        and float(row["oos_profit_factor"]) >= 1.0
        and float(row["net_profit_usd"]) > 0
    ) else "WATCH"
    return score, gate


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--state-dir", required=True)
    p.add_argument("--source-summary", required=True)
    p.add_argument("--out-dir", required=True)
    args = p.parse_args()

    state = Path(args.state_dir).resolve()
    source_summary = json.loads(Path(args.source_summary).read_text())
    out = Path(args.out_dir).resolve()
    out.mkdir(parents=True, exist_ok=True)

    if source_summary.get("validation") != "PASS":
        raise SystemExit("PERIOD2019_FAIL: source canonical validation is not PASS")

    d, audit = audit_dataset(
        state / "gate_a" / "GC1_COMEX_TRADINGVIEW_D1_PRIMARY.csv",
        state / "gate_a" / "gate_a_receipt.json",
        "D1",
    )
    data_end = pd.Timestamp(d["Date"].iloc[-1])
    if data_end.tzinfo is None:
        data_end = data_end.tz_localize("UTC")
    else:
        data_end = data_end.tz_convert("UTC")
    if data_end < RECENT_START:
        raise SystemExit("PERIOD2019_FAIL: canonical dataset ends before 2019")

    d_period = d[d["Date"] >= RECENT_START].copy().reset_index(drop=True)
    if d_period.empty:
        raise SystemExit("PERIOD2019_FAIL: no rows in 2019+ period")

    strict_rows = read_csv(HERE / "runtime_mt5_lot" / "latest_entry100_net20000_standard_lot.csv")
    multi_rows = read_csv(HERE / "runtime_multimethod_v1" / "latest_multimethod_v1_discovery.csv")
    by_method = {r["method"]: ("STRICT", r) for r in strict_rows}
    by_method.update({r["method"]: ("MULTI", r) for r in multi_rows})

    modules = {stem: vqs.load_module(stem) for stem in vqs.ALL}
    rows: list[dict] = []

    for stem in vqs.ALL:
        m = modules[stem]
        c = m.CANDIDATE
        expected = m.EXPECTED
        method = expected["method"]
        if method not in by_method:
            raise RuntimeError(f"PERIOD2019_FAIL: selected method missing from runtime CSV: {method}")
        origin, source_row = by_method[method]

        rerun = backtest_candidate(d, c, flat_lot=STANDARD_LOT_GOLD_UNITS)
        if rerun["config_hash"] != expected["config_hash"]:
            raise RuntimeError(f"PERIOD2019_FAIL: config hash mismatch for {stem}")

        ledger = pd.DataFrame(rerun.get("ledger", []))
        if ledger.empty:
            period_ledger = ledger.copy()
        else:
            entry_time = pd.to_datetime(ledger["entry_time"], utc=True)
            exit_time = pd.to_datetime(ledger["exit_time"], utc=True)
            period_ledger = ledger[(entry_time >= RECENT_START) & (exit_time <= data_end)].copy()

        bar_pnl = np.zeros(len(d_period), dtype=float)
        if not period_ledger.empty:
            exit_times = pd.to_datetime(period_ledger["exit_time"], utc=True)
            pnl = pd.to_numeric(period_ledger["net_pnl"], errors="raise").to_numpy(float)
            date_to_idx = {pd.Timestamp(x): i for i, x in enumerate(pd.to_datetime(d_period["Date"], utc=True))}
            for ts, val in zip(exit_times, pnl):
                idx = date_to_idx.get(pd.Timestamp(ts))
                if idx is None:
                    raise RuntimeError(f"PERIOD2019_FAIL: exit date not in canonical period rows: {ts}")
                bar_pnl[idx] += float(val)

        metrics = compute_metrics(d_period, period_ledger, bar_pnl, c.timeframe)
        trades = int(metrics.get("trades", 0) or 0)
        history_years = max((data_end - RECENT_START).days / 365.25, 1e-9)

        cutoff_idx = int(len(d_period) * 0.80)
        cutoff_date = pd.Timestamp(d_period["Date"].iloc[cutoff_idx])
        if cutoff_date.tzinfo is None:
            cutoff_date = cutoff_date.tz_localize("UTC")
        else:
            cutoff_date = cutoff_date.tz_convert("UTC")
        if period_ledger.empty:
            oos_ledger = period_ledger.copy()
        else:
            oos_exit = pd.to_datetime(period_ledger["exit_time"], utc=True)
            oos_ledger = period_ledger[oos_exit >= cutoff_date].copy()

        oos_pnl = (
            pd.to_numeric(oos_ledger["net_pnl"], errors="raise").to_numpy(float)
            if not oos_ledger.empty
            else np.array([], dtype=float)
        )
        period_pnl = (
            pd.to_numeric(period_ledger["net_pnl"], errors="raise").to_numpy(float)
            if not period_ledger.empty
            else np.array([], dtype=float)
        )
        mc = monte_carlo_metrics(period_pnl, expected["config_hash"] + "|2019plus")
        annual = annual_stats_from_ledger(period_ledger, 2019, int(data_end.year))

        full_rank = source_row.get("strict_rank") if origin == "STRICT" else source_row.get("rank")
        tier = "STRICT" if origin == "STRICT" else source_row.get("tier_v1", "LIBRARY")

        row = {
            "recent_rank": 0,
            "selected_origin": origin,
            "selected_tier": tier,
            "full_history_rank": int(full_rank or 0),
            "config_hash": expected["config_hash"],
            "method": method,
            "timeframe": c.timeframe,
            "entry_method": c.entry_method,
            "direction_mode": c.direction_mode,
            "sl_pips": float(c.sl / PIP_SIZE_USD),
            "tp_pips": float(c.tp / PIP_SIZE_USD),
            "period_start_utc": str(RECENT_START),
            "period_end_utc": str(data_end),
            "requested_through_today_utc": str(REQUESTED_TODAY),
            "coverage_gap_days": int((REQUESTED_TODAY.normalize() - data_end.normalize()).days),
            "total_entry": trades,
            "trades_per_year": float(trades / history_years),
            "win_rate_pct": float(metrics.get("wr", 0.0) or 0.0),
            "profit_factor_net": float(metrics.get("profit_factor", 0.0) or 0.0),
            "net_profit_usd": float(metrics.get("net_profit", 0.0) or 0.0),
            "ev_per_trade_usd": float(metrics.get("expectancy", 0.0) or 0.0),
            "avg_win_loss_ratio": float(metrics.get("avg_win_loss", 0.0) or 0.0),
            "max_dd_pct": float(metrics.get("max_dd_pct", 0.0) or 0.0),
            "recovery_factor": float(metrics.get("recovery", 0.0) or 0.0),
            "max_consecutive_loss": int(metrics.get("max_consec_loss", 0) or 0),
            "sqn": float(metrics.get("sqn", 0.0) or 0.0),
            "sharpe": float(metrics.get("sharpe", 0.0) or 0.0),
            "sortino": float(metrics.get("sortino", 0.0) or 0.0),
            "calmar": float(metrics.get("calmar", 0.0) or 0.0),
            "oos_profit_factor": float(pf_from_pnl(oos_pnl)),
            "oos_net_profit_usd": float(oos_pnl.sum()) if oos_pnl.size else 0.0,
            "oos_trades": int(len(oos_pnl)),
            "monte_carlo_pass": bool(mc["monte_carlo_pass"]),
            "mc_95pct_max_drawdown_pct": float(mc["mc_95pct_max_drawdown_pct"]),
            "positive_years_pct": float(annual["positive_years_pct"]),
            "worst_year": int(annual["worst_year"]),
            "worst_year_net_profit_usd": float(annual["worst_year_net_profit_usd"]),
            "profitable_months_pct": float(metrics.get("profitable_months_pct", 0.0) or 0.0),
            "full_history_corr_max": float(source_row.get("correlation_max", 0.0) or 0.0),
            "full_history_corr_gate": source_row.get("correlation_gate", ""),
            "trading_score_0_9": 0,
            "trading_gate": "",
            "python_script": f"https://github.com/copytolive/rwa/blob/main/backtest/gold24/qualified_scripts/{stem}.py",
            "mt5_script": f"https://github.com/copytolive/rwa/blob/main/backtest/gold24/qualified_scripts/{stem}.mq5",
        }
        score, gate = score_row(row)
        row["trading_score_0_9"] = score
        row["trading_gate"] = gate
        rows.append(row)

    rows.sort(key=lambda r: (
        0 if r["trading_gate"] == "PASS" else 1,
        -int(r["trading_score_0_9"]),
        -float(r["profit_factor_net"]),
        -float(r["recovery_factor"]),
        -float(r["sqn"]),
        float(r["max_dd_pct"]),
    ))
    for i, row in enumerate(rows, start=1):
        row["recent_rank"] = i

    csv_path = out / "latest_selected_2019_to_today.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for row in rows:
            w.writerow({k: row.get(k) for k in FIELDS})

    summary = {
        "status": "PASS",
        "schema": "gold24-selected-2019-to-today-v1",
        "source_batch": int(source_summary["batch"]),
        "source_run_id": str(source_summary["github_run_id"]),
        "source_archive_total": int(source_summary["cumulative_configs_archived"]),
        "selected_method_count": len(rows),
        "strict_count": len(vqs.STRICT),
        "multi_count": len(vqs.MULTI),
        "period_definition": "exact canonical full-history backtest ledger subset; include trades with entry_time >= 2019-01-01 UTC and exit_time <= latest canonical dataset date; no re-optimization and no parameter changes",
        "period_start_utc": str(RECENT_START),
        "data_available_through_utc": str(data_end),
        "requested_through_today_utc": str(REQUESTED_TODAY),
        "coverage_gap_days": int((REQUESTED_TODAY.normalize() - data_end.normalize()).days),
        "canonical_dataset_rows": int(audit["rows"]),
        "standard_lot_gold_units": STANDARD_LOT_GOLD_UNITS,
        "pip_size_usd": PIP_SIZE_USD,
        "oos_definition": "final 20% of 2019+ canonical rows; PF and net profit computed from selected canonical-ledger exits in that segment",
        "monte_carlo_definition": "deterministic 10,000-path bootstrap of 2019+ exact standard-lot trade net-PnL; PASS when >=95% paths finish net-positive",
        "trading_score_definition": {
            "points": 9,
            "criteria": [
                "Entry >= 20 in 2019+ window",
                "PF Net >= 1.10",
                "Net Profit > USD 0",
                "EV/Trade > USD 0",
                "Recovery Factor >= 1.0",
                "SQN >= 1.0",
                "OOS PF >= 1.0",
                "Positive Years >= 60%",
                "Monte Carlo Pass = true",
            ],
            "gate": "PASS when score>=7 plus PF>=1.10, OOS PF>=1.0, and Net Profit>0; otherwise WATCH",
            "note": "comparative diagnostic only; it does not override the full-history Entry>=100 + NP>=USD20000 + Corr<=0.50 canonical selection contract",
        },
        "rows": rows,
    }
    (out / "latest_selected_2019_to_today.json").write_text(json.dumps(summary, indent=2, default=str) + "\n", encoding="utf-8")

    print(json.dumps({
        "status": "PASS",
        "source_batch": summary["source_batch"],
        "source_run_id": summary["source_run_id"],
        "selected_method_count": len(rows),
        "period_start_utc": summary["period_start_utc"],
        "data_available_through_utc": summary["data_available_through_utc"],
        "coverage_gap_days": summary["coverage_gap_days"],
        "top3": [
            {
                "rank": r["recent_rank"],
                "method": r["method"],
                "score": r["trading_score_0_9"],
                "gate": r["trading_gate"],
                "pf": r["profit_factor_net"],
                "net": r["net_profit_usd"],
                "oos_pf": r["oos_profit_factor"],
            }
            for r in rows[:3]
        ],
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
