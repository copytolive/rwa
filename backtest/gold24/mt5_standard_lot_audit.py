from __future__ import annotations

import argparse
import csv
import json
import sqlite3
from pathlib import Path

from core import Candidate, audit_dataset, backtest_candidate, pearson_log_equity

CONTRACT_SIZE_OZ = 100.0
PIP_SIZE_USD = 0.01
STANDARD_LOT = 1.0
STANDARD_LOT_GOLD_UNITS = CONTRACT_SIZE_OZ * STANDARD_LOT
REPORT_MIN_TRADES = 100
REPORT_MIN_NET_PROFIT_USD = 3000.0
CORR_MAX = 0.50
CORR_WORDING = (
    "Maks 0.50 (pearson, log-return equity). Metode: per-symbol greedy filter. "
    "> 0.50 → yang kualitas lebih rendah DIHAPUS."
)


def atomic_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, sort_keys=True, default=str))
    tmp.replace(path)


def load_positive(db_path: Path, min_trades: int = REPORT_MIN_TRADES) -> list[dict]:
    db = sqlite3.connect(db_path)
    rows = db.execute("SELECT config_hash, canonical_json, metrics_json FROM configs").fetchall()
    db.close()

    out: list[dict] = []
    for config_hash, canonical_raw, metrics_raw in rows:
        candidate = json.loads(canonical_raw)
        metrics = json.loads(metrics_raw) if metrics_raw else {}
        trades = int(metrics.get("trades", 0) or 0)
        net_profit = float(metrics.get("net_profit", 0.0) or 0.0)
        if trades < min_trades or net_profit <= 0:
            continue
        if bool(metrics.get("exact_execution_duplicate", False)):
            continue
        out.append({
            "config_hash": config_hash,
            "candidate": candidate,
            "metrics": metrics,
        })

    out.sort(
        key=lambda r: (
            int(r["metrics"].get("trades", 0) or 0),
            float(r["metrics"].get("net_profit", 0.0) or 0.0),
        ),
        reverse=True,
    )
    return out


def method_label(c: dict) -> str:
    return (
        f"{c['family']} f{c['fast']}/s{c['slow']} "
        f"p1={c['p1']} p2={c['p2']} p3={c['p3']} "
        f"off={c['offset']} exp={c['expiry']}"
    )


def write_csv(path: Path, rows: list[dict], fields: list[str]) -> None:
    with path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for row in rows:
            w.writerow({k: row.get(k) for k in fields})


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--state-dir", default=".gold24-canonical-v11")
    p.add_argument("--out-dir", default="backtest/gold24/runtime_mt5_lot")
    args = p.parse_args()

    state = Path(args.state_dir).resolve()
    out_dir = Path(args.out_dir).resolve()
    dataset = state / "gate_a" / "GC1_COMEX_TRADINGVIEW_D1_PRIMARY.csv"
    receipt = state / "gate_a" / "gate_a_receipt.json"
    db_path = state / "gold24-v11.db"

    if not db_path.exists():
        raise SystemExit(f"missing canonical DB: {db_path}")

    source_summary_path = Path("runtime_v11/latest_validation_summary.json")
    source_summary = json.loads(source_summary_path.read_text()) if source_summary_path.exists() else {}

    d, audit = audit_dataset(dataset, receipt, "D1")
    source_rows = load_positive(db_path, REPORT_MIN_TRADES)
    if not source_rows:
        raise SystemExit(f"no positive >={REPORT_MIN_TRADES}-trade canonical rows found")

    ranking: list[dict] = []
    bar_pnls: dict[str, object] = {}
    for source_rank, src in enumerate(source_rows, 1):
        c = Candidate(**src["candidate"])
        current = src["metrics"]
        rerun = backtest_candidate(d, c, flat_lot=STANDARD_LOT_GOLD_UNITS)
        m = rerun["metrics"]

        current_trades = int(current.get("trades", 0) or 0)
        std_trades = int(m.get("trades", 0) or 0)
        if std_trades != current_trades:
            raise RuntimeError(
                f"trade-count parity failure for {src['config_hash']}: current={current_trades}, stdlot={std_trades}"
            )

        current_net = float(current.get("net_profit", 0.0) or 0.0)
        std_net = float(m.get("net_profit", 0.0) or 0.0)
        scale = std_net / current_net if current_net else None
        candidate = src["candidate"]
        bar_pnls[src["config_hash"]] = rerun["bar_pnl"]

        ranking.append({
            "source_rank": source_rank,
            "config_hash": src["config_hash"],
            "method": method_label(candidate),
            "family": candidate["family"],
            "timeframe": candidate["timeframe"],
            "entry_method": candidate["entry_method"],
            "direction_mode": candidate["direction_mode"],
            "sl_usd": float(candidate["sl"]),
            "tp_usd": float(candidate["tp"]),
            "trades": std_trades,
            "current_canonical_position": "1 GOLD unit",
            "current_net_profit_usd": current_net,
            "current_ev_per_trade_usd": float(current.get("expectancy", 0.0) or 0.0),
            "xauusd_standard_lot": STANDARD_LOT,
            "contract_size_oz": CONTRACT_SIZE_OZ,
            "pip_size_usd": PIP_SIZE_USD,
            "pip_value_per_standard_lot_usd": CONTRACT_SIZE_OZ * PIP_SIZE_USD,
            "standard_lot_gold_units": STANDARD_LOT_GOLD_UNITS,
            "standard_lot_net_profit_usd_same_cost_model": std_net,
            "standard_lot_ev_per_trade_usd_same_cost_model": float(m.get("expectancy", 0.0) or 0.0),
            "standard_lot_profit_factor_same_cost_model": float(m.get("profit_factor", 0.0) or 0.0),
            "standard_lot_win_rate_pct": float(m.get("wr", 0.0) or 0.0),
            "standard_lot_max_dd_pct_starting_equity_10000": float(m.get("max_dd_pct", 0.0) or 0.0),
            "standard_lot_sqn_same_cost_model": float(m.get("sqn", 0.0) or 0.0),
            "history_years": float(m.get("history_years", 0.0) or 0.0),
            "v11_sample_pass": bool(std_trades >= 300),
            "v11_tier1_pass_same_cost_model": bool(m.get("tier1_pass", False)),
            "v11_full_metrics_pass_same_cost_model": bool(m.get("full_metrics_pass", False)),
            "net_profit_scale_ratio_vs_qty1": scale,
            "interpretation": "Exact re-backtest at 100 GOLD units using the SAME canonical fill/cost model; not yet broker-specific MT5/Exness cost parity.",
        })

    ranking.sort(
        key=lambda r: (
            r["standard_lot_net_profit_usd_same_cost_model"],
            r["standard_lot_profit_factor_same_cost_model"],
            r["trades"],
        ),
        reverse=True,
    )
    for rank, row in enumerate(ranking, 1):
        row["rank"] = rank

    economic = [
        r.copy() for r in ranking
        if r["trades"] >= REPORT_MIN_TRADES
        and r["standard_lot_net_profit_usd_same_cost_model"] >= REPORT_MIN_NET_PROFIT_USD
    ]

    # Quality order for the portfolio-style correlation gate follows the canonical
    # PF-first principle, then net profit, then lower DD, then larger sample.
    economic.sort(
        key=lambda r: (
            r["standard_lot_profit_factor_same_cost_model"],
            r["standard_lot_net_profit_usd_same_cost_model"],
            -r["standard_lot_max_dd_pct_starting_equity_10000"],
            r["trades"],
        ),
        reverse=True,
    )

    selected: list[dict] = []
    removed: list[dict] = []
    for row in economic:
        corr_pairs: list[tuple[float, str]] = []
        for prior in selected:
            corr = abs(float(pearson_log_equity(
                bar_pnls[row["config_hash"]],
                bar_pnls[prior["config_hash"]],
            )))
            corr_pairs.append((corr, prior["config_hash"]))
        max_corr = max((x[0] for x in corr_pairs), default=0.0)
        max_against = max(corr_pairs, default=(0.0, None), key=lambda x: x[0])[1]
        row["correlation_max"] = max_corr
        row["correlation_against"] = max_against
        if max_corr <= CORR_MAX + 1e-12:
            row["correlation_gate"] = "PASS"
            selected.append(row)
        else:
            row["correlation_gate"] = "REMOVED >0.50"
            removed.append(row)

    for rank, row in enumerate(selected, 1):
        row["strict_rank"] = rank
        row["status"] = (
            "PASS ENTRY>=100 + NP>=USD3000 + CORR<=0.50; "
            + ("V11 TIER1 PASS" if row["v11_tier1_pass_same_cost_model"] else "NOT V11 TIER1 QUALIFIED")
        )
    for row in removed:
        row["status"] = "REMOVED BY CORR >0.50"

    payload = {
        "schema": "gold24-standard-lot-audit-v2",
        "status": "PASS",
        "purpose": "Correct the position-size interpretation mismatch between canonical Qty=1 GOLD unit and MT5 InpLot=1.0 standard lot.",
        "canonical_scope": "Hyperliquid GOLD base-asset quantity",
        "source_run_id": str(source_summary.get("github_run_id", "")),
        "source_batch": source_summary.get("batch"),
        "source_candidate_cursor": source_summary.get("candidate_cursor"),
        "report_minimum_trades": REPORT_MIN_TRADES,
        "standard_lot_reference": {
            "symbol": "XAUUSD",
            "lots": STANDARD_LOT,
            "contract_size_oz": CONTRACT_SIZE_OZ,
            "gold_units": STANDARD_LOT_GOLD_UNITS,
            "pip_size_usd": PIP_SIZE_USD,
            "pip_value_usd": CONTRACT_SIZE_OZ * PIP_SIZE_USD,
        },
        "important": [
            "Canonical GOLD v11 Qty=1.0 is not one MT5 standard lot.",
            "The standard-lot figures below are exact re-backtests at 100 GOLD units; MDD is recomputed rather than multiplied by 100.",
            "These results still use the canonical stressed Hyperliquid cost model. MT5/Exness spread, commission, swap, slippage and symbol contract settings require a separate broker-parity run.",
        ],
        "gate_a": audit,
        "count": len(ranking),
        "ranking": ranking,
    }

    strict_payload = {
        "schema": "gold24-entry100-net3000-standard-lot-corr-v1",
        "status": "PASS",
        "source_run_id": str(source_summary.get("github_run_id", "")),
        "source_batch": source_summary.get("batch"),
        "source_candidate_cursor": source_summary.get("candidate_cursor"),
        "minimum_trades": REPORT_MIN_TRADES,
        "minimum_net_profit_usd_standard_lot": REPORT_MIN_NET_PROFIT_USD,
        "unit": "1.0 XAUUSD standard lot = 100 GOLD units; exact re-backtest under canonical stressed Hyperliquid cost model",
        "correlation_rule": {
            "maximum": CORR_MAX,
            "metric": "absolute Pearson correlation of log-return equity",
            "selection": "per-symbol greedy filter; PF first, then net profit, lower DD, larger sample",
            "wording": CORR_WORDING,
        },
        "economic_count_before_correlation": len(economic),
        "removed_by_correlation_count": len(removed),
        "count": len(selected),
        "ranking": selected,
        "removed_by_correlation": removed,
    }

    out_dir.mkdir(parents=True, exist_ok=True)
    atomic_json(out_dir / "latest_standard_lot_audit.json", payload)
    atomic_json(out_dir / "latest_entry100_net3000_standard_lot.json", strict_payload)

    full_fields = [
        "rank", "source_rank", "config_hash", "method", "family", "timeframe", "entry_method", "direction_mode",
        "sl_usd", "tp_usd", "trades", "current_net_profit_usd", "current_ev_per_trade_usd",
        "standard_lot_net_profit_usd_same_cost_model", "standard_lot_ev_per_trade_usd_same_cost_model",
        "standard_lot_profit_factor_same_cost_model", "standard_lot_win_rate_pct",
        "standard_lot_max_dd_pct_starting_equity_10000", "standard_lot_sqn_same_cost_model",
        "history_years", "v11_sample_pass", "v11_tier1_pass_same_cost_model", "net_profit_scale_ratio_vs_qty1",
    ]
    write_csv(out_dir / "latest_standard_lot_audit.csv", ranking, full_fields)

    strict_fields = [
        "strict_rank", "source_rank", "config_hash", "method", "family", "timeframe", "entry_method", "direction_mode",
        "sl_usd", "tp_usd", "trades", "standard_lot_win_rate_pct", "standard_lot_profit_factor_same_cost_model",
        "standard_lot_net_profit_usd_same_cost_model", "standard_lot_ev_per_trade_usd_same_cost_model",
        "standard_lot_max_dd_pct_starting_equity_10000", "standard_lot_sqn_same_cost_model", "history_years",
        "v11_sample_pass", "correlation_max", "correlation_gate", "status",
    ]
    write_csv(out_dir / "latest_entry100_net3000_standard_lot.csv", selected, strict_fields)

    print(json.dumps({
        "status": "PASS",
        "count_positive_entry100": len(ranking),
        "economic_count_before_correlation": len(economic),
        "removed_by_correlation_count": len(removed),
        "strict_count_after_correlation": len(selected),
        "out_json": str(out_dir / "latest_standard_lot_audit.json"),
        "strict_json": str(out_dir / "latest_entry100_net3000_standard_lot.json"),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
