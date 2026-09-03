from __future__ import annotations

import argparse
import json
import os
import random
from pathlib import Path

import numpy as np
import pandas as pd

from core import Candidate, FAMILIES, backtest_candidate, novelty_pass, pearson_log_equity, validate_candidate
from github_dev_runner import CLASSIFICATION, atomic_json, prepare_dev_dataset
from store import Store

GOAL_POLICY = "GOLD24_GOAL_RR12_WR50_WEEKLY_V1_20260828"
GOAL_WR_MIN = 50.0
GOAL_WR_RED_FLAG = 75.0
GOAL_TRADES_PER_WEEK_MIN = 1.0
GOAL_TRADES_PER_WEEK_PREFERRED_MAX = 2.0
GOAL_CORR_MAX = 0.50
GOAL_CORR_WARNING = 0.35
REQUIRED_FAMILIES = {
    "ATR_BREAKOUT",
    "BOLLINGER_REVERSION",
    "KELTNER_BREAKOUT",
    "CANDLE_ENGULFING",
    "PRICE_STRUCTURE",
}


def generate_goal_candidate(rng: random.Random, timeframe: str = "D1") -> Candidate:
    family = rng.choice(list(FAMILIES))
    windows = [3, 5, 7, 8, 10, 13, 14, 20, 21, 26, 34, 50, 55, 89, 100, 144]
    fast, slow = sorted(rng.sample(windows, 2))
    entry_method = rng.choice(["STOP", "LIMIT"])
    direction_mode = rng.choice(["BOTH", "LONG_ONLY", "SHORT_ONLY"])

    # Existing GOLD absolute bounds are $5-$25 for both SL and TP.
    # Exact risk:reward 1:2 therefore constrains SL to $5-$12.5.
    sl = rng.choice([x / 2 for x in range(10, 26)])
    tp = 2.0 * sl
    offset = rng.choice([x / 4 for x in range(2, 21)])
    expiry = rng.randint(1, 8)

    if family in {"ATR_BREAKOUT", "KELTNER_BREAKOUT"}:
        p1, p2, p3 = rng.choice([0.5, 0.7, 0.9, 1.2, 1.5, 1.8, 2.2, 2.8]), 55.0, 1.0
    elif family == "BOLLINGER_REVERSION":
        p1, p2, p3 = rng.choice([1.2, 1.5, 1.8, 2.2, 2.6, 3.0]), rng.choice([25, 30, 35, 40]), 1.0
    elif family == "ZSCORE_REVERSION":
        p1, p2, p3 = rng.choice([0.7, 1.0, 1.3, 1.7, 2.1, 2.7]), rng.choice([25, 30, 35, 40]), 1.0
    elif family == "MOMENTUM_RSI_ROC":
        p1, p2, p3 = rng.choice([0.3, 0.5, 0.8, 1.2, 1.8, 2.5]), rng.choice([52, 55, 58, 62, 66]), 1.0
    else:
        p1, p2, p3 = rng.choice([52, 55, 58, 62, 66]), rng.choice([52, 55, 58, 62, 66]), 1.0

    c = Candidate(
        "GOLD",
        timeframe,
        family,
        fast,
        slow,
        p1,
        p2,
        p3,
        entry_method,
        direction_mode,
        sl,
        tp,
        offset,
        expiry,
    )
    validate_candidate(c)
    if abs(c.tp / c.sl - 2.0) > 1e-12:
        raise RuntimeError("GOAL_POLICY_FAIL: candidate RR is not exact 1:2")
    return c


def execution_profile_v2(candidate: dict) -> str:
    return (
        f"{candidate['symbol']}|TF={candidate['timeframe']}|{candidate['entry_method']}|"
        f"DIR={candidate['direction_mode']}|SL={float(candidate['sl']):.2f}|TP={float(candidate['tp']):.2f}|"
        f"OFF={float(candidate['offset']):.2f}|EXP={int(candidate['expiry'])}"
    )


def enrich_goal_metrics(result: dict, d: pd.DataFrame) -> None:
    m = result["metrics"]
    trades = int(m.get("trades", 0))
    start = pd.Timestamp(d["Date"].iloc[0])
    end = pd.Timestamp(d["Date"].iloc[-1])
    weeks = max((end - start).total_seconds() / (7 * 86400), 1e-9)
    tpw = trades / weeks
    wr = float(m.get("wr", 0.0)) if trades else 0.0
    expectancy = float(m.get("expectancy", 0.0)) if trades else 0.0
    c = result["candidate"]
    reward_risk = float(c["tp"]) / float(c["sl"])

    m.update(
        {
            "goal_policy": GOAL_POLICY,
            "reward_risk": reward_risk,
            "risk_reward_label": "1:2",
            "trades_per_week": float(tpw),
            "goal_rr_pass": bool(abs(reward_risk - 2.0) <= 1e-12),
            "goal_wr_pass": bool(wr >= GOAL_WR_MIN),
            "goal_wr_red_flag": bool(wr > GOAL_WR_RED_FLAG),
            "goal_frequency_pass": bool(tpw >= GOAL_TRADES_PER_WEEK_MIN),
            "goal_frequency_preferred_band": bool(
                GOAL_TRADES_PER_WEEK_MIN <= tpw <= GOAL_TRADES_PER_WEEK_PREFERRED_MAX
            ),
            "goal_net_expectancy_pass": bool(expectancy > 0),
        }
    )
    m["primary_goal_pass"] = bool(
        trades > 0
        and m["goal_rr_pass"]
        and m["goal_wr_pass"]
        and not m["goal_wr_red_flag"]
        and m["goal_frequency_pass"]
        and m["goal_net_expectancy_pass"]
    )


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


def select_goal_top200(store: Store, nrows: int) -> list[dict]:
    rows = store.eligible_rows()
    rows.sort(
        key=lambda r: (
            r["metrics"].get("profit_factor", 0),
            r["metrics"].get("trades", 0),
            r["metrics"].get("net_profit", 0),
        ),
        reverse=True,
    )

    selected: list[dict] = []
    profile_seen: set[str] = set()
    family_counts: dict[str, int] = {}
    pnl_cache: dict[str, np.ndarray] = {}

    ordered: list[dict] = []
    used: set[str] = set()
    for fam in sorted(REQUIRED_FAMILIES):
        for r in rows:
            if r["candidate"]["family"] == fam and r["config_hash"] not in used:
                ordered.append(r)
                used.add(r["config_hash"])
                break
    ordered.extend(r for r in rows if r["config_hash"] not in used)

    for r in ordered:
        profile = r["fingerprint"]
        if profile in profile_seen:
            continue

        fam = r["candidate"]["family"]
        proposed_n = len(selected) + 1
        proposed_fam = family_counts.get(fam, 0) + 1
        if proposed_n >= 5 and proposed_fam / proposed_n > 0.30:
            continue

        bp = load_bar_pnl(r["ledger_path"], r["config_hash"], nrows)
        maxcorr = 0.0
        warnings = 0
        reject = False
        for s in selected:
            corr = abs(pearson_log_equity(bp, pnl_cache[s["config_hash"]]))
            maxcorr = max(maxcorr, corr)
            if corr > GOAL_CORR_MAX:
                reject = True
                break
            if corr > GOAL_CORR_WARNING:
                warnings += 1
        if reject:
            continue

        r["correlation_max"] = float(maxcorr)
        r["correlation_warning_pairs"] = int(warnings)
        selected.append(r)
        profile_seen.add(profile)
        family_counts[fam] = proposed_fam
        pnl_cache[r["config_hash"]] = bp
        if len(selected) >= 200:
            break

    families = {x["candidate"]["family"] for x in selected}
    coverage_complete = REQUIRED_FAMILIES.issubset(families)
    for x in selected:
        x["portfolio_coverage_complete"] = bool(coverage_complete)
    return selected


def db_counts(db: Store) -> dict:
    total = int(db.db.execute("SELECT COUNT(*) FROM configs").fetchone()[0])
    with_trades = int(
        db.db.execute(
            "SELECT COUNT(*) FROM configs WHERE COALESCE(json_extract(metrics_json,'$.trades'),0) > 0"
        ).fetchone()[0]
    )
    goal_pass = int(db.db.execute("SELECT COUNT(*) FROM configs WHERE counted=1").fetchone()[0])
    return {
        "goal_unique_configs_dev": total,
        "goal_configs_with_trades": with_trades,
        "primary_goal_execution_unique_dev": goal_pass,
    }


def run(max_batches: int, batch_size: int) -> None:
    root = Path(os.environ.get("GOLD24_STATE_DIR", ".gold24-dev")).resolve()
    root.mkdir(parents=True, exist_ok=True)
    ledgers = root / "goal_rr12_ledgers"
    receipts = root / "goal_rr12_receipts"
    ledgers.mkdir(exist_ok=True)
    receipts.mkdir(exist_ok=True)

    d, audit = prepare_dev_dataset(root)
    db = Store(root / "gold24-goal-rr12.db")
    base_seed = int(os.environ.get("GOLD24_GOAL_SEED", "202608281700"))
    cursor = int(db.get_state("goal_candidate_cursor", base_seed))
    batch = int(db.get_state("goal_batch", 0))
    flat_lot = float(os.environ.get("GOLD24_FLAT_LOT", "1.0"))
    cumulative_exec_unique = int(db.get_state("goal_execution_unique_nonzero", 0))
    cumulative_exact_dupes = int(db.get_state("goal_exact_execution_duplicates", 0))
    cumulative_zero = int(db.get_state("goal_zero_trade_configs", 0))
    cumulative_goal_pass = int(db.get_state("goal_primary_pass_unique", 0))

    for _ in range(max_batches):
        batch += 1
        accepted: list[Candidate] = []
        rejected_pre = 0
        trials = 0
        max_trials = batch_size * 500

        while len(accepted) < batch_size and trials < max_trials:
            trials += 1
            c = generate_goal_candidate(random.Random(cursor), "D1")
            cursor += 1
            if db.seen(c.config_hash) or not db.novelty_ok(c):
                rejected_pre += 1
                continue
            if any(not novelty_pass(c, prior) for prior in accepted):
                rejected_pre += 1
                continue
            accepted.append(c)

        db.set_state("goal_candidate_cursor", cursor)
        db.set_state("goal_batch", batch)
        if not accepted:
            break

        results = []
        for c in accepted:
            r = backtest_candidate(d, c, flat_lot=flat_lot)
            profile = execution_profile_v2(r["candidate"])
            r["fingerprint"] = profile
            for row in r["ledger"]:
                row["fingerprint"] = profile
            enrich_goal_metrics(r, d)
            results.append(r)

        ledger_rows = [row for r in results for row in r["ledger"]]
        shard = ledgers / f"ledger_{batch:08d}.parquet"
        ledger_columns = [
            "config_hash",
            "fingerprint",
            "family",
            "entry_time",
            "exit_time",
            "entry_bar",
            "exit_bar",
            "side",
            "pending_order",
            "entry_price",
            "exit_price",
            "fixed_sl",
            "fixed_tp",
            "quantity",
            "gross_pnl",
            "cost",
            "net_pnl",
            "exit_reason",
        ]
        pd.DataFrame(ledger_rows, columns=ledger_columns).to_parquet(shard, index=False)

        batch_exec_unique = 0
        batch_exact_dupes = 0
        batch_zero = 0
        batch_goal_pass = 0
        configs = []

        for r in results:
            trades = int(r["metrics"].get("trades", 0))
            has_trades = trades > 0
            exact_duplicate = db.exact_execution_duplicate(r) if has_trades else False
            if not has_trades:
                batch_zero += 1
            elif exact_duplicate:
                batch_exact_dupes += 1
            else:
                batch_exec_unique += 1

            primary_goal = bool(r["metrics"].get("primary_goal_pass"))
            counted = has_trades and not exact_duplicate and primary_goal
            batch_goal_pass += int(counted)
            db.insert_result(r, str(shard), counted)
            configs.append(
                {
                    "config_hash": r["config_hash"],
                    "execution_profile_v2": r["fingerprint"],
                    "execution_hash": r["execution_hash"],
                    "trades": trades,
                    "wr": r["metrics"].get("wr", 0),
                    "trades_per_week": r["metrics"].get("trades_per_week", 0),
                    "reward_risk": r["metrics"].get("reward_risk", 0),
                    "primary_goal_pass": primary_goal,
                    "exact_execution_duplicate": exact_duplicate,
                }
            )

        cumulative_exec_unique += batch_exec_unique
        cumulative_exact_dupes += batch_exact_dupes
        cumulative_zero += batch_zero
        cumulative_goal_pass += batch_goal_pass
        db.set_state("goal_execution_unique_nonzero", cumulative_exec_unique)
        db.set_state("goal_exact_execution_duplicates", cumulative_exact_dupes)
        db.set_state("goal_zero_trade_configs", cumulative_zero)
        db.set_state("goal_primary_pass_unique", cumulative_goal_pass)

        top = select_goal_top200(db, len(d))
        atomic_json(
            root / "GOAL_TOP200_RR12.json",
            {
                "classification": CLASSIFICATION,
                "goal_policy": GOAL_POLICY,
                "gate_a": audit["gate_a"],
                "promotion_allowed": False,
                "count": len(top),
                "required_family_coverage_complete": bool(
                    REQUIRED_FAMILIES.issubset({x["candidate"]["family"] for x in top})
                ),
                "ranking": [
                    {
                        "rank": i,
                        "config_hash": x["config_hash"],
                        "candidate": x["candidate"],
                        "execution_profile_v2": x["fingerprint"],
                        "execution_hash": x["execution_hash"],
                        "metrics": x["metrics"],
                        "correlation_max": x.get("correlation_max", 0.0),
                        "correlation_warning_pairs": x.get("correlation_warning_pairs", 0),
                    }
                    for i, x in enumerate(top, 1)
                ],
            },
        )

        receipt = {
            "schema": "gold24-goal-rr12-dev-receipt-v1",
            "classification": CLASSIFICATION,
            "goal_policy": GOAL_POLICY,
            "gate_a": audit["gate_a"],
            "promotion_allowed": False,
            "batch": batch,
            "candidate_cursor_after": cursor,
            "raw_trials": trials,
            "preengine_rejects": rejected_pre,
            "simulated": len(results),
            "execution_unique_nonzero": batch_exec_unique,
            "exact_execution_duplicates_archived": batch_exact_dupes,
            "zero_trade_configs": batch_zero,
            "new_primary_goal_execution_unique": batch_goal_pass,
            "goal_top200_count": len(top),
            "configs": configs,
        }
        atomic_json(receipts / f"batch_{batch:08d}.json", receipt)
        atomic_json(
            root / "status.json",
            {
                "worker": "GITHUB_TEMPORARY_DEV_GOAL_RR12",
                "engine": "RUNNING",
                "classification": CLASSIFICATION,
                "goal_policy": GOAL_POLICY,
                "gate_a": audit["gate_a"],
                "promotion_allowed": False,
                "goal": {
                    "win_rate_min_pct": GOAL_WR_MIN,
                    "risk_reward": "1:2",
                    "trades_per_week_min": GOAL_TRADES_PER_WEEK_MIN,
                    "preferred_trades_per_week": "1-2",
                    "correlation_max": GOAL_CORR_MAX,
                },
                "goal_batch": batch,
                "goal_candidate_cursor": cursor,
                "goal_execution_unique_nonzero_dev": cumulative_exec_unique,
                "goal_exact_execution_duplicates_archived": cumulative_exact_dupes,
                "goal_zero_trade_configs": cumulative_zero,
                "primary_goal_execution_unique_dev": cumulative_goal_pass,
                "goal_top200_count": len(top),
                **db_counts(db),
                "updated_at": pd.Timestamp.now(tz="UTC").isoformat(),
            },
        )

    db.close()
    print((root / "status.json").read_text())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-batches", type=int, default=int(os.environ.get("GOLD24_DEV_MAX_BATCHES", "20")))
    ap.add_argument("--batch-size", type=int, default=int(os.environ.get("GOLD24_DEV_BATCH_SIZE", "32")))
    args = ap.parse_args()
    run(max_batches=max(1, args.max_batches), batch_size=max(1, args.batch_size))


if __name__ == "__main__":
    main()
