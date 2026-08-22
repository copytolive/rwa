from __future__ import annotations

import hashlib
import json
import os
import urllib.request
from pathlib import Path
from datetime import datetime, timezone

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "results"
RESULTS.mkdir(parents=True, exist_ok=True)

MONTH = os.getenv("VF_MONTH", "2018-01")
SOURCE = f"https://raw.githubusercontent.com/zcbmlijygrdwa/fx_EUR_USD_tick/master/EURUSD-{MONTH}_converted.txt"
ENGINE_VERSION = "vectorforge-batch-1.0.0"
PERIODS = list(range(50, 1501, 25))
DATA_PATH = Path("/tmp") / f"EURUSD-{MONTH}_converted.txt"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def download() -> None:
    req = urllib.request.Request(SOURCE, headers={"User-Agent": "VectorForge/1.0"})
    with urllib.request.urlopen(req, timeout=180) as r, DATA_PATH.open("wb") as f:
        while True:
            chunk = r.read(1024 * 1024)
            if not chunk:
                break
            f.write(chunk)
    if DATA_PATH.stat().st_size < 1_000_000:
        raise RuntimeError("Downloaded source file is unexpectedly small")


def evaluation_id(dataset_hash: str, period: int) -> str:
    payload = {
        "dataset_sha256": dataset_hash,
        "month": MONTH,
        "model": "price_vs_sma_state",
        "period": period,
        "engine_version": ENGINE_VERSION,
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()


def main() -> None:
    download()
    dataset_hash = sha256_file(DATA_PATH)
    bid = np.loadtxt(DATA_PATH, dtype=np.float64, usecols=(0,))
    bid = bid[np.isfinite(bid) & (bid > 0.5) & (bid < 2.5)]
    if bid.size < max(PERIODS) + 10:
        raise RuntimeError("Insufficient valid samples")

    cs = np.empty(bid.size + 1, dtype=np.float64)
    cs[0] = 0.0
    np.cumsum(bid, out=cs[1:])

    rows = []
    ids = set()
    ids_path = RESULTS / "evaluation_ids.json"
    if ids_path.exists():
        ids.update(json.loads(ids_path.read_text()).get("ids", []))

    for p in PERIODS:
        ma = (cs[p:] - cs[:-p]) / p
        price = bid[p - 1 :]
        diff = price - ma
        signs = np.where(diff > 0, 1, np.where(diff < 0, -1, 0)).astype(np.int8)
        nz = signs != 0
        if not np.any(nz):
            flips = 0
            buy_pct = sell_pct = mean_abs_distance_pct = 0.0
        else:
            # Fill zero states with previous non-zero state for stable flip counting.
            idx = np.where(nz, np.arange(signs.size), -1)
            np.maximum.accumulate(idx, out=idx)
            valid_prev = idx >= 0
            filled = signs.copy()
            filled[valid_prev] = signs[idx[valid_prev]]
            if np.any(~valid_prev):
                first = np.flatnonzero(nz)[0]
                filled[~valid_prev] = signs[first]
            flips = int(np.count_nonzero(filled[1:] != filled[:-1]))
            buy_pct = float(np.mean(filled == 1) * 100.0)
            sell_pct = float(np.mean(filled == -1) * 100.0)
            mean_abs_distance_pct = float(np.mean(np.abs(diff / ma)) * 100.0)

        eid = evaluation_id(dataset_hash, p)
        ids.add(eid)
        rows.append(
            {
                "evaluation_id": eid,
                "model": "price_vs_sma_state",
                "period": p,
                "samples": int(price.size),
                "flips": flips,
                "buy_pct": buy_pct,
                "sell_pct": sell_pct,
                "mean_abs_distance_pct": mean_abs_distance_pct,
            }
        )

    now = datetime.now(timezone.utc).isoformat()
    batch_payload = {
        "status": "PASS_COMPLETED",
        "engine_version": ENGINE_VERSION,
        "source_month": MONTH,
        "source_url": SOURCE,
        "dataset_sha256": dataset_hash,
        "valid_samples": int(bid.size),
        "new_batch_evaluations": len(rows),
        "unique_verified_evaluations_total": len(ids),
        "completed_at": now,
        "results": rows,
    }
    (RESULTS / "latest_batch.json").write_text(json.dumps(batch_payload, indent=2))
    ids_path.write_text(json.dumps({"schema_version": 1, "ids": sorted(ids)}, indent=2))

    campaign_path = RESULTS / "campaign.json"
    campaign = json.loads(campaign_path.read_text())
    campaign["verified_completed"] = len(ids)
    campaign["status"] = "RUNNING" if len(ids) < int(campaign["target_evaluations"]) else "COMPLETE"
    campaign["last_verified_batch"] = {
        "month": MONTH,
        "engine_version": ENGINE_VERSION,
        "dataset_sha256": dataset_hash,
        "evaluations": len(rows),
        "completed_at": now,
    }
    campaign_path.write_text(json.dumps(campaign, indent=2))

    print(f"VectorForge verified {len(rows)} evaluations; cumulative unique={len(ids)}")


if __name__ == "__main__":
    main()
