from __future__ import annotations

import argparse
import json
import random
import sqlite3
import time
from pathlib import Path

import pandas as pd

from core import Candidate, audit_dataset, backtest_candidate, novelty_pass
from store import Store
from v11_runner import POLICY, evaluate_v11_metrics, execution_profile_v11, generate_v11_candidate, rules_sha256

SCHEMA_SHARD = "gold-v11-parallel-search-probe-shard-v1"
SCHEMA_AGG = "gold-v11-parallel-search-probe-aggregate-v1"
CLASSIFICATION = "NON_CANONICAL_SIMULATION_PROBE_NO_PROMOTION"


def atomic_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, sort_keys=True, default=str), encoding="utf-8")
    tmp.replace(path)


def baseline_index(db_path: Path) -> tuple[set[str], dict[str, list[Candidate]]]:
    db = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    rows = db.execute("SELECT config_hash,family,canonical_json FROM configs").fetchall()
    db.close()
    seen: set[str] = set()
    by_family: dict[str, list[Candidate]] = {}
    for config_hash, family, raw in rows:
        seen.add(str(config_hash))
        by_family.setdefault(str(family), []).append(Candidate(**json.loads(raw)))
    return seen, by_family


def run_shard(args: argparse.Namespace) -> None:
    if args.shard_count < 1 or not 0 <= args.shard_index < args.shard_count:
        raise SystemExit("invalid shard index/count")
    if args.raw_count < 1 or args.max_simulations < 1:
        raise SystemExit("raw_count and max_simulations must be positive")

    d, audit = audit_dataset(args.dataset, args.crosscheck, args.timeframe)
    if audit.get("gate_a") != "PASS":
        raise SystemExit("Gate A failed")
    seen, prior_by_family = baseline_index(Path(args.baseline_db))

    global_end = int(args.start_cursor) + int(args.raw_count)
    cursor = int(args.start_cursor) + int(args.shard_index)
    scanned = 0
    rejected_seen = 0
    rejected_novelty = 0
    records: list[dict] = []
    started = time.perf_counter()

    while cursor < global_end and len(records) < args.max_simulations:
        scanned += 1
        rng = random.Random(cursor)
        candidate = generate_v11_candidate(rng, args.timeframe)
        current_cursor = cursor
        cursor += args.shard_count

        if candidate.config_hash in seen:
            rejected_seen += 1
            continue
        priors = prior_by_family.get(candidate.family, [])
        if not all(novelty_pass(candidate, prior) for prior in priors):
            rejected_novelty += 1
            continue

        result = backtest_candidate(d, candidate, flat_lot=args.flat_lot)
        profile = execution_profile_v11(result["candidate"])
        result["fingerprint"] = profile
        for row in result.get("ledger", []):
            row["fingerprint"] = profile
        result["metrics"].update(
            evaluate_v11_metrics(result["metrics"], args.timeframe, result.get("ledger", []), candidate.family)
        )
        records.append({
            "cursor": current_cursor,
            "config_hash": result["config_hash"],
            "candidate": result["candidate"],
            "fingerprint": profile,
            "execution_hash": result.get("execution_hash", ""),
            "metrics": result.get("metrics", {}),
            "ledger": result.get("ledger", []),
        })

    elapsed = max(time.perf_counter() - started, 1e-9)
    payload = {
        "schema": SCHEMA_SHARD,
        "classification": CLASSIFICATION,
        "policy": POLICY,
        "rules_sha256": rules_sha256(),
        "authoritative": False,
        "promotion_enabled": False,
        "canonical_state_mutation": False,
        "counter_increment": 0,
        "source_run_id": str(args.source_run_id),
        "source_batch": int(args.source_batch),
        "source_candidate_cursor": int(args.source_candidate_cursor),
        "timeframe": args.timeframe,
        "gate_a": "PASS",
        "shard_index": int(args.shard_index),
        "shard_count": int(args.shard_count),
        "global_start_cursor": int(args.start_cursor),
        "global_raw_count": int(args.raw_count),
        "owned_cursor_rule": "start+shard_index+k*shard_count",
        "raw_cursor_scanned": scanned,
        "rejected_seen_baseline": rejected_seen,
        "rejected_novelty_baseline": rejected_novelty,
        "simulated_candidates": len(records),
        "max_simulations": int(args.max_simulations),
        "scan_exhausted_global_range": cursor >= global_end,
        "elapsed_seconds": elapsed,
        "raw_cursors_per_second": scanned / elapsed,
        "simulations_per_second": len(records) / elapsed,
        "records": records,
    }
    atomic_json(Path(args.out), payload)
    print(json.dumps({k: v for k, v in payload.items() if k != "records"}, indent=2, sort_keys=True))


def canonical_ledger_records(rows: list[dict]) -> list[dict]:
    return Store._canonical_ledger_records(pd.DataFrame(rows))


def run_aggregate(args: argparse.Namespace) -> None:
    files = sorted(Path(args.input_root).rglob("shard_*.json"))
    if len(files) != args.expected_shards:
        raise SystemExit(f"expected {args.expected_shards} shard files, found {len(files)}")
    shards = [json.loads(p.read_text(encoding="utf-8")) for p in files]
    indexes = sorted(int(x["shard_index"]) for x in shards)
    if indexes != list(range(args.expected_shards)):
        raise SystemExit(f"invalid shard indexes: {indexes}")

    policy_set = {x.get("policy") for x in shards}
    rules_set = {x.get("rules_sha256") for x in shards}
    source_runs = {str(x.get("source_run_id")) for x in shards}
    source_batches = {int(x.get("source_batch", -1)) for x in shards}
    source_cursors = {int(x.get("source_candidate_cursor", -1)) for x in shards}
    if policy_set != {POLICY} or len(rules_set) != 1 or len(source_runs) != 1 or len(source_batches) != 1 or len(source_cursors) != 1:
        raise SystemExit("frozen source/policy mismatch across shards")
    if any(x.get("classification") != CLASSIFICATION or x.get("gate_a") != "PASS" for x in shards):
        raise SystemExit("shard governance/Gate A mismatch")
    if any(bool(x.get("authoritative")) or bool(x.get("promotion_enabled")) or bool(x.get("canonical_state_mutation")) or int(x.get("counter_increment", 0)) != 0 for x in shards):
        raise SystemExit("probe attempted canonical mutation/promotion")

    rows: list[dict] = []
    for shard in shards:
        idx = int(shard["shard_index"])
        count = int(shard["shard_count"])
        start = int(shard["global_start_cursor"])
        for row in shard.get("records", []):
            cursor = int(row["cursor"])
            if (cursor - start) % count != idx:
                raise SystemExit(f"cursor ownership mismatch shard={idx} cursor={cursor}")
            rows.append(row)
    rows.sort(key=lambda r: (int(r["cursor"]), str(r.get("config_hash", ""))))
    cursors = [int(r["cursor"]) for r in rows]
    overlap = len(cursors) - len(set(cursors))
    if overlap:
        raise SystemExit(f"simulated cursor overlap: {overlap}")

    baseline = Store(args.baseline_db)
    accepted_by_family: dict[str, list[Candidate]] = {}
    by_execution: dict[str, list[tuple[str, list[dict]]]] = {}
    globally_novel = []
    config_seen_baseline = 0
    novelty_rejected_global = 0
    exact_duplicate_baseline = 0
    exact_duplicate_cross_shard = 0
    execution_unique = 0

    for row in rows:
        c = Candidate(**row["candidate"])
        if baseline.seen(row["config_hash"]):
            config_seen_baseline += 1
            continue
        if not baseline.novelty_ok(c):
            novelty_rejected_global += 1
            continue
        if any(not novelty_pass(c, prior) for prior in accepted_by_family.get(c.family, [])):
            novelty_rejected_global += 1
            continue
        accepted_by_family.setdefault(c.family, []).append(c)
        globally_novel.append(row)

        ledger = row.get("ledger", [])
        baseline_dup = bool(ledger and baseline.exact_execution_duplicate(row))
        if baseline_dup:
            exact_duplicate_baseline += 1
            continue
        execution_hash = str(row.get("execution_hash") or "")
        current = canonical_ledger_records(ledger)
        cross_dup = False
        if execution_hash and current:
            for _, prior in by_execution.get(execution_hash, []):
                if current == prior:
                    cross_dup = True
                    break
        if cross_dup:
            exact_duplicate_cross_shard += 1
            continue
        if execution_hash and current:
            by_execution.setdefault(execution_hash, []).append((str(row["config_hash"]), current))
        execution_unique += 1

    baseline.close()
    elapsed_sum = sum(float(x.get("elapsed_seconds", 0.0) or 0.0) for x in shards)
    slowest = max((float(x.get("elapsed_seconds", 0.0) or 0.0) for x in shards), default=0.0)
    proof = {
        "schema": SCHEMA_AGG,
        "classification": CLASSIFICATION,
        "status": "PASS",
        "policy": POLICY,
        "rules_sha256": next(iter(rules_set)),
        "source_run_id": next(iter(source_runs)),
        "source_batch": next(iter(source_batches)),
        "source_candidate_cursor": next(iter(source_cursors)),
        "parallel_workers": args.expected_shards,
        "all_shards_gate_a_pass": True,
        "simulated_cursor_overlap_count": overlap,
        "simulated_candidates_total": len(rows),
        "globally_novel_after_central_filter": len(globally_novel),
        "config_seen_baseline": config_seen_baseline,
        "novelty_rejected_central": novelty_rejected_global,
        "exact_execution_duplicate_vs_baseline": exact_duplicate_baseline,
        "exact_execution_duplicate_cross_shard": exact_duplicate_cross_shard,
        "execution_unique_probe_candidates": execution_unique,
        "global_exact_ledger_dedupe_executed": True,
        "worker_elapsed_seconds_sum": elapsed_sum,
        "slowest_worker_elapsed_seconds": slowest,
        "estimated_parallel_speedup_vs_worker_sum": elapsed_sum / slowest if slowest > 0 else 0.0,
        "authoritative": False,
        "promotion_enabled": False,
        "canonical_state_mutation": False,
        "counter_increment": 0,
        "candidate_cursor_advance_allowed": False,
        "promotion_status": "BLOCKED_UNTIL_SINGLE_WRITER_MERGE_AND_READBACK",
        "remaining_promotion_gate": [
            "merge globally accepted probe evidence into one restored canonical store",
            "archive exact duplicates while counting only eligible unique results",
            "write deterministic batch receipts/rankings from merged authority",
            "publish atomic canonical artifact/runtime proof",
            "read back the published run before counters may advance",
        ],
        "shards": [{
            "shard_index": int(x["shard_index"]),
            "raw_cursor_scanned": int(x["raw_cursor_scanned"]),
            "simulated_candidates": int(x["simulated_candidates"]),
            "elapsed_seconds": float(x["elapsed_seconds"]),
        } for x in sorted(shards, key=lambda x: int(x["shard_index"]))],
    }
    atomic_json(Path(args.out), proof)
    print(json.dumps(proof, indent=2, sort_keys=True))


def selftest() -> None:
    a = [{"entry_bar": 1, "exit_bar": 2, "net_pnl": 3.0}]
    b = [{"entry_bar": 1, "exit_bar": 2, "net_pnl": 3.0}]
    c = [{"entry_bar": 1, "exit_bar": 3, "net_pnl": 3.0}]
    assert canonical_ledger_records(a) == canonical_ledger_records(b)
    assert canonical_ledger_records(a) != canonical_ledger_records(c)
    print("parallel_search_probe selftest: PASS")


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="command", required=True)
    sub.add_parser("selftest")

    shard = sub.add_parser("shard")
    shard.add_argument("--baseline-db", required=True)
    shard.add_argument("--dataset", required=True)
    shard.add_argument("--crosscheck", required=True)
    shard.add_argument("--timeframe", default="D1")
    shard.add_argument("--flat-lot", type=float, default=1.0)
    shard.add_argument("--start-cursor", type=int, required=True)
    shard.add_argument("--raw-count", type=int, default=200000)
    shard.add_argument("--shard-index", type=int, required=True)
    shard.add_argument("--shard-count", type=int, default=20)
    shard.add_argument("--max-simulations", type=int, default=8)
    shard.add_argument("--source-run-id", required=True)
    shard.add_argument("--source-batch", type=int, required=True)
    shard.add_argument("--source-candidate-cursor", type=int, required=True)
    shard.add_argument("--out", required=True)

    agg = sub.add_parser("aggregate")
    agg.add_argument("--input-root", required=True)
    agg.add_argument("--baseline-db", required=True)
    agg.add_argument("--expected-shards", type=int, default=20)
    agg.add_argument("--out", required=True)

    args = ap.parse_args()
    if args.command == "selftest":
        selftest()
    elif args.command == "shard":
        run_shard(args)
    else:
        run_aggregate(args)


if __name__ == "__main__":
    main()
