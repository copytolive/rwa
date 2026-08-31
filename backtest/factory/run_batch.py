from __future__ import annotations

import hashlib
import json
import os
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "results"
MANIFEST_PATH = ROOT / "data" / "manifest.json"
RESULTS.mkdir(parents=True, exist_ok=True)

MONTH_REQUEST = os.getenv("VF_MONTH", "auto").strip()
ENGINE_VERSION = "vectorforge-batch-1.1.0"
PERIODS = list(range(50, 1501, 25))


def load_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text())


def save_json(path: Path, payload) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def source_months() -> list[str]:
    manifest = load_json(MANIFEST_PATH, {})
    months = [row["month"] for row in manifest.get("files", [])]
    if not months:
        raise RuntimeError("Source manifest has no months")
    if len(months) != len(set(months)):
        raise RuntimeError("Source manifest contains duplicate months")
    return months


def choose_month() -> str | None:
    available = source_months()
    if MONTH_REQUEST.lower() != "auto":
        if MONTH_REQUEST not in available:
            raise RuntimeError(f"Month {MONTH_REQUEST!r} is outside verified manifest coverage")
        return MONTH_REQUEST

    history = load_json(RESULTS / "batches.json", {"batches": []})
    processed = {row.get("month") for row in history.get("batches", []) if row.get("month")}
    for month in available:
        if month not in processed:
            return month
    return None


def source_url(month: str) -> str:
    return (
        "https://raw.githubusercontent.com/zcbmlijygrdwa/"
        f"fx_EUR_USD_tick/master/EURUSD-{month}_converted.txt"
    )


def download(month: str) -> Path:
    url = source_url(month)
    path = Path("/tmp") / f"EURUSD-{month}_converted.txt"
    req = urllib.request.Request(url, headers={"User-Agent": "VectorForge/1.1"})
    with urllib.request.urlopen(req, timeout=180) as r, path.open("wb") as f:
        while True:
            chunk = r.read(1024 * 1024)
            if not chunk:
                break
            f.write(chunk)
    if not path.exists() or path.stat().st_size < 1_000_000:
        raise RuntimeError("Downloaded source file is unexpectedly small")
    return path


def evaluation_id(dataset_hash: str, month: str, period: int) -> str:
    payload = {
        "dataset_sha256": dataset_hash,
        "month": month,
        "model": "price_vs_sma_state",
        "period": period,
        "engine_version": ENGINE_VERSION,
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()


def update_campaign(
    *,
    month: str,
    dataset_hash: str,
    valid_samples: int,
    rows: list[dict],
    new_unique: int,
    ids: set[str],
    now: str,
) -> None:
    batches_path = RESULTS / "batches.json"
    history = load_json(batches_path, {"schema_version": 1, "batches": []})
    batches = history.setdefault("batches", [])

    record = {
        "month": month,
        "engine_version": ENGINE_VERSION,
        "dataset_sha256": dataset_hash,
        "valid_samples": int(valid_samples),
        "evaluations_computed": len(rows),
        "new_unique_evaluations": int(new_unique),
        "completed_at": now,
    }
    exact_key = (month, ENGINE_VERSION, dataset_hash)
    existing_exact = {
        (x.get("month"), x.get("engine_version"), x.get("dataset_sha256")) for x in batches
    }
    if exact_key not in existing_exact:
        batches.append(record)
    save_json(batches_path, history)

    available = source_months()
    processed_months = sorted({x.get("month") for x in batches if x.get("month") in available})
    next_month = next((m for m in available if m not in set(processed_months)), None)

    # Count each unique source dataset once even if a month is deliberately rerun
    # under a different engine version.
    unique_datasets = {}
    for x in batches:
        key = (x.get("month"), x.get("dataset_sha256"))
        unique_datasets[key] = int(x.get("valid_samples") or 0)
    verified_samples_total = sum(unique_datasets.values())

    campaign_path = RESULTS / "campaign.json"
    campaign = load_json(campaign_path, {})
    campaign["verified_completed"] = len(ids)
    campaign["status"] = (
        "COMPLETE"
        if len(ids) >= int(campaign.get("target_evaluations", 1_000_000_000_000))
        else "RUNNING"
    )
    campaign["source_catalog"] = {
        "available_months": len(available),
        "processed_months": len(processed_months),
        "remaining_months": len(available) - len(processed_months),
        "next_month": next_month,
        "coverage_complete": next_month is None,
        "verified_samples_total": verified_samples_total,
    }
    campaign["last_verified_batch"] = {
        "month": month,
        "engine_version": ENGINE_VERSION,
        "dataset_sha256": dataset_hash,
        "evaluations": new_unique,
        "evaluations_computed": len(rows),
        "duplicate_evaluations": len(rows) - new_unique,
        "valid_samples": int(valid_samples),
        "completed_at": now,
    }
    save_json(campaign_path, campaign)


def main() -> None:
    month = choose_month()
    if month is None:
        print("VectorForge source catalog already fully processed; no automatic month remains.")
        return

    path = download(month)
    dataset_hash = sha256_file(path)
    bid = np.loadtxt(path, dtype=np.float64, usecols=(0,))
    bid = bid[np.isfinite(bid) & (bid > 0.5) & (bid < 2.5)]
    if bid.size < max(PERIODS) + 10:
        raise RuntimeError("Insufficient valid samples")

    cs = np.empty(bid.size + 1, dtype=np.float64)
    cs[0] = 0.0
    np.cumsum(bid, out=cs[1:])

    ids_path = RESULTS / "evaluation_ids.json"
    ids = set(load_json(ids_path, {"ids": []}).get("ids", []))
    rows: list[dict] = []
    new_unique = 0

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

        eid = evaluation_id(dataset_hash, month, p)
        if eid not in ids:
            ids.add(eid)
            new_unique += 1
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
        "source_month": month,
        "source_url": source_url(month),
        "dataset_sha256": dataset_hash,
        "valid_samples": int(bid.size),
        "evaluations_computed": len(rows),
        "new_batch_evaluations": new_unique,
        "duplicate_evaluations": len(rows) - new_unique,
        "unique_verified_evaluations_total": len(ids),
        "completed_at": now,
        "results": rows,
    }
    save_json(RESULTS / "latest_batch.json", batch_payload)
    save_json(ids_path, {"schema_version": 1, "ids": sorted(ids)})
    update_campaign(
        month=month,
        dataset_hash=dataset_hash,
        valid_samples=int(bid.size),
        rows=rows,
        new_unique=new_unique,
        ids=ids,
        now=now,
    )

    try:
        path.unlink()
    except OSError:
        pass

    print(
        f"VectorForge month={month} computed={len(rows)} new_unique={new_unique} "
        f"cumulative_unique={len(ids)} samples={bid.size}"
    )


if __name__ == "__main__":
    main()
