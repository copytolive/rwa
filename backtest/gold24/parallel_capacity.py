from __future__ import annotations

import argparse
import hashlib
import json
import os
import socket
import tempfile
import time
from pathlib import Path

POLICY = "GOLD_CANONICAL_V11_20260828"
SCHEMA = "gold24-v11-parallel-capacity-v1"
MODE = "CAPACITY_ONLY_NON_AUTHORITATIVE"


def atomic_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, sort_keys=True))
    tmp.replace(path)


def shard_ids(start: int, count: int, shard_index: int, shard_count: int) -> list[int]:
    if count < 0:
        raise ValueError("count must be >= 0")
    if shard_count <= 0:
        raise ValueError("shard_count must be > 0")
    if not 0 <= shard_index < shard_count:
        raise ValueError("shard_index out of range")
    end = start + count
    return list(range(start + shard_index, end, shard_count))


def digest_ids(ids: list[int]) -> str:
    h = hashlib.sha256()
    for value in ids:
        h.update(f"{value}\n".encode("ascii"))
    return h.hexdigest()


def build_shard_payload(start: int, count: int, shard_index: int, shard_count: int) -> dict:
    t0 = time.perf_counter()
    ids = shard_ids(start, count, shard_index, shard_count)
    digest = digest_ids(ids)
    elapsed = max(time.perf_counter() - t0, 1e-9)
    return {
        "schema": SCHEMA,
        "policy": POLICY,
        "mode": MODE,
        "authoritative": False,
        "simulation_executed": False,
        "canonical_state_mutation": False,
        "counter_increment": 0,
        "cursor_origin": int(start),
        "candidate_count_total": int(count),
        "shard_index": int(shard_index),
        "shard_count": int(shard_count),
        "assigned_count": len(ids),
        "first_candidate_id": ids[0] if ids else None,
        "last_candidate_id": ids[-1] if ids else None,
        "candidate_ids_sha256": digest,
        "elapsed_seconds": elapsed,
        "ids_per_second": len(ids) / elapsed if ids else 0.0,
        "worker": {
            "hostname": socket.gethostname(),
            "runner_name": os.environ.get("RUNNER_NAME"),
            "github_job": os.environ.get("GITHUB_JOB"),
            "github_run_id": os.environ.get("GITHUB_RUN_ID"),
            "github_run_attempt": os.environ.get("GITHUB_RUN_ATTEMPT"),
            "github_sha": os.environ.get("GITHUB_SHA"),
        },
        "candidate_ids": ids,
    }


def write_shard(output: Path, start: int, count: int, shard_index: int, shard_count: int) -> dict:
    payload = build_shard_payload(start, count, shard_index, shard_count)
    atomic_json(output, payload)
    return payload


def aggregate(directory: Path, output: Path, start: int, count: int, shard_count: int) -> dict:
    paths = sorted(directory.glob("shard_*.json"))
    if len(paths) != shard_count:
        raise RuntimeError(f"SHARD_COUNT_FAIL: expected {shard_count}, found {len(paths)}")

    manifests = [json.loads(p.read_text()) for p in paths]
    indexes = [int(x["shard_index"]) for x in manifests]
    if sorted(indexes) != list(range(shard_count)):
        raise RuntimeError(f"SHARD_INDEX_FAIL: got {sorted(indexes)}")

    all_ids: list[int] = []
    total_worker_seconds = 0.0
    max_worker_seconds = 0.0

    for m in manifests:
        if m.get("schema") != SCHEMA or m.get("policy") != POLICY or m.get("mode") != MODE:
            raise RuntimeError("GOVERNANCE_FAIL: schema/policy/mode mismatch")
        if m.get("authoritative") is not False:
            raise RuntimeError("GOVERNANCE_FAIL: shard cannot be authoritative")
        if m.get("simulation_executed") is not False:
            raise RuntimeError("GOVERNANCE_FAIL: capacity proof cannot execute simulation")
        if m.get("canonical_state_mutation") is not False or int(m.get("counter_increment", 0)) != 0:
            raise RuntimeError("GOVERNANCE_FAIL: canonical state mutation is forbidden")
        if int(m["cursor_origin"]) != start or int(m["candidate_count_total"]) != count:
            raise RuntimeError("RANGE_FAIL: shard range metadata mismatch")
        if int(m["shard_count"]) != shard_count:
            raise RuntimeError("SHARD_COUNT_FAIL: manifest shard_count mismatch")

        ids = [int(x) for x in m.get("candidate_ids", [])]
        expected = shard_ids(start, count, int(m["shard_index"]), shard_count)
        if ids != expected:
            raise RuntimeError(f"ASSIGNMENT_FAIL: shard {m['shard_index']} assignment mismatch")
        if digest_ids(ids) != m.get("candidate_ids_sha256"):
            raise RuntimeError(f"DIGEST_FAIL: shard {m['shard_index']} digest mismatch")
        if len(ids) != int(m.get("assigned_count", -1)):
            raise RuntimeError(f"COUNT_FAIL: shard {m['shard_index']} assigned_count mismatch")

        elapsed = float(m.get("elapsed_seconds", 0.0) or 0.0)
        total_worker_seconds += elapsed
        max_worker_seconds = max(max_worker_seconds, elapsed)
        all_ids.extend(ids)

    expected_all = list(range(start, start + count))
    sorted_ids = sorted(all_ids)
    duplicate_count = len(all_ids) - len(set(all_ids))
    missing_count = count - len(set(all_ids))

    if duplicate_count != 0:
        raise RuntimeError(f"OVERLAP_FAIL: {duplicate_count} duplicate assignments")
    if sorted_ids != expected_all:
        expected_set = set(expected_all)
        actual_set = set(sorted_ids)
        missing = sorted(expected_set - actual_set)[:10]
        extra = sorted(actual_set - expected_set)[:10]
        raise RuntimeError(f"COVERAGE_FAIL: missing_sample={missing} extra_sample={extra}")

    global_digest = digest_ids(sorted_ids)
    proof = {
        "schema": SCHEMA,
        "policy": POLICY,
        "mode": MODE,
        "status": "PASS",
        "parallel_workers": shard_count,
        "cursor_origin": start,
        "candidate_count_total": count,
        "candidate_end_exclusive": start + count,
        "exact_coverage": True,
        "no_overlap": True,
        "duplicate_assignment_count": duplicate_count,
        "missing_assignment_count": missing_count,
        "global_candidate_ids_sha256": global_digest,
        "authoritative": False,
        "simulation_executed": False,
        "canonical_state_mutation": False,
        "counter_increment": 0,
        "worker_elapsed_seconds_sum": total_worker_seconds,
        "slowest_worker_elapsed_seconds": max_worker_seconds,
        "capacity_ids_per_second_by_slowest_worker": (
            count / max_worker_seconds if max_worker_seconds > 0 else None
        ),
        "shards": [
            {
                "shard_index": int(m["shard_index"]),
                "assigned_count": int(m["assigned_count"]),
                "first_candidate_id": m.get("first_candidate_id"),
                "last_candidate_id": m.get("last_candidate_id"),
                "candidate_ids_sha256": m["candidate_ids_sha256"],
                "elapsed_seconds": float(m.get("elapsed_seconds", 0.0) or 0.0),
            }
            for m in sorted(manifests, key=lambda x: int(x["shard_index"]))
        ],
    }
    atomic_json(output, proof)
    return proof


def selftest() -> None:
    start, count, shards = 17, 103, 20
    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        for i in range(shards):
            write_shard(root / f"shard_{i:02d}.json", start, count, i, shards)
        proof = aggregate(root, root / "proof.json", start, count, shards)
        assert proof["status"] == "PASS"
        assert proof["parallel_workers"] == 20
        assert proof["candidate_count_total"] == 103
        assert proof["duplicate_assignment_count"] == 0
        assert proof["missing_assignment_count"] == 0
        assert proof["authoritative"] is False
        assert proof["counter_increment"] == 0
    print("parallel_capacity selftest: PASS")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Non-authoritative 20-worker sharding/capacity proof for GOLD canonical v11.")
    sub = p.add_subparsers(dest="command", required=True)

    sub.add_parser("selftest")

    s = sub.add_parser("shard")
    s.add_argument("--start", type=int, required=True)
    s.add_argument("--count", type=int, required=True)
    s.add_argument("--shard-index", type=int, required=True)
    s.add_argument("--shard-count", type=int, required=True)
    s.add_argument("--output", type=Path, required=True)

    a = sub.add_parser("aggregate")
    a.add_argument("--start", type=int, required=True)
    a.add_argument("--count", type=int, required=True)
    a.add_argument("--shard-count", type=int, required=True)
    a.add_argument("--directory", type=Path, required=True)
    a.add_argument("--output", type=Path, required=True)
    return p.parse_args()


def main() -> None:
    args = parse_args()
    if args.command == "selftest":
        selftest()
    elif args.command == "shard":
        payload = write_shard(args.output, args.start, args.count, args.shard_index, args.shard_count)
        print(json.dumps({k: v for k, v in payload.items() if k != "candidate_ids"}, indent=2, sort_keys=True))
    elif args.command == "aggregate":
        proof = aggregate(args.directory, args.output, args.start, args.count, args.shard_count)
        print(json.dumps(proof, indent=2, sort_keys=True))
    else:
        raise AssertionError(args.command)


if __name__ == "__main__":
    main()
