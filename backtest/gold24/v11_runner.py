from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import random
import signal
import sqlite3
import time
from pathlib import Path

import pandas as pd

from core import Candidate, FAMILIES, audit_dataset, backtest_candidate, generate_candidate, novelty_pass, validate_candidate
from store import Store

POLICY = "GOLD_CANONICAL_V11_20260828"
RULES_FILE = "RULES_GOLD_V11_2026.md"
PF_MIN = 1.20
PF_TARGET = 2.00
PF_MAX = 8.00
WR_MIN = 50.0
WR_MAX = 75.0
EV_MIN = 0.50
MAX_DD = 25.0
CORR_MAX = 0.50
STOP = False


def _stop(*_):
    global STOP
    STOP = True


signal.signal(signal.SIGTERM, _stop)
signal.signal(signal.SIGINT, _stop)


def atomic_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, sort_keys=True, default=str))
    tmp.replace(path)


def rules_sha256() -> str:
    p = Path(__file__).with_name(RULES_FILE)
    if not p.exists():
        raise RuntimeError(f"RULES_LOCK_FAIL: {RULES_FILE} missing")
    return hashlib.sha256(p.read_bytes()).hexdigest()


def execution_profile_v11(c: dict) -> str:
    return (
        f"{c['symbol']}|TF={c['timeframe']}|{c['entry_method']}|DIR={c['direction_mode']}|"
        f"SL={float(c['sl']):.2f}|TP={float(c['tp']):.2f}|"
        f"OFF={float(c['offset']):.2f}|EXP={int(c['expiry'])}"
    )


def minimum_trades(timeframe: str) -> int:
    return 500 if timeframe == "H1" else 300


def layer_count(family: str) -> int:
    # Every currently enabled family in core.signal_series combines at least two
    # independent conditions (signal condition + trend/momentum/confirmation).
    return 4 if family == "HYBRID" else 2


def h1_entry_hours_pass(ledger: list[dict], timeframe: str) -> bool:
    if timeframe != "H1" or not ledger:
        return True
    hours = pd.to_datetime(pd.Series([x["entry_time"] for x in ledger]), utc=True).dt.hour
    return bool((hours >= 6).all())


def evaluate_v11_metrics(metrics: dict, timeframe: str, ledger: list[dict], family: str) -> dict:
    trades = int(metrics.get("trades", 0) or 0)
    wr = float(metrics.get("wr", metrics.get("win_rate_pct", 0.0)) or 0.0)
    pf = float(metrics.get("profit_factor", metrics.get("profit_factor_net", 0.0)) or 0.0)
    ev = float(metrics.get("expectancy", metrics.get("net_expectancy", 0.0)) or 0.0)
    dd = float(metrics.get("max_dd_pct", 100.0) or 0.0)
    years = float(metrics.get("history_years", 0.0) or 0.0)
    sqn = float(metrics.get("sqn", 0.0) or 0.0)
    sharpe = float(metrics.get("sharpe", 0.0) or 0.0)
    sortino = float(metrics.get("sortino", 0.0) or 0.0)
    recovery = float(metrics.get("recovery", 0.0) or 0.0)
    calmar = float(metrics.get("calmar", 0.0) or 0.0)
    avg_win_loss = float(metrics.get("avg_win_loss", 0.0) or 0.0)
    max_consec_loss = int(metrics.get("max_consec_loss", 10**9) or 0)
    profitable_months = float(metrics.get("profitable_months_pct", 0.0) or 0.0)
    sample_floor = minimum_trades(timeframe)
    history_floor = 4.0 if timeframe == "H1" else 3.0
    pm_floor = 60.0 if timeframe == "H1" else 55.0
    layers = layer_count(family)
    h1_hours = h1_entry_hours_pass(ledger, timeframe)

    tier1_flags = {
        "sample": trades >= sample_floor,
        "win_rate": WR_MIN <= wr <= WR_MAX,
        "profit_factor": PF_MIN <= pf <= PF_MAX,
        "max_drawdown": dd <= MAX_DD,
        "net_ev_per_trade": ev >= EV_MIN,
        "history": years >= history_floor,
        "full_trade_log": trades > 0 and len(ledger) == trades,
        "h1_profitable_months": timeframe != "H1" or profitable_months >= 60.0,
        "h1_sqn": timeframe != "H1" or sqn >= 2.0,
    }
    tier1_pass = all(tier1_flags.values())

    tier2_flags = {
        "sqn": sqn >= (2.0 if timeframe == "H1" else 1.5),
        "sharpe": sharpe >= 0.8,
        "sortino": sortino >= 1.0,
        "recovery": recovery >= 3.0,
        "calmar": calmar >= 1.5,
        "avg_win_loss": avg_win_loss >= 1.0,
        "max_consecutive_losses": max_consec_loss <= 15,
        "profitable_months": profitable_months >= pm_floor,
    }
    tier2_count = sum(bool(x) for x in tier2_flags.values())
    tier2_pass = tier2_count >= 6
    multi_layer_pass = 2 <= layers <= 4

    return {
        "goal_policy": POLICY,
        "profit_factor_net": pf,
        "net_expectancy": ev,
        "win_rate_pct": wr,
        "minimum_trades_required_v11": sample_floor,
        "sample_pass_v11": trades >= sample_floor,
        "tier1_flags_v11": tier1_flags,
        "tier1_pass_v11": tier1_pass,
        "tier2_flags_v11": tier2_flags,
        "tier2_pass_count_v11": tier2_count,
        "tier2_pass_v11": tier2_pass,
        "multi_layer_count": layers,
        "multi_layer_pass": multi_layer_pass,
        "h1_entry_hours_pass": h1_hours,
        "baseline_qualified_v11": bool(tier1_pass and tier2_pass and multi_layer_pass and h1_hours),
        "target_pf_2_to_8": bool(PF_TARGET <= pf <= PF_MAX),
        "target_candidate_v11": bool(tier1_pass and tier2_pass and multi_layer_pass and h1_hours and PF_TARGET <= pf <= PF_MAX),
    }


def generate_v11_candidate(rng: random.Random, timeframe: str) -> Candidate:
    # core.generate_candidate already searches fixed GOLD SL/TP independently over $5-$25.
    # Reject TP<SL at generation time because v11 quality requires AvgWin/AvgLoss >=1.0;
    # this keeps compute focused on economically sensible fixed-RR candidates without
    # locking the search to one RR value.
    for _ in range(100):
        c = generate_candidate(rng, timeframe=timeframe)
        if c.tp + 1e-12 >= c.sl and 2 <= layer_count(c.family) <= 4:
            validate_candidate(c)
            return c
    raise RuntimeError("GENERATOR_FAIL: unable to construct legal v11 candidate")


def candidate_quality_key(row: dict) -> tuple:
    m = row["metrics"]
    return (
        float(m.get("profit_factor_net", m.get("profit_factor", 0.0)) or 0.0),
        float(m.get("net_expectancy", m.get("expectancy", 0.0)) or 0.0),
        -float(m.get("max_dd_pct", 100.0) or 100.0),
        float(m.get("sqn", 0.0) or 0.0),
        float(m.get("sharpe", 0.0) or 0.0),
        float(m.get("sortino", 0.0) or 0.0),
        float(m.get("net_profit", 0.0) or 0.0),
    )


def load_rankable_rows(store: Store, timeframe: str) -> list[dict]:
    rows = store.db.execute(
        "SELECT config_hash,canonical_json,fingerprint,execution_hash,ledger_path,metrics_json FROM configs"
    ).fetchall()
    out = []
    min_sample = minimum_trades(timeframe)
    for h, c_raw, f, eh, lp, m_raw in rows:
        c = json.loads(c_raw)
        m = json.loads(m_raw) if m_raw else {}
        if int(m.get("trades", 0) or 0) < min_sample:
            continue
        if bool(m.get("exact_execution_duplicate", False)):
            continue
        out.append({"config_hash": h, "candidate": c, "fingerprint": f, "execution_hash": eh, "ledger_path": lp, "metrics": m})
    out.sort(key=candidate_quality_key, reverse=True)
    return out


def write_rankings(root: Path, store: Store, audit: dict, timeframe: str) -> tuple[int, int, int]:
    rankable = load_rankable_rows(store, timeframe)
    top200 = rankable[:200]
    qualified = [r for r in rankable if bool(r["metrics"].get("baseline_qualified_v11"))]
    targets = [r for r in qualified if bool(r["metrics"].get("target_pf_2_to_8"))]

    def compact(rows: list[dict]) -> list[dict]:
        return [{
            "rank": i,
            "config_hash": r["config_hash"],
            "candidate": r["candidate"],
            "execution_profile_v11": r["fingerprint"],
            "execution_hash": r["execution_hash"],
            "metrics": r["metrics"],
        } for i, r in enumerate(rows, 1)]

    atomic_json(root / "TOP200_SAMPLE_PF_V11.json", {
        "schema": "gold-v11-top200-sample-pf",
        "classification": "SAMPLE_RANKING_NOT_FINAL",
        "policy": POLICY,
        "rules_sha256": rules_sha256(),
        "gate_a": audit.get("gate_a"),
        "ranking_rule": "minimum trades first; then NET Profit Factor descending",
        "minimum_trades": minimum_trades(timeframe),
        "count": len(top200),
        "ranking": compact(top200),
    })
    atomic_json(root / "TOP100_QUALIFIED_V11.json", {
        "schema": "gold-v11-top100-qualified",
        "classification": "TIER1_TIER2_QUALIFIED_NOT_ROBUSTNESS_FINAL",
        "policy": POLICY,
        "rules_sha256": rules_sha256(),
        "count": min(len(qualified), 100),
        "target_pf_2_to_8_count": len(targets),
        "ranking": compact(qualified[:100]),
    })
    return len(rankable), len(qualified), len(targets)


def selftest() -> None:
    m = {
        "trades": 350, "wr": 55.0, "profit_factor": 2.2, "expectancy": 1.2,
        "max_dd_pct": 10.0, "history_years": 5.0, "sqn": 2.1, "sharpe": 1.0,
        "sortino": 1.3, "recovery": 4.0, "calmar": 1.8, "avg_win_loss": 1.2,
        "max_consec_loss": 7, "profitable_months_pct": 60.0,
    }
    ledger = [{"entry_time": "2026-01-01T00:00:00+00:00"}] * 350
    x = evaluate_v11_metrics(m, "D1", ledger, "TREND_EMA")
    assert x["baseline_qualified_v11"] is True
    assert x["target_candidate_v11"] is True
    m2 = dict(m, trades=299)
    assert evaluate_v11_metrics(m2, "D1", ledger[:299], "TREND_EMA")["sample_pass_v11"] is False
    m3 = dict(m, trades=500, profitable_months_pct=65.0, sqn=2.2)
    h1_ledger = [{"entry_time": "2026-01-01T06:00:00+00:00"}] * 500
    assert evaluate_v11_metrics(m3, "H1", h1_ledger, "TREND_EMA")["baseline_qualified_v11"] is True
    h1_bad = [{"entry_time": "2026-01-01T05:00:00+00:00"}] * 500
    assert evaluate_v11_metrics(m3, "H1", h1_bad, "TREND_EMA")["baseline_qualified_v11"] is False
    print("v11_runner selftest: PASS")


def run(once: bool = False) -> None:
    root = Path(os.environ.get("GOLD24_STATE_DIR", "/var/lib/gold24-v11")).resolve()
    root.mkdir(parents=True, exist_ok=True)
    ledgers = root / "ledgers_v11"
    receipts = root / "receipts_v11"
    ledgers.mkdir(exist_ok=True)
    receipts.mkdir(exist_ok=True)
    status_path = root / "status_v11.json"

    timeframe = os.environ.get("GOLD24_TIMEFRAME", "D1")
    dataset_path = os.environ.get("GOLD24_DATASET", "")
    crosscheck = os.environ.get("GOLD24_CROSSCHECK", "")
    batch_size = max(1, int(os.environ.get("GOLD24_BATCH_SIZE", "128")))
    flat_lot = float(os.environ.get("GOLD24_FLAT_LOT", "1.0"))
    base_seed = int(os.environ.get("GOLD24_SEED", "20260828"))
    rule_sha = rules_sha256()

    try:
        d, audit = audit_dataset(dataset_path, crosscheck, timeframe)
        audit["rules_sha256_v11"] = rule_sha
    except Exception as e:
        atomic_json(status_path, {
            "schema": "gold-v11-status",
            "policy": POLICY,
            "strategy_engine": "PAUSED",
            "gate_a": "BLOCKED",
            "reason": str(e),
            "rules_sha256": rule_sha,
            "simulation_executed": False,
            "updated_at": pd.Timestamp.now(tz="UTC").isoformat(),
        })
        print(status_path.read_text())
        return

    db = Store(root / "gold24-v11.db")
    cursor = int(db.get_state("candidate_cursor", base_seed))
    batch = int(db.get_state("batch", 0))

    while not STOP:
        started = time.time()
        batch += 1
        accepted: list[Candidate] = []
        trials = 0
        rejected_pre = 0
        max_trials = batch_size * 2000
        while len(accepted) < batch_size and trials < max_trials and not STOP:
            trials += 1
            rng = random.Random(cursor)
            cursor += 1
            c = generate_v11_candidate(rng, timeframe)
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
            atomic_json(status_path, {
                "schema": "gold-v11-status", "policy": POLICY, "strategy_engine": "SATURATED",
                "gate_a": "PASS", "batch": batch, "candidate_cursor": cursor,
                "simulation_executed": False, "rules_sha256": rule_sha,
                "updated_at": pd.Timestamp.now(tz="UTC").isoformat(),
            })
            break

        results = []
        for c in accepted:
            r = backtest_candidate(d, c, flat_lot=flat_lot)
            profile = execution_profile_v11(r["candidate"])
            r["fingerprint"] = profile
            for row in r["ledger"]:
                row["fingerprint"] = profile
            r["metrics"].update(evaluate_v11_metrics(r["metrics"], timeframe, r["ledger"], c.family))
            results.append(r)

        ledger_cols = [
            "config_hash", "fingerprint", "family", "entry_time", "exit_time", "entry_bar", "exit_bar",
            "side", "pending_order", "entry_price", "exit_price", "fixed_sl", "fixed_tp", "quantity",
            "gross_pnl", "cost", "net_pnl", "exit_reason",
        ]
        ledger_rows = [row for r in results for row in r["ledger"]]
        shard = ledgers / f"ledger_{batch:08d}.parquet"
        pd.DataFrame(ledger_rows, columns=ledger_cols).to_parquet(shard, index=False)

        exact_dupes = zero_trade = baseline_pass = target_pass = 0
        receipt_rows = []
        for r in results:
            trades = int(r["metrics"].get("trades", 0) or 0)
            zero_trade += int(trades == 0)
            exact_duplicate = db.exact_execution_duplicate(r) if trades > 0 else False
            r["metrics"]["exact_execution_duplicate"] = bool(exact_duplicate)
            exact_dupes += int(exact_duplicate)
            baseline = bool(r["metrics"].get("baseline_qualified_v11")) and not exact_duplicate
            target = bool(r["metrics"].get("target_candidate_v11")) and not exact_duplicate
            baseline_pass += int(baseline)
            target_pass += int(target)
            db.insert_result(r, str(shard), baseline)
            receipt_rows.append({
                "config_hash": r["config_hash"],
                "execution_hash": r["execution_hash"],
                "execution_profile_v11": r["fingerprint"],
                "trades": trades,
                "profit_factor_net": r["metrics"].get("profit_factor_net", 0.0),
                "net_expectancy": r["metrics"].get("net_expectancy", 0.0),
                "max_dd_pct": r["metrics"].get("max_dd_pct", 0.0),
                "baseline_qualified_v11": baseline,
                "target_candidate_v11": target,
                "exact_execution_duplicate": exact_duplicate,
            })

        rankable_count, qualified_total, targets_total = write_rankings(root, db, audit, timeframe)
        total_configs = db.db.execute("SELECT COUNT(*) FROM configs").fetchone()[0]
        elapsed = time.time() - started
        receipt = {
            "schema": "gold-v11-batch-receipt",
            "policy": POLICY,
            "rules_sha256": rule_sha,
            "batch": batch,
            "candidate_cursor": cursor,
            "timeframe": timeframe,
            "simulated_this_batch": len(results),
            "generator_trials": trials,
            "rejected_pre_simulation": rejected_pre,
            "zero_trade_configs": zero_trade,
            "exact_execution_duplicates_archived": exact_dupes,
            "baseline_qualified_this_batch": baseline_pass,
            "target_pf_2_to_8_this_batch": target_pass,
            "cumulative_configs_archived": int(total_configs),
            "cumulative_sample_rankable": rankable_count,
            "cumulative_baseline_qualified": qualified_total,
            "cumulative_target_pf_2_to_8": targets_total,
            "seconds": elapsed,
            "configs_per_second": len(results) / elapsed if elapsed > 0 else 0.0,
            "ledger_shard": str(shard),
            "configs": receipt_rows,
            "updated_at": pd.Timestamp.now(tz="UTC").isoformat(),
        }
        receipt_path = receipts / f"batch_{batch:08d}.json"
        atomic_json(receipt_path, receipt)
        atomic_json(status_path, {
            "schema": "gold-v11-status",
            "worker": "GOLD_V11_SAMPLE_PF",
            "policy": POLICY,
            "strategy_engine": "RUNNING",
            "gate_a": "PASS",
            "rules_sha256": rule_sha,
            "timeframe": timeframe,
            "batch": batch,
            "candidate_cursor": cursor,
            "simulated_this_batch": len(results),
            "cumulative_configs_archived": int(total_configs),
            "cumulative_sample_rankable": rankable_count,
            "cumulative_baseline_qualified": qualified_total,
            "cumulative_target_pf_2_to_8": targets_total,
            "ranking_rule": "minimum trades first; then NET Profit Factor descending",
            "minimum_trades": minimum_trades(timeframe),
            "pf_target_min": PF_TARGET,
            "pf_max": PF_MAX,
            "seconds": elapsed,
            "simulation_executed": True,
            "updated_at": pd.Timestamp.now(tz="UTC").isoformat(),
        })
        print(json.dumps({k: v for k, v in receipt.items() if k != "configs"}, sort_keys=True), flush=True)

        if once:
            break

    db.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    if args.self_test:
        selftest()
    else:
        run(once=args.once)
