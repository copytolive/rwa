from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "results"
DATA = ROOT / "data"
FACTORY = ROOT / "factory"
PERIODS = list(range(50, 1501, 25))


def load(path: Path):
    return json.loads(path.read_text())


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


def main() -> None:
    manifest = load(DATA / "manifest.json")
    campaign = load(RESULTS / "campaign.json")
    ids = load(RESULTS / "evaluation_ids.json").get("ids", [])
    batches = load(RESULTS / "batches.json").get("batches", [])
    shards = load(RESULTS / "shards.json").get("shards", [])
    contract = load(FACTORY / "scale_contract.json")

    files = manifest.get("files", [])
    months = [x["month"] for x in files]
    assert len(files) == 111
    assert len(months) == len(set(months))
    assert months[0] == "2009-05"
    assert months[-1] == "2018-07"
    assert contract["target_unique_evaluations"] == campaign["target_evaluations"]
    assert campaign["verified_completed"] == len(set(ids))
    assert len(ids) == len(set(ids))

    shard_by_key = {
        (s["month"], s["engine_version"], s["dataset_sha256"]): s for s in shards
    }
    assert len(shard_by_key) == len(shards)

    rebuilt = set()
    for batch in batches:
        key = (batch["month"], batch["engine_version"], batch["dataset_sha256"])
        assert key in shard_by_key, f"missing shard for batch {key}"
        eval_ids = [
            evaluation_id(batch["dataset_sha256"], batch["month"], p, batch["engine_version"])
            for p in PERIODS
        ]
        rebuilt.update(eval_ids)
        shard = shard_by_key[key]
        assert shard["evaluation_count"] == len(eval_ids)
        assert shard["merkle_root"] == merkle_root(eval_ids)

    assert rebuilt == set(ids), "explicit ID ledger and batch reconstruction differ"
    assert sum(int(s["evaluation_count"]) for s in shards) == len(ids)

    print(
        "VectorForge contract test PASS · "
        f"files={len(files)} · batches={len(batches)} · shards={len(shards)} · ids={len(ids)}"
    )


if __name__ == "__main__":
    main()
