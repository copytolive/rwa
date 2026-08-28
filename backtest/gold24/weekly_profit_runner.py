from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import signal
import time
from pathlib import Path

import numpy as np
import pandas as pd

from core import Candidate, FAMILIES, audit_dataset, backtest_candidate, novelty_pass, pearson_log_equity, validate_candidate
from store import Store
from weekly_metrics import FIXED_SL, FIXED_TP, MIN_PROFITABLE_WEEKS_PCT, MIN_TRADES_PER_WEEK, selftest as weekly_metrics_selftest, weekly_economics

POLICY = "GOLD24_WEEKLY_PROFIT_RR12_V2_20260828"
CORR_MAX = 0.50
CORR_WARNING = 0.35
REQUIRED_FAMILIES = {"ATR_BREAKOUT", "BOLLINGER_REVERSION", "KELTNER_BREAKOUT", "CANDLE_ENGULFING", "PRICE_STRUCTURE"}
STOP = False


def _stop(*_):
    global STOP
    STOP = True


signal.signal(signal.SIGTERM, _stop)
signal.signal(signal.SIGINT, _stop)


def atomic_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True, default=str))
    tmp.replace(path)


def rules_sha256() -> str:
    path = Path(__file__).with_name("RULES_GOAL_RR12_2026.md")
    if not path.exists():
        raise RuntimeError("RULES_LOCK_FAIL: RULES_GOAL_RR12_2026.md missing")
    return hashlib.sha256(path.read_bytes()).hexdigest()


def execution_profile_v2(candidate: dict) -> str:
    return (
        f"{candidate['symbol']}|TF={candidate['timeframe']}|{candidate['entry_method']}|"
        f"DIR={candidate['direction_mode']}|SL={float(candidate['sl']):.2f}|"
        f"TP={float(candidate['tp']):.2f}|OFF={float(candidate['offset']):.2f}|EXP={int(candidate['expiry'])}"
    )


def generate_weekly_candidate(rng: random.Random, timeframe: str) -> Candidate:
    family = rng.choice(list(FAMILIES))
    windows = [2, 3, 4, 5, 6, 8, 10, 13, 14, 20, 21, 26, 34, 50, 55, 89, 100, 144]
    fast, slow = sorted(rng.sample(windows, 2))
    entry_method = rng.choice(["STOP", "LIMIT"])
    direction_mode = rng.choice(["BOTH", "LONG_ONLY", "SHORT_ONLY"])
    offset = rng.choice([x / 4 for x in range(1, 25)])
    expiry = rng.randint(1, 12)

    if family in {"ATR_BREAKOUT", "KELTNER_BREAKOUT"}:
        p1, p2, p3 = rng.choice([0.35, 0.5, 0.7, 0.9, 1.2, 1.5, 1.8, 2.2]), 55.0, 1.0
    elif family == "BOLLINGER_REVERSION":
        p1, p2, p3 = rng.choice([1.0, 1.2, 1.5, 1.8, 2.2, 2.6]), rng.choice([25, 30, 35, 40, 45]), 1.0
    elif family == "ZSCORE_REVERSION":
        p1, p2, p3 = rng.choice([0.5, 0.7, 1.0, 1.3, 1.7, 2.1]), rng.choice([25, 30, 35, 40, 45]), 1.0
    elif family == "MOMENTUM_RSI_ROC":
        p1, p2, p3 = rng.choice([0.2, 0.3, 0.5, 0.8, 1.2, 1.8]), rng.choice([50, 52, 55, 58, 62]), 1.0
    else:
        p1, p2, p3 = rng.choice([50, 52, 55, 58, 62]), rng.choice([50, 52, 55, 58, 62]), 1.0

    c = Candidate("GOLD", timeframe, family, fast, slow, p1, p2, p3, entry_method, direction_mode, FIXED_SL, FIXED_TP, offset, expiry)
    validate_candidate(c)
    if abs(c.sl - FIXED_SL) > 1e-12 or abs(c.tp - FIXED_TP) > 1e-12 or abs(c.tp / c.sl - 2.0) > 1e-12:
        raise RuntimeError("GOAL_LOCK_FAIL: fixed SL/TP or RR lock violated")
    return c


def enrich_result(result: dict, d: pd.DataFrame) -> None:
    ledger = pd.DataFrame(result.get("ledger", []))
    weekly = weekly_economics(pd.Series(pd.to_datetime(d["Date"], utc=True)), ledger)
    m = result["metrics"]
    m.update(weekly)
    m.update({
        "goal_policy": POLICY,
        "fixed_sl_lock": FIXED_SL,
        "fixed_tp_lock": FIXED_TP,
        "reward_risk": 2.0,
        "rr_label": "1:2",
        "gate_b_execution_pass": bool(
            all(float(x.get("fixed_sl", FIXED_SL)) == FIXED_SL for x in result.get("ledger", []))
            and all(float(x.get("fixed_tp", FIXED_TP)) == FIXED_TP for x in result.get("ledger", []))
            and all(str(x.get("pending_order", "")).lower() in {"buy_stop", "sell_stop", "buy_limit", "sell_limit"} for x in result.get("ledger", []))
        ),
        "gate_c_weekly_economics_pass": bool(weekly["weekly_goal_candidate_pass"]),
        "robustness_gate": "PENDING_FROZEN_OOS_WALK_FORWARD",
    })


def load_bar_pnl(ledger_path: str, config_hash: str, nrows: int) -> np.ndarray:
    df = pd.read_parquet(ledger_path)
    if "config_hash" not in df.columns:
        raise RuntimeError("LEDGER_FAIL: config_hash missing")
    df = df[df["config_hash"] == config_hash]
    out = np.zeros(nrows, dtype=float)
    if not df.empty:
        g = df.groupby("exit_bar")["net_pnl"].sum()
        idx = g.index.to_numpy(int)
        if np.any(idx < 0) or np.any(idx >= nrows):
            raise RuntimeError("LEDGER_FAIL: exit_bar out of range")
        out[idx] = g.to_numpy(float)
    return out


def quality_key(row: dict) -> tuple:
    m = row["metrics"]
    tpw = float(m.get("trades_per_week", 0.0))
    freq_pref = -abs(min(max(tpw, 2.0), 4.0) - 3.0)
    return (
        float(m.get("median_weekly_net", 0.0)),
        float(m.get("average_weekly_net", 0.0)),
        float(m.get("profitable_weeks_pct", 0.0)),
        float(m.get("net_expectancy", m.get("expectancy", 0.0))),
        float(m.get("profit_factor_net", m.get("profit_factor", 0.0))),
        -float(m.get("max_dd_pct", 100.0)),
        freq_pref,
        float(m.get("net_profit", 0.0)),
    )


def select_top200(store: Store, nrows: int) -> list[dict]:
    rows = store.eligible_rows()
    rows.sort(key=quality_key, reverse=True)
    ordered, used = [], set()
    for fam in sorted(REQUIRED_FAMILIES):
        for r in rows:
            if r["candidate"]["family"] == fam and r["config_hash"] not in used:
                ordered.append(r)
                used.add(r["config_hash"])
                break
    ordered.extend(r for r in rows if r["config_hash"] not in used)

    selected, profiles, family_counts, pnl_cache = [], set(), {}, {}
    for r in ordered:
        profile = r["fingerprint"]
        if profile in profiles:
            continue
        fam = r["candidate"]["family"]
        proposed_n = len(selected) + 1
        proposed_fam = family_counts.get(fam, 0) + 1
        if proposed_n >= 5 and proposed_fam / proposed_n > 0.30:
            continue
        bp = load_bar_pnl(r["ledger_path"], r["config_hash"], nrows)
        maxcorr, warning_pairs, reject = 0.0, 0, False
        for s in selected:
            corr = abs(pearson_log_equity(bp, pnl_cache[s["config_hash"]]))
            maxcorr = max(maxcorr, corr)
            if corr > CORR_MAX:
                reject = True
                break
            if corr > CORR_WARNING:
                warning_pairs += 1
        if reject:
            continue
        r["correlation_max"] = float(maxcorr)
        r["correlation_warning_pairs"] = int(warning_pairs)
        selected.append(r)
        profiles.add(profile)
        family_counts[fam] = proposed_fam
        pnl_cache[r["config_hash"]] = bp
        if len(selected) >= 200:
            break

    fams = {x["candidate"]["family"] for x in selected}
    coverage = REQUIRED_FAMILIES.issubset(fams)
    family_cap = bool(selected) and all(v / len(selected) <= 0.30 + 1e-12 for v in family_counts.values())
    for r in selected:
        r["portfolio_required_coverage_complete"] = bool(coverage)
        r["portfolio_family_cap_complete"] = bool(family_cap)
    return selected


def _write_top200(root: Path, top: list[dict], audit: dict) -> None:
    atomic_json(root / "TOP200_WEEKLY_PROFIT.json", {
        "schema": "gold24-weekly-profit-top200-v2",
        "classification": "GATE_C_CANDIDATE_NOT_FINAL",
        "goal_policy": POLICY,
        "rules_sha256": rules_sha256(),
        "gate_a": audit.get("gate_a"),
        "count": len(top),
        "ranking": [{
            "rank": i,
            "config_hash": x["config_hash"],
            "candidate": x["candidate"],
            "execution_profile_v2": x["fingerprint"],
            "execution_hash": x["execution_hash"],
            "metrics": x["metrics"],
            "correlation_max": x.get("correlation_max", 0.0),
            "correlation_warning_pairs": x.get("correlation_warning_pairs", 0),
            "portfolio_required_coverage_complete": x.get("portfolio_required_coverage_complete", False),
            "portfolio_family_cap_complete": x.get("portfolio_family_cap_complete", False),
        } for i, x in enumerate(top, 1)],
    })


def run(once: bool = False) -> None:
    root = Path(os.environ.get("GOLD24_STATE_DIR", "/var/lib/gold24")).resolve()
    root.mkdir(parents=True, exist_ok=True)
    ledgers, receipts = root / "weekly_profit_ledgers", root / "weekly_profit_receipts"
    ledgers.mkdir(exist_ok=True)
    receipts.mkdir(exist_ok=True)
    status_path = root / "status.json"

    timeframe = os.environ.get("GOLD24_TIMEFRAME", "H4")
    dataset_path = os.environ.get("GOLD24_DATASET", "")
    crosscheck = os.environ.get("GOLD24_CROSSCHECK", "")
    batch_size = max(1, int(os.environ.get("GOLD24_BATCH_SIZE", "32")))
    flat_lot = float(os.environ.get("GOLD24_FLAT_LOT", "1.0"))
    base_seed = int(os.environ.get("GOLD24_SEED", "20260828"))
    rule_sha = rules_sha256()

    try:
        d, audit = audit_dataset(dataset_path, crosscheck, timeframe)
        audit["rules_sha256"] = rule_sha
    except Exception as e:
        atomic_json(status_path, {
            "worker": "GOLD24_WEEKLY_PROFIT_V2",
            "strategy_engine": "PAUSED",
            "gate_a": "BLOCKED",
            "reason": str(e),
            "goal_policy": POLICY,
            "rules_sha256": rule_sha,
            "fixed_sl": FIXED_SL,
            "fixed_tp": FIXED_TP,
            "min_trades_per_week": MIN_TRADES_PER_WEEK,
            "min_profitable_weeks_pct": MIN_PROFITABLE_WEEKS_PCT,
            "simulation_executed": False,
            "counter_increment": 0,
            "updated_at": pd.Timestamp.now(tz="UTC").isoformat(),
        })
        print(status_path.read_text())
        return

    db = Store(root / "gold24-weekly-profit-v2.db")
    cursor = int(db.get_state("candidate_cursor", base_seed))
    batch = int(db.get_state("batch", 0))

    while not STOP:
        started, batch = time.time(), batch + 1
        accepted, trials, rejected_pre = [], 0, 0
        max_trials = batch_size * 1000
        while len(accepted) < batch_size and trials < max_trials:
            trials += 1
            c = generate_weekly_candidate(random.Random(cursor), timeframe)
            cursor += 1
            if db.seen(c.config_hash) or not db.novelty_ok(c):
                rejected_pre += 1
                continue
            if any(not novelty_pass(c, prior) for prior in accepted):
                rejected_pre += 1
                continue
            accepted.append(c)
        db.set_state("candidate_cursor", cursor)
        db.set_state("batch", batch)
        if not accepted:
            atomic_json(status_path, {"worker": "GOLD24_WEEKLY_PROFIT_V2", "strategy_engine": "SATURATED", "gate_a": "PASS", "goal_policy": POLICY, "rules_sha256": rule_sha, "batch": batch, "candidate_cursor": cursor, "simulation_executed": False, "updated_at": pd.Timestamp.now(tz="UTC").isoformat()})
            break

        results = []
        for c in accepted:
            r = backtest_candidate(d, c, flat_lot=flat_lot)
            profile = execution_profile_v2(r["candidate"])
            r["fingerprint"] = profile
            for row in r["ledger"]:
                row["fingerprint"] = profile
            enrich_result(r, d)
            results.append(r)

        ledger_rows = [row for r in results for row in r["ledger"]]
        shard = ledgers / f"ledger_{batch:08d}.parquet"
        ledger_cols = ["config_hash", "fingerprint", "family", "entry_time", "exit_time", "entry_bar", "exit_bar", "side", "pending_order", "entry_price", "exit_price", "fixed_sl", "fixed_tp", "quantity", "gross_pnl", "cost", "net_pnl", "exit_reason"]
        pd.DataFrame(ledger_rows, columns=ledger_cols).to_parquet(shard, index=False)

        exact_dupes = zero_trade = gate_c_pass = 0
        configs = []
        for r in results:
            trades = int(r["metrics"].get("trades", 0))
            has_trades = trades > 0
            if not has_trades:
                zero_trade += 1
            exact_duplicate = db.exact_execution_duplicate(r) if has_trades else False
            exact_dupes += int(exact_duplicate)
            candidate_pass = bool(r["metrics"].get("weekly_goal_candidate_pass", False))
            counted = bool(has_trades and not exact_duplicate and candidate_pass)
            gate_c_pass += int(counted)
            db.insert_result(r, str(shard), counted)
            configs.append({
                "config_hash": r["config_hash"], "execution_profile_v2": r["fingerprint"], "execution_hash": r["execution_hash"],
                "trades": trades, "trades_per_week": r["metrics"].get("trades_per_week", 0.0),
                "net_expectancy": r["metrics"].get("net_expectancy", 0.0), "average_weekly_net": r["metrics"].get("average_weekly_net", 0.0),
                "median_weekly_net": r["metrics"].get("median_weekly_net", 0.0), "profitable_weeks_pct": r["metrics"].get("profitable_weeks_pct", 0.0),
                "wr": r["metrics"].get("win_rate_pct", r["metrics"].get("wr", 0.0)), "wr_red_flag": r["metrics"].get("win_rate_red_flag", False),
                "gate_c_pass": candidate_pass, "exact_execution_duplicate": exact_duplicate,
            })

        top = select_top200(db, len(d))
        db.replace_portfolio([x["config_hash"] for x in top], {x["config_hash"]: float(x.get("correlation_max", 0.0)) for x in top})
        _write_top200(root, top, audit)
        receipt_path = receipts / f"batch_{batch:08d}.json"
        atomic_json(receipt_path, {
            "schema": "gold24-weekly-profit-batch-v2", "classification": "GATE_C_SCREENING_NOT_FINAL", "goal_policy": POLICY,
            "rules_sha256": rule_sha, "dataset_audit": audit, "batch": batch, "candidate_cursor_after": cursor,
            "raw_trials": trials, "preengine_rejects": rejected_pre, "simulated": len(results), "zero_trade_configs": zero_trade,
            "exact_execution_duplicates_archived": exact_dupes, "new_gate_c_candidates": gate_c_pass, "top200_count": len(top),
            "ledger_shard": str(shard), "configs": configs,
        })
        atomic_json(status_path, {
            "worker": "GOLD24_WEEKLY_PROFIT_V2", "strategy_engine": "RUNNING", "gate_a": "PASS", "goal_policy": POLICY,
            "rules_sha256": rule_sha, "fixed_sl": FIXED_SL, "fixed_tp": FIXED_TP, "min_trades_per_week": MIN_TRADES_PER_WEEK,
            "min_profitable_weeks_pct": MIN_PROFITABLE_WEEKS_PCT, "batch": batch, "candidate_cursor": cursor,
            "simulated_this_batch": len(results), "new_gate_c_candidates": gate_c_pass, "top200_count": len(top), "simulation_executed": True,
            "ledger_shard": str(shard), "receipt": str(receipt_path), "seconds": time.time() - started, "updated_at": pd.Timestamp.now(tz="UTC").isoformat(),
        })
        print(status_path.read_text())
        if once:
            break
    db.close()


def selftest() -> None:
    weekly_metrics_selftest()
    for tf in ("H1", "H4", "D1"):
        c = generate_weekly_candidate(random.Random(12345 + len(tf)), tf)
        assert c.sl == FIXED_SL and c.tp == FIXED_TP and abs(c.tp / c.sl - 2.0) < 1e-12 and c.timeframe == tf
    sample = {"symbol": "GOLD", "timeframe": "H4", "entry_method": "STOP", "direction_mode": "BOTH", "sl": FIXED_SL, "tp": FIXED_TP, "offset": 1.0, "expiry": 4}
    assert execution_profile_v2(sample) == "GOLD|TF=H4|STOP|DIR=BOTH|SL=12.50|TP=25.00|OFF=1.00|EXP=4"
    print("weekly_profit_runner selftest: PASS")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    if args.self_test:
        selftest()
    else:
        run(once=args.once)


if __name__ == "__main__":
    main()
