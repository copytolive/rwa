from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import sqlite3
from pathlib import Path

import numpy as np
import pandas as pd

from core import Candidate, audit_dataset, backtest_candidate

STANDARD_LOT_GOLD_UNITS = 100.0
PIP_SIZE_USD = 0.01
MONTE_CARLO_PATHS = 10_000
MONTE_CARLO_PASS_PROBABILITY = 0.95


def atomic_json(path: Path, payload: dict) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, sort_keys=True, default=str))
    tmp.replace(path)


def candidate_for_hash(db_path: Path, config_hash: str) -> Candidate:
    db = sqlite3.connect(db_path)
    row = db.execute("SELECT canonical_json FROM configs WHERE config_hash=?", (config_hash,)).fetchone()
    db.close()
    if not row:
        raise RuntimeError(f"missing canonical candidate {config_hash}")
    return Candidate(**json.loads(row[0]))


def annual_stats(d: pd.DataFrame, bar_pnl: np.ndarray) -> dict:
    x = pd.DataFrame({"Date": pd.to_datetime(d["Date"], utc=True), "pnl": np.asarray(bar_pnl, dtype=float)})
    annual = x.set_index("Date")["pnl"].resample("YE").sum()
    if annual.empty:
        return {
            "positive_years_count": 0,
            "calendar_years_count": 0,
            "positive_years_pct": 0.0,
            "worst_year": 0,
            "worst_year_net_profit_usd": 0.0,
        }
    worst_ts = annual.idxmin()
    return {
        "positive_years_count": int((annual > 0).sum()),
        "calendar_years_count": int(len(annual)),
        "positive_years_pct": float(100.0 * (annual > 0).sum() / len(annual)),
        "worst_year": int(worst_ts.year),
        "worst_year_net_profit_usd": float(annual.loc[worst_ts]),
    }


def chronological_oos_metrics(d: pd.DataFrame, c: Candidate) -> dict:
    start = int(len(d) * 0.80)
    seg = d.iloc[start:].reset_index(drop=True)
    r = backtest_candidate(seg, c, flat_lot=STANDARD_LOT_GOLD_UNITS)
    m = r.get("metrics", {})
    return {
        "oos_definition": "final 20% chronological rows; exact re-backtest at 100 GOLD units with the same canonical fill/cost model",
        "oos_rows": int(len(seg)),
        "oos_trades": int(m.get("trades", 0) or 0),
        "oos_profit_factor": float(m.get("profit_factor", 0.0) or 0.0),
        "oos_net_profit_usd": float(m.get("net_profit", 0.0) or 0.0),
        "oos_win_rate_pct": float(m.get("wr", 0.0) or 0.0),
    }


def monte_carlo_metrics(net_pnl: np.ndarray, config_hash: str) -> dict:
    pnl = np.asarray(net_pnl, dtype=float)
    n = int(len(pnl))
    if n == 0:
        return {
            "probability_positive_pct": 0.0,
            "monte_carlo_pass": False,
            "monte_carlo_paths": MONTE_CARLO_PATHS,
            "mc_95pct_max_drawdown_pct": 0.0,
        }

    seed = int.from_bytes(hashlib.sha256(config_hash.encode()).digest()[:8], "big", signed=False)
    rng = np.random.default_rng(seed)
    positive = 0
    dds: list[float] = []
    done = 0
    chunk = 250
    while done < MONTE_CARLO_PATHS:
        k = min(chunk, MONTE_CARLO_PATHS - done)
        idx = rng.integers(0, n, size=(k, n))
        sample = pnl[idx]
        totals = sample.sum(axis=1)
        positive += int((totals > 0).sum())

        equity = 10000.0 + np.cumsum(sample, axis=1)
        equity = np.concatenate([np.full((k, 1), 10000.0), equity], axis=1)
        peak = np.maximum.accumulate(equity, axis=1)
        dd_pct = np.where(peak > 0, (peak - equity) / peak * 100.0, 0.0)
        dds.extend(np.max(dd_pct, axis=1).astype(float).tolist())
        done += k

    prob = positive / MONTE_CARLO_PATHS
    return {
        "probability_positive_pct": float(prob * 100.0),
        "probability_definition": "deterministic 10,000-path bootstrap of the real standard-lot trade net-PnL; probability that a same-length resampled path finishes net-positive",
        "monte_carlo_pass": bool(prob >= MONTE_CARLO_PASS_PROBABILITY),
        "monte_carlo_pass_rule": "PASS when >=95% of 10,000 deterministic bootstrap paths finish with net profit > 0; MC95 DD is reported separately",
        "monte_carlo_paths": MONTE_CARLO_PATHS,
        "mc_95pct_max_drawdown_pct": float(np.percentile(np.asarray(dds, dtype=float), 95.0)),
        "monte_carlo_seed_sha256": hashlib.sha256(config_hash.encode()).hexdigest(),
    }


def write_csv(path: Path, rows: list[dict]) -> None:
    fields = [
        "strict_rank", "source_rank", "config_hash", "method", "timeframe", "entry_method", "direction_mode",
        "sl_pips", "tp_pips", "total_entry", "total_trades", "standard_lot_win_rate_pct", "probability_positive_pct",
        "standard_lot_profit_factor_same_cost_model", "standard_lot_net_profit_usd_same_cost_model",
        "standard_lot_ev_per_trade_usd_same_cost_model", "avg_win_loss_ratio",
        "standard_lot_max_dd_pct_starting_equity_10000", "recovery_factor", "max_consecutive_loss",
        "standard_lot_sqn_same_cost_model", "oos_profit_factor", "monte_carlo_pass", "mc_95pct_max_drawdown_pct",
        "positive_years_pct", "worst_year", "worst_year_net_profit_usd", "backtest_start_utc", "backtest_end_utc",
        "history_years", "sample_v11", "correlation_max", "correlation_gate", "status",
    ]
    with path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for row in rows:
            w.writerow({k: row.get(k) for k in fields})


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--state-dir", required=True)
    p.add_argument("--out-dir", required=True)
    args = p.parse_args()

    state = Path(args.state_dir).resolve()
    out = Path(args.out_dir).resolve()
    strict_path = out / "latest_entry100_net20000_standard_lot.json"
    if not strict_path.exists():
        raise SystemExit("FULL_METRICS_FAIL: strict USD20k JSON missing")

    strict = json.loads(strict_path.read_text())
    dataset = state / "gate_a" / "GC1_COMEX_TRADINGVIEW_D1_PRIMARY.csv"
    receipt = state / "gate_a" / "gate_a_receipt.json"
    db_path = state / "gold24-v11.db"
    d, audit = audit_dataset(dataset, receipt, "D1")

    for row in strict.get("ranking", []):
        config_hash = str(row["config_hash"])
        c = candidate_for_hash(db_path, config_hash)
        rerun = backtest_candidate(d, c, flat_lot=STANDARD_LOT_GOLD_UNITS)
        ledger = pd.DataFrame(rerun.get("ledger", []))
        m = rerun.get("metrics", {})
        if int(m.get("trades", 0) or 0) != int(row.get("trades", 0) or 0):
            raise RuntimeError(f"trade parity failure in full metrics for {config_hash}")
        if ledger.empty:
            raise RuntimeError(f"empty ledger for strict USD20k row {config_hash}")

        annual = annual_stats(d, np.asarray(rerun["bar_pnl"], dtype=float))
        oos = chronological_oos_metrics(d, c)
        mc = monte_carlo_metrics(pd.to_numeric(ledger["net_pnl"], errors="raise").to_numpy(float), config_hash)

        row.update({
            "sl_pips": float(c.sl / PIP_SIZE_USD),
            "tp_pips": float(c.tp / PIP_SIZE_USD),
            "total_entry": int(len(ledger)),
            "total_entry_definition": "filled entries that closed into the audited trade ledger; one filled entry per closed trade in this engine",
            "total_trades": int(len(ledger)),
            "avg_win_loss_ratio": float(m.get("avg_win_loss", 0.0) or 0.0),
            "recovery_factor": float(m.get("recovery", 0.0) or 0.0),
            "max_consecutive_loss": int(m.get("max_consec_loss", 0) or 0),
            "sample_v11": f"{int(len(ledger))}/300 {'PASS' if len(ledger) >= 300 else 'FAIL'}",
            "backtest_start_utc": str(audit.get("start_utc", "")),
            "backtest_end_utc": str(audit.get("end_utc", "")),
        })
        row.update(annual)
        row.update(oos)
        row.update(mc)

        required = [
            "sl_pips", "tp_pips", "total_entry", "total_trades", "standard_lot_win_rate_pct",
            "probability_positive_pct", "standard_lot_profit_factor_same_cost_model",
            "standard_lot_net_profit_usd_same_cost_model", "standard_lot_ev_per_trade_usd_same_cost_model",
            "avg_win_loss_ratio", "standard_lot_max_dd_pct_starting_equity_10000", "recovery_factor",
            "max_consecutive_loss", "standard_lot_sqn_same_cost_model", "oos_profit_factor", "monte_carlo_pass",
            "mc_95pct_max_drawdown_pct", "positive_years_pct", "worst_year_net_profit_usd", "history_years",
            "sample_v11", "correlation_max", "correlation_gate",
        ]
        missing = [k for k in required if k not in row or row[k] is None]
        if missing:
            raise RuntimeError(f"FULL_METRICS_FAIL missing {missing} for {config_hash}")

    strict["full_metrics_status"] = "PASS"
    strict["full_metrics_source"] = "exact qty=100 canonical re-backtest ledger; no placeholder/N/A fields"
    strict["probability_definition"] = "10,000-path deterministic trade-PnL bootstrap; probability of finishing net-positive"
    strict["monte_carlo_definition"] = "10,000-path deterministic trade-PnL bootstrap; PASS iff >=95% paths finish net-positive; MC95 DD is 95th percentile path maximum drawdown from starting equity USD10,000"
    strict["oos_definition"] = "final 20% chronological dataset rows; exact qty=100 re-backtest under the same canonical model"
    strict["positive_year_definition"] = "percentage of calendar years in the dataset whose summed exact standard-lot bar PnL is >0"
    strict["worst_year_definition"] = "minimum calendar-year net profit in USD from the exact standard-lot bar PnL"

    atomic_json(strict_path, strict)
    write_csv(out / "latest_entry100_net20000_standard_lot.csv", strict.get("ranking", []))
    print(json.dumps({
        "status": "PASS",
        "rows": len(strict.get("ranking", [])),
        "full_metrics_status": strict.get("full_metrics_status"),
        "monte_carlo_paths": MONTE_CARLO_PATHS,
        "strict_json": str(strict_path),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
