from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "results"
PERIODS = list(range(50, 1501, 25))


def load(path: Path):
    return json.loads(path.read_text())


def save(path: Path, payload) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n")


def evaluation_id(dataset_hash: str, month: str, period: int, engine_version: str) -> str:
    payload = {
        "dataset_sha256": dataset_hash,
        "month": month,
        "model": "price_vs_sma_state",
        "period": period,
        "engine_version": engine_version,
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()


def merkle_root(eval_ids: list[str]) -> str:
    nodes = [bytes.fromhex(x) for x in sorted(eval_ids)]
    if not nodes:
        return hashlib.sha256(b"").hexdigest()
    while len(nodes) > 1:
        if len(nodes) % 2:
            nodes.append(nodes[-1])
        nodes = [
            hashlib.sha256(nodes[i] + nodes[i + 1]).digest()
            for i in range(0, len(nodes), 2)
        ]
    return nodes[0].hex()


def shard_id(*, month: str, engine_version: str, dataset_hash: str, root: str, count: int) -> str:
    payload = {
        "month": month,
        "engine_version": engine_version,
        "dataset_sha256": dataset_hash,
        "merkle_root": root,
        "evaluation_count": count,
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()


def main() -> None:
    batch_rows = load(RESULTS / "batches.json").get("batches", [])
    persisted_ids = set(load(RESULTS / "evaluation_ids.json").get("ids", []))

    shards = []
    reconstructed_ids: set[str] = set()
    seen_shards: set[str] = set()

    for batch in batch_rows:
        month = batch["month"]
        engine_version = batch["engine_version"]
        dataset_hash = batch["dataset_sha256"]
        ids = [evaluation_id(dataset_hash, month, p, engine_version) for p in PERIODS]
        reconstructed_ids.update(ids)
        root = merkle_root(ids)
        sid = shard_id(
            month=month,
            engine_version=engine_version,
            dataset_hash=dataset_hash,
            root=root,
            count=len(ids),
        )
        if sid in seen_shards:
            continue
        seen_shards.add(sid)
        shards.append(
            {
                "shard_id": sid,
                "month": month,
                "engine_version": engine_version,
                "dataset_sha256": dataset_hash,
                "evaluation_count": len(ids),
                "merkle_root": root,
                "valid_samples": int(batch.get("valid_samples") or 0),
                "completed_at": batch.get("completed_at"),
            }
        )

    if reconstructed_ids != persisted_ids:
        missing = len(persisted_ids - reconstructed_ids)
        extra = len(reconstructed_ids - persisted_ids)
        raise RuntimeError(
            f"Shard reconstruction mismatch: persisted-only={missing}, reconstructed-only={extra}"
        )

    shards.sort(key=lambda x: (x.get("completed_at") or "", x["shard_id"]))
    payload = {
        "schema_version": 1,
        "verification": "binary SHA-256 Merkle root over sorted evaluation-ID bytes",
        "shards": shards,
    }
    save(RESULTS / "shards.json", payload)

    campaign_path = RESULTS / "campaign.json"
    campaign = load(campaign_path)
    campaign["verification_shards"] = {
        "count": len(shards),
        "evaluation_count": sum(int(x["evaluation_count"]) for x in shards),
        "algorithm": payload["verification"],
        "ledger": "shards.json",
    }
    save(campaign_path, campaign)

    print(
        f"VectorForge shard ledger PASS: shards={len(shards)} "
        f"evaluations={len(reconstructed_ids)}"
    )


if __name__ == "__main__":
    main()
