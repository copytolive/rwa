from __future__ import annotations

import argparse
import json
import math
import re
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd

from core import Candidate, audit_dataset
import multimethod_v1_discovery as impl
import hardpass_targeted_search as classify_impl

METHOD_RE = re.compile(
    r"^(?P<family>[A-Z0-9_]+) f(?P<fast>\d+)/s(?P<slow>\d+) "
    r"p1=(?P<p1>[-+0-9.eE]+) p2=(?P<p2>[-+0-9.eE]+) p3=(?P<p3>[-+0-9.eE]+) "
    r"off=(?P<offset>[-+0-9.eE]+) exp=(?P<expiry>\d+)$"
)
STARTING_EQUITY = 10000.0


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def candidate_from_audit(row: dict) -> Candidate:
    m = METHOD_RE.match(str(row["method"]))
    if not m:
        raise RuntimeError(f"cannot reconstruct candidate from method: {row['method']}")
    g = m.groupdict()
    c = Candidate(
        symbol="GOLD",
        timeframe=str(row.get("timeframe") or "D1"),
        family=str(row["family"]),
        fast=int(g["fast"]),
        slow=int(g["slow"]),
        p1=float(g["p1"]),
        p2=float(g["p2"]),
        p3=float(g["p3"]),
        entry_method=str(row["entry_method"]),
        direction_mode=str(row["direction_mode"]),
        sl=float(row["sl_pips"]) * 0.01,
        tp=float(row["tp_pips"]) * 0.01,
        offset=float(g["offset"]),
        expiry=int(g["expiry"]),
    )
    if c.config_hash != str(row["config_hash"]):
        raise RuntimeError(
            f"config reconstruction mismatch method={row['method']} "
            f"expected={row['config_hash']} got={c.config_hash}"
        )
    return c


def daily_equity_log_returns(d: pd.DataFrame, bar_pnl: np.ndarray) -> pd.Series:
    if len(d) != len(bar_pnl):
        raise RuntimeError("bar_pnl length mismatch")
    dates = pd.to_datetime(d["Date"], utc=True).dt.floor("D")
    pnl = pd.Series(np.asarray(bar_pnl, dtype=float), index=dates).groupby(level=0).sum().sort_index()
    equity = STARTING_EQUITY + pnl.cumsum()
    if (equity <= 0).any():
        return pd.Series(dtype=float)
    ret = np.log(equity).diff().dropna()
    ret.name = "log_return_equity"
    return ret


def corr_abs(a: pd.Series, b: pd.Series) -> tuple[float, int]:
    z = pd.concat([a.rename("a"), b.rename("b")], axis=1, join="inner").dropna()
    if len(z) < 20:
        return 0.0, int(len(z))
    if float(z["a"].std(ddof=0)) == 0.0 or float(z["b"].std(ddof=0)) == 0.0:
        return 0.0, int(len(z))
    c = float(z["a"].corr(z["b"]))
    if not math.isfinite(c):
        return 0.0, int(len(z))
    return abs(c), int(len(z))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--d1-state-dir", required=True)
    ap.add_argument("--h4-artifact-dir", required=True)
    ap.add_argument("--repo-root", default=".")
    ap.add_argument("--out", required=True)
    ap.add_argument("--h4-source-run-id", default="")
    a = ap.parse_args()

    repo = Path(a.repo_root).resolve()
    d1_state = Path(a.d1_state_dir).resolve()
    h4_dir = Path(a.h4_artifact_dir).resolve()

    d1_csv = d1_state / "gate_a/GC1_COMEX_TRADINGVIEW_D1_PRIMARY.csv"
    d1_receipt = d1_state / "gate_a/gate_a_receipt.json"
    h4_csv = h4_dir / "GC1_COMEX_TRADINGVIEW_H4_PRIMARY.csv"
    h4_receipt = h4_dir / "gate_a_h4_receipt.json"
    h4_result = h4_dir / "native_h4_hardpass.json"

    d1, d1_audit = audit_dataset(d1_csv, d1_receipt, "D1")
    h4, h4_audit = audit_dataset(h4_csv, h4_receipt, "H4")

    screen = load(repo / "backtest/gold24/runtime_screening_gpt/screening_gpt_real_audit.json")
    combined_audit = load(repo / "backtest/gold24/runtime_screening_gpt/combined_portfolio_audit.json")
    h4_payload = load(h4_result)

    d1_rows_by_hash = {str(r["config_hash"]): r for r in screen.get("rows", [])}
    input_hashes = [str(r["config_hash"]) for r in combined_audit.get("rows", [])]
    if len(input_hashes) != int(combined_audit.get("methods_input", len(input_hashes))):
        raise RuntimeError("D1 input set size mismatch")

    exact_rows: list[dict] = []
    returns: dict[str, pd.Series] = {}
    origin_tf: dict[str, str] = {}

    for h in input_hashes:
        src = d1_rows_by_hash.get(h)
        if not src:
            raise RuntimeError(f"missing D1 screening row for {h}")
        c = candidate_from_audit(src)
        row, bp, tp = impl._exact_row(d1, d1_audit, c.canonical_dict(), "D1_GLOBAL_INPUT")
        row.update(impl.monte_carlo_metrics(tp, row["config_hash"]))
        exact_rows.append(row)
        returns[row["config_hash"]] = daily_equity_log_returns(d1, bp)
        origin_tf[row["config_hash"]] = "D1"

    h4_internal = list(h4_payload.get("hard_pass_rows", []))
    for src in h4_internal:
        cdict = src.get("candidate")
        if not cdict:
            raise RuntimeError("H4 hard-pass row missing candidate")
        c = Candidate(**cdict)
        if c.timeframe != "H4":
            raise RuntimeError("native H4 result contains non-H4 candidate")
        row, bp, tp = impl._exact_row(h4, h4_audit, c.canonical_dict(), "NATIVE_H4_GLOBAL_INPUT")
        row.update(impl.monte_carlo_metrics(tp, row["config_hash"]))
        exact_rows.append(row)
        returns[row["config_hash"]] = daily_equity_log_returns(h4, bp)
        origin_tf[row["config_hash"]] = "H4"

    # Global quality-ranked greedy filter across every D1 source method plus
    # every native-H4 HARD PASS. The correlation comparison is made at a common
    # UTC daily equity-close frequency only for correlation. H4 backtest OHLCV
    # remains source-native H4 and is never resampled into claimed H4 data.
    ordered = sorted(exact_rows, key=impl._quality, reverse=True)
    selected: list[dict] = []
    rejected: list[dict] = []
    pair_count = 0
    violations = 0
    max_pair = {"corr_abs": 0.0, "a": None, "b": None, "overlap_days": 0}

    for row in ordered:
        h = row["config_hash"]
        pairs = []
        for old in selected:
            oh = old["config_hash"]
            corr, overlap = corr_abs(returns[h], returns[oh])
            pair_count += 1
            if corr > max_pair["corr_abs"]:
                max_pair = {"corr_abs": corr, "a": h, "b": oh, "overlap_days": overlap}
            pairs.append((corr, overlap, oh))
        max_corr, overlap_days, against = max(pairs, default=(0.0, 0, None), key=lambda z: z[0])
        row["correlation_max"] = float(max_corr)
        row["correlation_against"] = against
        row["correlation_overlap_days"] = int(overlap_days)
        row["correlation_alignment"] = "common UTC daily equity close; H4 PnL summed by UTC date for correlation only"
        if max_corr <= 0.50 + 1e-12:
            row["correlation_gate"] = "PASS"
            classify_impl._classify(row)
            selected.append(row)
        else:
            violations += 1
            row["correlation_gate"] = "REMOVED >0.50"
            classify_impl._classify(row)
            rejected.append(row)

    hard = [r for r in selected if r.get("classification") == "HARD PASS"]
    watch = [r for r in selected if r.get("classification") == "WATCH"]
    fail = [r for r in selected if r.get("classification") == "FAIL"]
    h4_kept = [r for r in selected if origin_tf.get(r["config_hash"]) == "H4"]
    h4_hard = [r for r in hard if origin_tf.get(r["config_hash"]) == "H4"]

    family_counts = Counter(str(r["family"]) for r in selected)
    max_share = max(family_counts.values(), default=0) / max(len(selected), 1)
    distinct = len(family_counts)
    ready_div = distinct >= 6 and max_share <= 0.25
    target10 = distinct >= 10

    payload = {
        "schema": "gold10b-global-cross-timeframe-correlation-v1",
        "status": "PASS",
        "correlation_rule": "absolute Pearson(log-return equity), global per-symbol",
        "correlation_alignment": {
            "common_frequency": "UTC daily equity close",
            "D1": "native D1 bar PnL",
            "H4": "native H4 bar PnL summed by UTC date for correlation only",
            "backtest_resampling": False,
            "reason": "different native bar timestamps require a common equity-return clock; source OHLCV is unchanged",
        },
        "source_h4_run_id": str(a.h4_source_run_id or ""),
        "datasets": {
            "D1": {
                "rows": d1_audit["rows"], "sha256": d1_audit["dataset_sha256"],
                "start_utc": d1_audit["start_utc"], "end_utc": d1_audit["end_utc"],
                "provider": d1_audit["crosscheck_provider"],
            },
            "H4": {
                "rows": h4_audit["rows"], "sha256": h4_audit["dataset_sha256"],
                "start_utc": h4_audit["start_utc"], "end_utc": h4_audit["end_utc"],
                "provider": h4_audit["crosscheck_provider"],
            },
        },
        "methods_input_d1": len(input_hashes),
        "methods_input_h4_internal_hardpass": len(h4_internal),
        "methods_input_total": len(exact_rows),
        "selected_global": len(selected),
        "rejected_global": len(rejected),
        "greedy_comparisons_executed": pair_count,
        "greedy_rejections_corr_gt_0_50": violations,
        "max_pair": max_pair,
        "hard_pass_global": len(hard),
        "watch_global": len(watch),
        "fail_global": len(fail),
        "h4_selected_after_global_corr": len(h4_kept),
        "h4_hard_pass_after_global_corr": len(h4_hard),
        "distinct_family": distinct,
        "family_counts": dict(sorted(family_counts.items())),
        "max_family_concentration": max_share,
        "portfolio_min_6_family_gate": ready_div,
        "portfolio_target_10_family_gate": target10,
        "selected": [
            {
                "config_hash": r["config_hash"], "method": r["method"], "family": r["family"],
                "timeframe": r["timeframe"], "total_entry": r["total_entry"],
                "pf_net": r["standard_lot_profit_factor_same_cost_model"],
                "net_profit_usd": r["standard_lot_net_profit_usd_same_cost_model"],
                "max_dd_pct": r["standard_lot_max_dd_pct_starting_equity_10000"],
                "oos_pf": r["oos_profit_factor"], "monte_carlo_pass": r["monte_carlo_pass"],
                "positive_years_pct": r["positive_years_pct"], "correlation_max": r["correlation_max"],
                "correlation_against": r["correlation_against"], "correlation_overlap_days": r["correlation_overlap_days"],
                "hard_pass_gate_count": r["hard_pass_gate_count"], "classification": r["classification"],
                "candidate": r.get("candidate"),
            }
            for r in selected
        ],
        "rejected": [
            {
                "config_hash": r["config_hash"], "method": r["method"], "family": r["family"],
                "timeframe": r["timeframe"], "correlation_max": r["correlation_max"],
                "correlation_against": r["correlation_against"], "correlation_overlap_days": r["correlation_overlap_days"],
                "hard_pass_gate_count": r["hard_pass_gate_count"], "classification": r["classification"],
            }
            for r in rejected
        ],
        "portfolio_readiness": "NOT_READY",
        "live_ready": False,
        "live_ready_reason": "margin/slippage/broker interaction still requires explicit validation",
    }

    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": payload["status"],
        "methods_input_total": payload["methods_input_total"],
        "selected_global": payload["selected_global"],
        "hard_pass_global": payload["hard_pass_global"],
        "h4_hard_pass_after_global_corr": payload["h4_hard_pass_after_global_corr"],
        "distinct_family": payload["distinct_family"],
        "max_family_concentration": payload["max_family_concentration"],
        "greedy_rejections_corr_gt_0_50": payload["greedy_rejections_corr_gt_0_50"],
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
