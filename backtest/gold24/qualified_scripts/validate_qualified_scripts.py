from __future__ import annotations

# GOLD10B million-selection certification trigger: 118 exact pairs.

# Dynamic selected-set validation is intentionally triggered after wrapper synchronization.

import argparse
import csv
import importlib.util
import json
import math
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
GOLD24 = HERE.parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
if str(GOLD24) not in sys.path:
    sys.path.insert(0, str(GOLD24))

from core import audit_dataset, backtest_candidate  # noqa:E402
from family_codes import FAMILY_CODES  # noqa:E402

IGNORE_PY = {
    "common.py",
    "family_codes.py",
    "prepare_mt5_canonical.py",
    "sync_qualified_scripts.py",
    "validate_qualified_scripts.py",
}

METRICS = {
    "trades": ("trades", 0.0),
    "win_rate_pct": ("wr", 1e-9),
    "profit_factor": ("profit_factor", 1e-9),
    "net_profit_usd": ("net_profit", 1e-6),
    "ev_per_trade_usd": ("expectancy", 1e-9),
    "max_dd_pct": ("max_dd_pct", 1e-9),
    "sqn": ("sqn", 1e-9),
}
CSV_METRICS = {
    "trades": "total_entry",
    "win_rate_pct": "standard_lot_win_rate_pct",
    "profit_factor": "standard_lot_profit_factor_same_cost_model",
    "net_profit_usd": "standard_lot_net_profit_usd_same_cost_model",
    "ev_per_trade_usd": "standard_lot_ev_per_trade_usd_same_cost_model",
    "max_dd_pct": "standard_lot_max_dd_pct_starting_equity_10000",
    "sqn": "standard_lot_sqn_same_cost_model",
    "sl_pips": "sl_pips",
    "tp_pips": "tp_pips",
}


def read_csv(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def wrapper_index() -> dict[str, str]:
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
        if h in out:
            raise RuntimeError(f"duplicate qualified Python config_hash {h}: {out[h]} and {p.stem}")
        if not p.with_suffix(".mq5").exists():
            raise RuntimeError(f"qualified MT5 pair missing for {p.name}")
        out[h] = p.stem
    return out


def selected_stems(rows: list[dict], group: str, index: dict[str, str]) -> list[str]:
    stems = []
    missing = []
    for row in rows:
        h = str(row.get("config_hash") or "")
        stem = index.get(h)
        if not stem:
            missing.append({"group": group, "method": row.get("method"), "config_hash": h})
        else:
            stems.append(stem)
    if missing:
        raise RuntimeError("QUALIFIED_SCRIPT_SET_STALE missing wrappers: " + json.dumps(missing))
    return stems


def current_selection() -> tuple[list[dict], list[dict], list[str], list[str]]:
    strict_rows = read_csv(GOLD24 / "runtime_mt5_lot" / "latest_entry100_net20000_standard_lot.csv")
    multi_rows = read_csv(GOLD24 / "runtime_multimethod_v1" / "latest_multimethod_v1_discovery.csv")
    index = wrapper_index()
    strict = selected_stems(strict_rows, "STRICT", index)
    multi = selected_stems(multi_rows, "MULTI", index)
    if len(set(strict + multi)) != len(strict) + len(multi):
        raise RuntimeError("one wrapper stem cannot represent multiple current selected rows")
    return strict_rows, multi_rows, strict, multi


# Backward-compatible module globals used by screening_gpt_real_audit.py.
_STRICT_ROWS, _MULTI_ROWS, STRICT, MULTI = current_selection()
ALL = STRICT + MULTI


def load_module(stem: str):
    p = HERE / f"{stem}.py"
    spec = importlib.util.spec_from_file_location(f"q_{stem}", p)
    m = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(m)
    return m


def close(a, b, tol):
    return int(a) == int(b) if tol == 0 else math.isclose(float(a), float(b), rel_tol=0.0, abs_tol=tol)


def macro(text: str, name: str):
    m = re.search(rf"^#define\s+{re.escape(name)}\s+(.+?)\s*$", text, re.M)
    return m.group(1).strip() if m else None


def check_wrapper(stem: str, m, group: str) -> list[str]:
    p = HERE / f"{stem}.mq5"
    if not p.exists():
        return [f"MT5 pair missing: {p.name}"]
    text = p.read_text(encoding="utf-8")
    pref = "MM" if group == "MULTI" else "QM"
    c = m.CANDIDATE
    e = m.EXPECTED
    if c.family not in FAMILY_CODES:
        return [f"unregistered selected MT5 family: {c.family}"]
    expected = {
        f"{pref}_FAMILY_CODE": str(FAMILY_CODES[c.family]),
        f"{pref}_FAST": str(c.fast),
        f"{pref}_SLOW": str(c.slow),
        f"{pref}_P1": str(float(c.p1)),
        f"{pref}_P2": str(float(c.p2)),
        f"{pref}_P3": str(float(c.p3)),
        f"{pref}_SL_USD": str(float(c.sl)),
        f"{pref}_TP_USD": str(float(c.tp)),
        f"{pref}_OFFSET_USD": str(float(c.offset)),
        f"{pref}_EXPIRY_BARS": str(c.expiry),
        f"{pref}_DIRECTION_MODE": f'"{c.direction_mode}"',
        f"{pref}_ENTRY_METHOD": f'"{c.entry_method}"',
        f"{pref}_CONFIG_HASH": f'"{e["config_hash"]}"',
    }
    errors = []
    for k, v in expected.items():
        got = macro(text, k)
        if got is None:
            errors.append(f"{k} missing")
        elif k.endswith(("SL_USD", "TP_USD", "OFFSET_USD", "_P1", "_P2", "_P3")):
            try:
                if not math.isclose(float(got), float(v), abs_tol=1e-12):
                    errors.append(f"{k}={got} expected {v}")
            except ValueError:
                errors.append(f"{k} invalid {got}")
        elif got != v:
            errors.append(f"{k}={got} expected {v}")
    include = "multimethod_engine.mqh" if group == "MULTI" else "qualified_engine.mqh"
    if include not in text:
        errors.append(f"missing include {include}")
    if e["config_hash"] not in text:
        errors.append("MT5 wrapper missing exact canonical config_hash fingerprint")
    return errors


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--state-dir")
    p.add_argument("--out", default="qualified_scripts_validation.json")
    a = p.parse_args()

    strict_rows, multi_rows, strict, multi = current_selection()
    groups = [("STRICT", strict, strict_rows), ("MULTI", multi, multi_rows)]
    results = []
    rows_by_hash = {str(r["config_hash"]): r for r in strict_rows + multi_rows}

    for group, stems, source_rows in groups:
        if len(stems) != len(source_rows):
            raise SystemExit(f"{group}_SCRIPT_SET_STALE count mismatch")
        for stem in stems:
            m = load_module(stem)
            e = m.EXPECTED
            c = m.CANDIDATE
            row = rows_by_hash.get(str(e.get("config_hash")))
            if not row:
                raise SystemExit(f"{group}_SCRIPT_SET_STALE wrapper not in current runtime: {stem}")
            errs = check_wrapper(stem, m, group)
            if row.get("method") != e.get("method"):
                errs.append(f"csv method={row.get('method')} expected {e.get('method')}")
            if row.get("config_hash") != e.get("config_hash"):
                errs.append(f"csv config_hash={row.get('config_hash')} expected {e.get('config_hash')}")
            if c.config_hash != e.get("config_hash"):
                errs.append(f"Python CANDIDATE hash={c.config_hash} expected {e.get('config_hash')}")
            for ek, ck in CSV_METRICS.items():
                actual = float(row[ck])
                ref = float(e[ek])
                tol = 0.0 if ek == "trades" else (1e-6 if ek == "net_profit_usd" else 1e-9)
                if not close(actual, ref, tol):
                    errs.append(f"csv {ck}={actual} expected {ref}")
            record = {
                "group": group,
                "stem": stem,
                "method": e["method"],
                "config_hash_expected": e["config_hash"],
                "family": c.family,
                "family_code": FAMILY_CODES[c.family],
                "wrapper_static": "PASS" if not errs else "FAIL",
                "errors": errs,
            }
            if a.state_dir:
                state = Path(a.state_dir)
                d, audit = audit_dataset(
                    state / "gate_a/GC1_COMEX_TRADINGVIEW_D1_PRIMARY.csv",
                    state / "gate_a/gate_a_receipt.json",
                    c.timeframe,
                )
                res = backtest_candidate(d, c, flat_lot=100.0)
                mt = res["metrics"]
                if res["config_hash"] != e["config_hash"]:
                    errs.append(f"config_hash {res['config_hash']} != {e['config_hash']}")
                for ek, (mk, tol) in METRICS.items():
                    if not close(mt[mk], e[ek], tol):
                        errs.append(f"canonical {mk}={mt[mk]} expected {e[ek]}")
                record["canonical_python_parity"] = "PASS" if not errs else "FAIL"
                record["dataset_rows"] = audit.get("rows")
                record["execution_hash"] = res.get("execution_hash")
            if errs:
                raise SystemExit(json.dumps(record, indent=2))
            results.append(record)

    payload = {
        "status": "PASS",
        "strict_count": len(strict),
        "multi_count": len(multi),
        "total_method_pairs": len(results),
        "checks": results,
        "contract": {
            "python": "exact canonical core.py qty=100 parity",
            "mt5": "native MetaEditor clean compile plus Strategy Tester operational certification; wrapper config/hash/parameters must match Python candidate",
            "family_registry_count": len(FAMILY_CODES),
            "broker_pnl_note": "broker-specific spread/commission/swap/tick sequence can differ from canonical stressed cost model",
        },
    }
    Path(a.out).write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
