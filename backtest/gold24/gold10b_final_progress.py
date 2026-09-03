from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def load(rel: str, default=None):
    p = ROOT / rel
    if not p.exists():
        return {} if default is None else default
    return json.loads(p.read_text(encoding="utf-8"))


def main() -> int:
    v11 = load("runtime_v11/latest_validation_summary.json")
    multi = load("runtime_multimethod_v1/latest_multimethod_v1_discovery_summary.json")
    target = load("runtime_hardpass_targeted/latest_hardpass_targeted.json")
    port = load("runtime_screening_gpt/combined_portfolio_audit.json")
    audit = load("runtime_screening_gpt/screening_gpt_real_audit.json")
    h4 = load("runtime_native_h4/latest_native_h4_hardpass.json")
    cross = load("runtime_global_cross_tf/latest_global_d1_h4_corr.json")

    finalized = int(v11.get("cumulative_configs_archived", 0) or 0)
    master_eval = int(
        multi.get("evaluated_config_hash_count_cumulative",
                  multi.get("candidate_evaluated", multi.get("evaluated", 0))) or 0
    )
    targeted_eval = int(
        target.get("cumulative_targeted_evaluated_unique",
                   target.get("targeted_evaluated_unique", 0)) or 0
    )
    discovery_total = master_eval + targeted_eval

    source_input = int(port.get("methods_input", 0) or 0)
    global_kept = int(port.get("global_greedy_kept_count", 0) or 0)
    corr_viol = int(port.get("global_corr_violations", port.get("corr_violation_count", 0)) or 0)

    # Older audit payloads may not carry a precomputed violation count. The
    # exact pair count remains authoritative and no inferred number is invented.
    pair_count = int(port.get("global_pair_count", 0) or 0)
    family_count = int(port.get("final_distinct_family_count", 0) or 0)
    max_share = float(port.get("final_max_family_share", 0.0) or 0.0)

    hard_all = int(port.get("hard_pass_count", 0) or 0)
    watch_all = int(port.get("watch_count", 0) or 0)
    fail_all = int(port.get("fail_count", 0) or 0)

    target_hard = int(target.get("hard_pass_count", 0) or 0)
    target_new_hard = int(target.get("hard_pass_new_count", 0) or 0)
    target_watch = int(target.get("watch_count", 0) or 0)
    target_fail = int(target.get("fail_count", 0) or 0)

    h4_internal = int(h4.get("native_h4_hardpass_kept", 0) or 0)
    cross_status = str(cross.get("status", "NOT_RUN"))
    h4_corr_state = "PASS" if cross_status == "PASS" else str(h4.get("global_cross_timeframe_corr_status", "NOT_RUN"))
    h4_global_eligible = int(cross.get("h4_hard_pass_after_global_corr", 0) or 0) if cross_status == "PASS" else 0
    cross_global_hard = int(cross.get("hard_pass_global", hard_all) or 0) if cross_status == "PASS" else hard_all
    cross_global_watch = int(cross.get("watch_global", watch_all) or 0) if cross_status == "PASS" else watch_all
    cross_global_fail = int(cross.get("fail_global", fail_all) or 0) if cross_status == "PASS" else fail_all
    cross_selected = int(cross.get("selected_global", global_kept) or 0) if cross_status == "PASS" else global_kept
    cross_distinct = int(cross.get("distinct_family", family_count) or 0) if cross_status == "PASS" else family_count
    cross_max_share = float(cross.get("max_family_concentration", max_share) or 0.0) if cross_status == "PASS" else max_share

    payload = {
        "schema": "gold10b-final-progress-v1",
        "rules": {
            "total_backtest_definition": "finalized canonical only; candidate discovery is separate",
            "candidate_gate": {"entry_min": 100, "net_profit_usd_min": 20000.0, "corr_max": 0.50},
            "hard_pass": {
                "entry_min": 300, "pf_min": 1.20, "max_dd_pct_max": 25.0,
                "ev_gt": 0.0, "oos_pf_min": 1.00, "monte_carlo": "PASS",
                "positive_year_pct_min": 60.0, "corr_max": 0.50,
            },
            "correlation": "absolute Pearson(log-return equity), global per-symbol",
            "xauusd_pip_usd": 0.01,
        },
        "before": {
            "finalized_backtest": 65357,
            "candidate_evaluated": 1191912,
            "candidate_pass_global": 115,
            "hard_pass": 0,
            "watch": 24,
            "fail": 94,
            "selected_methods": 115,
            "distinct_family": 25,
            "max_family_concentration": 0.1565217391304348,
            "python_verified": 118,
            "mt5_verified": 118,
            "sample_ge_300_count": 2,
            "max_dd_le_25_count": 5,
            "portfolio_readiness": "NOT_READY",
        },
        "after": {
            "finalized_backtest": finalized,
            "master_candidate_evaluated": master_eval,
            "targeted_candidate_evaluated_unique": targeted_eval,
            "candidate_evaluated_discovery_total": discovery_total,
            "candidate_pass_global_d1": global_kept,
            "hard_pass_portfolio_audit": hard_all,
            "watch_portfolio_audit": watch_all,
            "fail_portfolio_audit": fail_all,
            "source_methods_input": source_input,
            "global_corr_kept_d1": global_kept,
            "global_corr_kept_all_timeframes": cross_selected,
            "global_pair_count": pair_count,
            "corr_violations": corr_viol if corr_viol else None,
            "distinct_family_d1": family_count,
            "distinct_family_all_timeframes": cross_distinct,
            "max_family_concentration_d1": max_share,
            "max_family_concentration_all_timeframes": cross_max_share,
            "sample_ge_300_count": int(port.get("sample_ge_300_count", 0) or 0),
            "max_dd_le_25_count": int(port.get("max_dd_le_25_count", 0) or 0),
            "portfolio_readiness": str(port.get("portfolio_readiness", "NOT_READY")),
        },
        "latest_targeted_search": {
            "schema": target.get("schema"),
            "status": target.get("status"),
            "targeted_evaluated_unique_this_run": int(target.get("targeted_evaluated_unique", 0) or 0),
            "cumulative_targeted_evaluated_unique": targeted_eval,
            "combined_candidate_evaluated_reported": int(target.get("combined_candidate_evaluated", 0) or 0),
            "prefilter_survivors": int(target.get("prefilter_survivors", 0) or 0),
            "full_pre_corr_survivors": int(target.get("full_pre_corr_survivors", 0) or 0),
            "hard_pass_count": target_hard,
            "hard_pass_new_count": target_new_hard,
            "watch_count": target_watch,
            "fail_count": target_fail,
            "global_corr_rejected": int(target.get("global_corr_rejected", 0) or 0),
            "threshold_relaxation": target.get("generation_profile", {}).get("threshold_relaxation"),
        },
        "native_h4": {
            "status": h4.get("status", "NOT_PUBLISHED"),
            "dataset": h4.get("dataset", {}),
            "candidate_evaluated_unique": int(h4.get("candidate_evaluated_unique", 0) or 0),
            "internal_hard_pass_kept": h4_internal,
            "global_cross_timeframe_corr_status": h4_corr_state,
            "globally_eligible_hard_pass": h4_global_eligible,
            "portfolio_readiness": h4.get("portfolio_readiness", "NOT_READY"),
        },
        "global_cross_timeframe": {
            "status": cross_status,
            "methods_input_total": int(cross.get("methods_input_total", 0) or 0),
            "selected_global": cross_selected if cross_status == "PASS" else 0,
            "hard_pass_global": cross_global_hard if cross_status == "PASS" else hard_all,
            "watch_global": cross_global_watch if cross_status == "PASS" else watch_all,
            "fail_global": cross_global_fail if cross_status == "PASS" else fail_all,
            "h4_hard_pass_after_global_corr": h4_global_eligible,
            "distinct_family": cross_distinct if cross_status == "PASS" else family_count,
            "max_family_concentration": cross_max_share if cross_status == "PASS" else max_share,
            "correlation_rule": cross.get("correlation_rule", "absolute Pearson(log-return equity), global per-symbol"),
        },
        "hard_pass_global_final": cross_global_hard,
        "live_ready": False,
        "live_ready_reason": "margin/slippage/broker interaction is not validated; native H4 methods are excluded until global cross-timeframe correlation is PASS",
    }

    out = ROOT / "runtime_final_progress/latest_final_progress.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
