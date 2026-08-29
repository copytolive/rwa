from __future__ import annotations

import argparse
import csv
import json
import sqlite3
from pathlib import Path

from core import Candidate, audit_dataset, backtest_candidate

CONTRACT_SIZE_OZ = 100.0
PIP_SIZE_USD = 0.01
STANDARD_LOT = 1.0
STANDARD_LOT_GOLD_UNITS = CONTRACT_SIZE_OZ * STANDARD_LOT


def atomic_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, sort_keys=True, default=str))
    tmp.replace(path)


def load_positive_200(db_path: Path) -> list[dict]:
    db = sqlite3.connect(db_path)
    rows = db.execute("SELECT config_hash, canonical_json, metrics_json FROM configs").fetchall()
    db.close()

    out: list[dict] = []
    for config_hash, canonical_raw, metrics_raw in rows:
        candidate = json.loads(canonical_raw)
        metrics = json.loads(metrics_raw) if metrics_raw else {}
        trades = int(metrics.get("trades", 0) or 0)
        net_profit = float(metrics.get("net_profit", 0.0) or 0.0)
        if trades < 200 or net_profit <= 0:
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

    d, audit = audit_dataset(dataset, receipt, "D1")
    source_rows = load_positive_200(db_path)
    if not source_rows:
        raise SystemExit("no positive >=200-trade canonical rows found")

    ranking: list[dict] = []
    for rank, src in enumerate(source_rows, 1):
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

        ranking.append({
            "rank": rank,
            "config_hash": src["config_hash"],
            "candidate": src["candidate"],
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
            "net_profit_scale_ratio_vs_qty1": scale,
            "interpretation": "Exact re-backtest at 100 GOLD units using the SAME canonical fill/cost model; not yet broker-specific MT5/Exness cost parity.",
        })

    payload = {
        "schema": "gold24-standard-lot-audit-v1",
        "status": "PASS",
        "purpose": "Correct the position-size interpretation mismatch between canonical Qty=1 GOLD unit and MT5 InpLot=1.0 standard lot.",
        "canonical_scope": "Hyperliquid GOLD base-asset quantity",
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
            "The standard-lot figures below are re-backtested at 100 GOLD units, so MDD is recomputed rather than multiplied by 100.",
            "These results still use the canonical stressed Hyperliquid cost model. MT5/Exness spread, commission, swap, slippage and symbol contract settings require a separate broker-parity run.",
        ],
        "gate_a": audit,
        "count": len(ranking),
        "ranking": ranking,
    }

    out_dir.mkdir(parents=True, exist_ok=True)
    atomic_json(out_dir / "latest_standard_lot_audit.json", payload)

    csv_path = out_dir / "latest_standard_lot_audit.csv"
    fields = [
        "rank", "config_hash", "family", "timeframe", "entry_method", "direction_mode",
        "sl_usd", "tp_usd", "trades", "current_net_profit_usd", "current_ev_per_trade_usd",
        "standard_lot_net_profit_usd", "standard_lot_ev_per_trade_usd", "standard_lot_pf",
        "standard_lot_wr_pct", "standard_lot_max_dd_pct_starting_equity_10000", "net_scale_ratio",
    ]
    with csv_path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in ranking:
            c = r["candidate"]
            w.writerow({
                "rank": r["rank"],
                "config_hash": r["config_hash"],
                "family": c["family"],
                "timeframe": c["timeframe"],
                "entry_method": c["entry_method"],
                "direction_mode": c["direction_mode"],
                "sl_usd": c["sl"],
                "tp_usd": c["tp"],
                "trades": r["trades"],
                "current_net_profit_usd": r["current_net_profit_usd"],
                "current_ev_per_trade_usd": r["current_ev_per_trade_usd"],
                "standard_lot_net_profit_usd": r["standard_lot_net_profit_usd_same_cost_model"],
                "standard_lot_ev_per_trade_usd": r["standard_lot_ev_per_trade_usd_same_cost_model"],
                "standard_lot_pf": r["standard_lot_profit_factor_same_cost_model"],
                "standard_lot_wr_pct": r["standard_lot_win_rate_pct"],
                "standard_lot_max_dd_pct_starting_equity_10000": r["standard_lot_max_dd_pct_starting_equity_10000"],
                "net_scale_ratio": r["net_profit_scale_ratio_vs_qty1"],
            })

    print(json.dumps({
        "status": "PASS",
        "count": len(ranking),
        "out_json": str(out_dir / "latest_standard_lot_audit.json"),
        "out_csv": str(csv_path),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
