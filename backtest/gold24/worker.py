from __future__ import annotations

import argparse
import json
import os
import random
import signal
import time
from pathlib import Path

import numpy as np
import pandas as pd

from core import REQUIRED_PORTFOLIO_FAMILIES, Candidate, audit_dataset, backtest_candidate, generate_candidate, pearson_log_equity
from store import Store

STOP = False

def _stop(*_):
    global STOP
    STOP = True

signal.signal(signal.SIGTERM, _stop)
signal.signal(signal.SIGINT, _stop)


def atomic_json(path: Path, data: dict):
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True, default=str))
    tmp.replace(path)


def load_bar_pnl(ledger_path: str, nrows: int) -> np.ndarray:
    df = pd.read_parquet(ledger_path)
    arr = np.zeros(nrows, dtype=float)
    if not df.empty:
        g = df.groupby("exit_bar")["net_pnl"].sum()
        idx = g.index.to_numpy(int)
        arr[idx] = g.to_numpy(float)
    return arr


def select_top100(store: Store, nrows: int) -> list[dict]:
    rows = store.eligible_rows()
    rows.sort(key=lambda r: (r["metrics"].get("profit_factor", 0), r["metrics"].get("trades", 0), r["metrics"].get("net_profit", 0)), reverse=True)
    selected = []
    fp = set()
    fam_counts = {}
    returns_cache = {}
    for r in rows:
        if r["fingerprint"] in fp:
            continue
        fam = r["candidate"]["family"]
        proposed_n = len(selected) + 1
        proposed_fam = fam_counts.get(fam, 0) + 1
        if proposed_n >= 4 and proposed_fam / proposed_n > 0.30:
            continue
        bp = load_bar_pnl(r["ledger_path"], nrows)
        corr_bad = False
        maxcorr = 0.0
        for s in selected:
            corr = abs(pearson_log_equity(bp, returns_cache[s["config_hash"]]))
            maxcorr = max(maxcorr, corr)
            if corr > 0.50:
                corr_bad = True
                break
        if corr_bad:
            continue
        r["correlation_max"] = maxcorr
        r["rr"] = r["candidate"]["tp"] / r["candidate"]["sl"]
        selected.append(r)
        returns_cache[r["config_hash"]] = bp
        fp.add(r["fingerprint"])
        fam_counts[fam] = proposed_fam
        if len(selected) >= 100:
            break
    coverage = REQUIRED_PORTFOLIO_FAMILIES.issubset({x["candidate"]["family"] for x in selected})
    for x in selected:
        x["portfolio_coverage_complete"] = coverage
    return selected


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()

    root = Path(os.environ.get("GOLD24_STATE_DIR", "/var/lib/gold24"))
    root.mkdir(parents=True, exist_ok=True)
    ledgers = root / "ledgers"
    ledgers.mkdir(exist_ok=True)
    status_path = root / "status.json"
    db = Store(root / "gold24.db")
    rng = random.Random(int(os.environ.get("GOLD24_SEED", "20260828")))
    batch_size = int(os.environ.get("GOLD24_BATCH_SIZE", "32"))
    flat_lot = float(os.environ.get("GOLD24_FLAT_LOT", "1.0"))
    timeframe = os.environ.get("GOLD24_TIMEFRAME", "D1")
    dataset_path = os.environ.get("GOLD24_DATASET", "")
    crosscheck = os.environ.get("GOLD24_CROSSCHECK", "")

    if args.self_test:
        from selftest import run_selftest
        run_selftest()
        return

    batch = 0
    while not STOP:
        batch += 1
        started = time.time()
        try:
            d, audit = audit_dataset(dataset_path, crosscheck, timeframe)
        except Exception as e:
            atomic_json(status_path, {
                "worker": "RUNNING_FAIL_CLOSED",
                "strategy_engine": "PAUSED",
                "gate_a": "BLOCKED",
                "reason": str(e),
                "rules_sha256": "6b7fc2920b48a5db18a3fd63e9c4afd4f0281c84003a4e6ebe141b275110b07e",
                "updated_at": pd.Timestamp.now(tz="UTC").isoformat(),
            })
            if args.once:
                return
            time.sleep(60)
            continue

        accepted = []
        rejected_pre = 0
        trials = 0
        max_trials = batch_size * 100
        while len(accepted) < batch_size and trials < max_trials:
            trials += 1
            c = generate_candidate(rng, timeframe)
            if db.seen(c.config_hash) or not db.novelty_ok(c):
                rejected_pre += 1
                continue
            accepted.append(c)
        if not accepted:
            atomic_json(status_path, {"worker":"RUNNING", "strategy_engine":"SATURATED", "gate_a":"PASS", "batch":batch, "rejected_pre":rejected_pre, "updated_at":pd.Timestamp.now(tz="UTC").isoformat()})
            if args.once:
                return
            time.sleep(1)
            continue

        ledger_rows = []
        results = []
        for c in accepted:
            r = backtest_candidate(d, c, flat_lot=flat_lot)
            results.append(r)
            ledger_rows.extend(r["ledger"])

        shard = ledgers / f"ledger_{pd.Timestamp.utcnow().strftime('%Y%m%dT%H%M%S')}_{batch:08d}.parquet"
        pd.DataFrame(ledger_rows).to_parquet(shard, index=False)

        counted = 0
        exec_dupes = 0
        for r in results:
            has_trades = r["metrics"].get("trades", 0) > 0
            unique_exec = bool(r["execution_hash"]) and not db.execution_seen(r["execution_hash"])
            full_metrics = bool(r["metrics"].get("full_metrics_pass"))
            eligible = has_trades and unique_exec and full_metrics
            if has_trades and not unique_exec:
                exec_dupes += 1
            db.insert_result(r, str(shard), eligible)
            counted += int(eligible)

        top = select_top100(db, len(d))
        db.replace_portfolio([x["config_hash"] for x in top])

        google_status = "DISABLED"
        try:
            from sync import GoogleSync
            gs = GoogleSync()
            for x in top:
                x["period"] = f"{audit['start_utc']} → {audit['end_utc']}"
                x["execution_hash"] = next((r["execution_hash"] for r in results if r["config_hash"] == x["config_hash"]), "")
            gs.update_top100(top)
            if os.environ.get("GOLD24_UPLOAD_EVERY_BATCH", "1") == "1":
                gs.upload_checkpoint(shard)
                gs.upload_checkpoint(root / "gold24.db", f"gold24_{batch:08d}.db")
            google_status = "PASS"
        except Exception as e:
            google_status = f"BLOCKED: {e}"

        atomic_json(status_path, {
            "worker": "RUNNING",
            "strategy_engine": "RUNNING",
            "gate_a": "PASS",
            "dataset_audit": audit,
            "batch": batch,
            "raw_trials": trials,
            "preengine_rejects": rejected_pre,
            "simulated": len(results),
            "new_full_metric_unique": counted,
            "execution_duplicate_archived": exec_dupes,
            "top100_count": len(top),
            "portfolio_required_coverage": bool(top and top[0].get("portfolio_coverage_complete")),
            "google_sync": google_status,
            "ledger_shard": str(shard),
            "seconds": time.time() - started,
            "updated_at": pd.Timestamp.now(tz="UTC").isoformat(),
        })
        if args.once:
            return

    db.close()

if __name__ == "__main__":
    main()
