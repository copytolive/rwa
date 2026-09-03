from __future__ import annotations

"""Compatibility shim for the canonical CopyToLive unified backtest engine.

Do not add execution logic here.  GitHub replay, production and local reference
runs must share copytolive_unified_engine.py as the single execution kernel.
"""

from copytolive_unified_engine import (  # noqa: F401
    ENGINE_ID,
    COPYTOLIVE_DEPOSIT_USD,
    COPYTOLIVE_RISK_USD,
    COPYTOLIVE_STRESSED_FEE,
    COPYTOLIVE_WF_TRAIN_PCT,
    COPYTOLIVE_SL_PCTS,
    COPYTOLIVE_TP_RATIOS,
    CopyToLiveExecutionConfig,
    compute_vol_mask,
    compute_session_mask,
    compute_mtf_bias,
    filter_mode_from_signal_type,
    apply_production_filter,
    run_copytolive_backtest,
    empty_metrics,
    compute_copytolive_metrics,
    validate_copytolive_period,
    walk_forward_copytolive,
    execution_digest,
    adapt_core_candidate_signals,
)

__all__ = [
    "ENGINE_ID",
    "COPYTOLIVE_DEPOSIT_USD",
    "COPYTOLIVE_RISK_USD",
    "COPYTOLIVE_STRESSED_FEE",
    "COPYTOLIVE_WF_TRAIN_PCT",
    "COPYTOLIVE_SL_PCTS",
    "COPYTOLIVE_TP_RATIOS",
    "CopyToLiveExecutionConfig",
    "compute_vol_mask",
    "compute_session_mask",
    "compute_mtf_bias",
    "filter_mode_from_signal_type",
    "apply_production_filter",
    "run_copytolive_backtest",
    "empty_metrics",
    "compute_copytolive_metrics",
    "validate_copytolive_period",
    "walk_forward_copytolive",
    "execution_digest",
    "adapt_core_candidate_signals",
]
