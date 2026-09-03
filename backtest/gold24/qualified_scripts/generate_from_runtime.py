from __future__ import annotations
import csv, json, re
from pathlib import Path

HERE=Path(__file__).resolve().parent
GOLD24=HERE.parent
CSV_PATH=GOLD24/"runtime_multimethod_v1"/"latest_multimethod_v1_discovery.csv"
MANIFEST=HERE/"generated_multi_manifest.json"

FAMILY_CODES={
    "DONCHIAN":1,
    "CANDLE_ENGULFING":2,
    "CHART_PATTERN":3,
    "ADAPTIVE_TREND":4,
    "BOLLINGER_REVERSION_V2":5,
    "VOLUME":6,
    "VOLATILITY_REGIME":7,
}

def rows():
    with CSV_PATH.open(newline="",encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))

def candidate_from_row(r):
    m=re.fullmatch(
        r"(?P<family>[A-Z0-9_]+) f(?P<fast>\d+)/s(?P<slow>\d+) "
        r"p1=(?P<p1>-?[0-9.]+) p2=(?P<p2>-?[0-9.]+) p3=(?P<p3>-?[0-9.]+) "
        r"off=(?P<offset>[0-9.]+) exp=(?P<expiry>\d+)",
        r["method"],
    )
    if not m:
        raise RuntimeError(f"cannot parse canonical method: {r['method']}")
    g=m.groupdict()
    family=g["family"]
    if family not in FAMILY_CODES:
        raise RuntimeError(f"selected family has no real MT5 engine mapping: {family}")
    return {
        "symbol":"GOLD","timeframe":r["timeframe"],"family":family,
        "fast":int(g["fast"]),"slow":int(g["slow"]),
        "p1":float(g["p1"]),"p2":float(g["p2"]),"p3":float(g["p3"]),
        "entry_method":r["entry_method"],"direction_mode":r["direction_mode"],
        "sl":float(r["sl_pips"])*0.01,"tp":float(r["tp_pips"])*0.01,
        "offset":float(g["offset"]),"expiry":int(g["expiry"]),
    }

def expected_from_row(r):
    return {
        "method":r["method"],"config_hash":r["config_hash"],
        "trades":int(r["total_entry"]),
        "win_rate_pct":float(r["standard_lot_win_rate_pct"]),
        "profit_factor":float(r["standard_lot_profit_factor_same_cost_model"]),
        "net_profit_usd":float(r["standard_lot_net_profit_usd_same_cost_model"]),
        "ev_per_trade_usd":float(r["standard_lot_ev_per_trade_usd_same_cost_model"]),
        "max_dd_pct":float(r["standard_lot_max_dd_pct_starting_equity_10000"]),
        "sqn":float(r["standard_lot_sqn_same_cost_model"]),
        "sl_pips":float(r["sl_pips"]),"tp_pips":float(r["tp_pips"]),
    }

def py_text(c,e):
    args=",".join(f"{k}={json.dumps(v)}" for k,v in c.items())
    return (
        "from common import Candidate, run_candidate\n"
        f"CANDIDATE=Candidate({args})\n"
        f"EXPECTED={json.dumps(e,separators=(',',':'))}\n"
        "if __name__=='__main__': run_candidate(CANDIDATE,EXPECTED)\n"
    )

def mq5_text(c,e,rank):
    code=FAMILY_CODES[c["family"]]
    magic=24100000+rank
    tag=("G10B_"+c["family"])[:24]
    lines=[
        '#property strict',
        '#property version "3.00"',
        '#property description "GOLD10B exact selected canonical wrapper"',
        f'// {e["method"]} | config_hash {e["config_hash"]}',
        f'#define MM_FAMILY_CODE {code}',
        f'#define MM_FAST {c["fast"]}',
        f'#define MM_SLOW {c["slow"]}',
        f'#define MM_P1 {c["p1"]}',
        f'#define MM_P2 {c["p2"]}',
        f'#define MM_P3 {c["p3"]}',
        f'#define MM_SL_USD {c["sl"]}',
        f'#define MM_TP_USD {c["tp"]}',
        f'#define MM_OFFSET_USD {c["offset"]}',
        f'#define MM_EXPIRY_BARS {c["expiry"]}',
        f'#define MM_DIRECTION_MODE "{c["direction_mode"]}"',
        f'#define MM_MAGIC {magic}',
        f'#define MM_TAG "{tag}"',
    ]
    if c["family"]=="VOLATILITY_REGIME":
        lines.append('#define MM_VOLREG_SPECIAL')
    lines.append('#include "multimethod_engine.mqh"')
    return "\n".join(lines)+"\n"

def main():
    rs=rows()
    if not rs:
        raise SystemExit("no selected Multi rows")
    for p in HERE.glob("multi_*.py"):
        p.unlink()
    for p in HERE.glob("multi_*.mq5"):
        p.unlink()
    manifest=[]
    for rank,r in enumerate(rs,1):
        c=candidate_from_row(r);e=expected_from_row(r)
        stem=f"multi_autogen_{rank:02d}_{r['config_hash'][:12]}"
        (HERE/f"{stem}.py").write_text(py_text(c,e),encoding="utf-8")
        (HERE/f"{stem}.mq5").write_text(mq5_text(c,e,rank),encoding="utf-8")
        manifest.append({
            "rank":rank,"stem":stem,"method":r["method"],"family":c["family"],
            "config_hash":r["config_hash"],"timeframe":c["timeframe"],
            "entry_method":c["entry_method"],"direction_mode":c["direction_mode"],
            "sl_pips":e["sl_pips"],"tp_pips":e["tp_pips"],
        })
    MANIFEST.write_text(json.dumps({
        "schema":"gold10b-qualified-multi-autogen-v1",
        "count":len(manifest),"rows":manifest,
    },indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"status":"PASS","generated_pairs":len(manifest),"families":sorted(set(x["family"] for x in manifest))},indent=2))

if __name__=="__main__":
    main()
