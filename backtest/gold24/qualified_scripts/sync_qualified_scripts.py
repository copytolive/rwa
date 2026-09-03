from __future__ import annotations

import csv
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
GOLD24 = HERE.parent

import sys
if str(GOLD24) not in sys.path:
    sys.path.insert(0, str(GOLD24))
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from core import Candidate  # noqa:E402
from family_codes import FAMILY_CODES  # noqa:E402

PIP_SIZE_USD = 0.01

METHOD_RE = re.compile(
    r"^(?P<family>[A-Z0-9_]+) f(?P<fast>\d+)/s(?P<slow>\d+) "
    r"p1=(?P<p1>-?[0-9.eE]+) p2=(?P<p2>-?[0-9.eE]+) p3=(?P<p3>-?[0-9.eE]+) "
    r"off=(?P<offset>-?[0-9.eE]+) exp=(?P<expiry>\d+)$"
)

IGNORE_PY = {
    "common.py",
    "family_codes.py",
    "prepare_mt5_canonical.py",
    "sync_qualified_scripts.py",
    "validate_qualified_scripts.py",
}


def read_csv(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def existing_by_hash() -> dict[str, str]:
    out: dict[str, str] = {}
    pat = re.compile(r'["\']config_hash["\']\s*:\s*["\']([0-9a-f]{64})["\']')
    for p in sorted(HERE.glob("*.py")):
        if p.name in IGNORE_PY:
            continue
        text = p.read_text(encoding="utf-8")
        m = pat.search(text)
        if not m:
            continue
        h = m.group(1)
        mq = p.with_suffix(".mq5")
        if mq.exists():
            out[h] = p.stem
    return out


def parse_candidate(row: dict) -> Candidate:
    m = METHOD_RE.match(str(row["method"]).strip())
    if not m:
        raise RuntimeError(f"cannot parse method label: {row['method']}")
    family = m.group("family")
    if family not in FAMILY_CODES:
        raise RuntimeError(f"family not registered for MT5: {family}")
    c = Candidate(
        symbol="GOLD",
        timeframe=str(row.get("timeframe") or "D1"),
        family=family,
        fast=int(m.group("fast")),
        slow=int(m.group("slow")),
        p1=float(m.group("p1")),
        p2=float(m.group("p2")),
        p3=float(m.group("p3")),
        entry_method=str(row["entry_method"]),
        direction_mode=str(row["direction_mode"]),
        sl=float(row["sl_pips"]) * PIP_SIZE_USD,
        tp=float(row["tp_pips"]) * PIP_SIZE_USD,
        offset=float(m.group("offset")),
        expiry=int(m.group("expiry")),
    )
    expected = str(row["config_hash"])
    if c.config_hash != expected:
        raise RuntimeError(
            f"config hash mismatch while syncing wrapper method={row['method']} "
            f"candidate={c.config_hash} csv={expected}"
        )
    return c


def py_text(c: Candidate, row: dict) -> str:
    expected = {
        "method": row["method"],
        "config_hash": row["config_hash"],
        "trades": int(row["total_entry"]),
        "win_rate_pct": float(row["standard_lot_win_rate_pct"]),
        "profit_factor": float(row["standard_lot_profit_factor_same_cost_model"]),
        "net_profit_usd": float(row["standard_lot_net_profit_usd_same_cost_model"]),
        "ev_per_trade_usd": float(row["standard_lot_ev_per_trade_usd_same_cost_model"]),
        "max_dd_pct": float(row["standard_lot_max_dd_pct_starting_equity_10000"]),
        "sqn": float(row["standard_lot_sqn_same_cost_model"]),
        "sl_pips": float(row["sl_pips"]),
        "tp_pips": float(row["tp_pips"]),
    }
    return (
        "from common import Candidate, run_candidate\n"
        f"CANDIDATE=Candidate(symbol=\"GOLD\",timeframe={c.timeframe!r},family={c.family!r},"
        f"fast={c.fast},slow={c.slow},p1={float(c.p1)!r},p2={float(c.p2)!r},p3={float(c.p3)!r},"
        f"entry_method={c.entry_method!r},direction_mode={c.direction_mode!r},"
        f"sl={float(c.sl)!r},tp={float(c.tp)!r},offset={float(c.offset)!r},expiry={c.expiry})\n"
        f"EXPECTED={json.dumps(expected, separators=(',', ':'))}\n"
        "if __name__==\"__main__\": run_candidate(CANDIDATE,EXPECTED)\n"
    )


def mq5_text(c: Candidate, row: dict, group: str, ordinal: int) -> str:
    code = FAMILY_CODES[c.family]
    prefix = "MM" if group == "MULTI" else "QM"
    include = "multimethod_engine.mqh" if group == "MULTI" else "qualified_engine.mqh"
    magic = 24100000 + (int(row["config_hash"][:8], 16) % 800000)
    tag = f"GOLD10B_{group}_{ordinal:03d}"
    desc = "GOLD10B dynamic canonical translation"
    lines = [
        "#property strict",
        '#property version "4.00"',
        f'#property description "{desc}"',
        f"// {row['method']} | hash {row['config_hash']}",
        f"#define {prefix}_FAMILY_CODE {code}",
        f"#define {prefix}_FAST {c.fast}",
        f"#define {prefix}_SLOW {c.slow}",
        f"#define {prefix}_P1 {float(c.p1)}",
        f"#define {prefix}_P2 {float(c.p2)}",
        f"#define {prefix}_P3 {float(c.p3)}",
        f"#define {prefix}_SL_USD {float(c.sl)}",
        f"#define {prefix}_TP_USD {float(c.tp)}",
        f"#define {prefix}_OFFSET_USD {float(c.offset)}",
        f"#define {prefix}_EXPIRY_BARS {c.expiry}",
        f'#define {prefix}_DIRECTION_MODE "{c.direction_mode}"',
        f'#define {prefix}_ENTRY_METHOD "{c.entry_method}"',
        f'#define {prefix}_CONFIG_HASH "{row["config_hash"]}"',
        f"#define {prefix}_MAGIC {magic}",
        f'#define {prefix}_TAG "{tag}"',
        f'#include "{include}"',
        "",
    ]
    return "\n".join(lines)


def auto_stem(group: str, c: Candidate, config_hash: str) -> str:
    lead = "multi_auto" if group == "MULTI" else "strict_auto"
    return f"{lead}_{c.family.lower()}_{config_hash[:12]}"


def main() -> int:
    strict = read_csv(GOLD24 / "runtime_mt5_lot" / "latest_entry100_net20000_standard_lot.csv")
    multi = read_csv(GOLD24 / "runtime_multimethod_v1" / "latest_multimethod_v1_discovery.csv")
    rows = [("STRICT", r) for r in strict] + [("MULTI", r) for r in multi]
    existing = existing_by_hash()
    selected_hashes = {str(r["config_hash"]) for _, r in rows}
    manifest = []
    created = []
    reused = []

    for ordinal, (group, row) in enumerate(rows, 1):
        c = parse_candidate(row)
        h = str(row["config_hash"])
        stem = existing.get(h) or auto_stem(group, c, h)
        py = HERE / f"{stem}.py"
        mq = HERE / f"{stem}.mq5"
        if h in existing:
            reused.append(stem)
        else:
            py.write_text(py_text(c, row), encoding="utf-8")
            mq.write_text(mq5_text(c, row, group, ordinal), encoding="utf-8")
            created.append(stem)
        manifest.append(
            {
                "group": group,
                "stem": stem,
                "method": row["method"],
                "family": c.family,
                "config_hash": h,
                "family_code": FAMILY_CODES[c.family],
                "python": py.name,
                "mt5": mq.name,
            }
        )

    removed = []
    for p in sorted(HERE.glob("*_auto_*.py")):
        text = p.read_text(encoding="utf-8")
        m = re.search(r'["\']config_hash["\']\s*:\s*["\']([0-9a-f]{64})["\']', text)
        if m and m.group(1) not in selected_hashes:
            stem = p.stem
            p.unlink()
            mq = p.with_suffix(".mq5")
            if mq.exists():
                mq.unlink()
            removed.append(stem)

    payload = {
        "status": "PASS",
        "strict_count": len(strict),
        "multi_count": len(multi),
        "total_method_pairs": len(rows),
        "created": created,
        "reused": reused,
        "removed_stale_auto": removed,
        "methods": manifest,
        "contract": {
            "pip_size_usd": PIP_SIZE_USD,
            "quantity_gold_units": 100.0,
            "candidate_gate": "Entry>=100 + Net Profit>=USD20000; global Corr<=0.50 applied upstream",
            "data_blocked_native_h4_not_registered": True,
        },
    }
    (HERE / "selected_manifest.json").write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
