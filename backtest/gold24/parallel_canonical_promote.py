from __future__ import annotations

import argparse
import json
import sqlite3
import time
from pathlib import Path

import pandas as pd

from core import Candidate, validate_candidate
from store import Store
from v11_runner import (
    POLICY,
    PF_MAX,
    PF_TARGET,
    atomic_json,
    execution_profile_v11,
    minimum_trades,
    rules_sha256,
    write_rankings,
)

SHARD_SCHEMA = "gold-v11-parallel-search-probe-shard-v1"
SHARD_CLASSIFICATION = "NON_CANONICAL_SIMULATION_PROBE_NO_PROMOTION"
PROMOTION_SCHEMA = "gold-v11-parallel-canonical-promotion-v1"
LEDGER_COLS = [
    "config_hash", "fingerprint", "family", "entry_time", "exit_time", "entry_bar", "exit_bar",
    "side", "pending_order", "entry_price", "exit_price", "fixed_sl", "fixed_tp", "quantity",
    "gross_pnl", "cost", "net_pnl", "exit_reason",
]


def _load_shards(input_root: Path, expected_shards: int) -> list[dict]:
    files = sorted(input_root.rglob("shard_*.json"))
    if len(files) != expected_shards:
        raise RuntimeError(f"expected {expected_shards} shard files, found {len(files)}")
    shards = [json.loads(p.read_text(encoding="utf-8")) for p in files]
    indexes = sorted(int(x.get("shard_index", -1)) for x in shards)
    if indexes != list(range(expected_shards)):
        raise RuntimeError(f"invalid shard indexes: {indexes}")
    return shards


def _rebase_ledger_paths(store: Store, root: Path) -> int:
    rows = store.db.execute("SELECT config_hash,ledger_path FROM configs WHERE ledger_path IS NOT NULL AND ledger_path != ''").fetchall()
    changed = 0
    for config_hash, raw in rows:
        p = Path(str(raw))
        if p.exists():
            continue
        candidate = root / "ledgers_v11" / p.name
        if not candidate.exists():
            raise RuntimeError(f"baseline ledger missing for {config_hash}: {raw}")
        store.db.execute("UPDATE configs SET ledger_path=? WHERE config_hash=?", (str(candidate), config_hash))
        changed += 1
    if changed:
        store.db.commit()
    return changed


def promote(args: argparse.Namespace) -> None:
    started = time.perf_counter()
    root = Path(args.state_root).resolve()
    input_root = Path(args.input_root).resolve()
    db_path = root / "gold24-v11.db"
    if not db_path.exists():
        raise RuntimeError(f"canonical store missing: {db_path}")

    shards = _load_shards(input_root, args.expected_shards)
    expected_rules = rules_sha256()
    expected_end = int(args.source_cursor) + int(args.raw_count)

    for shard in shards:
        if shard.get("schema") != SHARD_SCHEMA:
            raise RuntimeError("shard schema mismatch")
        if shard.get("classification") != SHARD_CLASSIFICATION:
            raise RuntimeError("shard classification mismatch")
        if shard.get("policy") != POLICY or shard.get("rules_sha256") != expected_rules:
            raise RuntimeError("policy/rules mismatch")
        if shard.get("gate_a") != "PASS":
            raise RuntimeError("Gate A mismatch")
        if bool(shard.get("authoritative")) or bool(shard.get("promotion_enabled")) or bool(shard.get("canonical_state_mutation")):
            raise RuntimeError("worker shard attempted canonical mutation")
        if str(shard.get("source_run_id")) != str(args.source_run_id):
            raise RuntimeError("source run mismatch")
        if int(shard.get("source_batch", -1)) != int(args.source_batch):
            raise RuntimeError("source batch mismatch")
        if int(shard.get("source_candidate_cursor", -1)) != int(args.source_cursor):
            raise RuntimeError("source cursor mismatch")
        if int(shard.get("global_start_cursor", -1)) != int(args.source_cursor):
            raise RuntimeError("global start mismatch")
        if int(shard.get("global_raw_count", -1)) != int(args.raw_count):
            raise RuntimeError("raw range mismatch")
        if int(shard.get("shard_count", -1)) != int(args.expected_shards):
            raise RuntimeError("shard count mismatch")
        if not bool(shard.get("scan_exhausted_global_range")):
            raise RuntimeError(f"shard {shard.get('shard_index')} did not exhaust its assigned cursor range")

    store = Store(db_path)
    source_cursor_db = int(store.get_state("candidate_cursor", -1))
    source_batch_db = int(store.get_state("batch", -1))
    if source_cursor_db != int(args.source_cursor) or source_batch_db != int(args.source_batch):
        store.close()
        raise RuntimeError(
            f"STALE_SOURCE_FAIL: db batch/cursor={source_batch_db}/{source_cursor_db}, expected={args.source_batch}/{args.source_cursor}"
        )
    archived_before = int(store.db.execute("SELECT COUNT(*) FROM configs").fetchone()[0])
    if args.source_archived is not None and archived_before != int(args.source_archived):
        store.close()
        raise RuntimeError(f"source archive mismatch: db={archived_before}, expected={args.source_archived}")

    rebased_paths = _rebase_ledger_paths(store, root)

    records: list[dict] = []
    ownership_seen: set[int] = set()
    for shard in shards:
        idx = int(shard["shard_index"])
        for row in shard.get("records", []):
            cursor = int(row["cursor"])
            if cursor < int(args.source_cursor) or cursor >= expected_end:
                raise RuntimeError(f"cursor outside frozen range: {cursor}")
            if (cursor - int(args.source_cursor)) % int(args.expected_shards) != idx:
                raise RuntimeError(f"cursor ownership mismatch shard={idx} cursor={cursor}")
            if cursor in ownership_seen:
                raise RuntimeError(f"duplicate simulated cursor: {cursor}")
            ownership_seen.add(cursor)
            c = Candidate(**row["candidate"])
            validate_candidate(c)
            if c.config_hash != str(row.get("config_hash")):
                raise RuntimeError("config hash mismatch")
            expected_profile = execution_profile_v11(c.canonical_dict())
            if expected_profile != str(row.get("fingerprint")):
                raise RuntimeError("execution profile mismatch")
            metrics = dict(row.get("metrics") or {})
            if metrics.get("goal_policy") != POLICY:
                raise RuntimeError("result metrics policy mismatch")
            records.append(row)

    records.sort(key=lambda r: (int(r["cursor"]), str(r["config_hash"])))

    ledgers_dir = root / "ledgers_v11"
    receipts_dir = root / "receipts_v11"
    ledgers_dir.mkdir(parents=True, exist_ok=True)
    receipts_dir.mkdir(parents=True, exist_ok=True)
    new_batch = int(args.source_batch) + 1
    ledger_path = ledgers_dir / f"ledger_parallel_{new_batch:08d}.parquet"
    ledger_rows = [ledger for row in records for ledger in row.get("ledger", [])]
    pd.DataFrame(ledger_rows, columns=LEDGER_COLS).to_parquet(ledger_path, index=False)

    novelty_rejected_central = 0
    exact_dupes = 0
    zero_trade = 0
    baseline_pass = 0
    target_pass = 0
    archived_added = 0
    receipt_rows: list[dict] = []

    for row in records:
        c = Candidate(**row["candidate"])
        if store.seen(str(row["config_hash"])) or not store.novelty_ok(c):
            novelty_rejected_central += 1
            continue

        result = {
            "candidate": c.canonical_dict(),
            "config_hash": str(row["config_hash"]),
            "fingerprint": str(row["fingerprint"]),
            "execution_hash": str(row.get("execution_hash") or ""),
            "metrics": dict(row.get("metrics") or {}),
            "ledger": list(row.get("ledger") or []),
        }
        trades = int(result["metrics"].get("trades", 0) or 0)
        zero_trade += int(trades == 0)
        exact_duplicate = bool(trades > 0 and store.exact_execution_duplicate(result))
        result["metrics"]["exact_execution_duplicate"] = exact_duplicate
        exact_dupes += int(exact_duplicate)
        baseline = bool(result["metrics"].get("baseline_qualified_v11")) and not exact_duplicate
        target = bool(result["metrics"].get("target_candidate_v11")) and not exact_duplicate
        baseline_pass += int(baseline)
        target_pass += int(target)
        store.insert_result(result, str(ledger_path), baseline)
        archived_added += 1
        receipt_rows.append({
            "cursor": int(row["cursor"]),
            "config_hash": result["config_hash"],
            "execution_hash": result["execution_hash"],
            "execution_profile_v11": result["fingerprint"],
            "trades": trades,
            "profit_factor_net": result["metrics"].get("profit_factor_net", 0.0),
            "net_profit": result["metrics"].get("net_profit", 0.0),
            "net_expectancy": result["metrics"].get("net_expectancy", 0.0),
            "max_dd_pct": result["metrics"].get("max_dd_pct", 0.0),
            "baseline_qualified_v11": baseline,
            "target_candidate_v11": target,
            "exact_execution_duplicate": exact_duplicate,
        })

    store.set_state("candidate_cursor", expected_end)
    store.set_state("batch", new_batch)

    audit_path = root / "STRICT_GATE_A_AUDIT.json"
    if not audit_path.exists():
        store.close()
        raise RuntimeError("STRICT_GATE_A_AUDIT.json missing from canonical state")
    audit = json.loads(audit_path.read_text(encoding="utf-8"))
    if audit.get("gate_a") != "PASS":
        store.close()
        raise RuntimeError("Strict Gate A is not PASS")

    rankable_count, qualified_total, targets_total = write_rankings(root, store, audit, args.timeframe)
    total_configs = int(store.db.execute("SELECT COUNT(*) FROM configs").fetchone()[0])
    with_trades = int(store.db.execute(
        "SELECT COUNT(*) FROM configs WHERE CAST(json_extract(metrics_json,'$.trades') AS INTEGER) > 0"
    ).fetchone()[0])
    hash_rows = [r[0] for r in store.db.execute("SELECT execution_hash FROM configs WHERE execution_hash IS NOT NULL AND execution_hash != ''").fetchall()]
    exact_total = int(store.db.execute(
        "SELECT COUNT(*) FROM configs WHERE json_extract(metrics_json,'$.exact_execution_duplicate') = 1"
    ).fetchone()[0])

    slowest_worker = max(float(x.get("elapsed_seconds", 0.0) or 0.0) for x in shards)
    worker_elapsed_sum = sum(float(x.get("elapsed_seconds", 0.0) or 0.0) for x in shards)
    raw_scanned = sum(int(x.get("raw_cursor_scanned", 0) or 0) for x in shards)
    simulated_total = sum(int(x.get("simulated_candidates", 0) or 0) for x in shards)
    elapsed = max(time.perf_counter() - started, 1e-9)

    receipt = {
        "schema": "gold-v11-parallel-batch-receipt-v1",
        "policy": POLICY,
        "rules_sha256": expected_rules,
        "authoritative": True,
        "parallel_workers": int(args.expected_shards),
        "source_run_id": str(args.source_run_id),
        "source_batch": int(args.source_batch),
        "source_candidate_cursor": int(args.source_cursor),
        "batch": new_batch,
        "candidate_cursor": expected_end,
        "raw_cursor_range": int(args.raw_count),
        "raw_cursor_scanned_across_shards": raw_scanned,
        "all_shards_exhausted_assigned_range": True,
        "simulated_by_workers": simulated_total,
        "archived_this_batch": archived_added,
        "central_novelty_rejected_after_simulation": novelty_rejected_central,
        "zero_trade_configs": zero_trade,
        "exact_execution_duplicates_archived": exact_dupes,
        "baseline_qualified_this_batch": baseline_pass,
        "target_pf_2_to_8_this_batch": target_pass,
        "cumulative_configs_archived": total_configs,
        "cumulative_configs_with_trades": with_trades,
        "cumulative_sample_rankable": rankable_count,
        "cumulative_baseline_qualified": qualified_total,
        "cumulative_target_pf_2_to_8": targets_total,
        "cumulative_exact_execution_duplicates": exact_total,
        "execution_hash_nonzero": len(hash_rows),
        "execution_hash_unique": len(set(hash_rows)),
        "worker_elapsed_seconds_sum": worker_elapsed_sum,
        "slowest_worker_elapsed_seconds": slowest_worker,
        "estimated_parallel_speedup_vs_worker_sum": worker_elapsed_sum / slowest_worker if slowest_worker > 0 else 0.0,
        "central_promotion_seconds": elapsed,
        "ledger_shard": str(ledger_path),
        "ledger_paths_rebased": rebased_paths,
        "configs": receipt_rows,
        "updated_at": pd.Timestamp.now(tz="UTC").isoformat(),
    }
    atomic_json(receipts_dir / f"batch_{new_batch:08d}.json", receipt)

    status = {
        "schema": "gold-v11-status",
        "worker": "GOLD_V11_PARALLEL_CANONICAL_20",
        "worker_mode": "20_SHARDS_SINGLE_WRITER_PROMOTION",
        "parallel_workers": int(args.expected_shards),
        "authoritative": True,
        "policy": POLICY,
        "strategy_engine": "RUNNING",
        "gate_a": "PASS",
        "rules_sha256": expected_rules,
        "timeframe": args.timeframe,
        "batch": new_batch,
        "candidate_cursor": expected_end,
        "raw_cursor_range": int(args.raw_count),
        "simulated_this_batch": archived_added,
        "simulated_by_workers_before_central_novelty": simulated_total,
        "cumulative_configs_archived": total_configs,
        "cumulative_sample_rankable": rankable_count,
        "cumulative_baseline_qualified": qualified_total,
        "cumulative_target_pf_2_to_8": targets_total,
        "ranking_rule": "minimum trades first; then NET Profit Factor descending",
        "minimum_trades": minimum_trades(args.timeframe),
        "pf_target_min": PF_TARGET,
        "pf_max": PF_MAX,
        "simulation_executed": True,
        "global_exact_ledger_dedupe_executed": True,
        "single_writer_promotion": True,
        "updated_at": pd.Timestamp.now(tz="UTC").isoformat(),
    }
    atomic_json(root / "status_v11.json", status)

    proof = {
        "schema": PROMOTION_SCHEMA,
        "status": "PASS",
        "authoritative": True,
        "promotion_enabled": True,
        "canonical_state_mutation": True,
        "single_writer_promotion": True,
        "global_exact_ledger_dedupe_executed": True,
        "parallel_workers": int(args.expected_shards),
        "source_run_id": str(args.source_run_id),
        "source_batch": int(args.source_batch),
        "source_candidate_cursor": int(args.source_cursor),
        "promoted_batch": new_batch,
        "promoted_candidate_cursor": expected_end,
        "raw_cursor_range": int(args.raw_count),
        "raw_cursor_scanned_across_shards": raw_scanned,
        "simulated_by_workers": simulated_total,
        "archived_added": archived_added,
        "archived_before": archived_before,
        "archived_after": total_configs,
        "central_novelty_rejected_after_simulation": novelty_rejected_central,
        "exact_execution_duplicates_archived_this_batch": exact_dupes,
        "cumulative_exact_execution_duplicates": exact_total,
        "cumulative_sample_rankable": rankable_count,
        "cumulative_baseline_qualified": qualified_total,
        "cumulative_target_pf_2_to_8": targets_total,
        "worker_elapsed_seconds_sum": worker_elapsed_sum,
        "slowest_worker_elapsed_seconds": slowest_worker,
        "estimated_parallel_speedup_vs_worker_sum": worker_elapsed_sum / slowest_worker if slowest_worker > 0 else 0.0,
        "rules_sha256": expected_rules,
        "policy": POLICY,
    }
    atomic_json(root / "PARALLEL_CANONICAL_PROMOTION_V11.json", proof)
    store.close()
    print(json.dumps(proof, indent=2, sort_keys=True))


def selftest() -> None:
    start = 1000
    count = 4000
    workers = 20
    ownership = {i: [] for i in range(workers)}
    for cursor in range(start, start + count):
        ownership[(cursor - start) % workers].append(cursor)
    merged = sorted(x for rows in ownership.values() for x in rows)
    assert merged == list(range(start, start + count))
    assert len(set(merged)) == count
    a = Store._canonical_ledger_records(pd.DataFrame([{"entry_bar": 1, "exit_bar": 2, "net_pnl": 3.0}]))
    b = Store._canonical_ledger_records(pd.DataFrame([{"entry_bar": 1, "exit_bar": 2, "net_pnl": 3.0}]))
    assert a == b
    print("parallel_canonical_promote selftest: PASS")


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="command", required=True)
    sub.add_parser("selftest")
    p = sub.add_parser("promote")
    p.add_argument("--input-root", required=True)
    p.add_argument("--state-root", required=True)
    p.add_argument("--expected-shards", type=int, default=20)
    p.add_argument("--source-run-id", required=True)
    p.add_argument("--source-batch", type=int, required=True)
    p.add_argument("--source-cursor", type=int, required=True)
    p.add_argument("--source-archived", type=int)
    p.add_argument("--raw-count", type=int, required=True)
    p.add_argument("--timeframe", default="D1")
    args = ap.parse_args()
    if args.command == "selftest":
        selftest()
    else:
        promote(args)


if __name__ == "__main__":
    main()
