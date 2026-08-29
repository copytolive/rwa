from __future__ import annotations

import argparse
import hashlib
import json
import random
import tempfile
from pathlib import Path

from core import Candidate, audit_dataset, backtest_candidate, novelty_pass
from store import Store
from v11_runner import (
    POLICY,
    evaluate_v11_metrics,
    execution_profile_v11,
    generate_v11_candidate,
    rules_sha256,
)

SCHEMA = "gold24-v11-parallel-parity-v1"
MODE = "NON_AUTHORITATIVE_PARITY_PROOF"


def atomic_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, sort_keys=True, default=str))
    tmp.replace(path)


def stable_hash(payload) -> str:
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode()
    return hashlib.sha256(raw).hexdigest()


def load_state_cursor(db: Store) -> tuple[int, int]:
    cursor = int(db.get_state("candidate_cursor", 20260828))
    batch = int(db.get_state("batch", 0))
    return cursor, batch


def plan_candidates(
    state_dir: Path,
    dataset: Path,
    receipt: Path,
    accepted_count: int,
    timeframe: str,
    output: Path,
) -> dict:
    if accepted_count <= 0:
        raise ValueError("accepted_count must be > 0")
    _, audit = audit_dataset(dataset, receipt, timeframe)
    if audit.get("gate_a") != "PASS":
        raise RuntimeError("GATE_A_FAIL")

    db = Store(state_dir / "gold24-v11.db")
    try:
        start_cursor, source_batch = load_state_cursor(db)
        cursor = start_cursor
        accepted: list[Candidate] = []
        trials = 0
        rejected_pre = 0
        max_trials = accepted_count * 2000
        while len(accepted) < accepted_count and trials < max_trials:
            trials += 1
            c = generate_v11_candidate(random.Random(cursor), timeframe)
            cursor += 1
            if db.seen(c.config_hash) or not db.novelty_ok(c):
                rejected_pre += 1
                continue
            if any(not novelty_pass(c, prior) for prior in accepted):
                rejected_pre += 1
                continue
            accepted.append(c)

        if len(accepted) != accepted_count:
            raise RuntimeError(
                f"PLANNER_SATURATED: wanted {accepted_count}, got {len(accepted)} after {trials} trials"
            )

        rows = [
            {
                "accepted_index": i,
                "seed_cursor": None,
                "config_hash": c.config_hash,
                "candidate": c.canonical_dict(),
            }
            for i, c in enumerate(accepted)
        ]
        # Recover the exact seed cursor for every accepted candidate without changing
        # the canonical acceptance semantics above. Candidate hash is deterministic.
        by_hash = {r["config_hash"]: r for r in rows}
        replay_cursor = start_cursor
        remaining = set(by_hash)
        while replay_cursor < cursor and remaining:
            c = generate_v11_candidate(random.Random(replay_cursor), timeframe)
            if c.config_hash in remaining:
                by_hash[c.config_hash]["seed_cursor"] = replay_cursor
                remaining.remove(c.config_hash)
            replay_cursor += 1
        if remaining:
            raise RuntimeError(f"SEED_RECOVERY_FAIL: {len(remaining)} accepted candidates missing seed cursor")

        payload = {
            "schema": SCHEMA,
            "mode": MODE,
            "policy": POLICY,
            "rules_sha256": rules_sha256(),
            "authoritative": False,
            "canonical_state_mutation": False,
            "counter_increment": 0,
            "timeframe": timeframe,
            "flat_lot": 1.0,
            "source_batch": source_batch,
            "source_candidate_cursor": start_cursor,
            "planned_candidate_cursor": cursor,
            "accepted_count": len(rows),
            "trials": trials,
            "rejected_pre": rejected_pre,
            "gate_a": audit,
            "accepted": rows,
        }
        payload["plan_sha256"] = stable_hash(payload["accepted"])
        atomic_json(output, payload)
        return payload
    finally:
        db.close()


def normalize_result(result: dict, timeframe: str) -> dict:
    c = result["candidate"]
    ledger = result.get("ledger", [])
    metrics = dict(result.get("metrics", {}))
    metrics.update(evaluate_v11_metrics(metrics, timeframe, ledger, c["family"]))
    profile = execution_profile_v11(c)
    return {
        "config_hash": result["config_hash"],
        "candidate": c,
        "execution_profile_v11": profile,
        "execution_hash": result.get("execution_hash"),
        "metrics": metrics,
        "ledger": ledger,
    }


def result_summary(result: dict) -> dict:
    ledger = result["ledger"]
    metrics = result["metrics"]
    canonical_payload = {
        "config_hash": result["config_hash"],
        "candidate": result["candidate"],
        "execution_profile_v11": result["execution_profile_v11"],
        "execution_hash": result["execution_hash"],
        "metrics": metrics,
        "ledger": ledger,
    }
    return {
        "config_hash": result["config_hash"],
        "execution_hash": result["execution_hash"],
        "trades": int(metrics.get("trades", 0) or 0),
        "profit_factor_net": float(metrics.get("profit_factor_net", metrics.get("profit_factor", 0.0)) or 0.0),
        "net_expectancy": float(metrics.get("net_expectancy", metrics.get("expectancy", 0.0)) or 0.0),
        "net_profit": float(metrics.get("net_profit", 0.0) or 0.0),
        "max_dd_pct": float(metrics.get("max_dd_pct", 0.0) or 0.0),
        "baseline_qualified_v11": bool(metrics.get("baseline_qualified_v11", False)),
        "target_candidate_v11": bool(metrics.get("target_candidate_v11", False)),
        "ledger_rows": len(ledger),
        "result_sha256": stable_hash(canonical_payload),
        "ledger_sha256": stable_hash(ledger),
    }


def simulate(plan_path: Path, dataset: Path, receipt: Path, shard_index: int, shard_count: int, output: Path) -> dict:
    if shard_count <= 0 or not 0 <= shard_index < shard_count:
        raise ValueError("invalid shard")
    plan = json.loads(plan_path.read_text())
    if plan.get("schema") != SCHEMA or plan.get("mode") != MODE or plan.get("policy") != POLICY:
        raise RuntimeError("PLAN_GOVERNANCE_FAIL")
    timeframe = plan["timeframe"]
    d, audit = audit_dataset(dataset, receipt, timeframe)
    if audit.get("gate_a") != "PASS":
        raise RuntimeError("GATE_A_FAIL")
    if stable_hash(plan["accepted"]) != plan.get("plan_sha256"):
        raise RuntimeError("PLAN_DIGEST_FAIL")

    assigned = [x for x in plan["accepted"] if int(x["accepted_index"]) % shard_count == shard_index]
    rows = []
    for item in assigned:
        c = Candidate(**item["candidate"])
        if c.config_hash != item["config_hash"]:
            raise RuntimeError("CONFIG_HASH_FAIL")
        r = normalize_result(backtest_candidate(d, c, flat_lot=float(plan["flat_lot"])), timeframe)
        if r["config_hash"] != item["config_hash"]:
            raise RuntimeError("BACKTEST_CONFIG_HASH_FAIL")
        s = result_summary(r)
        s["accepted_index"] = int(item["accepted_index"])
        s["seed_cursor"] = int(item["seed_cursor"])
        rows.append(s)

    payload = {
        "schema": SCHEMA,
        "mode": MODE,
        "policy": POLICY,
        "rules_sha256": plan["rules_sha256"],
        "plan_sha256": plan["plan_sha256"],
        "authoritative": False,
        "simulation_executed": True,
        "canonical_state_mutation": False,
        "counter_increment": 0,
        "shard_index": shard_index,
        "shard_count": shard_count,
        "assigned_count": len(assigned),
        "results": rows,
    }
    payload["results_sha256"] = stable_hash(rows)
    atomic_json(output, payload)
    return payload


def aggregate(plan_path: Path, serial_path: Path, shard_dir: Path, shard_count: int, output: Path) -> dict:
    plan = json.loads(plan_path.read_text())
    serial = json.loads(serial_path.read_text())
    shard_paths = sorted(shard_dir.glob("shard_*.json"))
    if len(shard_paths) != shard_count:
        raise RuntimeError(f"SHARD_COUNT_FAIL: expected {shard_count}, found {len(shard_paths)}")
    shards = [json.loads(p.read_text()) for p in shard_paths]
    if sorted(int(x["shard_index"]) for x in shards) != list(range(shard_count)):
        raise RuntimeError("SHARD_INDEX_FAIL")

    for x in [serial, *shards]:
        if x.get("schema") != SCHEMA or x.get("mode") != MODE or x.get("policy") != POLICY:
            raise RuntimeError("GOVERNANCE_FAIL")
        if x.get("authoritative") is not False or x.get("canonical_state_mutation") is not False:
            raise RuntimeError("AUTHORITY_FAIL")
        if int(x.get("counter_increment", 0)) != 0:
            raise RuntimeError("COUNTER_FAIL")
        if x.get("plan_sha256") != plan.get("plan_sha256"):
            raise RuntimeError("PLAN_SHA_FAIL")
        if stable_hash(x.get("results", [])) != x.get("results_sha256"):
            raise RuntimeError("RESULT_DIGEST_FAIL")

    serial_by = {r["config_hash"]: r for r in serial["results"]}
    parallel_rows = [r for s in shards for r in s["results"]]
    parallel_by = {r["config_hash"]: r for r in parallel_rows}
    planned_hashes = [x["config_hash"] for x in plan["accepted"]]
    if len(parallel_rows) != len(parallel_by):
        raise RuntimeError("PARALLEL_DUPLICATE_CONFIG_FAIL")
    if set(serial_by) != set(planned_hashes) or set(parallel_by) != set(planned_hashes):
        raise RuntimeError("COVERAGE_FAIL")

    mismatches = []
    for h in planned_hashes:
        a, b = serial_by[h], parallel_by[h]
        if a != b:
            mismatches.append({
                "config_hash": h,
                "serial_result_sha256": a.get("result_sha256"),
                "parallel_result_sha256": b.get("result_sha256"),
                "serial_ledger_sha256": a.get("ledger_sha256"),
                "parallel_ledger_sha256": b.get("ledger_sha256"),
            })

    if mismatches:
        raise RuntimeError(f"PARITY_FAIL: {len(mismatches)} mismatches; sample={mismatches[:3]}")

    ordered_parallel = sorted(parallel_rows, key=lambda x: int(x["accepted_index"]))
    ordered_serial = sorted(serial["results"], key=lambda x: int(x["accepted_index"]))
    proof = {
        "schema": SCHEMA,
        "mode": MODE,
        "policy": POLICY,
        "status": "PASS",
        "authoritative": False,
        "canonical_state_mutation": False,
        "counter_increment": 0,
        "simulation_executed": True,
        "source_batch": plan["source_batch"],
        "source_candidate_cursor": plan["source_candidate_cursor"],
        "planned_candidate_cursor": plan["planned_candidate_cursor"],
        "accepted_count": plan["accepted_count"],
        "planner_trials": plan["trials"],
        "planner_rejected_pre": plan["rejected_pre"],
        "parallel_workers": shard_count,
        "parallel_exact_coverage": True,
        "parallel_duplicate_config_count": 0,
        "serial_parallel_result_mismatches": 0,
        "plan_sha256": plan["plan_sha256"],
        "serial_results_sha256": stable_hash(ordered_serial),
        "parallel_results_sha256": stable_hash(ordered_parallel),
        "result_digest_set_sha256": stable_hash(sorted(r["result_sha256"] for r in ordered_parallel)),
        "total_trades": sum(int(r["trades"]) for r in ordered_parallel),
        "sample_rankable": sum(int(r["trades"] >= 300) for r in ordered_parallel),
        "baseline_qualified": sum(int(bool(r["baseline_qualified_v11"])) for r in ordered_parallel),
        "target_candidates": sum(int(bool(r["target_candidate_v11"])) for r in ordered_parallel),
        "gate_a": plan["gate_a"],
        "note": "Non-authoritative proof: exact canonical candidate planning semantics were frozen from the source DB, then the same accepted candidates were simulated serially and across 20 workers. Every per-candidate result+ledger digest matched. Canonical counters were not mutated.",
    }
    if proof["serial_results_sha256"] != proof["parallel_results_sha256"]:
        raise RuntimeError("ORDERED_GLOBAL_DIGEST_FAIL")
    atomic_json(output, proof)
    return proof


def selftest() -> None:
    rows = [{"accepted_index": i, "config_hash": f"h{i}"} for i in range(40)]
    shards = [[x for x in rows if x["accepted_index"] % 20 == s] for s in range(20)]
    flat = [x for shard in shards for x in shard]
    assert len(flat) == 40
    assert len({x["config_hash"] for x in flat}) == 40
    assert sorted(x["accepted_index"] for x in flat) == list(range(40))
    assert all(len(x) == 2 for x in shards)
    print("parallel_v11_parity selftest: PASS")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("selftest")

    q = sub.add_parser("plan")
    q.add_argument("--state-dir", type=Path, required=True)
    q.add_argument("--dataset", type=Path, required=True)
    q.add_argument("--receipt", type=Path, required=True)
    q.add_argument("--accepted-count", type=int, default=40)
    q.add_argument("--timeframe", default="D1")
    q.add_argument("--output", type=Path, required=True)

    s = sub.add_parser("simulate")
    s.add_argument("--plan", type=Path, required=True)
    s.add_argument("--dataset", type=Path, required=True)
    s.add_argument("--receipt", type=Path, required=True)
    s.add_argument("--shard-index", type=int, required=True)
    s.add_argument("--shard-count", type=int, required=True)
    s.add_argument("--output", type=Path, required=True)

    a = sub.add_parser("aggregate")
    a.add_argument("--plan", type=Path, required=True)
    a.add_argument("--serial", type=Path, required=True)
    a.add_argument("--shard-dir", type=Path, required=True)
    a.add_argument("--shard-count", type=int, required=True)
    a.add_argument("--output", type=Path, required=True)
    return p.parse_args()


def main() -> None:
    args = parse_args()
    if args.cmd == "selftest":
        selftest()
    elif args.cmd == "plan":
        print(json.dumps(plan_candidates(args.state_dir, args.dataset, args.receipt, args.accepted_count, args.timeframe, args.output), indent=2, sort_keys=True, default=str))
    elif args.cmd == "simulate":
        print(json.dumps(simulate(args.plan, args.dataset, args.receipt, args.shard_index, args.shard_count, args.output), indent=2, sort_keys=True, default=str))
    elif args.cmd == "aggregate":
        print(json.dumps(aggregate(args.plan, args.serial, args.shard_dir, args.shard_count, args.output), indent=2, sort_keys=True, default=str))
    else:
        raise AssertionError(args.cmd)


if __name__ == "__main__":
    main()
