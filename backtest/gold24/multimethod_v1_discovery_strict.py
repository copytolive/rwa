from __future__ import annotations

import multimethod_v1_discovery as impl

MIN_NET_PROFIT_USD = 20_000.0
_original_library_pre_corr = impl._library_pre_corr


def _strict_library_pre_corr(row: dict) -> bool:
    """Apply the user's economic floor before Pearson/log-equity greedy correlation."""
    return (
        _original_library_pre_corr(row)
        and int(row.get("total_entry", 0) or 0) >= 100
        and float(row.get("standard_lot_net_profit_usd_same_cost_model", 0.0) or 0.0) >= MIN_NET_PROFIT_USD
    )


impl._library_pre_corr = _strict_library_pre_corr

if __name__ == "__main__":
    raise SystemExit(impl.main())
