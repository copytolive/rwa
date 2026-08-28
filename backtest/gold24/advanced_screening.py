from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sqlite3
from pathlib import Path

import numpy as np
import pandas as pd

from core import Candidate, audit_dataset, backtest_candidate, pearson_log_equity
from weekly_metrics import FIXED_SL, FIXED_TP, REQUIRED_LEDGER_COLUMNS, weekly_economics

POLICY = "GOLD24_WEEKLY_PROFIT_RR12_V3_SCREENING_20260828"
REQUIRED_FAMILIES = {"ATR_BREAKOUT", "BOLLINGER_REVERSION", "KELTNER_BREAKOUT", "CANDLE_ENGULFING", "PRICE_STRUCTURE"}
CORR_MAX = 0.50
CORR_WARNING = 0.35
COST_FLOOR_RT = 0.0032


def atomic_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, sort_keys=True, default=str))
    tmp.replace(path)


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rules_sha256() -> str:
    p = Path(__file__).with_name("RULES_GOAL_RR12_2026.md")
    return sha256_file(p)


def candidate_from_json(raw: str) -> Candidate:
    return Candidate(**json.loads(raw))


def ledger_for_config(path: str, config_hash: str) -> pd.DataFrame:
    p = Path(path)
    if not p.exists():
        raise RuntimeError(f"ledger missing: {p}")
    x = pd.read_parquet(p)
    if "config_hash" not in x.columns:
        raise RuntimeError("ledger missing config_hash")
    return x[x["config_hash"] == config_hash].copy().reset_index(drop=True)


def compact_metrics(m: dict) -> dict:
    keys = [
        "trades", "trades_per_week", "wr", "win_rate_pct", "profit_factor", "profit_factor_net",
        "net_profit", "expectancy", "net_expectancy", "average_weekly_net", "median_weekly_net",
        "profitable_weeks_pct", "zero_trade_weeks", "max_weekly_loss", "max_consecutive_losing_weeks",
        "profitable_years_pct", "max_dd_pct", "sqn", "sharpe", "sortino", "recovery", "calmar",
        "avg_win_loss", "max_consec_loss", "profitable_months_pct", "history_years", "tier1_pass",
        "tier2_pass_count", "tier2_pass", "full_metrics_pass", "weekly_goal_candidate_pass",
    ]
    return {k: m.get(k) for k in keys if k in m}


def evaluate_segment(d: pd.DataFrame, c: Candidate, flat_lot: float) -> dict:
    r = backtest_candidate(d.reset_index(drop=True), c, flat_lot=flat_lot)
    ledger = pd.DataFrame(r.get("ledger", []))
    w = weekly_economics(pd.Series(pd.to_datetime(d["Date"], utc=True)), ledger)
    m = dict(r.get("metrics", {}))
    m.update(w)
    return compact_metrics(m)


def chronological_oos(d: pd.DataFrame, c: Candidate, flat_lot: float) -> dict:
    n = len(d)
    a, b = int(n * 0.60), int(n * 0.80)
    if a < 300 or b - a < 200 or n - b < 200:
        return {"pass": False, "reason": "insufficient rows for 60/20/20", "train": {}, "validation": {}, "test": {}}
    train = evaluate_segment(d.iloc[:a], c, flat_lot)
    validation = evaluate_segment(d.iloc[a:b], c, flat_lot)
    test = evaluate_segment(d.iloc[b:], c, flat_lot)

    train_pass = bool(train.get("weekly_goal_candidate_pass") and train.get("tier1_pass") and train.get("tier2_pass"))
    val_pass = bool(
        validation.get("weekly_goal_candidate_pass")
        and float(validation.get("net_expectancy") or 0) > 0
        and float(validation.get("profit_factor_net") or validation.get("profit_factor") or 0) >= 1.0
        and float(validation.get("win_rate_pct") or validation.get("wr") or 0) >= 30.0
    )
    test_pass = bool(
        test.get("weekly_goal_candidate_pass")
        and float(test.get("net_expectancy") or 0) > 0
        and float(test.get("profit_factor_net") or test.get("profit_factor") or 0) >= 1.0
        and float(test.get("win_rate_pct") or test.get("wr") or 0) >= 30.0
    )
    train_ev = float(train.get("net_expectancy") or 0)
    test_ev = float(test.get("net_expectancy") or 0)
    decay = test_ev / train_ev if train_ev > 0 else 0.0
    return {
        "pass": bool(train_pass and val_pass and test_pass and decay >= 0.40),
        "split": "60/20/20 chronological; test untouched by parameter generator",
        "train_pass": train_pass,
        "validation_pass": val_pass,
        "test_pass": test_pass,
        "test_to_train_expectancy_ratio": float(decay),
        "train": train,
        "validation": validation,
        "test": test,
    }


def walk_forward(d: pd.DataFrame, c: Candidate, flat_lot: float, folds: int = 5) -> dict:
    edges = np.linspace(0, len(d), folds + 1, dtype=int)
    rows = []
    for i in range(folds):
        seg = d.iloc[edges[i]:edges[i + 1]]
        if len(seg) < 200:
            rows.append({"fold": i + 1, "pass": False, "reason": "too few rows"})
            continue
        m = evaluate_segment(seg, c, flat_lot)
        fold_pass = bool(
            int(m.get("trades") or 0) > 0
            and float(m.get("net_expectancy") or 0) > 0
            and float(m.get("net_profit") or 0) > 0
            and float(m.get("profit_factor_net") or m.get("profit_factor") or 0) >= 1.0
            and float(m.get("win_rate_pct") or m.get("wr") or 0) >= 30.0
        )
        rows.append({"fold": i + 1, "pass": fold_pass, "metrics": m})
    passed = sum(bool(x.get("pass")) for x in rows)
    aggregate_net = float(sum(float((x.get("metrics") or {}).get("net_profit") or 0) for x in rows))
    return {"pass": bool(passed >= 4 and aggregate_net > 0), "folds": folds, "positive_folds": passed, "aggregate_net": aggregate_net, "results": rows}


def annual_zero_loss_flag(ledger: pd.DataFrame) -> bool:
    if ledger.empty:
        return False
    x = ledger.copy()
    x["year"] = pd.to_datetime(x["exit_time"], utc=True).dt.year
    for _, g in x.groupby("year"):
        if len(g) >= 20 and (pd.to_numeric(g["net_pnl"], errors="coerce") < 0).sum() == 0:
            return True
    return False


def h1_time_filter_pass(ledger: pd.DataFrame, timeframe: str) -> bool:
    if timeframe != "H1" or ledger.empty:
        return True
    hour = pd.to_datetime(ledger["entry_time"], utc=True).dt.hour
    return bool((hour >= 6).all())


def execution_legality(ledger: pd.DataFrame, timeframe: str) -> dict:
    required = set(REQUIRED_LEDGER_COLUMNS) | {"config_hash", "entry_bar", "exit_bar", "fingerprint"}
    missing = sorted(required.difference(ledger.columns)) if not ledger.empty else sorted(required)
    if ledger.empty:
        return {"pass": False, "missing_columns": missing, "pending_only": False, "flat_lot": False, "fixed_sl_tp": False, "cost_floor": False, "h1_time_filter": True}
    pending = set(ledger["pending_order"].astype(str).str.lower())
    pending_only = pending.issubset({"buy_stop", "sell_stop", "buy_limit", "sell_limit"})
    qty = pd.to_numeric(ledger["quantity"], errors="coerce")
    flat_lot = bool(qty.notna().all() and qty.nunique() == 1 and float(qty.iloc[0]) > 0)
    sl = pd.to_numeric(ledger["fixed_sl"], errors="coerce")
    tp = pd.to_numeric(ledger["fixed_tp"], errors="coerce")
    fixed_sl_tp = bool(sl.notna().all() and tp.notna().all() and np.allclose(sl, FIXED_SL) and np.allclose(tp, FIXED_TP))
    entry = pd.to_numeric(ledger["entry_price"], errors="coerce").abs()
    exit_ = pd.to_numeric(ledger["exit_price"], errors="coerce").abs()
    cost = pd.to_numeric(ledger["cost"], errors="coerce")
    denom = ((entry + exit_) * 0.5 * qty.abs()).replace(0, np.nan)
    rt = cost / denom
    cost_floor = bool(rt.notna().all() and (rt >= COST_FLOOR_RT - 1e-12).all())
    h1_pass = h1_time_filter_pass(ledger, timeframe)
    passed = bool(not missing and pending_only and flat_lot and fixed_sl_tp and cost_floor and h1_pass)
    return {
        "pass": passed,
        "missing_columns": missing,
        "pending_only": pending_only,
        "flat_lot": flat_lot,
        "fixed_sl_tp": fixed_sl_tp,
        "cost_floor": cost_floor,
        "minimum_observed_round_trip_cost_fraction": float(rt.min()) if rt.notna().any() else None,
        "h1_time_filter": h1_pass,
    }


def regime_stability(d: pd.DataFrame, ledger: pd.DataFrame, profitable_years_pct: float) -> dict:
    if ledger.empty:
        return {"pass": False, "reason": "empty ledger", "regimes": {}}
    close = pd.to_numeric(d["Close"], errors="coerce").to_numpy(float)
    logret = pd.Series(np.log(close)).diff()
    vol = logret.rolling(20, min_periods=20).std().bfill().fillna(0).to_numpy(float)
    vol_med = float(np.median(vol))
    sma200 = pd.Series(close).rolling(200, min_periods=20).mean().bfill().to_numpy(float)
    high_vol = vol >= vol_med
    bull = close >= sma200
    buckets = {"high_vol": high_vol, "low_vol": ~high_vol, "bull": bull, "bear": ~bull}
    total = len(ledger)
    min_bucket_trades = max(20, int(math.ceil(total * 0.05)))
    details = {}
    positive = 0
    for name, mask in buckets.items():
        idx = pd.to_numeric(ledger["exit_bar"], errors="coerce").astype(int).to_numpy()
        valid = (idx >= 0) & (idx < len(mask))
        take = valid & mask[np.clip(idx, 0, len(mask) - 1)]
        pnl = pd.to_numeric(ledger.loc[take, "net_pnl"], errors="coerce")
        net = float(pnl.sum()) if len(pnl) else 0.0
        count = int(len(pnl))
        ok = bool(count >= min_bucket_trades and net > 0)
        positive += int(ok)
        details[name] = {"trades": count, "net_profit": net, "pass": ok}
    return {
        "pass": bool(positive >= 3 and float(profitable_years_pct) >= 70.0),
        "positive_regimes": positive,
        "required_positive_regimes": 3,
        "min_bucket_trades": min_bucket_trades,
        "profitable_years_pct": float(profitable_years_pct),
        "regimes": details,
    }


def red_flags(metrics: dict, ledger: pd.DataFrame, oos: dict) -> dict:
    wr = float(metrics.get("win_rate_pct", metrics.get("wr", 0)) or 0)
    pf = float(metrics.get("profit_factor_net", metrics.get("profit_factor", 0)) or 0)
    dd = float(metrics.get("max_dd_pct", 0) or 0)
    exp = float(metrics.get("net_expectancy", metrics.get("expectancy", 0)) or 0)
    sqn = float(metrics.get("sqn", 0) or 0)
    net = float(metrics.get("net_profit", 0) or 0)
    growth_pct = 100.0 * net / 10000.0
    test = oos.get("test") or {}
    test_wr = float(test.get("win_rate_pct", test.get("wr", 0)) or 0)
    decay = float(oos.get("test_to_train_expectancy_ratio", 0) or 0)
    flags = {
        "wr_gt_75": wr > 75.0,
        "pf_gt_8": pf > 8.0,
        "growth_gt_100000_pct": growth_pct > 100000.0,
        "dd_lt_2_pct": dd < 2.0,
        "expectancy_lt_0_50": exp < 0.50,
        "zero_loss_year": annual_zero_loss_flag(ledger),
        "oos_wr_lt_30": bool(test) and test_wr < 30.0,
        "sqn_lt_1_5": sqn < 1.5,
        "oos_expectancy_decay_lt_0_40": bool(test) and decay < 0.40,
    }
    return {"pass": not any(flags.values()), "flags": flags, "growth_pct": growth_pct}


def bar_pnl_from_ledger(ledger: pd.DataFrame, nrows: int) -> np.ndarray:
    out = np.zeros(nrows, dtype=float)
    if ledger.empty:
        return out
    g = ledger.groupby("exit_bar")["net_pnl"].sum()
    idx = g.index.to_numpy(int)
    valid = (idx >= 0) & (idx < nrows)
    out[idx[valid]] = g.to_numpy(float)[valid]
    return out


def quality_key(row: dict) -> tuple:
    m = row["metrics"]
    tpw = float(m.get("trades_per_week", 0) or 0)
    return (
        float(m.get("median_weekly_net", 0) or 0),
        float(m.get("average_weekly_net", 0) or 0),
        float(m.get("profitable_weeks_pct", 0) or 0),
        float(m.get("net_expectancy", 0) or 0),
        float(m.get("profit_factor_net", m.get("profit_factor", 0)) or 0),
        -float(m.get("max_dd_pct", 100) or 100),
        -abs(min(max(tpw, 2.0), 4.0) - 3.0),
    )


def portfolio_filter(rows: list[dict], nrows: int, limit: int = 100) -> tuple[list[dict], dict]:
    rows = sorted(rows, key=quality_key, reverse=True)
    selected, profiles, fam_counts, pnl_cache = [], set(), {}, {}
    rejected_corr = rejected_profile = rejected_family = 0
    for r in rows:
        profile = r["fingerprint"]
        if profile in profiles:
            rejected_profile += 1
            continue
        fam = r["candidate"]["family"]
        proposed_n = len(selected) + 1
        proposed_fam = fam_counts.get(fam, 0) + 1
        if proposed_n >= 5 and proposed_fam / proposed_n > 0.30:
            rejected_family += 1
            continue
        ledger = ledger_for_config(r["ledger_path"], r["config_hash"])
        bp = bar_pnl_from_ledger(ledger, nrows)
        maxcorr, warnings, blocked = 0.0, 0, False
        for s in selected:
            corr = abs(pearson_log_equity(bp, pnl_cache[s["config_hash"]]))
            maxcorr = max(maxcorr, corr)
            if corr > CORR_MAX:
                blocked = True
                break
            if corr > CORR_WARNING:
                warnings += 1
        if blocked:
            rejected_corr += 1
            continue
        x = dict(r)
        x["correlation_max"] = float(maxcorr)
        x["correlation_warning_pairs"] = int(warnings)
        selected.append(x)
        profiles.add(profile)
        fam_counts[fam] = proposed_fam
        pnl_cache[r["config_hash"]] = bp
        if len(selected) >= limit:
            break
    fams = {x["candidate"]["family"] for x in selected}
    coverage = REQUIRED_FAMILIES.issubset(fams)
    cap = bool(selected) and all(v / len(selected) <= 0.30 + 1e-12 for v in fam_counts.values())
    return selected, {
        "required_coverage_complete": coverage,
        "family_cap_complete": cap,
        "families": fam_counts,
        "rejected_correlation_gt_0_50": rejected_corr,
        "rejected_duplicate_execution_profile_v2": rejected_profile,
        "rejected_family_cap": rejected_family,
    }


def run() -> None:
    root = Path(os.environ.get("GOLD24_STATE_DIR", "/var/lib/gold24")).resolve()
    dataset_path = os.environ.get("GOLD24_DATASET", "")
    receipt_path = os.environ.get("GOLD24_CROSSCHECK", "")
    timeframe = os.environ.get("GOLD24_TIMEFRAME", "D1")
    flat_lot = float(os.environ.get("GOLD24_FLAT_LOT", "1.0"))
    db_path = root / "gold24-weekly-profit-v2.db"
    out_audit = root / "SCREENING_AUDIT.json"
    out_top100 = root / "TOP100_COMPLIANT.json"

    d, gate_a = audit_dataset(dataset_path, receipt_path, timeframe)
    # audit_dataset has its own engine compatibility hash; screening evidence must pin
    # the actual canonical policy file that governed this run.
    gate_a["rules_sha256"] = rules_sha256()
    if not db_path.exists():
        raise RuntimeError(f"screening database missing: {db_path}")

    con = sqlite3.connect(str(db_path))
    raw_rows = con.execute(
        "SELECT config_hash,canonical_json,fingerprint,execution_hash,ledger_path,metrics_json FROM configs WHERE counted=1 ORDER BY created_at"
    ).fetchall()
    con.close()

    screened, preportfolio = [], []
    for config_hash, canonical_json, fingerprint, execution_hash, ledger_path, metrics_json in raw_rows:
        c = candidate_from_json(canonical_json)
        m = json.loads(metrics_json)
        ledger = ledger_for_config(ledger_path, config_hash)
        legality = execution_legality(ledger, c.timeframe)
        sample_min = 500 if c.timeframe == "H1" else 300
        sample_pass = int(m.get("trades", 0) or 0) >= sample_min
        gate_c = bool(m.get("weekly_goal_candidate_pass"))
        tier1 = bool(m.get("tier1_pass")) and h1_time_filter_pass(ledger, c.timeframe)
        tier2 = int(m.get("tier2_pass_count", 0) or 0) >= 6
        oos = chronological_oos(d, c, flat_lot) if (legality["pass"] and gate_c and sample_pass and tier1 and tier2) else {"pass": False, "reason": "not reached: prior gate failed", "train": {}, "validation": {}, "test": {}}
        wf = walk_forward(d, c, flat_lot) if oos.get("pass") else {"pass": False, "reason": "not reached: OOS failed"}
        regime = regime_stability(d, ledger, float(m.get("profitable_years_pct", 0) or 0)) if wf.get("pass") else {"pass": False, "reason": "not reached: walk-forward failed"}
        flags = red_flags(m, ledger, oos)
        robust = bool(oos.get("pass") and wf.get("pass") and regime.get("pass"))
        pre = bool(legality["pass"] and gate_c and sample_pass and tier1 and tier2 and flags["pass"] and robust)
        ledger_sha = sha256_file(Path(ledger_path))
        row = {
            "config_hash": config_hash,
            "candidate": c.canonical_dict(),
            "fingerprint": fingerprint,
            "execution_hash": execution_hash,
            "ledger_path": ledger_path,
            "ledger_sha256": ledger_sha,
            "metrics": m,
            "gate_b_execution_legality": legality,
            "gate_4_sample_pass": sample_pass,
            "sample_minimum": sample_min,
            "gate_c_weekly_economics_pass": gate_c,
            "gate_5_tier1_pass": tier1,
            "gate_6_tier2_pass": tier2,
            "gate_7_red_flags": flags,
            "gate_d_oos": oos,
            "gate_d_walk_forward": wf,
            "gate_d_regime_stability": regime,
            "gate_d_robustness_pass": robust,
            "gate_f_preportfolio_pass": pre,
        }
        screened.append(row)
        if pre:
            preportfolio.append(row)

    draft, portfolio = portfolio_filter(preportfolio, len(d), 100)
    portfolio_pass = bool(draft and portfolio["required_coverage_complete"] and portfolio["family_cap_complete"])
    final = draft if portfolio_pass else []

    audit = {
        "schema": "gold24-screening-audit-v3",
        "policy": POLICY,
        "rules_sha256": rules_sha256(),
        "gate_a": gate_a,
        "gate_c_candidates_screened": len(screened),
        "preportfolio_pass_count": len(preportfolio),
        "portfolio_draft_count": len(draft),
        "top100_compliant_count": len(final),
        "portfolio": portfolio,
        "screened": screened,
        "generated_at": pd.Timestamp.now(tz="UTC").isoformat(),
    }
    atomic_json(out_audit, audit)
    atomic_json(out_top100, {
        "schema": "gold24-top100-compliant-v3",
        "classification": "TOP100_COMPLIANT" if final else "NO_COMPLIANT_PORTFOLIO_YET",
        "policy": POLICY,
        "rules_sha256": rules_sha256(),
        "gate_a": gate_a,
        "count": len(final),
        "preportfolio_pass_count": len(preportfolio),
        "portfolio_draft_count": len(draft),
        "portfolio": portfolio,
        "ranking": [
            {
                "rank": i,
                "config_hash": r["config_hash"],
                "candidate": r["candidate"],
                "execution_profile_v2": r["fingerprint"],
                "execution_hash": r["execution_hash"],
                "ledger_sha256": r["ledger_sha256"],
                "metrics": r["metrics"],
                "correlation_max": r.get("correlation_max", 0.0),
                "correlation_warning_pairs": r.get("correlation_warning_pairs", 0),
            }
            for i, r in enumerate(final, 1)
        ],
    })
    print(json.dumps({
        "screening": "PASS",
        "gate_c_candidates_screened": len(screened),
        "preportfolio_pass_count": len(preportfolio),
        "portfolio_draft_count": len(draft),
        "top100_compliant_count": len(final),
        "portfolio": portfolio,
    }, indent=2, sort_keys=True))


def selftest() -> None:
    good = {
        "wr": 60.0, "profit_factor": 1.5, "max_dd_pct": 12.0, "expectancy": 1.0,
        "sqn": 2.2, "net_profit": 1000.0,
    }
    empty = pd.DataFrame(columns=["exit_time", "net_pnl"])
    oos = {"test": {"wr": 55.0}, "test_to_train_expectancy_ratio": 0.8}
    flags = red_flags(good, empty, oos)
    assert flags["pass"] is True, flags
    bad = dict(good)
    bad["wr"] = 90.0
    assert red_flags(bad, empty, oos)["pass"] is False
    assert abs(COST_FLOOR_RT - 0.0032) < 1e-12
    assert REQUIRED_FAMILIES == {"ATR_BREAKOUT", "BOLLINGER_REVERSION", "KELTNER_BREAKOUT", "CANDLE_ENGULFING", "PRICE_STRUCTURE"}
    print("advanced_screening selftest: PASS")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    if args.self_test:
        selftest()
    else:
        run()


if __name__ == "__main__":
    main()
