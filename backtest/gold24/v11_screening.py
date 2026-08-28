from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from dataclasses import replace
from pathlib import Path

import numpy as np
import pandas as pd

from core import Candidate, audit_dataset, backtest_candidate, pearson_log_equity
from store import Store
from v11_runner import POLICY, PF_TARGET, PF_MAX, execution_profile_v11, rules_sha256

CORR_MAX = 0.50
FAMILY_CAP = 0.30
REQUIRED_FAMILIES = {
    "ATR_BREAKOUT", "BOLLINGER_REVERSION", "KELTNER_BREAKOUT",
    "CANDLE_ENGULFING", "PRICE_STRUCTURE",
}
REQUIRED_LEDGER_COLUMNS = {
    "config_hash", "fingerprint", "family", "entry_time", "exit_time", "entry_bar", "exit_bar",
    "side", "pending_order", "entry_price", "exit_price", "fixed_sl", "fixed_tp", "quantity",
    "gross_pnl", "cost", "net_pnl", "exit_reason",
}


def atomic_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, sort_keys=True, default=str))
    tmp.replace(path)


def candidate_from_dict(x: dict) -> Candidate:
    return Candidate(**x)


def ledger_for(path: str, config_hash: str) -> pd.DataFrame:
    p = Path(path)
    if not p.exists():
        raise RuntimeError(f"ledger missing: {p}")
    x = pd.read_parquet(p)
    if "config_hash" not in x.columns:
        raise RuntimeError("ledger missing config_hash")
    return x[x["config_hash"] == config_hash].copy().reset_index(drop=True)


def metric_pack(result: dict) -> dict:
    m = dict(result.get("metrics", {}))
    return {
        "trades": int(m.get("trades", 0) or 0),
        "wr": float(m.get("wr", 0.0) or 0.0),
        "pf": float(m.get("profit_factor", 0.0) or 0.0),
        "net_profit": float(m.get("net_profit", 0.0) or 0.0),
        "expectancy": float(m.get("expectancy", 0.0) or 0.0),
        "max_dd_pct": float(m.get("max_dd_pct", 0.0) or 0.0),
        "sqn": float(m.get("sqn", 0.0) or 0.0),
        "sharpe": float(m.get("sharpe", 0.0) or 0.0),
        "sortino": float(m.get("sortino", 0.0) or 0.0),
    }


def segment_eval(d: pd.DataFrame, c: Candidate, flat_lot: float) -> dict:
    if len(d) < max(c.slow + 160, 200):
        return {"trades": 0, "wr": 0.0, "pf": 0.0, "net_profit": 0.0, "expectancy": 0.0, "reason": "too_few_bars"}
    return metric_pack(backtest_candidate(d.reset_index(drop=True), c, flat_lot=flat_lot))


def chronological_oos(d: pd.DataFrame, c: Candidate, flat_lot: float) -> dict:
    n = len(d)
    a, b = int(n * 0.60), int(n * 0.80)
    if a < 300 or b - a < 200 or n - b < 200:
        return {"pass": False, "reason": "insufficient rows for 60/20/20"}
    train = segment_eval(d.iloc[:a], c, flat_lot)
    validation = segment_eval(d.iloc[a:b], c, flat_lot)
    test = segment_eval(d.iloc[b:], c, flat_lot)
    train_ok = train["trades"] > 0 and train["net_profit"] > 0 and train["pf"] >= 1.20
    val_ok = validation["trades"] > 0 and validation["net_profit"] > 0 and validation["pf"] >= 1.30 and validation["wr"] >= 30.0
    test_ok = test["trades"] > 0 and test["net_profit"] > 0 and test["pf"] >= 1.30 and test["wr"] >= 30.0
    decay = test["expectancy"] / train["expectancy"] if train["expectancy"] > 0 else 0.0
    return {
        "pass": bool(train_ok and val_ok and test_ok and decay >= 0.40),
        "split": "60/20/20 chronological; frozen config",
        "train": train,
        "validation": validation,
        "test": test,
        "test_to_train_expectancy_ratio": float(decay),
    }


def walk_forward(d: pd.DataFrame, c: Candidate, flat_lot: float, folds: int = 5) -> dict:
    edges = np.linspace(0, len(d), folds + 1, dtype=int)
    rows = []
    for i in range(folds):
        m = segment_eval(d.iloc[edges[i]:edges[i + 1]], c, flat_lot)
        ok = bool(m["trades"] > 0 and m["net_profit"] > 0 and m["pf"] >= 1.0 and m["wr"] >= 30.0)
        rows.append({"fold": i + 1, "pass": ok, "metrics": m})
    positive = sum(bool(x["pass"]) for x in rows)
    return {
        "pass": positive >= 4,
        "positive_folds": positive,
        "required_positive_folds": 4,
        "results": rows,
    }


def _safe_candidate(c: Candidate, *, fast: int | None = None, slow: int | None = None, p1: float | None = None) -> Candidate:
    nf = int(c.fast if fast is None else fast)
    ns = int(c.slow if slow is None else slow)
    nf = max(2, nf)
    ns = max(nf + 1, ns)
    np1 = float(c.p1 if p1 is None else p1)
    return replace(c, fast=nf, slow=ns, p1=np1)


def parameter_stability(d: pd.DataFrame, c: Candidate, flat_lot: float) -> dict:
    variants = [
        ("fast_-20", _safe_candidate(c, fast=max(2, int(round(c.fast * 0.8))))),
        ("fast_+20", _safe_candidate(c, fast=int(round(c.fast * 1.2)))),
        ("slow_-20", _safe_candidate(c, slow=max(c.fast + 1, int(round(c.slow * 0.8))))),
        ("slow_+20", _safe_candidate(c, slow=int(round(c.slow * 1.2)))),
        ("p1_-20", _safe_candidate(c, p1=c.p1 * 0.8)),
        ("p1_+20", _safe_candidate(c, p1=c.p1 * 1.2)),
    ]
    seen = set()
    rows = []
    for name, v in variants:
        if v.config_hash == c.config_hash or v.config_hash in seen:
            continue
        seen.add(v.config_hash)
        m = segment_eval(d, v, flat_lot)
        ok = bool(m["trades"] > 0 and m["net_profit"] > 0 and m["pf"] >= 1.0)
        rows.append({"variant": name, "pass": ok, "candidate": v.canonical_dict(), "metrics": m})
    passed = sum(bool(x["pass"]) for x in rows)
    required = max(1, math.ceil(len(rows) * 0.67)) if rows else 1
    return {"pass": bool(rows and passed >= required), "passed": passed, "required": required, "results": rows}


def execution_realism(ledger: pd.DataFrame, c: Candidate) -> dict:
    if ledger.empty:
        return {"pass": False, "reason": "empty ledger"}
    missing = sorted(REQUIRED_LEDGER_COLUMNS.difference(ledger.columns))
    pending = set(ledger["pending_order"].astype(str).str.lower()) if not missing else set()
    pending_only = pending.issubset({"buy_stop", "sell_stop", "buy_limit", "sell_limit"})
    qty = pd.to_numeric(ledger["quantity"], errors="coerce")
    flat_lot = bool(qty.notna().all() and qty.nunique() == 1 and float(qty.iloc[0]) > 0)
    sl = pd.to_numeric(ledger["fixed_sl"], errors="coerce")
    tp = pd.to_numeric(ledger["fixed_tp"], errors="coerce")
    fixed = bool(
        sl.notna().all() and tp.notna().all()
        and np.allclose(sl, c.sl) and np.allclose(tp, c.tp)
        and 5.0 <= c.sl <= 25.0 and 5.0 <= c.tp <= 25.0
    )
    entry = pd.to_numeric(ledger["entry_price"], errors="coerce").abs()
    exit_ = pd.to_numeric(ledger["exit_price"], errors="coerce").abs()
    cost = pd.to_numeric(ledger["cost"], errors="coerce")
    denom = ((entry + exit_) * 0.5 * qty.abs()).replace(0, np.nan)
    rt = cost / denom
    cost_floor = bool(rt.notna().all() and (rt >= 0.0032 - 1e-12).all())
    if c.timeframe == "H1":
        h = pd.to_datetime(ledger["entry_time"], utc=True).dt.hour
        h1_hours = bool((h >= 6).all())
    else:
        h1_hours = True
    return {
        "pass": bool(not missing and pending_only and flat_lot and fixed and cost_floor and h1_hours),
        "missing_columns": missing,
        "pending_only": pending_only,
        "flat_lot": flat_lot,
        "fixed_sl_tp": fixed,
        "cost_floor": cost_floor,
        "minimum_observed_round_trip_cost_fraction": float(rt.min()) if rt.notna().any() else None,
        "h1_entry_hours_pass": h1_hours,
        "limit_crossing_only_model": True,
        "stop_gap_aware_model": True,
        "same_bar_worst_case_model": True,
    }


def regime_test(d: pd.DataFrame, ledger: pd.DataFrame) -> dict:
    if ledger.empty:
        return {"pass": False, "reason": "empty ledger", "regimes": {}}
    close = pd.to_numeric(d["Close"], errors="raise").to_numpy(float)
    ret = pd.Series(np.log(close)).diff().fillna(0.0)
    vol = ret.rolling(20, min_periods=20).std().bfill().fillna(0.0).to_numpy(float)
    sma200 = pd.Series(close).rolling(200, min_periods=20).mean().bfill().to_numpy(float)
    dist = np.abs(close / np.where(sma200 == 0, close, sma200) - 1.0)
    sideways_cut = float(np.quantile(dist, 0.35))
    high_vol_cut = float(np.quantile(vol, 0.75))
    masks = {
        "bull": (close > sma200) & (dist > sideways_cut),
        "bear": (close < sma200) & (dist > sideways_cut),
        "sideways": dist <= sideways_cut,
        "high_vol": vol >= high_vol_cut,
    }
    idx = pd.to_numeric(ledger["exit_bar"], errors="coerce").fillna(-1).astype(int).to_numpy()
    pnl_all = pd.to_numeric(ledger["net_pnl"], errors="coerce").fillna(0.0).to_numpy(float)
    min_trades = max(10, int(math.ceil(len(ledger) * 0.03)))
    details = {}
    positive = 0
    for name, mask in masks.items():
        valid = (idx >= 0) & (idx < len(mask))
        take = valid & mask[np.clip(idx, 0, len(mask) - 1)]
        pnl = pnl_all[take]
        net = float(pnl.sum()) if len(pnl) else 0.0
        count = int(len(pnl))
        ok = bool(count >= min_trades and net > 0)
        positive += int(ok)
        details[name] = {"trades": count, "net_profit": net, "pass": ok}
    return {
        "pass": positive >= 3,
        "positive_regimes": positive,
        "required_positive_regimes": 3,
        "min_trades_per_regime": min_trades,
        "regimes": details,
    }


def bar_pnl(ledger: pd.DataFrame, nrows: int) -> np.ndarray:
    out = np.zeros(nrows, dtype=float)
    if ledger.empty:
        return out
    g = ledger.groupby("exit_bar")["net_pnl"].sum()
    idx = g.index.to_numpy(int)
    vals = g.to_numpy(float)
    valid = (idx >= 0) & (idx < nrows)
    out[idx[valid]] = vals[valid]
    return out


def quality_key(row: dict) -> tuple:
    m = row["metrics"]
    return (
        float(m.get("profit_factor_net", m.get("profit_factor", 0.0)) or 0.0),
        float(m.get("net_expectancy", m.get("expectancy", 0.0)) or 0.0),
        -float(m.get("max_dd_pct", 100.0) or 100.0),
        float(m.get("sqn", 0.0) or 0.0),
        float(m.get("sharpe", 0.0) or 0.0),
        float(m.get("sortino", 0.0) or 0.0),
    )


def portfolio_filter(rows: list[dict], nrows: int, limit: int = 100) -> tuple[list[dict], dict]:
    rows = sorted(rows, key=quality_key, reverse=True)
    selected = []
    fam_counts: dict[str, int] = {}
    pnl_cache: dict[str, np.ndarray] = {}
    rejected_corr = rejected_family = rejected_profile = 0
    profiles = set()
    for r in rows:
        profile = r["fingerprint"]
        if profile in profiles:
            rejected_profile += 1
            continue
        fam = r["candidate"]["family"]
        proposed_n = len(selected) + 1
        proposed_fam = fam_counts.get(fam, 0) + 1
        if proposed_n >= 5 and proposed_fam / proposed_n > FAMILY_CAP + 1e-12:
            rejected_family += 1
            continue
        led = ledger_for(r["ledger_path"], r["config_hash"])
        bp = bar_pnl(led, nrows)
        maxcorr = 0.0
        blocked = False
        for s in selected:
            corr = abs(pearson_log_equity(bp, pnl_cache[s["config_hash"]]))
            maxcorr = max(maxcorr, corr)
            if corr > CORR_MAX:
                blocked = True
                break
        if blocked:
            rejected_corr += 1
            continue
        r = dict(r)
        r["correlation_max"] = float(maxcorr)
        selected.append(r)
        profiles.add(profile)
        fam_counts[fam] = proposed_fam
        pnl_cache[r["config_hash"]] = bp
        if len(selected) >= limit:
            break
    fams = {r["candidate"]["family"] for r in selected}
    coverage = REQUIRED_FAMILIES.issubset(fams)
    family_cap_complete = bool(selected) and all(v / len(selected) <= FAMILY_CAP + 1e-12 for v in fam_counts.values())
    return selected, {
        "required_coverage_complete": coverage,
        "family_cap_complete": family_cap_complete,
        "families": fam_counts,
        "rejected_correlation_gt_0_50": rejected_corr,
        "rejected_family_cap": rejected_family,
        "rejected_duplicate_execution_profile": rejected_profile,
    }


def selftest() -> None:
    c = Candidate("GOLD", "D1", "TREND_EMA", 10, 50, 55, 55, 1, "STOP", "BOTH", 10, 20, 1, 3)
    led = pd.DataFrame([{
        "config_hash": c.config_hash, "fingerprint": execution_profile_v11(c.canonical_dict()), "family": c.family,
        "entry_time": "2026-01-01T00:00:00+00:00", "exit_time": "2026-01-02T00:00:00+00:00",
        "entry_bar": 1, "exit_bar": 2, "side": "LONG", "pending_order": "buy_stop",
        "entry_price": 2000.0, "exit_price": 2020.0, "fixed_sl": 10.0, "fixed_tp": 20.0,
        "quantity": 1.0, "gross_pnl": 20.0, "cost": 7.0, "net_pnl": 13.0, "exit_reason": "TP",
    }])
    e = execution_realism(led, c)
    assert e["pending_only"] is True and e["flat_lot"] is True and e["fixed_sl_tp"] is True
    print("v11_screening selftest: PASS")


def run() -> None:
    root = Path(os.environ.get("GOLD24_STATE_DIR", "/var/lib/gold24-v11")).resolve()
    timeframe = os.environ.get("GOLD24_TIMEFRAME", "D1")
    dataset = os.environ.get("GOLD24_DATASET", "")
    crosscheck = os.environ.get("GOLD24_CROSSCHECK", "")
    flat_lot = float(os.environ.get("GOLD24_FLAT_LOT", "1.0"))
    d, gate_a = audit_dataset(dataset, crosscheck, timeframe)
    store = Store(root / "gold24-v11.db")

    raw = store.db.execute(
        "SELECT config_hash,canonical_json,fingerprint,execution_hash,ledger_path,metrics_json FROM configs WHERE counted=1"
    ).fetchall()
    candidates = []
    for h, c_raw, fp, eh, lp, m_raw in raw:
        c = json.loads(c_raw)
        m = json.loads(m_raw) if m_raw else {}
        pf = float(m.get("profit_factor_net", m.get("profit_factor", 0.0)) or 0.0)
        if not (PF_TARGET <= pf <= PF_MAX):
            continue
        if bool(m.get("exact_execution_duplicate", False)):
            continue
        candidates.append({"config_hash": h, "candidate": c, "fingerprint": fp, "execution_hash": eh, "ledger_path": lp, "metrics": m})
    candidates.sort(key=quality_key, reverse=True)
    candidates = candidates[:100]

    screened = []
    preportfolio = []
    for row in candidates:
        c = candidate_from_dict(row["candidate"])
        ledger = ledger_for(row["ledger_path"], row["config_hash"])
        execution = execution_realism(ledger, c)
        oos = chronological_oos(d, c, flat_lot)
        wf = walk_forward(d, c, flat_lot)
        stability = parameter_stability(d, c, flat_lot)
        regimes = regime_test(d, ledger)
        passed = bool(execution.get("pass") and oos.get("pass") and wf.get("pass") and stability.get("pass") and regimes.get("pass"))
        audit_row = {
            **row,
            "gate_e_execution_realism": execution,
            "gate_e_oos": oos,
            "gate_e_walk_forward": wf,
            "gate_e_parameter_stability": stability,
            "gate_e_regimes": regimes,
            "preportfolio_pass": passed,
        }
        screened.append(audit_row)
        if passed:
            preportfolio.append(audit_row)

    selected, portfolio = portfolio_filter(preportfolio, len(d), limit=100)
    final_allowed = bool(portfolio["required_coverage_complete"] and portfolio["family_cap_complete"])
    final = selected if final_allowed else []
    correlations = {r["config_hash"]: float(r.get("correlation_max", 0.0)) for r in final}
    store.replace_portfolio([r["config_hash"] for r in final], correlations)

    atomic_json(root / "SCREENING_V11.json", {
        "schema": "gold-v11-screening",
        "policy": POLICY,
        "rules_sha256": rules_sha256(),
        "gate_a": gate_a,
        "target_pf_candidates_screened": len(candidates),
        "preportfolio_pass_count": len(preportfolio),
        "portfolio_draft_count": len(selected),
        "top100_compliant_count": len(final),
        "portfolio": portfolio,
        "screened": screened,
    })
    atomic_json(root / "TOP100_COMPLIANT_V11.json", {
        "schema": "gold-v11-top100-compliant",
        "classification": "FINAL_ONLY_IF_ALL_V11_GATES_PASS",
        "policy": POLICY,
        "rules_sha256": rules_sha256(),
        "count": len(final),
        "portfolio": portfolio,
        "ranking": [{
            "rank": i,
            "config_hash": r["config_hash"],
            "candidate": r["candidate"],
            "execution_profile_v11": r["fingerprint"],
            "execution_hash": r["execution_hash"],
            "metrics": r["metrics"],
            "correlation_max": r.get("correlation_max", 0.0),
        } for i, r in enumerate(final, 1)],
    })
    print(json.dumps({
        "target_pf_candidates_screened": len(candidates),
        "preportfolio_pass_count": len(preportfolio),
        "portfolio_draft_count": len(selected),
        "top100_compliant_count": len(final),
        "portfolio": portfolio,
    }, indent=2, sort_keys=True))
    store.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    if args.self_test:
        selftest()
    else:
        run()
