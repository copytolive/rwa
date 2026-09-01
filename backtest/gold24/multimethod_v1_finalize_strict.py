from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

MIN_ENTRY = 100
MIN_NET_PROFIT_USD = 20_000.0
MAX_CORR = 0.50

CSV_FIELDS = [
    "rank", "origin", "config_hash", "method", "family", "timeframe", "entry_method", "direction_mode",
    "sl_pips", "tp_pips", "total_entry", "standard_lot_win_rate_pct",
    "standard_lot_profit_factor_same_cost_model", "standard_lot_net_profit_usd_same_cost_model",
    "standard_lot_ev_per_trade_usd_same_cost_model", "avg_win_loss_ratio",
    "standard_lot_max_dd_pct_starting_equity_10000", "recovery_factor", "max_consecutive_loss",
    "standard_lot_sqn_same_cost_model", "oos_profit_factor", "monte_carlo_pass", "mc_95pct_max_drawdown_pct",
    "positive_years_pct", "worst_year", "worst_year_net_profit_usd", "backtest_start_utc", "backtest_end_utc",
    "history_years", "sample_v11", "correlation_max", "correlation_gate", "tier_v1",
]

SUMMARY_KEYS = [
    "schema", "status", "source_run_id", "source_batch", "source_candidate_cursor", "source_archive_total",
    "base_seed", "workers", "simulated_new_configs_this_run", "evaluated_config_hash_count_cumulative",
    "cheap_pass_count_this_run", "execution_duplicate_rejected_this_run", "exact_full_metrics_pre_corr_new_this_run",
    "combined_pre_corr_count", "removed_by_correlation_count", "library_count", "new_selected_count",
    "existing_selected_count", "active_count", "elite_count", "tier_counts",
]


def atomic_json(path: Path, payload: dict) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    tmp.replace(path)


def passes(row: dict) -> bool:
    return (
        int(row.get("total_entry", 0) or 0) >= MIN_ENTRY
        and float(row.get("standard_lot_net_profit_usd_same_cost_model", 0.0) or 0.0) >= MIN_NET_PROFIT_USD
        and abs(float(row.get("correlation_max", 0.0) or 0.0)) <= MAX_CORR + 1e-12
        and str(row.get("correlation_gate", "")) == "PASS"
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", required=True)
    args = ap.parse_args()
    out = Path(args.out_dir)
    discovery = out / "latest_multimethod_v1_discovery.json"
    summary_path = out / "latest_multimethod_v1_discovery_summary.json"
    csv_path = out / "latest_multimethod_v1_discovery.csv"

    payload = json.loads(discovery.read_text(encoding="utf-8"))
    original = list(payload.get("ranking", []))
    kept = [dict(row) for row in original if passes(row)]
    removed = [dict(row) for row in original if not passes(row)]
    if not kept:
        raise RuntimeError("economic/correlation finalizer removed every Multi method")

    for rank, row in enumerate(kept, 1):
        row["rank"] = rank
    for row in kept:
        if not passes(row):
            raise RuntimeError(f"final selection contract failed: {row.get('config_hash')}")

    payload["ranking"] = kept
    payload["library_count"] = len(kept)
    payload["new_selected_count"] = sum(1 for row in kept if row.get("origin") == "DISCOVERY")
    payload["existing_selected_count"] = len(kept) - payload["new_selected_count"]
    payload["active_count"] = sum(1 for row in kept if row.get("tier_v1") in {"ACTIVE", "ELITE"})
    payload["elite_count"] = sum(1 for row in kept if row.get("tier_v1") == "ELITE")
    tiers: dict[str, int] = {}
    for row in kept:
        tier = str(row.get("tier_v1", "LIBRARY"))
        tiers[tier] = tiers.get(tier, 0) + 1
    payload["tier_counts"] = tiers
    payload["economic_selection_rule"] = {
        "min_entry": MIN_ENTRY,
        "min_net_profit_usd": MIN_NET_PROFIT_USD,
        "max_abs_pearson_log_return_equity": MAX_CORR,
        "selection": "per-symbol greedy; when correlation exceeds 0.50 the lower-quality method is removed",
    }
    payload["removed_by_economic_selection"] = removed
    payload["removed_by_economic_selection_count"] = len(removed)
    atomic_json(discovery, payload)

    with csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        w.writeheader()
        for row in kept:
            w.writerow({k: row.get(k) for k in CSV_FIELDS})

    summary = {k: payload.get(k) for k in SUMMARY_KEYS}
    summary["economic_floor_min_entry"] = MIN_ENTRY
    summary["economic_floor_min_net_profit_usd"] = MIN_NET_PROFIT_USD
    summary["economic_floor_max_corr"] = MAX_CORR
    summary["economic_floor_removed_count"] = len(removed)
    atomic_json(summary_path, summary)

    print(json.dumps({
        "status": "PASS",
        "before": len(original),
        "removed": len(removed),
        "final": len(kept),
        "min_entry": MIN_ENTRY,
        "min_net_profit_usd": MIN_NET_PROFIT_USD,
        "max_corr": MAX_CORR,
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
