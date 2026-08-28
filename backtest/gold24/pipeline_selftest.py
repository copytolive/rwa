from __future__ import annotations

import tempfile
from pathlib import Path

import pandas as pd

from core import Candidate, novelty_pass
from store import Store


def candidate(fast: int, family: str = "TREND_EMA") -> Candidate:
    return Candidate(
        symbol="GOLD", timeframe="D1", family=family,
        fast=fast, slow=50, p1=55.0, p2=55.0, p3=1.0,
        entry_method="STOP", direction_mode="BOTH",
        sl=12.5, tp=25.0, offset=1.0, expiry=3,
    )


def ledger(config_hash: str, net: float = 10.0) -> list[dict]:
    return [{
        "config_hash": config_hash,
        "fingerprint": "GOLD|TF=D1|STOP|DIR=BOTH|SL=12.50|TP=25.00|OFF=1.00|EXP=3",
        "family": "TREND_EMA",
        "entry_time": "2026-01-01T00:00:00+00:00",
        "exit_time": "2026-01-02T00:00:00+00:00",
        "entry_bar": 1,
        "exit_bar": 2,
        "side": "LONG",
        "pending_order": "buy_stop",
        "entry_price": 2000.0,
        "exit_price": 2025.0,
        "fixed_sl": 12.5,
        "fixed_tp": 25.0,
        "quantity": 1.0,
        "gross_pnl": 25.0,
        "cost": 15.0,
        "net_pnl": net,
        "exit_reason": "TP",
    }]


def main() -> None:
    base = candidate(10)
    too_close = candidate(11)   # 10% change: must fail novelty
    enough = candidate(12)      # 20% change: must pass novelty
    other_family = candidate(10, "ATR_BREAKOUT")
    assert novelty_pass(too_close, base) is False
    assert novelty_pass(enough, base) is True
    assert novelty_pass(other_family, base) is True

    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        store = Store(root / "s.db")
        first_ledger = pd.DataFrame(ledger(base.config_hash))
        shard = root / "ledger.parquet"
        first_ledger.to_parquet(shard, index=False)
        first = {
            "config_hash": base.config_hash,
            "candidate": base.canonical_dict(),
            "fingerprint": "GOLD|TF=D1|STOP|DIR=BOTH|SL=12.50|TP=25.00|OFF=1.00|EXP=3",
            "execution_hash": "same128",
            "metrics": {"trades": 1},
            "ledger": ledger(base.config_hash),
        }
        store.insert_result(first, str(shard), False)
        assert store.seen(base.config_hash)
        assert store.novelty_ok(too_close) is False
        assert store.novelty_ok(enough) is True

        second_hash = enough.config_hash
        identical = {
            "config_hash": second_hash,
            "candidate": enough.canonical_dict(),
            "fingerprint": first["fingerprint"],
            "execution_hash": "same128",
            "metrics": {"trades": 1},
            "ledger": [{**ledger(second_hash)[0], "config_hash": second_hash}],
        }
        assert store.exact_execution_duplicate(identical) is True

        different = {
            **identical,
            "ledger": [{**identical["ledger"][0], "net_pnl": 9.0}],
        }
        assert store.exact_execution_duplicate(different) is False
        store.close()

    print("pipeline_selftest: PASS — novelty>=20% and exact full-ledger duplicate authority verified")


if __name__ == "__main__":
    main()
