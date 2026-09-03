#!/usr/bin/env python3
from __future__ import annotations

"""Build the D1 companion used by the unified CopyToLive engine.

For GitHub-hosted reconstruction only. Final production certification should
prefer the byte-exact production GOLD_D1.parquet when available.
"""

import argparse
from pathlib import Path
import pandas as pd


def load(path: Path) -> pd.DataFrame:
    if path.suffix.lower() in {".parquet", ".pq"}:
        d = pd.read_parquet(path)
    else:
        d = pd.read_csv(path)
    rename = {}
    for c in d.columns:
        lo = str(c).lower()
        if lo in {"date", "time", "timestamp", "datetime"}:
            rename[c] = "Date"
        elif lo in {"open", "high", "low", "close", "volume"}:
            rename[c] = lo
    d = d.rename(columns=rename)
    if "Date" not in d.columns and isinstance(d.index, pd.DatetimeIndex):
        d = d.copy()
        d.insert(0, "Date", pd.DatetimeIndex(d.index))
    required = {"Date", "open", "high", "low", "close"}
    missing = required - set(d.columns)
    if missing:
        raise RuntimeError(f"missing columns: {sorted(missing)}")
    if "volume" not in d:
        d["volume"] = 0.0
    d["Date"] = pd.to_datetime(d["Date"], errors="coerce")
    d = d.dropna(subset=["Date", "open", "high", "low", "close"]).copy()
    for c in ("open", "high", "low", "close", "volume"):
        d[c] = pd.to_numeric(d[c], errors="coerce")
    d = d.dropna(subset=["open", "high", "low", "close"]).sort_values("Date")
    return d


def build_d1(h1: pd.DataFrame) -> pd.DataFrame:
    x = h1.set_index("Date")
    d1 = x.resample("1D").agg(
        {
            "open": "first",
            "high": "max",
            "low": "min",
            "close": "last",
            "volume": "sum",
        }
    )
    d1 = d1.dropna(subset=["open", "high", "low", "close"])
    d1.index.name = "Date"
    return d1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("h1")
    ap.add_argument("out")
    args = ap.parse_args()
    h1 = load(Path(args.h1))
    d1 = build_d1(h1)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.suffix.lower() in {".parquet", ".pq"}:
        d1.to_parquet(out)
    else:
        d1.reset_index().to_csv(out, index=False)
    print({
        "rows": len(d1),
        "start": str(d1.index[0]) if len(d1) else None,
        "end": str(d1.index[-1]) if len(d1) else None,
        "out": str(out),
    })
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
