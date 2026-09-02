from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
QDIR = HERE / "qualified_scripts"
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
if str(QDIR) not in sys.path:
    sys.path.insert(0, str(QDIR))

from core import audit_dataset, backtest_candidate, pearson_log_equity  # noqa:E402
from multimethod_v1_full_rescan import (  # noqa:E402
    PIP_SIZE_USD,
    STANDARD_LOT_GOLD_UNITS,
    annual_stats,
    chronological_oos_metrics,
    exact_full_metrics_from_ledger,
    monte_carlo_metrics,
)
import qualified_scripts.validate_qualified_scripts as vqs  # type: ignore # noqa:E402

FIELDS = [
    "audit_rank","origin","stem","config_hash","method","family","timeframe","entry_method","direction_mode",
    "sl_pips","tp_pips","total_entry","win_rate_pct","profit_factor_net","net_profit_usd","ev_per_trade_usd",
    "avg_win_loss_ratio","max_dd_pct","recovery_factor","max_consecutive_loss","sqn","oos_profit_factor",
    "monte_carlo_pass","probability_positive_pct","mc_95pct_max_drawdown_pct","positive_years_pct","worst_year",
    "worst_year_net_profit_usd","backtest_start_utc","backtest_end_utc","history_years","sample_v11",
    "correlation_max","correlation_gate","execution_hash","dataset_rows","dataset_sha256","verification_status"
]

def load_module(stem: str):
    p = QDIR / f"{stem}.py"
    spec = importlib.util.spec_from_file_location(f"audit_{stem}", p)
    if not spec or not spec.loader:
        raise RuntimeError(f"cannot load {p}")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m

def read_csv(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))

def close(a, b, tol=1e-8) -> bool:
    return math.isclose(float(a), float(b), rel_tol=0.0, abs_tol=tol)

def compare_row(got: dict, pub: dict) -> list[str]:
    checks = [
        ("sl_pips","sl_pips",1e-9),
        ("tp_pips","tp_pips",1e-9),
        ("total_entry","total_entry",0.0),
        ("win_rate_pct","standard_lot_win_rate_pct",1e-9),
        ("profit_factor_net","standard_lot_profit_factor_same_cost_model",1e-9),
        ("net_profit_usd","standard_lot_net_profit_usd_same_cost_model",1e-6),
        ("ev_per_trade_usd","standard_lot_ev_per_trade_usd_same_cost_model",1e-9),
        ("avg_win_loss_ratio","avg_win_loss_ratio",1e-9),
        ("max_dd_pct","standard_lot_max_dd_pct_starting_equity_10000",1e-9),
        ("recovery_factor","recovery_factor",1e-9),
        ("max_consecutive_loss","max_consecutive_loss",0.0),
        ("sqn","standard_lot_sqn_same_cost_model",1e-9),
        ("oos_profit_factor","oos_profit_factor",1e-9),
        ("mc_95pct_max_drawdown_pct","mc_95pct_max_drawdown_pct",1e-8),
        ("positive_years_pct","positive_years_pct",1e-9),
        ("worst_year","worst_year",0.0),
        ("worst_year_net_profit_usd","worst_year_net_profit_usd",1e-6),
        ("history_years","history_years",1e-9),
        ("correlation_max","correlation_max",1e-8),
    ]
    errors=[]
    for g,p,tol in checks:
        if tol==0.0:
            ok=int(float(got[g]))==int(float(pub[p]))
        else:
            ok=close(got[g], pub[p], tol)
        if not ok:
            errors.append(f"{g}={got[g]} published {p}={pub[p]}")
    if str(got["sample_v11"]) != str(pub["sample_v11"]):
        errors.append(f"sample_v11={got['sample_v11']} published={pub['sample_v11']}")
    if str(got["correlation_gate"]) != str(pub["correlation_gate"]):
        errors.append(f"correlation_gate={got['correlation_gate']} published={pub['correlation_gate']}")
    pub_mc = str(pub["monte_carlo_pass"]).strip().lower() == "true"
    if bool(got["monte_carlo_pass"]) != pub_mc:
        errors.append(f"monte_carlo_pass={got['monte_carlo_pass']} published={pub_mc}")
    return errors

def main() -> int:
    ap=argparse.ArgumentParser()
    ap.add_argument("--state-dir", required=True)
    ap.add_argument("--source-summary", required=True)
    ap.add_argument("--out-dir", required=True)
    args=ap.parse_args()

    state=Path(args.state_dir).resolve()
    source=json.loads(Path(args.source_summary).read_text())
    out=Path(args.out_dir).resolve()
    out.mkdir(parents=True, exist_ok=True)

    if source.get("validation") != "PASS":
        raise SystemExit("REAL_AUDIT_FAIL: source validation not PASS")

    d,audit=audit_dataset(
        state/"gate_a"/"GC1_COMEX_TRADINGVIEW_D1_PRIMARY.csv",
        state/"gate_a"/"gate_a_receipt.json",
        "D1",
    )
    dataset_sha=str(source.get("gate_a_strict",{}).get("primary_sha256",""))

    strict_pub=read_csv(HERE/"runtime_mt5_lot"/"latest_entry100_net20000_standard_lot.csv")
    multi_pub=read_csv(HERE/"runtime_multimethod_v1"/"latest_multimethod_v1_discovery.csv")
    pub_by_method={r["method"]:r for r in strict_pub+multi_pub}

    groups=[("STRICT",vqs.STRICT),("MULTI",vqs.MULTI)]
    results=[]
    audit_rank=0

    for origin,stems in groups:
        accepted_bar_pnl=[]
        for stem in stems:
            audit_rank+=1
            m=load_module(stem)
            c=m.CANDIDATE
            e=m.EXPECTED
            rerun=backtest_candidate(d,c,flat_lot=STANDARD_LOT_GOLD_UNITS)
            if rerun["config_hash"] != e["config_hash"]:
                raise SystemExit(f"REAL_AUDIT_FAIL config hash {stem}")
            ledger=pd.DataFrame(rerun["ledger"])
            if ledger.empty:
                raise SystemExit(f"REAL_AUDIT_FAIL empty ledger {stem}")
            pnl=pd.to_numeric(ledger["net_pnl"],errors="raise").to_numpy(float)
            bar=np.asarray(rerun["bar_pnl"],dtype=float)
            exact=exact_full_metrics_from_ledger(pnl,bar)
            annual=annual_stats(d,bar)
            oos=chronological_oos_metrics(d,c)
            mc=monte_carlo_metrics(pnl,c.config_hash)

            corr=0.0
            if accepted_bar_pnl:
                corr=max(abs(float(pearson_log_equity(bar,b))) for b in accepted_bar_pnl)
            accepted_bar_pnl.append(bar)

            row={
                "audit_rank":audit_rank,
                "origin":origin,
                "stem":stem,
                "config_hash":c.config_hash,
                "method":e["method"],
                "family":c.family,
                "timeframe":c.timeframe,
                "entry_method":c.entry_method,
                "direction_mode":c.direction_mode,
                "sl_pips":float(c.sl/PIP_SIZE_USD),
                "tp_pips":float(c.tp/PIP_SIZE_USD),
                "total_entry":int(exact["total_entry"]),
                "win_rate_pct":float(exact["standard_lot_win_rate_pct"]),
                "profit_factor_net":float(exact["standard_lot_profit_factor_same_cost_model"]),
                "net_profit_usd":float(exact["standard_lot_net_profit_usd_same_cost_model"]),
                "ev_per_trade_usd":float(exact["standard_lot_ev_per_trade_usd_same_cost_model"]),
                "avg_win_loss_ratio":float(exact["avg_win_loss_ratio"]),
                "max_dd_pct":float(exact["standard_lot_max_dd_pct_starting_equity_10000"]),
                "recovery_factor":float(exact["recovery_factor"]),
                "max_consecutive_loss":int(exact["max_consecutive_loss"]),
                "sqn":float(exact["standard_lot_sqn_same_cost_model"]),
                "oos_profit_factor":float(oos["oos_profit_factor"]),
                "monte_carlo_pass":bool(mc["monte_carlo_pass"]),
                "probability_positive_pct":float(mc["probability_positive_pct"]),
                "mc_95pct_max_drawdown_pct":float(mc["mc_95pct_max_drawdown_pct"]),
                "positive_years_pct":float(annual["positive_years_pct"]),
                "worst_year":int(annual["worst_year"]),
                "worst_year_net_profit_usd":float(annual["worst_year_net_profit_usd"]),
                "backtest_start_utc":str(audit.get("start_utc","")),
                "backtest_end_utc":str(audit.get("end_utc","")),
                "history_years":float(rerun["metrics"].get("history_years",0.0) or 0.0),
                "sample_v11":f"{len(ledger)}/300 {'PASS' if len(ledger)>=300 else 'FAIL'}",
                "correlation_max":float(corr),
                "correlation_gate":"PASS" if corr <= 0.50 + 1e-12 else "FAIL",
                "execution_hash":str(rerun.get("execution_hash") or ""),
                "dataset_rows":int(audit.get("rows",0)),
                "dataset_sha256":dataset_sha,
                "verification_status":"PENDING",
            }
            pub=pub_by_method.get(e["method"])
            if pub is None:
                raise SystemExit(f"REAL_AUDIT_FAIL published method missing {e['method']}")
            errs=compare_row(row,pub)
            if errs:
                raise SystemExit(json.dumps({"status":"FAIL","stem":stem,"errors":errs},indent=2))
            row["verification_status"]="PASS"
            results.append(row)

    payload={
        "status":"PASS",
        "schema":"gold24-screening-gpt-real-audit-v1",
        "source_batch":int(source["batch"]),
        "source_run_id":str(source["github_run_id"]),
        "source_candidate_cursor":int(source["candidate_cursor"]),
        "source_archive_total":int(source["cumulative_configs_archived"]),
        "dataset_provider":source.get("gate_a_strict",{}).get("provider"),
        "dataset_symbol":source.get("gate_a_strict",{}).get("primary_symbol"),
        "dataset_timeframe":source.get("gate_a_strict",{}).get("timeframe"),
        "dataset_rows":int(source.get("gate_a_strict",{}).get("primary_rows",0)),
        "dataset_sha256":dataset_sha,
        "dataset_start_utc":source.get("gate_a_strict",{}).get("primary_start_utc"),
        "dataset_end_utc":source.get("gate_a_strict",{}).get("primary_end_utc"),
        "quantity_gold_units":STANDARD_LOT_GOLD_UNITS,
        "reporting_lot_convention":"100 GOLD units = 1.0 XAUUSD standard lot reporting convention",
        "starting_equity_usd_for_drawdown":10000.0,
        "cost_floor_round_trip_rate":0.0032,
        "oos_definition":"final 20% chronological canonical D1 rows; exact qty=100 rerun",
        "monte_carlo_definition":"10,000 deterministic bootstrap paths of exact trade net-PnL; PASS iff >=95% finish net-positive; MC95 DD is 95th percentile path maximum drawdown from USD10,000 starting equity and is not capped at 100%",
        "correlation_definition":"absolute Pearson correlation of log-return equity; recomputed in published selection order within STRICT and MULTI groups",
        "total_methods":len(results),
        "all_rows_verified":all(r["verification_status"]=="PASS" for r in results),
        "rows":results,
    }
    (out/"screening_gpt_real_audit.json").write_text(json.dumps(payload,indent=2)+"\n",encoding="utf-8")
    with (out/"screening_gpt_real_audit.csv").open("w",newline="",encoding="utf-8") as f:
        w=csv.DictWriter(f,fieldnames=FIELDS)
        w.writeheader()
        for row in results:
            w.writerow({k:row.get(k) for k in FIELDS})
    print(json.dumps({
        "status":"PASS",
        "source_batch":payload["source_batch"],
        "source_run_id":payload["source_run_id"],
        "total_methods":payload["total_methods"],
        "all_rows_verified":payload["all_rows_verified"],
        "dataset_sha256":payload["dataset_sha256"],
    },indent=2))
    return 0

if __name__=="__main__":
    raise SystemExit(main())
