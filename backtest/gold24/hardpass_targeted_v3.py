from __future__ import annotations

import argparse
import json
import random
from collections import Counter
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

from core import Candidate, audit_dataset, pearson_log_equity, validate_candidate
import multimethod_v1_discovery as impl
import hardpass_targeted_search as base

TARGET_FAMILIES = (
    "SUPPORT_RESISTANCE",
    "CHART_PATTERN",
    "VOLATILITY_REGIME",
    "BOLLINGER_REVERSION_V2",
    "VOLUME",
    "BAND_HYBRID",
)
TARGET_WEIGHTS = [0.28, 0.28, 0.16, 0.12, 0.08, 0.08]

# v3 deliberately leaves every prior generator grid for at least one
# signal-defining parameter. This makes the search configuration-disjoint from
# the master discovery and targeted v1/v2 without relaxing any gate.
P1 = {
    "SUPPORT_RESISTANCE": [1.10, 1.25, 1.35, 1.40, 1.60, 1.70, 1.90, 2.20, 2.40],
    "CHART_PATTERN": [1.10, 1.25, 1.35, 1.40, 1.60, 1.70, 1.90, 2.20, 2.40],
    "VOLATILITY_REGIME": [0.95, 1.00, 1.15, 1.25, 1.35, 1.40, 1.45],
    "BOLLINGER_REVERSION_V2": [1.05, 1.10, 1.25, 1.35, 1.45, 1.60, 1.70, 1.90, 2.10, 2.40],
    "VOLUME": [1.05, 1.15, 1.25, 1.30, 1.50, 1.80, 2.20, 2.30],
    "BAND_HYBRID": [0.90, 1.10, 1.30, 1.40, 1.60, 1.70, 1.90, 2.10],
}
P2 = {
    "SUPPORT_RESISTANCE": [55.0],
    "CHART_PATTERN": [55.0],
    # Every value is outside the canonical v1/v2 VOLATILITY_REGIME p2 grid.
    "VOLATILITY_REGIME": [0.65, 0.75, 0.85, 0.95],
    "BOLLINGER_REVERSION_V2": [35.0, 40.0, 42.5, 45.0, 47.5],
    "VOLUME": [55.0],
    "BAND_HYBRID": [1.60, 1.70, 1.90, 2.10, 2.30, 2.40],
}

FAST = [2, 3, 4, 5, 6, 7, 8, 10, 12, 13, 14, 16, 20]
SLOW = [5, 7, 8, 10, 13, 14, 16, 18, 20, 21, 26, 34, 50, 55]
SL = [12.5, 15.0, 16.0, 17.0, 17.5, 18.0, 18.5, 19.0, 19.5, 20.0, 20.5, 21.0, 21.5, 22.0, 22.5, 23.0, 23.5, 24.0, 24.5, 25.0]
TP = [15.0, 16.0, 17.0, 17.5, 18.0, 18.5, 19.0, 19.5, 20.0, 20.5, 21.0, 21.5, 22.0, 22.5, 23.0, 23.5, 24.0, 24.5, 25.0]
OFFSET = [0.25, 0.50, 0.75, 1.0, 1.25, 1.50, 1.75, 2.0, 2.25, 2.50, 3.0, 3.50, 4.0, 4.50]
EXPIRY = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]


def _candidate(rng: random.Random) -> Candidate:
    family = rng.choices(list(TARGET_FAMILIES), weights=TARGET_WEIGHTS, k=1)[0]
    fast = rng.choice(FAST)
    valid_slow = [x for x in SLOW if x > fast]
    if not valid_slow:
        fast = 3
        valid_slow = SLOW
    slow = rng.choice(valid_slow)

    p1 = float(rng.choice(P1[family]))
    p2 = float(rng.choice(P2[family]))

    # BOTH is a real signal-frequency change (not metadata): signal_series emits
    # both long and short directions instead of deleting one side.
    if family in {"SUPPORT_RESISTANCE", "CHART_PATTERN", "VOLUME"}:
        direction = "BOTH" if rng.random() < 0.82 else "LONG_ONLY"
    else:
        direction = "BOTH" if rng.random() < 0.68 else "LONG_ONLY"
    entry = "LIMIT" if rng.random() < 0.92 else "STOP"

    sl = float(rng.choice(SL))
    if rng.random() < 0.82:
        tps = [x for x in TP if x >= sl]
        tp = float(rng.choice(tps or TP))
    else:
        tp = float(rng.choice(TP))

    c = Candidate(
        symbol="GOLD", timeframe="D1", family=family,
        fast=int(fast), slow=int(slow), p1=p1, p2=p2, p3=1.0,
        entry_method=entry, direction_mode=direction,
        sl=sl, tp=tp, offset=float(rng.choice(OFFSET)),
        expiry=int(rng.choice(EXPIRY)),
    )
    validate_candidate(c)
    return c


def _primitive_gate_count(r: dict) -> int:
    return int(sum([
        int(r.get("trades", 0)) >= 300,
        float(r.get("net_profit_usd", 0.0)) >= 20000.0,
        float(r.get("pf", 0.0)) >= 1.20,
        float(r.get("max_dd_pct", 1e9)) <= 25.0,
        float(r.get("ev_per_trade_usd", 0.0)) > 0.0,
    ]))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--state-dir", required=True)
    ap.add_argument("--prior-json", required=True)
    ap.add_argument("--prior-targeted-json", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--candidate-count", type=int, default=100000)
    ap.add_argument("--seed", type=int, default=2026090402)
    ap.add_argument("--workers", type=int, default=8)
    a = ap.parse_args()

    state = Path(a.state_dir)
    dataset = state / "gate_a/GC1_COMEX_TRADINGVIEW_D1_PRIMARY.csv"
    receipt = state / "gate_a/gate_a_receipt.json"
    d, audit = audit_dataset(dataset, receipt, "D1")
    prior = json.loads(Path(a.prior_json).read_text())
    prev_targeted = json.loads(Path(a.prior_targeted_json).read_text())

    prior_eval = set(str(x) for x in prior.get("evaluated_config_hashes", []))
    prior_rank = list(prior.get("ranking", []))
    prior_hashes = {str(r.get("config_hash")) for r in prior_rank}

    rng = random.Random(int(a.seed))
    generated = []
    generated_hashes = set()
    family_counts = Counter()
    attempts = 0
    max_attempts = int(a.candidate_count) * 100
    while len(generated) < int(a.candidate_count) and attempts < max_attempts:
        attempts += 1
        c = _candidate(rng)
        h = c.config_hash
        if h in prior_eval or h in prior_hashes or h in generated_hashes:
            continue
        generated_hashes.add(h)
        cd = c.canonical_dict()
        generated.append(cd)
        family_counts[cd["family"]] += 1
    if len(generated) != int(a.candidate_count):
        raise RuntimeError(f"v3 generation exhausted wanted={a.candidate_count} got={len(generated)}")

    prelim = []
    primitive = Counter()
    near = []
    with ProcessPoolExecutor(
        max_workers=max(1, int(a.workers)),
        initializer=base._init_worker,
        initargs=(str(dataset), str(receipt)),
    ) as pool:
        futs = [pool.submit(base._worker, c) for c in generated]
        for fut in as_completed(futs):
            r = fut.result()
            pc = _primitive_gate_count(r)
            primitive[f"gates_{pc}"] += 1
            if int(r["trades"]) >= 300:
                primitive["entry_ge_300"] += 1
            if float(r["pf"]) >= 1.20:
                primitive["pf_ge_1_20"] += 1
            if float(r["max_dd_pct"]) <= 25.0:
                primitive["dd_le_25"] += 1
            if float(r["net_profit_usd"]) >= 20000.0:
                primitive["net_ge_20k"] += 1
            if float(r["ev_per_trade_usd"]) > 0.0:
                primitive["ev_gt_0"] += 1
            if pc >= 4:
                near.append(r)
            if r["keep"]:
                prelim.append(r)

    near = sorted(
        near,
        key=lambda r: (
            _primitive_gate_count(r),
            int(r["trades"]),
            float(r["pf"]),
            -float(r["max_dd_pct"]),
            float(r["net_profit_usd"]),
        ),
        reverse=True,
    )[:50]

    new_exact = []
    new_bar = {}
    for r in prelim:
        row, bp, tp = impl._exact_row(d, audit, r["candidate"], "HARDPASS_TARGETED_V3")
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

    current = []
    bars = {}
    for old in prior_rank:
        cdict = old.get("candidate")
        if not cdict:
            continue
        row, bp, tp = impl._exact_row(d, audit, cdict, "PRIOR_SELECTED")
        row.update(impl.monte_carlo_metrics(tp, row["config_hash"]))
        current.append(row)
        bars[row["config_hash"]] = bp

    # Preserve any genuine new HARD PASS from the immediately previous targeted
    # search so v3 cannot accidentally erase progress.
    for old in prev_targeted.get("new_hard_pass_rows", []):
        cdict = old.get("candidate")
        if not cdict:
            continue
        row, bp, tp = impl._exact_row(d, audit, cdict, "PRIOR_TARGETED")
        row.update(impl.monte_carlo_metrics(tp, row["config_hash"]))
        current.append(row)
        bars[row["config_hash"]] = bp

    for row in new_exact:
        current.append(row)
        bars[row["config_hash"]] = new_bar[row["config_hash"]]

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
        base._classify(row)

    hard = [r for r in selected if r["classification"] == "HARD PASS"]
    watch = [r for r in selected if r["classification"] == "WATCH"]
    fail = [r for r in selected if r["classification"] == "FAIL"]
    hard_new = [r for r in hard if r.get("origin") == "HARDPASS_TARGETED_V3"]

    prev_targeted_count = int(prev_targeted.get(
        "cumulative_targeted_evaluated_unique",
        prev_targeted.get("targeted_evaluated_unique", 0),
    ))
    combined_eval = int(prior.get("evaluated_config_hash_count_cumulative", len(prior_eval))) + prev_targeted_count + len(generated)

    payload = {
        "schema": "gold10b-hardpass-targeted-search-v3-outside-grid-frequency",
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
        "prior_targeted_evaluated_unique": prev_targeted_count,
        "targeted_evaluated_unique": len(generated),
        "cumulative_targeted_evaluated_unique": prev_targeted_count + len(generated),
        "combined_candidate_evaluated": combined_eval,
        "generation_profile": {
            "name": "frequency-v3-outside-prior-grids",
            "families": list(TARGET_FAMILIES),
            "generated_family_counts": dict(sorted(family_counts.items())),
            "disjoint_from_master_and_targeted_v1_v2": True,
            "disjoint_rule": "each family uses at least one signal-defining p1/p2 value outside all prior master/v1/v2 generator grids",
            "frequency_changes": "shorter windows + BOTH weighting + signal-threshold grids; these change actual signals/trades",
            "threshold_relaxation": False,
        },
        "primitive_diagnostics": dict(sorted(primitive.items())),
        "top50_primitive_near_miss": near,
        "prefilter_survivors": len(prelim),
        "full_pre_corr_survivors": len(new_exact),
        "selected_after_global_corr": len(selected),
        "hard_pass_count": len(hard),
        "hard_pass_new_count": len(hard_new),
        "watch_count": len(watch),
        "fail_count": len(fail),
        "global_corr_rejected": len(rejected),
        "new_hard_pass_rows": hard_new,
        "top50_after_global_corr": sorted(
            selected,
            key=lambda r: (
                int(r.get("hard_pass_gate_count", 0)),
                int(r.get("total_entry", 0)),
                float(r.get("standard_lot_profit_factor_same_cost_model", 0.0)),
                -float(r.get("standard_lot_max_dd_pct_starting_equity_10000", 1e9)),
            ),
            reverse=True,
        )[:50],
    }
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: payload[k] for k in (
        "status", "prior_evaluated", "prior_targeted_evaluated_unique",
        "targeted_evaluated_unique", "cumulative_targeted_evaluated_unique",
        "combined_candidate_evaluated", "primitive_diagnostics",
        "prefilter_survivors", "full_pre_corr_survivors",
        "selected_after_global_corr", "hard_pass_count",
        "hard_pass_new_count", "watch_count", "fail_count",
        "global_corr_rejected",
    )}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
