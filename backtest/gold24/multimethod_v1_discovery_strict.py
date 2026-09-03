from __future__ import annotations

import multimethod_v1_discovery as impl

# Authoritative user Candidate Gate:
#   Total Entry >= 100
#   Net Profit >= USD 20,000 at the exact 100-GOLD-unit / 1.00-lot reference
#   global abs Pearson(log-return equity) Corr <= 0.50 (applied by the shared greedy authority)
#
# PF/OOS/Positive-Year/SQN are HARD PASS/WATCH metrics, not Candidate admission filters.
MIN_ENTRY = 100
MIN_NET_PROFIT_USD = 20_000.0
PROBE_MIN_NET_PROFIT_USD_FLAT1 = MIN_NET_PROFIT_USD / float(impl.STANDARD_LOT_GOLD_UNITS)


def _strict_cheap_pass(metrics: dict) -> bool:
    """Lossless economic prefilter before exact qty=100 replay.

    core._cost and gross PnL are linear in quantity, so USD20k at 100 GOLD units
    maps exactly to USD200 at flat_lot=1. This prevents hidden PF/SQN filtering
    from discarding a true Candidate before exact replay.
    """
    return (
        int(metrics.get("trades", 0) or 0) >= MIN_ENTRY
        and float(metrics.get("net_profit", 0.0) or 0.0) >= PROBE_MIN_NET_PROFIT_USD_FLAT1
    )


def _strict_library_pre_corr(row: dict) -> bool:
    """Apply exactly the user's economic Candidate Gate before global correlation."""
    return (
        int(row.get("total_entry", 0) or 0) >= MIN_ENTRY
        and float(row.get("standard_lot_net_profit_usd_same_cost_model", 0.0) or 0.0)
        >= MIN_NET_PROFIT_USD
    )


impl._cheap_pass = _strict_cheap_pass
impl._library_pre_corr = _strict_library_pre_corr

if __name__ == "__main__":
    raise SystemExit(impl.main())
