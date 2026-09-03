from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
from collections import Counter
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import numpy as np

from core import Candidate, audit_dataset, pearson_log_equity, validate_candidate
import multimethod_v1_discovery as impl
import hardpass_targeted_search as classify_impl
from global_cross_timeframe_corr import candidate_from_audit

FAMILIES = (
    "SUPPORT_RESISTANCE",
    "CHART_PATTERN",
    "BOLLINGER_REVERSION_V2",
    "RSI_REVERSION",
    "EMA_PULLBACK",
    "PIVOT_SR",
    "ATR_MEANREV_REGIME",
    "TREND_MEANREV_ENSEMBLE",
    "VWAP",
    "ZSCORE_REVERSION",
)
WEIGHTS = [0.18,0.14,0.14,0.12,0.10,0.10,0.06,0.06,0.05,0.05]
FAST = [2,3,4,5,6,7,8,10,12,13,14,16,20]
SLOW = [5,7,8,10,13,14,16,18,20,21,26,34,50,55]
SL = [5.0,5.5,6.0,6.5,7.0,7.5,8.0,8.5,9.0,10.0,11.0,12.0]
TP = [5.0,5.5,6.0,6.5,7.0,7.5,8.0,8.5,9.0,10.0,11.0,12.0,12.5]
OFFSET = [0.5,0.75,1.0,1.25,1.5,1.75,2.0,2.25,2.5]
EXPIRY = [1,2,3,4,5,6,8]
_WORKER_D = None


def _init(dataset: str, receipt: str) -> None:
    global _WORKER_D
    _WORKER_D, _ = audit_dataset(dataset, receipt, "D1")


def _candidate(rng: random.Random) -> Candidate:
    family = rng.choices(FAMILIES, weights=WEIGHTS, k=1)[0]
    fast = rng.choice(FAST)
    valid_slow = [x for x in SLOW if x > fast]
    if not valid_slow:
        fast = 3
        valid_slow = [x for x in SLOW if x > fast]
    slow = rng.choice(valid_slow)
    direction = "BOTH" if rng.random() < 0.90 else "LONG_ONLY"
    entry = "LIMIT" if rng.random() < 0.78 else "STOP"
    sl = float(rng.choice(SL))
    if rng.random() < 0.70:
        pool = [x for x in TP if x >= sl]
        tp = float(rng.choice(pool or TP))
    else:
        tp = float(rng.choice(TP))

    # Every branch uses a signal-defining p1/p2 region outside the master,
    # targeted-v1/v2 and targeted-v3 grids. Gates are unchanged.
    if family in {"SUPPORT_RESISTANCE","CHART_PATTERN"}:
        p1, p2 = float(rng.choice([7.0,8.0,10.0,12.0])), 55.0
    elif family == "BOLLINGER_REVERSION_V2":
        p1, p2 = float(rng.choice([0.45,0.55,0.65,0.75])), float(rng.choice([52.0,55.0,58.0,60.0]))
    elif family == "RSI_REVERSION":
        p1, p2 = float(rng.choice([42.0,45.0,48.0])), 55.0
    elif family in {"EMA_PULLBACK","PIVOT_SR"}:
        p1, p2 = float(rng.choice([1.25,1.50,1.75,2.0,2.5,3.0])), 55.0
    elif family == "ATR_MEANREV_REGIME":
        p1, p2 = float(rng.choice([0.25,0.30,0.35,0.40])), float(rng.choice([1.10,1.20,1.30,1.40]))
    elif family == "TREND_MEANREV_ENSEMBLE":
        p1, p2 = float(rng.choice([0.20,0.25,0.30,0.35,0.40])), float(rng.choice([47.5,50.0]))
    elif family == "VWAP":
        p1, p2 = float(rng.choice([0.30,0.40,0.50,0.60])), float(rng.choice([42.0,45.0,48.0,50.0]))
    elif family == "ZSCORE_REVERSION":
        p1, p2 = float(rng.choice([0.30,0.40,0.50,0.60])), float(rng.choice([42.0,45.0,48.0,50.0]))
    else:
        raise RuntimeError(f"unsupported family {family}")

    c = Candidate(
        symbol="GOLD", timeframe="D1", family=family,
        fast=int(fast), slow=int(slow), p1=p1, p2=p2, p3=1.0,
        entry_method=entry, direction_mode=direction,
        sl=sl, tp=tp, offset=float(rng.choice(OFFSET)),
        expiry=int(rng.choice(EXPIRY)),
    )
    validate_candidate(c)
    return c


def _worker(cdict: dict) -> dict:
    if _WORKER_D is None:
        raise RuntimeError("worker dataset not initialized")
    from core import backtest_candidate
    c = Candidate(**cdict)
    r = backtest_candidate(_WORKER_D, c, flat_lot=100.0)
    m = r.get("metrics", {})
    trades = int(m.get("trades", 0) or 0)
    net = float(m.get("net_profit", 0.0) or 0.0)
    pf = float(m.get("profit_factor", 0.0) or 0.0)
    dd = float(m.get("max_dd_pct", 1e9) or 1e9)
    ev = float(m.get("expectancy", 0.0) or 0.0)
    keep = trades >= 300 and net >= 20000.0 and pf >= 1.20 and dd <= 25.0 and ev > 0.0
    return {
        "candidate": c.canonical_dict(), "config_hash": c.config_hash,
        "trades": trades, "net_profit_usd": net, "pf": pf,
        "max_dd_pct": dd, "ev_per_trade_usd": ev, "keep": bool(keep),
    }


def _primitive_count(r: dict) -> int:
    return sum((
        int(r["trades"]) >= 300,
        float(r["net_profit_usd"]) >= 20000.0,
        float(r["pf"]) >= 1.20,
        float(r["max_dd_pct"]) <= 25.0,
        float(r["ev_per_trade_usd"]) > 0.0,
    ))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--state-dir", required=True)
    ap.add_argument("--repo-root", default=".")
    ap.add_argument("--out", required=True)
    ap.add_argument("--candidate-count", type=int, default=100000)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--seed", type=int, default=2026090417)
    a = ap.parse_args()

    state = Path(a.state_dir)
    dataset = state/"gate_a/GC1_COMEX_TRADINGVIEW_D1_PRIMARY.csv"
    receipt = state/"gate_a/gate_a_receipt.json"
    d, audit = audit_dataset(dataset, receipt, "D1")
    repo = Path(a.repo_root).resolve()

    rng = random.Random(a.seed)
    generated, seen = [], set()
    family_counts = Counter()
    attempts = 0
    while len(generated) < a.candidate_count and attempts < a.candidate_count * 100:
        attempts += 1
        c = _candidate(rng)
        if c.config_hash in seen:
            continue
        seen.add(c.config_hash)
        generated.append(c.canonical_dict())
        family_counts[c.family] += 1
    if len(generated) != a.candidate_count:
        raise RuntimeError(f"generation exhausted {len(generated)}/{a.candidate_count}")

    primitive = Counter()
    prelim, near = [], []
    with ProcessPoolExecutor(max_workers=max(1,a.workers), initializer=_init, initargs=(str(dataset),str(receipt))) as pool:
        futs = [pool.submit(_worker, c) for c in generated]
        for fut in as_completed(futs):
            r = fut.result()
            n = _primitive_count(r)
            primitive[f"gates_{n}"] += 1
            primitive["entry_ge_300"] += int(r["trades"] >= 300)
            primitive["net_ge_20k"] += int(r["net_profit_usd"] >= 20000.0)
            primitive["pf_ge_1_20"] += int(r["pf"] >= 1.20)
            primitive["dd_le_25"] += int(r["max_dd_pct"] <= 25.0)
            primitive["ev_gt_0"] += int(r["ev_per_trade_usd"] > 0.0)
            if n >= 4:
                near.append(r)
            if r["keep"]:
                prelim.append(r)

    near = sorted(
        near,
        key=lambda r: (_primitive_count(r), int(r["trades"]), float(r["pf"]), -float(r["max_dd_pct"]), float(r["net_profit_usd"])),
        reverse=True,
    )[:50]

    new_exact, new_bars = [], {}
    for r in prelim:
        row, bp, tp = impl._exact_row(d, audit, r["candidate"], "HARDPASS_FREQUENCY_V4")
        row.update(impl.monte_carlo_metrics(tp, row["config_hash"]))
        noncorr = (
            int(row["total_entry"]) >= 300
            and float(row["standard_lot_profit_factor_same_cost_model"]) >= 1.20
            and float(row["standard_lot_max_dd_pct_starting_equity_10000"]) <= 25.0
            and float(row["standard_lot_ev_per_trade_usd_same_cost_model"]) > 0.0
            and float(row["oos_profit_factor"]) >= 1.00
            and bool(row["monte_carlo_pass"])
            and float(row["positive_years_pct"]) >= 60.0
        )
        if noncorr:
            new_exact.append(row)
            new_bars[row["config_hash"]] = bp

    screen = json.loads((repo/"backtest/gold24/runtime_screening_gpt/screening_gpt_real_audit.json").read_text())
    portfolio = json.loads((repo/"backtest/gold24/runtime_screening_gpt/combined_portfolio_audit.json").read_text())
    screen_by_hash = {str(r["config_hash"]): r for r in screen.get("rows", [])}
    input_hashes = [str(r["config_hash"]) for r in portfolio.get("rows", [])]
    if len(input_hashes) != int(portfolio.get("methods_input", 0)):
        raise RuntimeError("existing global input set mismatch")

    current, bars = [], {}
    for h in input_hashes:
        src = screen_by_hash.get(h)
        if src is None:
            raise RuntimeError(f"missing screening row {h}")
        c = candidate_from_audit(src)
        row, bp, tp = impl._exact_row(d, audit, c.canonical_dict(), "D1_GLOBAL_EXISTING")
        row.update(impl.monte_carlo_metrics(tp, row["config_hash"]))
        current.append(row)
        bars[row["config_hash"]] = bp
    for row in new_exact:
        current.append(row)
        bars[row["config_hash"]] = new_bars[row["config_hash"]]

    by_exec = {}
    for row in sorted(current, key=impl._quality, reverse=True):
        ex = str(row.get("execution_hash_qty100") or row["config_hash"])
        if ex not in by_exec:
            by_exec[ex] = row
    ordered = sorted(by_exec.values(), key=impl._quality, reverse=True)

    raw_pair_count = 0
    raw_corr_violations = 0
    raw_max_pair = {"corr_abs":0.0,"a":None,"b":None}
    for i in range(len(ordered)):
        for j in range(i+1,len(ordered)):
            corr = abs(float(pearson_log_equity(bars[ordered[i]["config_hash"]], bars[ordered[j]["config_hash"]])))
            raw_pair_count += 1
            if corr > 0.50 + 1e-12:
                raw_corr_violations += 1
            if corr > raw_max_pair["corr_abs"]:
                raw_max_pair = {"corr_abs":float(corr),"a":ordered[i]["config_hash"],"b":ordered[j]["config_hash"]}

    selected, rejected = [], []
    comparisons = 0
    for row in ordered:
        pairs = []
        for old in selected:
            corr = abs(float(pearson_log_equity(bars[row["config_hash"]], bars[old["config_hash"]])))
            comparisons += 1
            pairs.append((corr, old["config_hash"]))
        max_corr, against = max(pairs, default=(0.0,None), key=lambda z:z[0])
        row["correlation_max"] = float(max_corr)
        row["correlation_against"] = against
        if max_corr <= 0.50 + 1e-12:
            row["correlation_gate"] = "PASS"
            classify_impl._classify(row)
            selected.append(row)
        else:
            row["correlation_gate"] = "REMOVED >0.50"
            classify_impl._classify(row)
            rejected.append(row)

    hard = [r for r in selected if r.get("classification") == "HARD PASS"]
    hard_new = [r for r in hard if r.get("origin") == "HARDPASS_FREQUENCY_V4"]
    watch = [r for r in selected if r.get("classification") == "WATCH"]
    fail = [r for r in selected if r.get("classification") == "FAIL"]

    family_counts_final = Counter(str(r["family"]) for r in selected)
    distinct_family = len(family_counts_final)
    max_family_concentration = max(family_counts_final.values(), default=0) / max(len(selected),1)

    def portfolio_metrics(rows: list[dict], scale: float) -> dict:
        if not rows:
            return {"methods":0,"scale_per_strategy":float(scale),"net_profit_usd":0.0,"max_dd_pct":0.0,"ending_equity_usd":10000.0,"min_equity_usd":10000.0}
        bp = sum((bars[r["config_hash"]] for r in rows), np.zeros(len(d),dtype=float)) * float(scale)
        eq = 10000.0 + np.cumsum(bp)
        peak = np.maximum.accumulate(eq)
        dd = np.where(peak>0.0,(peak-eq)/peak*100.0,0.0)
        return {
            "methods":len(rows),"scale_per_strategy":float(scale),"net_profit_usd":float(bp.sum()),
            "max_dd_pct":float(dd.max(initial=0.0)),"ending_equity_usd":float(eq[-1]),"min_equity_usd":float(eq.min()),
        }

    full_stack = portfolio_metrics(selected,1.0)
    equal_budget = portfolio_metrics(selected,1.0/max(len(selected),1))
    diversified = []
    for target in range(min(10,len(selected)),5,-1):
        cap=max(1,int(math.floor(0.25*target+1e-12))); trial=[]; counts=Counter()
        for r in selected:
            if counts[r["family"]] >= cap:
                continue
            trial.append(r); counts[r["family"]] += 1
            if len(trial)==target:
                break
        if len(trial)==target and len(counts)>=6 and max(counts.values())/target <= 0.25+1e-12:
            diversified=trial; break
    diversified_counts=Counter(str(r["family"]) for r in diversified)
    diversified_equal_budget=portfolio_metrics(diversified,1.0/max(len(diversified),1))
    payload = {
        "schema": "gold10b-hardpass-frequency-v4",
        "status": "PASS",
        "dataset": {
            "provider": audit["crosscheck_provider"], "symbol":"COMEX:GC1!", "timeframe":"D1",
            "rows":audit["rows"], "start_utc":audit["start_utc"], "end_utc":audit["end_utc"],
            "dataset_sha256":audit["dataset_sha256"], "cost_model":"core.py COST_FLOOR_RT=0.0032",
            "quantity_gold_units":100.0, "starting_equity_usd":10000.0,
        },
        "candidate_gate":{"entry_min":100,"net_profit_usd_min":20000.0,"corr_max":0.50},
        "hard_pass_gate":{"entry_min":300,"pf_min":1.20,"max_dd_pct_max":25.0,"ev_gt":0.0,"oos_pf_min":1.0,"monte_carlo":"PASS","positive_year_pct_min":60.0,"corr_max":0.50},
        "candidate_evaluated_unique":len(generated),
        "generated_hashes_sha256":hashlib.sha256("\n".join(sorted(seen)).encode()).hexdigest(),
        "generated_family_counts":dict(sorted(family_counts.items())),
        "generation_profile":{
            "name":"frequency-v4-small-bracket-outside-prior-signal-grids",
            "families":list(FAMILIES),
            "small_bracket_usd_range":[5.0,12.5],
            "high_both_direction_weight":0.90,
            "disjoint_from_master_targeted_v1_v2_v3":True,
            "disjoint_rule":"each family uses at least one signal-defining p1/p2 value outside every earlier generator domain; D1 timeframe remains canonical source data",
            "threshold_relaxation":False,
        },
        "primitive_diagnostics":dict(sorted(primitive.items())),
        "primitive_survivors":len(prelim),
        "noncorr_7_of_7_survivors":len(new_exact),
        "global_methods_input_existing":len(input_hashes),
        "global_methods_input_with_new":len(current),
        "global_pair_count":raw_pair_count,
        "raw_corr_violations_gt_0_50":raw_corr_violations,
        "raw_max_pair":raw_max_pair,
        "global_selected":len(selected),
        "global_rejected":len(rejected),
        "global_comparisons_executed":comparisons,
        "hard_pass_global":len(hard),
        "hard_pass_new_count":len(hard_new),
        "watch_global":len(watch),
        "fail_global":len(fail),
        "new_hard_pass_rows":hard_new,
        "top50_primitive_near_miss":near,
        "family_counts_final":dict(sorted(family_counts_final.items())),
        "distinct_family":distinct_family,
        "max_family_concentration":float(max_family_concentration),
        "portfolio_min_6_family_gate":bool(distinct_family>=6 and max_family_concentration<=0.25+1e-12),
        "portfolio_target_10_family_gate":bool(distinct_family>=10 and max_family_concentration<=0.25+1e-12),
        "full_size_stack_final":full_stack,
        "equal_budget_total_1x_final":equal_budget,
        "diversified_subset_count":len(diversified),
        "diversified_family_counts":dict(sorted(diversified_counts.items())),
        "diversified_equal_budget_total_1x":diversified_equal_budget,
        "portfolio_readiness":"NOT_READY" if not hard else "HARD_PASS_FOUND_REQUIRES_SCRIPT_MT5_AND_PORTFOLIO_CERTIFICATION",
        "note":"Discovery does not confer VERIFIED. Any new HARD PASS still requires exact Python/MQ5 pair generation, native MetaEditor compile, native MT5 Strategy Tester and final portfolio validation.",
    }
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload,indent=2,sort_keys=True)+"\n")
    print(json.dumps({
        "status":payload["status"],"candidate_evaluated_unique":payload["candidate_evaluated_unique"],
        "primitive_diagnostics":payload["primitive_diagnostics"],"primitive_survivors":payload["primitive_survivors"],
        "noncorr_7_of_7_survivors":payload["noncorr_7_of_7_survivors"],"hard_pass_new_count":payload["hard_pass_new_count"],
        "global_selected":payload["global_selected"],
    },indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
