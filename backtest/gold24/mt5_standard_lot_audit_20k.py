from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import mt5_standard_lot_audit as audit

MIN_NET_PROFIT_USD = 20000.0
STRICT_JSON_OLD = "latest_entry100_net3000_standard_lot.json"
STRICT_CSV_OLD = "latest_entry100_net3000_standard_lot.csv"
STRICT_JSON_NEW = "latest_entry100_net20000_standard_lot.json"
STRICT_CSV_NEW = "latest_entry100_net20000_standard_lot.csv"


def atomic_json(path: Path, payload: dict) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, sort_keys=True, default=str))
    tmp.replace(path)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--state-dir", default=".gold24-canonical-v11")
    p.add_argument("--out-dir", default="backtest/gold24/runtime_mt5_lot")
    args = p.parse_args()

    # Reuse the exact qty=100 re-backtest engine, but apply the user's USD20k
    # economic threshold BEFORE the same PF-first greedy correlation filter.
    audit.REPORT_MIN_NET_PROFIT_USD = MIN_NET_PROFIT_USD
    old_argv = sys.argv[:]
    try:
        sys.argv = [
            "mt5_standard_lot_audit.py",
            "--state-dir",
            args.state_dir,
            "--out-dir",
            args.out_dir,
        ]
        rc = audit.main()
    finally:
        sys.argv = old_argv
    if rc != 0:
        return int(rc)

    out = Path(args.out_dir).resolve()
    old_json = out / STRICT_JSON_OLD
    old_csv = out / STRICT_CSV_OLD
    if not old_json.exists() or not old_csv.exists():
        raise SystemExit("USD20K_FILTER_FAIL: base audit outputs missing")

    strict = json.loads(old_json.read_text())
    if float(strict.get("minimum_net_profit_usd_standard_lot", 0.0)) != MIN_NET_PROFIT_USD:
        raise SystemExit("USD20K_FILTER_FAIL: threshold mismatch")

    strict["schema"] = "gold24-entry100-net20000-standard-lot-corr-v1"
    strict["exact_rebacktest_qty_100"] = True
    strict["simple_relabel_forbidden"] = True
    strict["canonical_qty_gold_units"] = 1.0
    strict["audited_qty_gold_units"] = 100.0
    strict["gold_units_per_standard_lot"] = 100.0
    for row in strict.get("ranking", []):
        row["status"] = str(row.get("status", "")).replace("USD3000", "USD20000")
    for row in strict.get("removed_by_correlation", []):
        row["status"] = str(row.get("status", "")).replace("USD3000", "USD20000")

    new_json = out / STRICT_JSON_NEW
    new_csv = out / STRICT_CSV_NEW
    atomic_json(new_json, strict)
    new_csv.write_text(old_csv.read_text().replace("USD3000", "USD20000"))
    old_json.unlink()
    old_csv.unlink()

    print(json.dumps({
        "status": strict.get("status"),
        "source_run_id": strict.get("source_run_id"),
        "minimum_trades": strict.get("minimum_trades"),
        "minimum_net_profit_usd_standard_lot": strict.get("minimum_net_profit_usd_standard_lot"),
        "economic_count_before_correlation": strict.get("economic_count_before_correlation"),
        "removed_by_correlation_count": strict.get("removed_by_correlation_count"),
        "strict_count_after_correlation": strict.get("count"),
        "strict_json": str(new_json),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
