from __future__ import annotations

import argparse
import csv
import json
import math
import os
import random
import sqlite3
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import numpy as np
import pandas as pd

from core import Candidate, FAMILIES, audit_dataset, backtest_candidate, generate_candidate, pearson_log_equity, validate_candidate
from multimethod_v1_full_rescan import (
    ACTIVE,
    CORR_HARD_MAX,
    CORR_IDEAL,
    CORR_WORDING,
    ELITE,
    LIBRARY,
    PIP_SIZE_USD,
    STANDARD_LOT_GOLD_UNITS,
    annual_stats,
    atomic_json,
    exact_full_metrics_from_ledger,
    method_label,
    monte_carlo_metrics,
    tier_for,
)

WINDOWS = [3, 5, 7, 8, 10, 13, 14, 20, 21, 26, 34, 50, 55, 89, 100, 144]
SL_TP_FOCUSED = [x / 2 for x in range(30, 51)]  # $15.0-$25.0
SL_TP_FULL = [x / 2 for x in range(10, 51)]
OFFSETS = [x / 4 for x in range(2, 21)]
DIRECTIONS = ["LONG_ONLY", "BOTH", "SHORT_ONLY"]

MASTER_UNIVERSE_PATH = Path(__file__).resolve().with_name("MASTER_METHOD_UNIVERSE.json")
IMPLEMENTED_FAMILIES = tuple(sorted(FAMILIES))
PORTFOLIO_MIN_DISTINCT_FAMILIES = 6
PORTFOLIO_MAX_SINGLE_FAMILY_SHARE = 0.25

_WORKER_D: pd.DataFrame | None = None


def _validate_master_universe() -> dict:
    if not MASTER_UNIVERSE_PATH.exists():
        raise RuntimeError(f"master method universe missing: {MASTER_UNIVERSE_PATH}")
    payload = json.loads(MASTER_UNIVERSE_PATH.read_text())
    registered = set()
    for category in payload.get("categories", []):
        if str(category.get("status")) != "IMPLEMENTED":
            continue
        registered.update(str(x) for x in category.get("engine_families", []))
    engine = set(IMPLEMENTED_FAMILIES)
    if registered != engine:
        raise RuntimeError(
            "master method universe/engine mismatch: "
            f"registered_only={sorted(registered-engine)} engine_only={sorted(engine-registered)}"
        )
    return payload


def _worker_init(dataset: str, receipt: str) -> None:
    global _WORKER_D
    _WORKER_D, _ = audit_dataset(dataset, receipt, "D1")


def _cheap_pass(m: dict) -> bool:
    return (
        int(m.get("trades", 0) or 0) >= int(LIBRARY["min_entry"])
        and float(m.get("net_profit", 0.0) or 0.0) > 0.0
        and float(m.get("profit_factor", 0.0) or 0.0) >= float(LIBRARY["min_pf"])
        and float(m.get("expectancy", 0.0) or 0.0) > 0.0
        and float(m.get("sqn", 0.0) or 0.0) >= float(LIBRARY["min_sqn"])
    )


def _simulate_worker(candidate_dict: dict) -> dict:
    if _WORKER_D is None:
        raise RuntimeError("worker dataset not initialized")
    c = Candidate(**candidate_dict)
    r = backtest_candidate(_WORKER_D, c, flat_lot=1.0)
    m = r.get("metrics", {})
    out = {
        "candidate": c.canonical_dict(),
        "config_hash": c.config_hash,
        "execution_hash": str(r.get("execution_hash") or ""),
        "metrics": m,
        "cheap_pass": _cheap_pass(m),
    }
    if out["cheap_pass"]:
        out["ledger"] = r.get("ledger", [])
        out["bar_pnl"] = np.asarray(r.get("bar_pnl", []), dtype=float).tolist()
    return out


def _positive_seed_rows(db: sqlite3.Connection) -> list[dict]:
    rows = db.execute("SELECT canonical_json,metrics_json FROM configs").fetchall()
    out: list[dict] = []
    for c_raw, m_raw in rows:
        c = json.loads(c_raw)
        m = json.loads(m_raw) if m_raw else {}
        if bool(m.get("exact_execution_duplicate", False)):
            continue
        trades = int(m.get("trades", 0) or 0)
        net = float(m.get("net_profit", 0.0) or 0.0)
        if trades < 100 or net <= 0:
            continue
        out.append({"candidate": c, "metrics": m})
    out.sort(
        key=lambda x: (
            float(x["metrics"].get("profit_factor", 0.0) or 0.0),
            float(x["metrics"].get("net_profit", 0.0) or 0.0),
            float(x["metrics"].get("sqn", 0.0) or 0.0),
        ),
        reverse=True,
    )
    return out


def _weighted_direction(rng: random.Random) -> str:
    x = rng.random()
    if x < 0.58:
        return "LONG_ONLY"
    if x < 0.96:
        return "BOTH"
    return "SHORT_ONLY"


def _family_params(rng: random.Random, family: str, current: dict | None = None) -> tuple[float, float, float]:
    if current and rng.random() < 0.60:
        return float(current["p1"]), float(current["p2"]), float(current["p3"])

    if family in {"ATR_BREAKOUT", "KELTNER_BREAKOUT", "VOLATILITY", "ADAPTIVE_TREND"}:
        return float(rng.choice([0.5, 0.7, 0.9, 1.0, 1.2, 1.5, 1.8, 2.2])), 55.0, 1.0
    if family == "BAND_HYBRID":
        return float(rng.choice([1.0, 1.2, 1.5, 1.8, 2.0])), float(rng.choice([1.5, 1.8, 2.0, 2.2, 2.5])), 1.0
    if family in {"BOLLINGER_REVERSION", "VWAP"}:
        return float(rng.choice([0.7, 1.0, 1.2, 1.5, 1.8, 2.2, 2.6])), float(rng.choice([25, 30, 35, 40])), 1.0
    if family == "ZSCORE_REVERSION":
        return float(rng.choice([0.7, 1.0, 1.3, 1.7, 2.1, 2.7])), float(rng.choice([25, 30, 35, 40])), 1.0
    if family in {"MOMENTUM_RSI_ROC", "RELATIVE_STRENGTH"}:
        return float(rng.choice([0.3, 0.5, 0.8, 1.2, 1.8, 2.5])), float(rng.choice([52, 55, 58, 62, 66])), 1.0
    if family in {"CHART_PATTERN", "SUPPORT_RESISTANCE"}:
        return float(rng.choice([0.2, 0.3, 0.5, 0.7, 1.0])), 55.0, 1.0
    if family == "FIBONACCI":
        return float(rng.choice([0.382, 0.5, 0.618, 0.786])), float(rng.choice([3.0, 5.0, 8.0, 10.0])), 1.0
    if family == "DIVERGENCE":
        return float(rng.choice([2.0, 3.0, 5.0, 8.0, 10.0])), 55.0, 1.0
    if family == "VOLUME":
        return float(rng.choice([1.1, 1.2, 1.4, 1.6, 2.0, 2.5])), 55.0, 1.0
    if family == "STATISTICAL":
        return float(rng.choice([0.65, 0.70, 0.75, 0.80, 0.85, 0.90])), 55.0, 1.0
    return float(rng.choice([52, 55, 58, 62, 66])), float(rng.choice([52, 55, 58, 62, 66])), 1.0

def _fresh_candidate_for_family(rng: random.Random, family: str) -> Candidate:
    if family not in FAMILIES:
        raise ValueError(f"unknown implemented family: {family}")
    c0 = generate_candidate(rng, timeframe="D1")
    d = c0.canonical_dict()
    d["family"] = family
    fast, slow = sorted(rng.sample(WINDOWS, 2))
    d["fast"], d["slow"] = int(fast), int(slow)
    p1, p2, p3 = _family_params(rng, family, None)
    d["p1"], d["p2"], d["p3"] = p1, p2, p3
    d["entry_method"] = "LIMIT" if rng.random() < 0.90 else "STOP"
    d["direction_mode"] = _weighted_direction(rng)
    choices = SL_TP_FOCUSED if rng.random() < 0.85 else SL_TP_FULL
    sl = float(rng.choice(choices))
    if rng.random() < 0.82:
        tps = [x for x in choices if x + 1e-12 >= sl]
        tp = float(rng.choice(tps or choices))
    else:
        tp = float(rng.choice(choices))
    d["sl"], d["tp"] = sl, tp
    d["offset"] = float(rng.choice(OFFSETS))
    d["expiry"] = int(rng.randint(1, 8))
    c = Candidate(**d)
    validate_candidate(c)
    return c


def _mutated_candidate(rng: random.Random, seeds: list[dict], target_family: str) -> Candidate:
    # Family-balanced discovery: exploit only inside the target family.
    family_seeds = [
        x for x in seeds
        if str(x.get("candidate", {}).get("family", "")) == target_family
    ]

    # Exploit useful neighborhoods inside the requested family, never globally.
    if family_seeds and rng.random() < 0.68:
        pool = family_seeds[: min(24, len(family_seeds))] if rng.random() < 0.85 else family_seeds
        base = dict(rng.choice(pool)["candidate"])
        base["family"] = target_family

        if rng.random() < 0.80:
            fast, slow = sorted(rng.sample(WINDOWS, 2))
            base["fast"], base["slow"] = int(fast), int(slow)
        p1, p2, p3 = _family_params(rng, target_family, base)
        base["p1"], base["p2"], base["p3"] = p1, p2, p3
        base["entry_method"] = "LIMIT" if rng.random() < 0.90 else "STOP"
        base["direction_mode"] = _weighted_direction(rng)
        choices = SL_TP_FOCUSED if rng.random() < 0.88 else SL_TP_FULL
        sl = float(rng.choice(choices))
        if rng.random() < 0.84:
            tps = [x for x in choices if x + 1e-12 >= sl]
            tp = float(rng.choice(tps or choices))
        else:
            tp = float(rng.choice(choices))
        base["sl"], base["tp"] = sl, tp
        base["offset"] = float(rng.choice(OFFSETS))
        base["expiry"] = int(rng.randint(1, 8))
        c = Candidate(**base)
        validate_candidate(c)
        return c

    return _fresh_candidate_for_family(rng, target_family)

def _oos_qty100(d: pd.DataFrame, c: Candidate) -> dict:
    start = int(len(d) * 0.80)
    seg = d.iloc[start:].reset_index(drop=True)
    r = backtest_candidate(seg, c, flat_lot=STANDARD_LOT_GOLD_UNITS)
    m = r.get("metrics", {})
    return {
        "oos_rows": int(len(seg)),
        "oos_trades": int(m.get("trades", 0) or 0),
        "oos_profit_factor": float(m.get("profit_factor", 0.0) or 0.0),
        "oos_net_profit_usd": float(m.get("net_profit", 0.0) or 0.0),
        "oos_win_rate_pct": float(m.get("wr", 0.0) or 0.0),
    }


def _exact_row(d: pd.DataFrame, audit: dict, candidate_dict: dict, origin: str) -> tuple[dict, np.ndarray, np.ndarray]:
    c = Candidate(**candidate_dict)
    r = backtest_candidate(d, c, flat_lot=STANDARD_LOT_GOLD_UNITS)
    ledger = pd.DataFrame(r.get("ledger", []))
    if ledger.empty:
        raise RuntimeError(f"exact row unexpectedly empty for {c.config_hash}")
    pnl = pd.to_numeric(ledger["net_pnl"], errors="raise").to_numpy(float)
    bar_pnl = np.asarray(r.get("bar_pnl", []), dtype=float)
    metrics = exact_full_metrics_from_ledger(pnl, bar_pnl)
    annual = annual_stats(d, bar_pnl)
    oos = _oos_qty100(d, c)
    row = {
        "origin": origin,
        "config_hash": c.config_hash,
        "candidate": c.canonical_dict(),
        "method": method_label(c.canonical_dict()),
        "family": c.family,
        "timeframe": c.timeframe,
        "entry_method": c.entry_method,
        "direction_mode": c.direction_mode,
        "sl_pips": float(c.sl / PIP_SIZE_USD),
        "tp_pips": float(c.tp / PIP_SIZE_USD),
        "backtest_start_utc": str(audit.get("start_utc", "")),
        "backtest_end_utc": str(audit.get("end_utc", "")),
        "history_years": float(r.get("metrics", {}).get("history_years", 0.0) or 0.0),
        "sample_v11": f"{len(ledger)}/300 {'PASS' if len(ledger) >= 300 else 'FAIL'}",
        "execution_hash_qty100": str(r.get("execution_hash") or ""),
    }
    row.update(metrics)
    row.update(annual)
    row.update(oos)
    return row, bar_pnl, pnl


def _library_pre_corr(row: dict) -> bool:
    return (
        int(row["total_entry"]) >= int(LIBRARY["min_entry"])
        and float(row["standard_lot_net_profit_usd_same_cost_model"]) > 0.0
        and float(row["standard_lot_profit_factor_same_cost_model"]) >= float(LIBRARY["min_pf"])
        and float(row["standard_lot_ev_per_trade_usd_same_cost_model"]) > 0.0
        and float(row["oos_profit_factor"]) >= float(LIBRARY["min_oos_pf"])
        and float(row["positive_years_pct"]) >= float(LIBRARY["min_positive_year_pct"])
        and float(row["standard_lot_sqn_same_cost_model"]) >= float(LIBRARY["min_sqn"])
    )


def _quality(row: dict) -> tuple:
    return (
        float(row["standard_lot_profit_factor_same_cost_model"]),
        float(row["standard_lot_net_profit_usd_same_cost_model"]),
        -float(row["standard_lot_max_dd_pct_starting_equity_10000"]),
        int(row["total_entry"]),
    )


def _write_csv(path: Path, rows: list[dict]) -> None:
    fields = [
        "rank", "origin", "config_hash", "method", "family", "timeframe", "entry_method", "direction_mode",
        "sl_pips", "tp_pips", "total_entry", "standard_lot_win_rate_pct",
        "standard_lot_profit_factor_same_cost_model", "standard_lot_net_profit_usd_same_cost_model",
        "standard_lot_ev_per_trade_usd_same_cost_model", "avg_win_loss_ratio",
        "standard_lot_max_dd_pct_starting_equity_10000", "recovery_factor", "max_consecutive_loss",
        "standard_lot_sqn_same_cost_model", "oos_profit_factor", "monte_carlo_pass", "mc_95pct_max_drawdown_pct",
        "positive_years_pct", "worst_year", "worst_year_net_profit_usd", "backtest_start_utc", "backtest_end_utc",
        "history_years", "sample_v11", "correlation_max", "correlation_gate", "tier_v1",
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
    ap.add_argument("--existing-library", required=True)
    ap.add_argument("--candidate-count", type=int, default=2000)
    ap.add_argument("--base-seed", type=int, default=2026083101)
    ap.add_argument("--workers", type=int, default=0)
    args = ap.parse_args()

    state = Path(args.state_dir).resolve()
    out = Path(args.out_dir).resolve()
    out.mkdir(parents=True, exist_ok=True)
    source = json.loads(Path(args.source_summary).read_text())
    existing_payload = json.loads(Path(args.existing_library).read_text())
    master_universe = _validate_master_universe()

    dataset = state / "gate_a" / "GC1_COMEX_TRADINGVIEW_D1_PRIMARY.csv"
    receipt = state / "gate_a" / "gate_a_receipt.json"
    db_path = state / "gold24-v11.db"
    d, audit = audit_dataset(dataset, receipt, "D1")

    db = sqlite3.connect(db_path)
    archive_hashes = {str(x[0]) for x in db.execute("SELECT config_hash FROM configs").fetchall()}
    archive_exec_hashes = {str(x[0]) for x in db.execute("SELECT execution_hash FROM configs WHERE execution_hash IS NOT NULL AND execution_hash != ''").fetchall()}
    seeds = _positive_seed_rows(db)
    existing_config_by_hash = {
        str(h): json.loads(craw)
        for h, craw in db.execute("SELECT config_hash,canonical_json FROM configs").fetchall()
    }
    db.close()

    previous_path = out / "latest_multimethod_v1_discovery.json"
    previous = json.loads(previous_path.read_text()) if previous_path.exists() else {}
    prior_evaluated = set(str(x) for x in previous.get("evaluated_config_hashes", []))

    rng = random.Random(int(args.base_seed))
    generated: list[Candidate] = []
    generated_hashes: set[str] = set()
    generated_family_counts = {family: 0 for family in IMPLEMENTED_FAMILIES}
    attempts = 0
    max_attempts = max(int(args.candidate_count) * 300, 20000)
    while len(generated) < int(args.candidate_count) and attempts < max_attempts:
        attempts += 1
        min_count = min(generated_family_counts.values())
        least_sampled = [
            family for family in IMPLEMENTED_FAMILIES
            if generated_family_counts[family] == min_count
        ]
        target_family = rng.choice(least_sampled)
        candidate = _mutated_candidate(rng, seeds, target_family)
        h = candidate.config_hash
        if h in archive_hashes or h in prior_evaluated or h in generated_hashes:
            continue
        generated.append(candidate)
        generated_hashes.add(h)
        generated_family_counts[candidate.family] += 1
    if len(generated) < int(args.candidate_count):
        raise RuntimeError(f"generation exhausted: wanted={args.candidate_count} got={len(generated)} attempts={attempts}")
    if max(generated_family_counts.values()) - min(generated_family_counts.values()) > 1:
        raise RuntimeError(f"family-balanced generation invariant failed: {generated_family_counts}")

    generated_category_counts: dict[str, int] = {}
    implemented_categories = [
        category for category in master_universe.get("categories", [])
        if str(category.get("status")) == "IMPLEMENTED"
    ]
    for category in implemented_categories:
        name = str(category.get("name") or category.get("id") or "")
        families = [str(x) for x in category.get("engine_families", [])]
        generated_category_counts[name] = sum(generated_family_counts.get(family, 0) for family in families)
    all_implemented_categories_sampled = (
        len(implemented_categories) == int(master_universe.get("implemented_category_count", len(implemented_categories)))
        and len(implemented_categories) == 20
        and all(int(v) > 0 for v in generated_category_counts.values())
    )
    if not all_implemented_categories_sampled:
        raise RuntimeError(
            f"master category coverage failed count={len(implemented_categories)} "
            f"generated={generated_category_counts}"
        )

    workers = int(args.workers) if int(args.workers) > 0 else max(1, min(os.cpu_count() or 2, 8))
    simulated: list[dict] = []
    with ProcessPoolExecutor(max_workers=workers, initializer=_worker_init, initargs=(str(dataset), str(receipt))) as pool:
        futures = [pool.submit(_simulate_worker, c.canonical_dict()) for c in generated]
        for fut in as_completed(futures):
            simulated.append(fut.result())

    execution_unique = []
    exact_hash_seen = set(archive_exec_hashes)
    # Preserve execution uniqueness against previously discovered LIBRARY rows too.
    for old in existing_payload.get("ranking", []):
        h = str(old.get("config_hash") or "")
        cdict = existing_config_by_hash.get(h) or old.get("candidate")
        if not cdict:
            continue
        c = Candidate(**cdict)
        validate_candidate(c)
        if c.config_hash != h:
            raise RuntimeError(f"existing library candidate/hash mismatch: expected={h} got={c.config_hash}")
        prior_result = backtest_candidate(d, c, flat_lot=1.0)
        prior_execution_hash = str(prior_result.get("execution_hash") or "")
        if prior_execution_hash:
            exact_hash_seen.add(prior_execution_hash)

    duplicate_execution_rejected = 0
    cheap_pass_count = 0
    for r in simulated:
        if not r.get("cheap_pass"):
            continue
        cheap_pass_count += 1
        eh = str(r.get("execution_hash") or "")
        if not eh or eh in exact_hash_seen:
            duplicate_execution_rejected += 1
            continue
        exact_hash_seen.add(eh)
        execution_unique.append(r)

    # Exact standard-lot + OOS + yearly gate only for cheap-pass execution-unique rows.
    new_exact_rows: list[dict] = []
    new_barpnl: dict[str, np.ndarray] = {}
    new_tradepnl: dict[str, np.ndarray] = {}
    exact_reject_counts = {"oos_pf": 0, "positive_year": 0, "other": 0}
    for r in execution_unique:
        row, bar_pnl, trade_pnl = _exact_row(d, audit, r["candidate"], "DISCOVERY")
        if not _library_pre_corr(row):
            if float(row["oos_profit_factor"]) < float(LIBRARY["min_oos_pf"]):
                exact_reject_counts["oos_pf"] += 1
            if float(row["positive_years_pct"]) < float(LIBRARY["min_positive_year_pct"]):
                exact_reject_counts["positive_year"] += 1
            continue
        new_exact_rows.append(row)
        new_barpnl[row["config_hash"]] = bar_pnl
        new_tradepnl[row["config_hash"]] = trade_pnl

    # Rebuild the existing frozen LIBRARY rows exactly so one greedy correlation authority ranks old + new together.
    # Previously discovered rows are not necessarily present in the canonical archive DB, so their stored candidate
    # is the authoritative fallback. Every fallback is hash-validated and exact-rebacktested before reuse.
    combined_rows: list[dict] = []
    barpnls: dict[str, np.ndarray] = {}
    tradepnls: dict[str, np.ndarray] = {}
    for old in existing_payload.get("ranking", []):
        h = str(old["config_hash"])
        cdict = existing_config_by_hash.get(h)
        origin = "ARCHIVE"
        if not cdict:
            cdict = old.get("candidate")
            origin = "DISCOVERY_PREVIOUS"
        if not cdict:
            raise RuntimeError(f"existing library config missing from canonical DB and prior payload: {h}")
        c = Candidate(**cdict)
        validate_candidate(c)
        if c.config_hash != h:
            raise RuntimeError(f"existing library candidate/hash mismatch: expected={h} got={c.config_hash}")
        row, bar_pnl, trade_pnl = _exact_row(d, audit, c.canonical_dict(), origin)
        if not _library_pre_corr(row):
            raise RuntimeError(f"frozen existing LIBRARY row no longer passes exact gate: {h}")
        combined_rows.append(row)
        barpnls[h] = bar_pnl
        tradepnls[h] = trade_pnl
    for row in new_exact_rows:
        h = row["config_hash"]
        combined_rows.append(row)
        barpnls[h] = new_barpnl[h]
        tradepnls[h] = new_tradepnl[h]

    combined_rows.sort(key=_quality, reverse=True)
    selected: list[dict] = []
    removed: list[dict] = []
    for row in combined_rows:
        pairs: list[tuple[float, str]] = []
        for prior in selected:
            corr = abs(float(pearson_log_equity(barpnls[row["config_hash"]], barpnls[prior["config_hash"]])))
            pairs.append((corr, prior["config_hash"]))
        max_corr, against = max(pairs, default=(0.0, None), key=lambda x: x[0])
        row["correlation_max"] = float(max_corr)
        row["correlation_against"] = against
        if max_corr <= CORR_HARD_MAX + 1e-12:
            row["correlation_gate"] = "PASS"
            selected.append(row)
        else:
            row["correlation_gate"] = "REMOVED >0.50"
            removed.append(row)

    for rank, row in enumerate(selected, 1):
        row.update(monte_carlo_metrics(tradepnls[row["config_hash"]], row["config_hash"]))
        row["tier_v1"] = tier_for(row)
        row["rank"] = rank
        row["status"] = f"PASS MULTI-METHOD v1 {row['tier_v1']} + CORR<=0.50"

    tier_counts: dict[str, int] = {}
    for row in selected:
        tier_counts[row["tier_v1"]] = tier_counts.get(row["tier_v1"], 0) + 1
    new_selected_count = sum(1 for row in selected if row.get("origin") == "DISCOVERY")
    existing_selected_count = sum(1 for row in selected if row.get("origin") != "DISCOVERY")

    selected_family_counts: dict[str, int] = {}
    for row in selected:
        family = str(row.get("family") or "")
        selected_family_counts[family] = selected_family_counts.get(family, 0) + 1
    selected_count = len(selected)
    selected_distinct_family_count = len([x for x in selected_family_counts if x])
    max_selected_family_share = (
        max(selected_family_counts.values()) / selected_count
        if selected_count > 0 else 0.0
    )
    portfolio_ready = (
        selected_distinct_family_count >= PORTFOLIO_MIN_DISTINCT_FAMILIES
        and max_selected_family_share <= PORTFOLIO_MAX_SINGLE_FAMILY_SHARE + 1e-12
    )

    evaluated_hashes = sorted(prior_evaluated | generated_hashes)
    payload = {
        "schema": "gold24-multimethod-v1-adaptive-discovery-v1",
        "status": "PASS",
        "purpose": "Adaptive discovery for the small-lot / many-method portfolio while keeping execution uniqueness, exact OOS/year gates and greedy correlation authority.",
        "source_run_id": str(source.get("github_run_id", "")),
        "source_batch": source.get("batch"),
        "source_candidate_cursor": source.get("candidate_cursor"),
        "source_archive_total": source.get("cumulative_configs_archived"),
        "base_seed": int(args.base_seed),
        "workers": workers,
        "generation_attempts": attempts,
        "discovery_policy": "family-balanced across every implemented engine family; seed exploitation is restricted to the target family",
        "master_method_universe_schema": master_universe.get("schema"),
        "implemented_family_count": len(IMPLEMENTED_FAMILIES),
        "implemented_families": list(IMPLEMENTED_FAMILIES),
        "implemented_category_count": len(implemented_categories),
        "generated_family_counts_this_run": generated_family_counts,
        "generated_category_counts_this_run": generated_category_counts,
        "all_implemented_categories_sampled": all_implemented_categories_sampled,
        "simulated_new_configs_this_run": len(simulated),
        "evaluated_config_hash_count_cumulative": len(evaluated_hashes),
        "cheap_pass_count_this_run": cheap_pass_count,
        "execution_duplicate_rejected_this_run": duplicate_execution_rejected,
        "exact_full_metrics_pre_corr_new_this_run": len(new_exact_rows),
        "exact_reject_counts_this_run": exact_reject_counts,
        "existing_library_input_count": len(existing_payload.get("ranking", [])),
        "combined_pre_corr_count": len(combined_rows),
        "removed_by_correlation_count": len(removed),
        "library_count": len(selected),
        "new_selected_count": new_selected_count,
        "existing_selected_count": existing_selected_count,
        "active_count": sum(1 for x in selected if x["tier_v1"] in {"ACTIVE", "ELITE"}),
        "elite_count": sum(1 for x in selected if x["tier_v1"] == "ELITE"),
        "tier_counts": tier_counts,
        "selected_family_counts": selected_family_counts,
        "selected_distinct_family_count": selected_distinct_family_count,
        "max_selected_family_share": max_selected_family_share,
        "portfolio_ready": portfolio_ready,
        "portfolio_diversification_gate": {
            "min_distinct_families": PORTFOLIO_MIN_DISTINCT_FAMILIES,
            "max_single_family_share": PORTFOLIO_MAX_SINGLE_FAMILY_SHARE,
            "library_may_exceed_family_cap": True,
            "status": "PASS" if portfolio_ready else "NOT_READY",
        },
        "library_rule": LIBRARY,
        "active_rule": ACTIVE,
        "elite_rule": ELITE,
        "correlation_rule": {
            "maximum": CORR_HARD_MAX,
            "ideal": CORR_IDEAL,
            "metric": "absolute Pearson correlation of log-return equity",
            "selection": "PF first, then net profit, lower DD, larger sample; old and new candidates share one greedy authority",
            "wording": CORR_WORDING,
        },
        "standard_lot_reference": {
            "xauusd_standard_lot": 1.0,
            "gold_units": STANDARD_LOT_GOLD_UNITS,
            "pip_size_usd": PIP_SIZE_USD,
            "pip_value_per_standard_lot_usd": 1.0,
            "cost_model": "canonical stressed Hyperliquid cost model; not broker-specific MT5/Exness parity",
        },
        "ranking": selected,
        "removed_by_correlation": removed,
        "new_pre_corr_rows": new_exact_rows,
        "evaluated_config_hashes": evaluated_hashes,
    }
    atomic_json(previous_path, payload)
    atomic_json(out / "latest_multimethod_v1_discovery_summary.json", {
        k: payload[k] for k in [
            "schema", "status", "source_run_id", "source_batch", "source_candidate_cursor", "source_archive_total",
            "base_seed", "workers", "simulated_new_configs_this_run", "evaluated_config_hash_count_cumulative",
            "cheap_pass_count_this_run", "execution_duplicate_rejected_this_run", "exact_full_metrics_pre_corr_new_this_run",
            "combined_pre_corr_count", "removed_by_correlation_count", "library_count", "new_selected_count",
            "existing_selected_count", "active_count", "elite_count", "tier_counts",
            "implemented_family_count", "implemented_category_count",
            "generated_family_counts_this_run", "generated_category_counts_this_run",
            "all_implemented_categories_sampled", "selected_family_counts",
            "selected_distinct_family_count", "max_selected_family_share", "portfolio_ready",
        ]
    })
    _write_csv(out / "latest_multimethod_v1_discovery.csv", selected)
    print(json.dumps(json.loads((out / "latest_multimethod_v1_discovery_summary.json").read_text()), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
