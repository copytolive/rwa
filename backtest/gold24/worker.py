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

from core import (
    REQUIRED_PORTFOLIO_FAMILIES,
    audit_dataset,
    backtest_candidate,
    generate_candidate,
    novelty_pass,
    pearson_log_equity,
)
from store import Store

STOP = False
RULES_SHA256 = "6b7fc2920b48a5db18a3fd63e9c4afd4f0281c84003a4e6ebe141b275110b07e"


def _stop(*_):
    global STOP
    STOP = True


signal.signal(signal.SIGTERM, _stop)
signal.signal(signal.SIGINT, _stop)


def atomic_json(path: Path, data: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True, default=str))
    tmp.replace(path)


def load_bar_pnl(ledger_path: str, config_hash: str, nrows: int) -> np.ndarray:
    """Reconstruct one config only, even when many configs share one ledger shard."""
    df = pd.read_parquet(ledger_path)
    if "config_hash" not in df.columns:
        raise RuntimeError("LEDGER_FAIL: config_hash missing from shard")
    df = df[df["config_hash"] == config_hash]
    arr = np.zeros(nrows, dtype=float)
    if not df.empty:
        g = df.groupby("exit_bar")["net_pnl"].sum()
        idx = g.index.to_numpy(int)
        if np.any(idx < 0) or np.any(idx >= nrows):
            raise RuntimeError("LEDGER_FAIL: exit_bar outside canonical dataset")
        arr[idx] = g.to_numpy(float)
    return arr


def _portfolio_family_cap_ok(selected: list[dict]) -> bool:
    if not selected:
        return True
    counts: dict[str, int] = {}
    for r in selected:
        fam = r["candidate"]["family"]
        counts[fam] = counts.get(fam, 0) + 1
    n = len(selected)
    return all(v / n <= 0.30 + 1e-12 for v in counts.values())


def select_top100(store: Store, nrows: int) -> list[dict]:
    """Greedy quality ranking with fail-closed portfolio-level diversification."""
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
    fp: set[str] = set()
    fam_counts: dict[str, int] = {}
    returns_cache: dict[str, np.ndarray] = {}

    # Required families are seeded first so an apparently high-quality monoculture
    # can never be published as a rules-compliant portfolio.
    ordered = []
    used = set()
    for required_family in sorted(REQUIRED_PORTFOLIO_FAMILIES):
        for r in rows:
            if r["candidate"]["family"] == required_family and r["config_hash"] not in used:
                ordered.append(r)
                used.add(r["config_hash"])
                break
    ordered.extend(r for r in rows if r["config_hash"] not in used)

    for r in ordered:
        if r["fingerprint"] in fp:
            continue
        fam = r["candidate"]["family"]
        bp = load_bar_pnl(r["ledger_path"], r["config_hash"], nrows)
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

        proposed_n = len(selected) + 1
        proposed_fam = fam_counts.get(fam, 0) + 1
        # Once enough rows exist to make the 30% cap meaningful, never worsen it.
        # Final publication below still verifies the exact cap globally.
        if proposed_n >= 5 and proposed_fam / proposed_n > 0.30:
            continue

        r["correlation_max"] = maxcorr
        r["rr"] = r["candidate"]["tp"] / r["candidate"]["sl"]
        selected.append(r)
        returns_cache[r["config_hash"]] = bp
        fp.add(r["fingerprint"])
        fam_counts[fam] = proposed_fam
        if len(selected) >= 100:
            break

    families = {x["candidate"]["family"] for x in selected}
    coverage = REQUIRED_PORTFOLIO_FAMILIES.issubset(families)
    cap_ok = _portfolio_family_cap_ok(selected)
    if not coverage or not cap_ok:
        # Fail closed: evidence remains in SQLite/Parquet, but TOP100_COMPLIANT stays empty.
        return []
    for x in selected:
        x["portfolio_coverage_complete"] = True
    return selected


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()

    # Self-test must be runnable on unprivileged CI hosts and must not touch /var/lib.
    if args.self_test:
        from selftest import run_selftest
        run_selftest()
        return

    root = Path(os.environ.get("GOLD24_STATE_DIR", "/var/lib/gold24"))
    root.mkdir(parents=True, exist_ok=True)
    ledgers = root / "ledgers"
    receipts = root / "receipts"
    checkpoints = root / "checkpoints"
    ledgers.mkdir(exist_ok=True)
    receipts.mkdir(exist_ok=True)
    checkpoints.mkdir(exist_ok=True)
    status_path = root / "status.json"
    db = Store(root / "gold24.db")
    base_seed = int(os.environ.get("GOLD24_SEED", "20260828"))
    candidate_cursor = int(db.get_state("candidate_cursor", base_seed))
    batch_size = int(os.environ.get("GOLD24_BATCH_SIZE", "32"))
    flat_lot = float(os.environ.get("GOLD24_FLAT_LOT", "1.0"))
    timeframe = os.environ.get("GOLD24_TIMEFRAME", "D1")
    dataset_path = os.environ.get("GOLD24_DATASET", "")
    crosscheck = os.environ.get("GOLD24_CROSSCHECK", "")

    batch = int(db.get_state("batch", 0))
    while not STOP:
        batch += 1
        started = time.time()
        try:
            d, audit = audit_dataset(dataset_path, crosscheck, timeframe)
        except Exception as e:
            atomic_json(
                status_path,
                {
                    "worker": "RUNNING_FAIL_CLOSED",
                    "strategy_engine": "PAUSED",
                    "gate_a": "BLOCKED",
                    "reason": str(e),
                    "rules_sha256": RULES_SHA256,
                    "candidate_cursor": candidate_cursor,
                    "updated_at": pd.Timestamp.now(tz="UTC").isoformat(),
                },
            )
            if args.once:
                db.close()
                return
            time.sleep(60)
            continue

        accepted = []
        rejected_pre = 0
        trials = 0
        max_trials = batch_size * 1000
        while len(accepted) < batch_size and trials < max_trials:
            trials += 1
            c = generate_candidate(random.Random(candidate_cursor), timeframe)
            candidate_cursor += 1
            if db.seen(c.config_hash):
                rejected_pre += 1
                continue
            if not db.novelty_ok(c):
                rejected_pre += 1
                continue
            if any(not novelty_pass(c, prior) for prior in accepted):
                rejected_pre += 1
                continue
            accepted.append(c)

        db.set_state("candidate_cursor", candidate_cursor)
        db.set_state("batch", batch)

        if not accepted:
            atomic_json(
                status_path,
                {
                    "worker": "RUNNING",
                    "strategy_engine": "SATURATED",
                    "gate_a": "PASS",
                    "batch": batch,
                    "candidate_cursor": candidate_cursor,
                    "rejected_pre": rejected_pre,
                    "updated_at": pd.Timestamp.now(tz="UTC").isoformat(),
                },
            )
            if args.once:
                db.close()
                return
            time.sleep(1)
            continue

        ledger_rows = []
        results = []
        for c in accepted:
            r = backtest_candidate(d, c, flat_lot=flat_lot)
            results.append(r)
            ledger_rows.extend(r["ledger"])

        shard = ledgers / f"ledger_{pd.Timestamp.now(tz='UTC').strftime('%Y%m%dT%H%M%S')}_{batch:08d}.parquet"
        ledger_columns = [
            "config_hash", "fingerprint", "family", "entry_time", "exit_time", "entry_bar", "exit_bar",
            "side", "pending_order", "entry_price", "exit_price", "fixed_sl", "fixed_tp", "quantity",
            "gross_pnl", "cost", "net_pnl", "exit_reason",
        ]
        pd.DataFrame(ledger_rows, columns=ledger_columns).to_parquet(shard, index=False)

        counted = 0
        exact_exec_dupes = 0
        per_config_receipt = []
        for r in results:
            has_trades = r["metrics"].get("trades", 0) > 0
            exact_duplicate = db.exact_execution_duplicate(r) if has_trades else False
            full_metrics = bool(r["metrics"].get("full_metrics_pass"))
            eligible = has_trades and not exact_duplicate and full_metrics
            if exact_duplicate:
                exact_exec_dupes += 1
            db.insert_result(r, str(shard), eligible)
            counted += int(eligible)
            per_config_receipt.append(
                {
                    "config_hash": r["config_hash"],
                    "fingerprint": r["fingerprint"],
                    "execution_hash": r["execution_hash"],
                    "trades": r["metrics"].get("trades", 0),
                    "exact_execution_duplicate": exact_duplicate,
                    "full_metrics_pass": full_metrics,
                    "eligible_precert": eligible,
                    "ledger_shard": str(shard),
                }
            )

        top = select_top100(db, len(d))
        correlations = {x["config_hash"]: x.get("correlation_max", 0.0) for x in top}
        db.replace_portfolio([x["config_hash"] for x in top], correlations)

        receipt_path = receipts / f"batch_{batch:08d}.json"
        atomic_json(
            receipt_path,
            {
                "schema": "gold24-batch-receipt-v2",
                "classification": "COMPLIANT_2026_PRECERT_NOT_VALIDATED",
                "rules_sha256": RULES_SHA256,
                "dataset_audit": audit,
                "batch": batch,
                "candidate_cursor_after": candidate_cursor,
                "raw_trials": trials,
                "preengine_rejects": rejected_pre,
                "simulated": len(results),
                "exact_execution_duplicates_archived": exact_exec_dupes,
                "new_full_metric_execution_unique": counted,
                "top100_count": len(top),
                "ledger_shard": str(shard),
                "configs": per_config_receipt,
            },
        )

        google_status = "DISABLED"
        try:
            from sync import GoogleSync

            gs = GoogleSync()
            for x in top:
                x["period"] = f"{audit['start_utc']} → {audit['end_utc']}"
            gs.update_top100(top)
            if os.environ.get("GOLD24_UPLOAD_EVERY_BATCH", "1") == "1":
                gs.upload_ledger(shard)
                gs.upload_receipt(receipt_path)
                snapshot = checkpoints / f"gold24_{batch:08d}.db"
                db.snapshot(snapshot)
                gs.upload_checkpoint(snapshot)
                gs.upload_checkpoint(status_path, f"status_{batch:08d}.json") if status_path.exists() else None
            google_status = "PASS"
        except Exception as e:
            google_status = f"BLOCKED: {e}"

        atomic_json(
            status_path,
            {
                "worker": "RUNNING",
                "strategy_engine": "RUNNING",
                "gate_a": "PASS",
                "classification": "COMPLIANT_2026_PRECERT_NOT_VALIDATED",
                "dataset_audit": audit,
                "batch": batch,
                "candidate_cursor": candidate_cursor,
                "raw_trials": trials,
                "preengine_rejects": rejected_pre,
                "simulated": len(results),
                "new_full_metric_execution_unique": counted,
                "exact_execution_duplicate_archived": exact_exec_dupes,
                "top100_count": len(top),
                "portfolio_required_coverage": bool(top),
                "google_sync": google_status,
                "ledger_shard": str(shard),
                "receipt": str(receipt_path),
                "seconds": time.time() - started,
                "updated_at": pd.Timestamp.now(tz="UTC").isoformat(),
            },
        )
        if args.once:
            db.close()
            return

    db.close()


if __name__ == "__main__":
    main()
