from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import sqlite3
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pandas as pd

from core import Candidate, audit_dataset, backtest_candidate, pearson_log_equity

STANDARD_LOT_GOLD_UNITS = 100.0
PIP_SIZE_USD = 0.01
MONTE_CARLO_PATHS = 10_000
CORR_HARD_MAX = 0.50
CORR_IDEAL = 0.30
CORR_WORDING = (
    "Maks 0.50 (pearson, log-return equity). Metode: per-symbol greedy filter. "
    "> 0.50 → yang kualitas lebih rendah DIHAPUS."
)

LIBRARY = {
    "min_entry": 100,
    "min_net_profit_usd": 0.0,
    "min_pf": 1.10,
    "min_ev_usd": 0.0,
    "min_oos_pf": 1.00,
    "min_positive_year_pct": 55.0,
    "min_sqn": 0.50,
    "max_corr": 0.50,
}
ACTIVE = {
    "min_entry": 100,
    "min_net_profit_usd": 0.0,
    "min_pf": 1.15,
    "min_ev_usd": 0.0,
    "min_oos_pf": 1.05,
    "min_positive_year_pct": 60.0,
    "min_sqn": 1.00,
    "max_corr": 0.30,
}
ELITE = {
    "min_entry": 300,
    "min_net_profit_usd": 20_000.0,
    "min_pf": 1.25,
    "min_ev_usd": 0.0,
    "min_oos_pf": 1.10,
    "min_positive_year_pct": 65.0,
    "min_sqn": 1.50,
    "max_corr": 0.20,
    "monte_carlo_pass_required": True,
}


def atomic_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, sort_keys=True, default=str))
    tmp.replace(path)


def method_label(c: dict) -> str:
    return (
        f"{c['family']} f{c['fast']}/s{c['slow']} "
        f"p1={c['p1']} p2={c['p2']} p3={c['p3']} "
        f"off={c['offset']} exp={c['expiry']}"
    )


def finite_float(x: object, default: float = 0.0) -> float:
    try:
        v = float(x)
    except Exception:
        return default
    if math.isnan(v):
        return default
    return v


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


def exact_full_metrics_from_ledger(pnl: np.ndarray, bar_pnl: np.ndarray) -> dict:
    pnl = np.asarray(pnl, dtype=float)
    trades = int(len(pnl))
    if not trades:
        raise RuntimeError("empty ledger passed to exact metrics")
    wins = pnl[pnl > 0]
    losses = -pnl[pnl <= 0]
    gp = float(wins.sum())
    gl = float(losses.sum())
    net = float(pnl.sum())
    pf = float(gp / gl) if gl > 0 else float("inf")
    wr = float(100.0 * len(wins) / trades)
    ev = float(net / trades)
    std = float(pnl.std(ddof=1)) if trades > 1 else 0.0
    sqn = float(math.sqrt(trades) * ev / std) if std > 0 else 0.0
    avgwin = float(wins.mean()) if len(wins) else 0.0
    avgloss = float(losses.mean()) if len(losses) else 0.0
    avg_win_loss = float(avgwin / avgloss) if avgloss > 0 else 0.0

    equity = 10000.0 + np.cumsum(np.asarray(bar_pnl, dtype=float))
    peak = np.maximum.accumulate(equity)
    dd_abs = peak - equity
    dd_pct = np.where(peak > 0, dd_abs / peak * 100.0, 0.0)
    maxdd_abs = float(dd_abs.max(initial=0.0))
    maxdd_pct = float(dd_pct.max(initial=0.0))
    recovery = float(net / maxdd_abs) if maxdd_abs > 0 else 0.0

    max_consec_loss = 0
    cur = 0
    for x in pnl:
        if x <= 0:
            cur += 1
            max_consec_loss = max(max_consec_loss, cur)
        else:
            cur = 0

    return {
        "total_entry": trades,
        "standard_lot_win_rate_pct": wr,
        "standard_lot_profit_factor_same_cost_model": pf,
        "standard_lot_net_profit_usd_same_cost_model": net,
        "standard_lot_ev_per_trade_usd_same_cost_model": ev,
        "avg_win_loss_ratio": avg_win_loss,
        "standard_lot_max_dd_pct_starting_equity_10000": maxdd_pct,
        "recovery_factor": recovery,
        "max_consecutive_loss": int(max_consec_loss),
        "standard_lot_sqn_same_cost_model": sqn,
    }


def chronological_oos_metrics(d: pd.DataFrame, c: Candidate) -> dict:
    start = int(len(d) * 0.80)
    seg = d.iloc[start:].reset_index(drop=True)
    r = backtest_candidate(seg, c, flat_lot=STANDARD_LOT_GOLD_UNITS)
    m = r.get("metrics", {})
    return {
        "oos_rows": int(len(seg)),
        "oos_trades": int(m.get("trades", 0) or 0),
        "oos_profit_factor": finite_float(m.get("profit_factor", 0.0)),
        "oos_net_profit_usd": finite_float(m.get("net_profit", 0.0)),
        "oos_win_rate_pct": finite_float(m.get("wr", 0.0)),
    }


def monte_carlo_metrics(net_pnl: np.ndarray, config_hash: str) -> dict:
    pnl = np.asarray(net_pnl, dtype=float)
    n = int(len(pnl))
    if n == 0:
        return {
            "monte_carlo_pass": False,
            "monte_carlo_paths": MONTE_CARLO_PATHS,
            "mc_95pct_max_drawdown_pct": 0.0,
            "probability_positive_pct": 0.0,
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
        "monte_carlo_pass": bool(prob >= 0.95),
        "monte_carlo_paths": MONTE_CARLO_PATHS,
        "mc_95pct_max_drawdown_pct": float(np.percentile(np.asarray(dds, dtype=float), 95.0)),
        "probability_positive_pct": float(prob * 100.0),
    }


def tier_for(row: dict) -> str:
    if (
        row["total_entry"] >= ELITE["min_entry"]
        and row["standard_lot_net_profit_usd_same_cost_model"] >= ELITE["min_net_profit_usd"]
        and row["standard_lot_profit_factor_same_cost_model"] >= ELITE["min_pf"]
        and row["standard_lot_ev_per_trade_usd_same_cost_model"] > ELITE["min_ev_usd"]
        and row["oos_profit_factor"] >= ELITE["min_oos_pf"]
        and row["positive_years_pct"] >= ELITE["min_positive_year_pct"]
        and row["standard_lot_sqn_same_cost_model"] >= ELITE["min_sqn"]
        and row["correlation_max"] <= ELITE["max_corr"] + 1e-12
        and bool(row["monte_carlo_pass"])
    ):
        return "ELITE"
    if (
        row["total_entry"] >= ACTIVE["min_entry"]
        and row["standard_lot_net_profit_usd_same_cost_model"] > ACTIVE["min_net_profit_usd"]
        and row["standard_lot_profit_factor_same_cost_model"] >= ACTIVE["min_pf"]
        and row["standard_lot_ev_per_trade_usd_same_cost_model"] > ACTIVE["min_ev_usd"]
        and row["oos_profit_factor"] >= ACTIVE["min_oos_pf"]
        and row["positive_years_pct"] >= ACTIVE["min_positive_year_pct"]
        and row["standard_lot_sqn_same_cost_model"] >= ACTIVE["min_sqn"]
        and row["correlation_max"] <= ACTIVE["max_corr"] + 1e-12
    ):
        return "ACTIVE"
    return "LIBRARY"


def write_csv(path: Path, rows: list[dict]) -> None:
    fields = [
        "rank", "config_hash", "method", "timeframe", "entry_method", "direction_mode",
        "sl_pips", "tp_pips", "total_entry", "standard_lot_win_rate_pct",
        "standard_lot_profit_factor_same_cost_model", "standard_lot_net_profit_usd_same_cost_model",
        "standard_lot_ev_per_trade_usd_same_cost_model", "avg_win_loss_ratio",
        "standard_lot_max_dd_pct_starting_equity_10000", "recovery_factor", "max_consecutive_loss",
        "standard_lot_sqn_same_cost_model", "oos_profit_factor", "monte_carlo_pass",
        "mc_95pct_max_drawdown_pct", "positive_years_pct", "worst_year", "worst_year_net_profit_usd",
        "backtest_start_utc", "backtest_end_utc", "history_years", "sample_v11",
        "correlation_max", "correlation_gate", "tier_v1",
    ]
    with path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for row in rows:
            w.writerow({k: row.get(k) for k in fields})


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--state-dir", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--source-summary", required=True)
    args = ap.parse_args()

    state = Path(args.state_dir).resolve()
    out = Path(args.out_dir).resolve()
    out.mkdir(parents=True, exist_ok=True)
    db_path = state / "gold24-v11.db"
    dataset = state / "gate_a" / "GC1_COMEX_TRADINGVIEW_D1_PRIMARY.csv"
    receipt = state / "gate_a" / "gate_a_receipt.json"
    source_summary = json.loads(Path(args.source_summary).read_text())
    d, audit = audit_dataset(dataset, receipt, "D1")

    db = sqlite3.connect(db_path)
    rows = db.execute(
        "SELECT config_hash,canonical_json,execution_hash,ledger_path,metrics_json FROM configs"
    ).fetchall()
    db.close()

    archive_total = len(rows)
    with_trades = 0
    exact_duplicates = 0
    independent_fail_counts = Counter()
    prelim: list[dict] = []
    for config_hash, canonical_raw, execution_hash, ledger_path, metrics_raw in rows:
        candidate = json.loads(canonical_raw)
        metrics = json.loads(metrics_raw) if metrics_raw else {}
        trades = int(metrics.get("trades", 0) or 0)
        net = finite_float(metrics.get("net_profit", 0.0))
        pf = finite_float(metrics.get("profit_factor", metrics.get("profit_factor_net", 0.0)))
        ev = finite_float(metrics.get("expectancy", metrics.get("net_expectancy", 0.0)))
        sqn = finite_float(metrics.get("sqn", 0.0))
        duplicate = bool(metrics.get("exact_execution_duplicate", False))
        with_trades += int(trades > 0)
        exact_duplicates += int(duplicate)
        checks = {
            "entry_lt_100": trades < LIBRARY["min_entry"],
            "net_profit_not_positive": net <= LIBRARY["min_net_profit_usd"],
            "pf_lt_1_10": pf < LIBRARY["min_pf"],
            "ev_not_positive": ev <= LIBRARY["min_ev_usd"],
            "sqn_lt_0_50": sqn < LIBRARY["min_sqn"],
            "exact_execution_duplicate": duplicate,
        }
        for k, failed in checks.items():
            independent_fail_counts[k] += int(failed)
        if any(checks.values()):
            continue
        prelim.append({
            "config_hash": str(config_hash),
            "candidate": candidate,
            "execution_hash": str(execution_hash or ""),
            "ledger_path": str(ledger_path or ""),
            "metrics": metrics,
        })

    # Read only ledger shards needed by the cheap, scale-invariant prefilter.
    by_shard: dict[str, list[dict]] = defaultdict(list)
    for row in prelim:
        name = Path(row["ledger_path"]).name
        if not name:
            raise RuntimeError(f"missing ledger path for {row['config_hash']}")
        by_shard[name].append(row)

    ledger_by_hash: dict[str, pd.DataFrame] = {}
    for shard_name, members in by_shard.items():
        shard = state / "ledgers_v11" / shard_name
        if not shard.exists():
            raise RuntimeError(f"ledger shard missing after artifact restore: {shard}")
        wanted = {x["config_hash"] for x in members}
        frame = pd.read_parquet(shard, columns=["config_hash", "exit_bar", "net_pnl"])
        frame = frame[frame["config_hash"].astype(str).isin(wanted)]
        for h, part in frame.groupby("config_hash", sort=False):
            ledger_by_hash[str(h)] = part.copy()

    pre_corr: list[dict] = []
    rejected_after_exact: list[dict] = []
    reject_counts = Counter()
    for src in prelim:
        h = src["config_hash"]
        ledger = ledger_by_hash.get(h)
        if ledger is None or ledger.empty:
            raise RuntimeError(f"missing ledger rows for {h}")
        current = src["metrics"]
        expected_trades = int(current.get("trades", 0) or 0)
        if len(ledger) != expected_trades:
            raise RuntimeError(f"ledger trade parity failure {h}: {len(ledger)} != {expected_trades}")

        pnl = pd.to_numeric(ledger["net_pnl"], errors="raise").to_numpy(float) * STANDARD_LOT_GOLD_UNITS
        exit_bar = pd.to_numeric(ledger["exit_bar"], errors="raise").to_numpy(int)
        if np.any(exit_bar < 0) or np.any(exit_bar >= len(d)):
            raise RuntimeError(f"exit_bar out of range for {h}")
        bar_pnl = np.zeros(len(d), dtype=float)
        np.add.at(bar_pnl, exit_bar, pnl)
        exact = exact_full_metrics_from_ledger(pnl, bar_pnl)

        # The canonical cost function is exactly linear in qty, so qty=1 ledger PnL * 100
        # is the exact qty=100 ledger under the same canonical stressed cost model.
        expected_net = finite_float(current.get("net_profit", 0.0)) * STANDARD_LOT_GOLD_UNITS
        if not math.isclose(exact["standard_lot_net_profit_usd_same_cost_model"], expected_net, rel_tol=1e-9, abs_tol=1e-7):
            raise RuntimeError(f"qty scale parity failure for {h}")

        c = Candidate(**src["candidate"])
        annual = annual_stats(d, bar_pnl)
        oos = chronological_oos_metrics(d, c)
        row = {
            "config_hash": h,
            "method": method_label(src["candidate"]),
            "family": src["candidate"]["family"],
            "timeframe": src["candidate"]["timeframe"],
            "entry_method": src["candidate"]["entry_method"],
            "direction_mode": src["candidate"]["direction_mode"],
            "sl_pips": float(c.sl / PIP_SIZE_USD),
            "tp_pips": float(c.tp / PIP_SIZE_USD),
            "backtest_start_utc": str(audit.get("start_utc", "")),
            "backtest_end_utc": str(audit.get("end_utc", "")),
            "history_years": finite_float(current.get("history_years", 0.0)),
            "sample_v11": f"{exact['total_entry']}/300 {'PASS' if exact['total_entry'] >= 300 else 'FAIL'}",
            "_bar_pnl": bar_pnl,
            "_trade_pnl": pnl,
        }
        row.update(exact)
        row.update(annual)
        row.update(oos)

        exact_library_checks = {
            "entry": row["total_entry"] >= LIBRARY["min_entry"],
            "net_profit": row["standard_lot_net_profit_usd_same_cost_model"] > LIBRARY["min_net_profit_usd"],
            "pf": row["standard_lot_profit_factor_same_cost_model"] >= LIBRARY["min_pf"],
            "ev": row["standard_lot_ev_per_trade_usd_same_cost_model"] > LIBRARY["min_ev_usd"],
            "oos_pf": row["oos_profit_factor"] >= LIBRARY["min_oos_pf"],
            "positive_year": row["positive_years_pct"] >= LIBRARY["min_positive_year_pct"],
            "sqn": row["standard_lot_sqn_same_cost_model"] >= LIBRARY["min_sqn"],
        }
        row["library_checks_pre_corr"] = exact_library_checks
        failed = [k for k, ok in exact_library_checks.items() if not ok]
        if failed:
            for k in failed:
                reject_counts[k] += 1
            row["reject_reasons"] = failed
            row.pop("_bar_pnl", None)
            row.pop("_trade_pnl", None)
            rejected_after_exact.append(row)
            continue
        pre_corr.append(row)

    # Same quality order used by the existing portfolio-style correlation audit.
    pre_corr.sort(
        key=lambda r: (
            r["standard_lot_profit_factor_same_cost_model"],
            r["standard_lot_net_profit_usd_same_cost_model"],
            -r["standard_lot_max_dd_pct_starting_equity_10000"],
            r["total_entry"],
        ),
        reverse=True,
    )

    selected: list[dict] = []
    removed_corr: list[dict] = []
    for row in pre_corr:
        pairs: list[tuple[float, str]] = []
        for prior in selected:
            corr = abs(float(pearson_log_equity(row["_bar_pnl"], prior["_bar_pnl"])))
            pairs.append((corr, prior["config_hash"]))
        max_corr, against = max(pairs, default=(0.0, None), key=lambda x: x[0])
        row["correlation_max"] = float(max_corr)
        row["correlation_against"] = against
        if max_corr <= CORR_HARD_MAX + 1e-12:
            row["correlation_gate"] = "PASS"
            selected.append(row)
        else:
            row["correlation_gate"] = "REMOVED >0.50"
            row["reject_reasons"] = ["corr_gt_0_50"]
            row.pop("_bar_pnl", None)
            row.pop("_trade_pnl", None)
            removed_corr.append(row)

    # Monte Carlo is ranking-only for LIBRARY, preference for ACTIVE, hard only for ELITE.
    for row in selected:
        row.update(monte_carlo_metrics(row["_trade_pnl"], row["config_hash"]))
        row["tier_v1"] = tier_for(row)
        row.pop("_bar_pnl", None)
        row.pop("_trade_pnl", None)

    tier_priority = {"ELITE": 3, "ACTIVE": 2, "LIBRARY": 1}
    selected.sort(
        key=lambda r: (
            tier_priority.get(r["tier_v1"], 0),
            r["oos_profit_factor"],
            r["standard_lot_profit_factor_same_cost_model"],
            r["standard_lot_sqn_same_cost_model"],
            -r["correlation_max"],
            r["standard_lot_net_profit_usd_same_cost_model"],
        ),
        reverse=True,
    )
    for i, row in enumerate(selected, 1):
        row["rank"] = i
        row["status"] = "PASS MULTI-METHOD v1 LIBRARY + CORR<=0.50"

    tiers = Counter(r["tier_v1"] for r in selected)
    payload = {
        "schema": "gold24-multimethod-v1-full-archive-rescan-v1",
        "status": "PASS",
        "purpose": "Full rescan of the entire canonical GOLD v11 archive for the small-lot / many-method portfolio design.",
        "source_run_id": str(source_summary.get("github_run_id", "")),
        "source_batch": source_summary.get("batch"),
        "source_candidate_cursor": source_summary.get("candidate_cursor"),
        "source_archive_total": archive_total,
        "source_with_trades": with_trades,
        "source_exact_execution_duplicates": exact_duplicates,
        "source_execution_unique": int(source_summary.get("execution_hash_unique", 0) or 0),
        "dataset": audit,
        "standard_lot_reference": {
            "xauusd_standard_lot": 1.0,
            "gold_units": STANDARD_LOT_GOLD_UNITS,
            "pip_size_usd": PIP_SIZE_USD,
            "pip_value_per_standard_lot_usd": 1.0,
            "cost_model": "canonical stressed Hyperliquid cost model; not broker-specific MT5/Exness parity",
        },
        "library_rule": LIBRARY,
        "active_rule": ACTIVE,
        "elite_rule": ELITE,
        "correlation_rule": {
            "maximum": CORR_HARD_MAX,
            "ideal": CORR_IDEAL,
            "metric": "absolute Pearson correlation of log-return equity",
            "selection": "per-symbol greedy filter; PF first, then net profit, lower DD, larger sample",
            "wording": CORR_WORDING,
        },
        "monte_carlo_definition": "10,000-path deterministic trade-PnL bootstrap; PASS iff >=95% paths finish net-positive; MC95 DD is 95th percentile path maximum drawdown from starting equity USD10,000",
        "oos_definition": "final 20% chronological dataset rows; exact qty=100 re-backtest under the same canonical model",
        "positive_year_definition": "percentage of calendar years whose summed exact qty=100 bar PnL is >0",
        "full_archive_rows_scanned": archive_total,
        "cheap_scale_invariant_prefilter_count": len(prelim),
        "exact_full_metrics_pre_correlation_count": len(pre_corr),
        "removed_by_correlation_count": len(removed_corr),
        "library_count": len(selected),
        "active_count": int(tiers.get("ACTIVE", 0) + tiers.get("ELITE", 0)),
        "elite_count": int(tiers.get("ELITE", 0)),
        "tier_counts": dict(tiers),
        "independent_archive_fail_counts": dict(independent_fail_counts),
        "exact_stage_reject_counts": dict(reject_counts),
        "ranking": selected,
        "removed_by_correlation": removed_corr,
        "rejected_after_exact_metrics": rejected_after_exact,
    }

    atomic_json(out / "latest_multimethod_v1_full_rescan.json", payload)
    write_csv(out / "latest_multimethod_v1_full_rescan.csv", selected)
    atomic_json(out / "latest_multimethod_v1_full_rescan_summary.json", {
        "status": "PASS",
        "source_run_id": payload["source_run_id"],
        "source_batch": payload["source_batch"],
        "source_candidate_cursor": payload["source_candidate_cursor"],
        "full_archive_rows_scanned": archive_total,
        "source_with_trades": with_trades,
        "cheap_scale_invariant_prefilter_count": len(prelim),
        "exact_full_metrics_pre_correlation_count": len(pre_corr),
        "removed_by_correlation_count": len(removed_corr),
        "library_count": len(selected),
        "active_count": payload["active_count"],
        "elite_count": payload["elite_count"],
        "tier_counts": payload["tier_counts"],
        "correlation_wording": CORR_WORDING,
    })
    print(json.dumps(json.loads((out / "latest_multimethod_v1_full_rescan_summary.json").read_text()), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
