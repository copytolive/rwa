from __future__ import annotations

import argparse
import json
import os
import random
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import numpy as np

from core import Candidate, audit_dataset, backtest_candidate, pearson_log_equity, validate_candidate
import multimethod_v1_discovery as impl

_WORKER_D = None

BASES = (
    {
        "family": "SUPPORT_RESISTANCE",
        "fast": 3, "slow": 21, "p1": 0.7, "p2": 55.0, "p3": 1.0,
        "entry_method": "LIMIT", "direction_mode": "LONG_ONLY",
        "sl": 20.0, "tp": 25.0, "offset": 4.25, "expiry": 6,
    },
    {
        "family": "CHART_PATTERN",
        "fast": 5, "slow": 26, "p1": 0.7, "p2": 55.0, "p3": 1.0,
        "entry_method": "LIMIT", "direction_mode": "LONG_ONLY",
        "sl": 19.5, "tp": 24.5, "offset": 3.5, "expiry": 12,
    },
)

FAST = [2, 3, 5, 7, 8, 10, 13]
SLOW = [5, 7, 8, 10, 13, 14, 20, 21, 26, 34, 50]
P1 = [0.5, 0.7, 0.9, 1.0, 1.2, 1.5, 1.8, 2.0, 2.5]
SL = [10.0, 12.5, 15.0, 17.5, 19.5, 20.0, 22.5]
TP = [17.5, 20.0, 22.5, 24.0, 24.5, 25.0]
OFFSET = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.25]
EXPIRY = [4, 6, 8, 10, 12, 16, 20]


def _init_worker(dataset: str, receipt: str) -> None:
    global _WORKER_D
    _WORKER_D, _ = audit_dataset(dataset, receipt, "D1")


def _candidate(rng: random.Random) -> Candidate:
    b = dict(rng.choice(BASES))
    family = b["family"]

    if rng.random() < 0.82:
        fast = rng.choice(FAST)
        valid_slow = [x for x in SLOW if x > fast]
        slow = rng.choice(valid_slow)
    else:
        fast, slow = int(b["fast"]), int(b["slow"])

    p1 = rng.choice(P1) if rng.random() < 0.88 else float(b["p1"])
    entry = "LIMIT" if rng.random() < 0.95 else "STOP"
    direction = "LONG_ONLY" if rng.random() < 0.88 else "BOTH"
    sl = rng.choice(SL)
    tp = rng.choice([x for x in TP if x >= sl] or TP)
    offset = rng.choice(OFFSET)
    expiry = rng.choice(EXPIRY)

    c = Candidate(
        symbol="GOLD", timeframe="D1", family=family,
        fast=int(fast), slow=int(slow), p1=float(p1), p2=55.0, p3=1.0,
        entry_method=entry, direction_mode=direction,
        sl=float(sl), tp=float(tp), offset=float(offset), expiry=int(expiry),
    )
    validate_candidate(c)
    return c


def _worker(cdict: dict) -> dict:
    if _WORKER_D is None:
        raise RuntimeError("worker dataset missing")
    c = Candidate(**cdict)
    r = backtest_candidate(_WORKER_D, c, flat_lot=100.0)
    m = r.get("metrics", {})
    trades = int(m.get("trades", 0) or 0)
    net = float(m.get("net_profit", 0.0) or 0.0)
    pf = float(m.get("profit_factor", 0.0) or 0.0)
    dd = float(m.get("max_dd_pct", 1e9) or 1e9)
    ev = float(m.get("expectancy", 0.0) or 0.0)
    # Keep exact-hard prefilter candidates only. Thresholds are unchanged.
    keep = trades >= 300 and net >= 20000.0 and pf >= 1.20 and dd <= 25.0 and ev > 0.0
    return {
        "candidate": c.canonical_dict(),
        "config_hash": c.config_hash,
        "keep": bool(keep),
        "trades": trades,
        "net_profit_usd": net,
        "pf": pf,
        "max_dd_pct": dd,
        "ev_per_trade_usd": ev,
    }


def _classify(row: dict) -> str:
    gates = [
        int(row["total_entry"]) >= 300,
        float(row["standard_lot_profit_factor_same_cost_model"]) >= 1.20,
        float(row["standard_lot_max_dd_pct_starting_equity_10000"]) <= 25.0,
        float(row["standard_lot_ev_per_trade_usd_same_cost_model"]) > 0.0,
        float(row["oos_profit_factor"]) >= 1.00,
        bool(row["monte_carlo_pass"]),
        float(row["positive_years_pct"]) >= 60.0,
        float(row["correlation_max"]) <= 0.50,
    ]
    row["hard_pass_gate_count"] = int(sum(bool(x) for x in gates))
    row["classification"] = "HARD PASS" if all(gates) else ("WATCH" if sum(gates) >= 5 else "FAIL")
    return row["classification"]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--state-dir", required=True)
    ap.add_argument("--prior-json", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--candidate-count", type=int, default=50000)
    ap.add_argument("--seed", type=int, default=2026090311)
    ap.add_argument("--workers", type=int, default=8)
    a = ap.parse_args()

    state = Path(a.state_dir)
    dataset = state / "gate_a/GC1_COMEX_TRADINGVIEW_D1_PRIMARY.csv"
    receipt = state / "gate_a/gate_a_receipt.json"
    d, audit = audit_dataset(dataset, receipt, "D1")
    prior = json.loads(Path(a.prior_json).read_text())

    prior_eval = set(str(x) for x in prior.get("evaluated_config_hashes", []))
    prior_rank = list(prior.get("ranking", []))
    prior_hashes = {str(r.get("config_hash")) for r in prior_rank}

    rng = random.Random(int(a.seed))
    generated = []
    generated_hashes = set()
    attempts = 0
    max_attempts = int(a.candidate_count) * 100
    while len(generated) < int(a.candidate_count) and attempts < max_attempts:
        attempts += 1
        c = _candidate(rng)
        h = c.config_hash
        if h in prior_eval or h in prior_hashes or h in generated_hashes:
            continue
        generated_hashes.add(h)
        generated.append(c.canonical_dict())
    if len(generated) != int(a.candidate_count):
        raise RuntimeError(f"targeted generation exhausted wanted={a.candidate_count} got={len(generated)}")

    prelim = []
    with ProcessPoolExecutor(
        max_workers=max(1, int(a.workers)),
        initializer=_init_worker,
        initargs=(str(dataset), str(receipt)),
    ) as pool:
        futs = [pool.submit(_worker, c) for c in generated]
        for fut in as_completed(futs):
            r = fut.result()
            if r["keep"]:
                prelim.append(r)

    # Exact OOS/year/MC evaluation for all prefilter survivors.
    new_exact = []
    new_bar = {}
    new_trade = {}
    for r in prelim:
        row, bp, tp = impl._exact_row(d, audit, r["candidate"], "HARDPASS_TARGETED")
        if int(row["total_entry"]) < 300:
            continue
        if float(row["standard_lot_net_profit_usd_same_cost_model"]) < 20000.0:
            continue
        if float(row["standard_lot_profit_factor_same_cost_model"]) < 1.20:
            continue
        if float(row["standard_lot_max_dd_pct_starting_equity_10000"]) > 25.0:
            continue
        if float(row["standard_lot_ev_per_trade_usd_same_cost_model"]) <= 0.0:
            continue
        if float(row["oos_profit_factor"]) < 1.00:
            continue
        if float(row["positive_years_pct"]) < 60.0:
            continue
        row.update(impl.monte_carlo_metrics(tp, row["config_hash"]))
        new_exact.append(row)
        new_bar[row["config_hash"]] = bp
        new_trade[row["config_hash"]] = tp

    # Reconstruct current selected set exactly; combine with new strong rows.
    current = []
    bars = {}
    tradepnls = {}
    for old in prior_rank:
        cdict = old.get("candidate")
        if not cdict:
            continue
        row, bp, tp = impl._exact_row(d, audit, cdict, "PRIOR_SELECTED")
        row.update(impl.monte_carlo_metrics(tp, row["config_hash"]))
        current.append(row)
        bars[row["config_hash"]] = bp
        tradepnls[row["config_hash"]] = tp

    for row in new_exact:
        current.append(row)
        bars[row["config_hash"]] = new_bar[row["config_hash"]]
        tradepnls[row["config_hash"]] = new_trade[row["config_hash"]]

    # Execution-profile dedupe then hard-pass-oriented global greedy correlation.
    by_exec = {}
    for row in sorted(current, key=impl._quality, reverse=True):
        ex = str(row.get("execution_hash_qty100") or row["config_hash"])
        if ex not in by_exec:
            by_exec[ex] = row

    combined = sorted(by_exec.values(), key=impl._quality, reverse=True)
    selected = []
    rejected = []
    for row in combined:
        pairs = []
        for old in selected:
            corr = abs(float(pearson_log_equity(bars[row["config_hash"]], bars[old["config_hash"]])))
            pairs.append((corr, old["config_hash"]))
        max_corr, against = max(pairs, default=(0.0, None), key=lambda z: z[0])
        row["correlation_max"] = float(max_corr)
        row["correlation_against"] = against
        if max_corr <= 0.50 + 1e-12:
            row["correlation_gate"] = "PASS"
            selected.append(row)
        else:
            row["correlation_gate"] = "REMOVED >0.50"
            rejected.append(row)

    for row in selected:
        _classify(row)

    hard = [r for r in selected if r["classification"] == "HARD PASS"]
    watch = [r for r in selected if r["classification"] == "WATCH"]
    fail = [r for r in selected if r["classification"] == "FAIL"]
    hard_new = [r for r in hard if r.get("origin") == "HARDPASS_TARGETED"]

    top = sorted(
        selected,
        key=lambda r: (
            int(r.get("hard_pass_gate_count", 0)),
            int(r.get("total_entry", 0)),
            float(r.get("standard_lot_profit_factor_same_cost_model", 0.0)),
            -float(r.get("standard_lot_max_dd_pct_starting_equity_10000", 1e9)),
        ),
        reverse=True,
    )[:50]

    payload = {
        "schema": "gold10b-hardpass-targeted-search-v1",
        "status": "PASS",
        "dataset": {
            "provider": audit.get("crosscheck_provider"),
            "symbol": "COMEX:GC1!",
            "timeframe": "D1",
            "rows": audit.get("rows"),
            "start_utc": audit.get("start_utc"),
            "end_utc": audit.get("end_utc"),
            "dataset_sha256": audit.get("dataset_sha256"),
            "quantity_gold_units": 100.0,
            "starting_equity_usd": 10000.0,
        },
        "candidate_gate": {"entry_min": 100, "net_profit_usd_min": 20000.0, "corr_max": 0.50},
        "hard_pass_gate": {
            "entry_min": 300, "pf_min": 1.20, "max_dd_pct_max": 25.0, "ev_gt": 0.0,
            "oos_pf_min": 1.00, "monte_carlo": "PASS", "positive_year_pct_min": 60.0, "corr_max": 0.50,
        },
        "prior_evaluated": int(prior.get("evaluated_config_hash_count_cumulative", len(prior_eval))),
        "targeted_evaluated_unique": len(generated),
        "combined_candidate_evaluated": int(prior.get("evaluated_config_hash_count_cumulative", len(prior_eval))) + len(generated),
        "prefilter_survivors": len(prelim),
        "full_pre_corr_survivors": len(new_exact),
        "selected_after_global_corr": len(selected),
        "hard_pass_count": len(hard),
        "hard_pass_new_count": len(hard_new),
        "watch_count": len(watch),
        "fail_count": len(fail),
        "global_corr_rejected": len(rejected),
        "new_hard_pass_rows": hard_new,
        "top50_after_global_corr": top,
    }
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: payload[k] for k in (
        "status","prior_evaluated","targeted_evaluated_unique","combined_candidate_evaluated",
        "prefilter_survivors","full_pre_corr_survivors","selected_after_global_corr",
        "hard_pass_count","hard_pass_new_count","watch_count","fail_count","global_corr_rejected"
    )}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
