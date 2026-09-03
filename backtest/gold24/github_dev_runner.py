from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
from pathlib import Path

import numpy as np
import pandas as pd

from core import RULES_SHA256, backtest_candidate, generate_candidate, novelty_pass
from store import Store
from worker import select_top100

CLASSIFICATION = "DEV_RESEARCH_ONLY_NOT_VALIDATED_GATE_A_BLOCKED"
DATA_START = "2012-01-01"
DATA_END_EXCLUSIVE = "2026-08-28"


def atomic_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True, default=str))
    tmp.replace(path)


def prepare_dev_dataset(root: Path) -> tuple[pd.DataFrame, dict]:
    """Freeze one GC=F D1 snapshot for the temporary GitHub runner.

    This is deliberately DEV-only. It reaches 2026 but has no approved
    OANDA/TradingView cross-check, so it can never promote to compliant output.
    The snapshot is persisted in the workflow state artifact and reused on the
    next run instead of silently changing historical data between jobs.
    """
    path = root / "dev_gc_f_d1_2012_2026.csv"
    if not path.exists():
        import yfinance as yf

        raw = yf.download(
            "GC=F",
            start=DATA_START,
            end=DATA_END_EXCLUSIVE,
            auto_adjust=False,
            progress=False,
            threads=False,
        )
        if raw.empty:
            raise RuntimeError("DEV_DATA_FAIL: yfinance GC=F returned no rows")
        if isinstance(raw.columns, pd.MultiIndex):
            raw.columns = [str(c[0]) for c in raw.columns]
        raw = raw.reset_index()
        date_col = "Date" if "Date" in raw.columns else raw.columns[0]
        out = pd.DataFrame(
            {
                "Date": pd.to_datetime(raw[date_col], utc=True),
                "Open": pd.to_numeric(raw["Open"], errors="coerce"),
                "High": pd.to_numeric(raw["High"], errors="coerce"),
                "Low": pd.to_numeric(raw["Low"], errors="coerce"),
                "Close": pd.to_numeric(raw["Close"], errors="coerce"),
                "Volume": pd.to_numeric(raw.get("Volume", 0), errors="coerce").fillna(0),
            }
        )
        out = out.dropna(subset=["Date", "Open", "High", "Low", "Close"]).sort_values("Date")
        out.to_csv(path, index=False)

    d = pd.read_csv(path)
    required = ["Date", "Open", "High", "Low", "Close", "Volume"]
    if any(c not in d.columns for c in required):
        raise RuntimeError("DEV_DATA_FAIL: required OHLCV columns missing")
    d["Date"] = pd.to_datetime(d["Date"], errors="coerce", utc=True)
    if d["Date"].isna().any() or d["Date"].duplicated().any() or not d["Date"].is_monotonic_increasing:
        raise RuntimeError("DEV_DATA_FAIL: timestamps invalid/duplicate/unsorted")
    for c in ["Open", "High", "Low", "Close", "Volume"]:
        d[c] = pd.to_numeric(d[c], errors="coerce")
    if d[["Open", "High", "Low", "Close", "Volume"]].isna().any().any():
        raise RuntimeError("DEV_DATA_FAIL: NaN OHLCV")
    o, h, l, c = (d[x].to_numpy(float) for x in ["Open", "High", "Low", "Close"])
    bad = (h < l) | (o < l) | (o > h) | (c < l) | (c > h)
    if bool(np.any(bad)):
        raise RuntimeError(f"DEV_DATA_FAIL: OHLC consistency violations={int(bad.sum())}")
    if d["Date"].iloc[-1].year < 2026:
        raise RuntimeError("DEV_DATA_FAIL: snapshot does not reach 2026")

    sha = hashlib.sha256(path.read_bytes()).hexdigest()
    audit = {
        "mode": "GITHUB_TEMPORARY_DEV",
        "classification": CLASSIFICATION,
        "gate_a": "BLOCKED_APPROVED_CROSSCHECK_MISSING",
        "promotion_allowed": False,
        "provider_primary": "Yahoo Finance GC=F",
        "approved_crosscheck": None,
        "dataset_sha256": sha,
        "rows": int(len(d)),
        "start_utc": str(d["Date"].iloc[0]),
        "end_utc": str(d["Date"].iloc[-1]),
        "zero_volume_rows": int((d["Volume"] <= 0).sum()),
        "rules_sha256": RULES_SHA256,
    }
    atomic_json(root / "dev_dataset_audit.json", audit)
    return d, audit


def db_counts(db: Store) -> dict:
    total = int(db.db.execute("SELECT COUNT(*) FROM configs").fetchone()[0])
    with_trades = int(
        db.db.execute(
            "SELECT COUNT(*) FROM configs WHERE COALESCE(json_extract(metrics_json,'$.trades'),0) > 0"
        ).fetchone()[0]
    )
    metric_unique = int(db.db.execute("SELECT COUNT(*) FROM configs WHERE counted=1").fetchone()[0])
    return {
        "strict_unique_configs_dev": total,
        "configs_with_trades": with_trades,
        "full_metric_execution_unique_dev": metric_unique,
    }


def run(max_batches: int, batch_size: int) -> None:
    root = Path(os.environ.get("GOLD24_STATE_DIR", ".gold24-dev")).resolve()
    root.mkdir(parents=True, exist_ok=True)
    ledgers = root / "ledgers"
    receipts = root / "receipts"
    ledgers.mkdir(exist_ok=True)
    receipts.mkdir(exist_ok=True)

    d, audit = prepare_dev_dataset(root)
    db = Store(root / "gold24-dev.db")
    base_seed = int(os.environ.get("GOLD24_DEV_SEED", "202608280154"))
    cursor = int(db.get_state("candidate_cursor", base_seed))
    batch = int(db.get_state("batch", 0))
    cumulative_exec_unique = int(db.get_state("execution_unique_nonzero", 0))
    cumulative_exec_dupes = int(db.get_state("exact_execution_duplicates", 0))
    cumulative_zero = int(db.get_state("zero_trade_configs", 0))
    flat_lot = float(os.environ.get("GOLD24_FLAT_LOT", "1.0"))

    for _ in range(max_batches):
        batch += 1
        accepted = []
        rejected_pre = 0
        trials = 0
        max_trials = batch_size * 300
        while len(accepted) < batch_size and trials < max_trials:
            trials += 1
            c = generate_candidate(random.Random(cursor), "D1")
            cursor += 1
            if db.seen(c.config_hash) or not db.novelty_ok(c):
                rejected_pre += 1
                continue
            if any(not novelty_pass(c, prior) for prior in accepted):
                rejected_pre += 1
                continue
            accepted.append(c)

        db.set_state("candidate_cursor", cursor)
        db.set_state("batch", batch)
        if not accepted:
            atomic_json(
                root / "status.json",
                {
                    "worker": "GITHUB_TEMPORARY_DEV",
                    "engine": "SATURATED",
                    "classification": CLASSIFICATION,
                    "gate_a": audit["gate_a"],
                    "promotion_allowed": False,
                    "batch": batch,
                    "candidate_cursor": cursor,
                    **db_counts(db),
                    "updated_at": pd.Timestamp.now(tz="UTC").isoformat(),
                },
            )
            break

        results = [backtest_candidate(d, c, flat_lot=flat_lot) for c in accepted]
        ledger_rows = [row for r in results for row in r["ledger"]]
        shard = ledgers / f"ledger_{batch:08d}.parquet"
        ledger_columns = [
            "config_hash", "fingerprint", "family", "entry_time", "exit_time", "entry_bar", "exit_bar",
            "side", "pending_order", "entry_price", "exit_price", "fixed_sl", "fixed_tp", "quantity",
            "gross_pnl", "cost", "net_pnl", "exit_reason",
        ]
        pd.DataFrame(ledger_rows, columns=ledger_columns).to_parquet(shard, index=False)

        exact_dupes = 0
        zero = 0
        exec_unique = 0
        full_metric_unique = 0
        configs = []
        for r in results:
            trades = int(r["metrics"].get("trades", 0))
            has_trades = trades > 0
            exact_duplicate = db.exact_execution_duplicate(r) if has_trades else False
            if not has_trades:
                zero += 1
            elif exact_duplicate:
                exact_dupes += 1
            else:
                exec_unique += 1
            full_metric = bool(r["metrics"].get("full_metrics_pass"))
            dev_precert = has_trades and not exact_duplicate and full_metric
            db.insert_result(r, str(shard), dev_precert)
            full_metric_unique += int(dev_precert)
            configs.append(
                {
                    "config_hash": r["config_hash"],
                    "fingerprint": r["fingerprint"],
                    "execution_hash": r["execution_hash"],
                    "trades": trades,
                    "exact_execution_duplicate": exact_duplicate,
                    "full_metrics_pass": full_metric,
                    "dev_precert_only": dev_precert,
                }
            )

        cumulative_exec_unique += exec_unique
        cumulative_exec_dupes += exact_dupes
        cumulative_zero += zero
        db.set_state("execution_unique_nonzero", cumulative_exec_unique)
        db.set_state("exact_execution_duplicates", cumulative_exec_dupes)
        db.set_state("zero_trade_configs", cumulative_zero)

        top = select_top100(db, len(d))
        atomic_json(
            root / "DEV_TOP100.json",
            {
                "classification": CLASSIFICATION,
                "gate_a": audit["gate_a"],
                "promotion_allowed": False,
                "count": len(top),
                "ranking": [
                    {
                        "rank": i,
                        "config_hash": x["config_hash"],
                        "candidate": x["candidate"],
                        "fingerprint": x["fingerprint"],
                        "metrics": x["metrics"],
                        "correlation_max": x.get("correlation_max", 0.0),
                    }
                    for i, x in enumerate(top, 1)
                ],
            },
        )

        receipt = {
            "schema": "gold24-github-dev-receipt-v1",
            "classification": CLASSIFICATION,
            "gate_a": audit["gate_a"],
            "promotion_allowed": False,
            "rules_sha256": RULES_SHA256,
            "dataset_audit": audit,
            "batch": batch,
            "candidate_cursor_after": cursor,
            "raw_trials": trials,
            "preengine_rejects": rejected_pre,
            "simulated": len(results),
            "zero_trade_configs": zero,
            "execution_unique_nonzero": exec_unique,
            "exact_execution_duplicates_archived": exact_dupes,
            "full_metric_execution_unique_dev": full_metric_unique,
            "dev_top100_count": len(top),
            "ledger_shard": str(shard),
            "configs": configs,
        }
        atomic_json(receipts / f"batch_{batch:08d}.json", receipt)
        atomic_json(
            root / "status.json",
            {
                "worker": "GITHUB_TEMPORARY_DEV",
                "engine": "RUNNING",
                "classification": CLASSIFICATION,
                "gate_a": audit["gate_a"],
                "promotion_allowed": False,
                "batch": batch,
                "candidate_cursor": cursor,
                "execution_unique_nonzero_dev": cumulative_exec_unique,
                "exact_execution_duplicates_archived": cumulative_exec_dupes,
                "zero_trade_configs": cumulative_zero,
                "dev_top100_count": len(top),
                **db_counts(db),
                "updated_at": pd.Timestamp.now(tz="UTC").isoformat(),
            },
        )

    db.close()
    print((root / "status.json").read_text())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-batches", type=int, default=int(os.environ.get("GOLD24_DEV_MAX_BATCHES", "20")))
    ap.add_argument("--batch-size", type=int, default=int(os.environ.get("GOLD24_DEV_BATCH_SIZE", "32")))
    args = ap.parse_args()
    run(max_batches=max(1, args.max_batches), batch_size=max(1, args.batch_size))


if __name__ == "__main__":
    main()
