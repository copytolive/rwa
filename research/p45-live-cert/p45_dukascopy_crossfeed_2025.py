#!/usr/bin/env python3
"""Frozen P45 cross-feed certification on Dukascopy XAUUSD BID/ASK M1.

This is a SECOND-FEED robustness test, not production-broker certification.
No optimizer, no parameter search, no retuning.

Frozen P45:
- M15 signal on BID prices, fixed EST (UTC-5, no DST)
- EMA50/EMA200 trend regime
- previous-week breakout, LIMIT retest at prior-week boundary
- risk = 4.0 * Wilder ATR14 M15
- expiry = 32 M15 bars
- initial TP = +2R
- profit lock +0.30R -> SL +0.25R
- max hold = 192 M15 bars

Execution uses independent Dukascopy BID/ASK M1 bars:
- BUY LIMIT fills on ASK; long exits/lock observe BID
- SELL LIMIT fills on BID; short exits/lock observe ASK
- same-minute ambiguity is conservative: SL before TP before lock
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd

FROZEN = dict(riskATR=4.0, lockTrig=0.30, lockProfit=0.25, expiry=32, maxbars=192, initialRR=2.0)
SCORE_START = pd.Timestamp('2025-01-01 00:00:00')
SCORE_END = pd.Timestamp('2026-01-01 00:00:00')


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def load_side(path: Path, prefix: str) -> tuple[pd.DataFrame, dict]:
    q = pd.read_csv(path)
    q.columns = [str(c).strip().lower() for c in q.columns]
    required = {'timestamp', 'open', 'high', 'low', 'close'}
    missing = required - set(q.columns)
    if missing:
        raise ValueError(f'{path}: missing columns {sorted(missing)}; got={q.columns.tolist()}')
    raw_rows = len(q)
    ts = pd.to_numeric(q['timestamp'], errors='raise')
    # Dukascopy-node timestamps are epoch milliseconds UTC. Convert explicitly to fixed EST UTC-5, no DST.
    q['dt'] = pd.to_datetime(ts, unit='ms', utc=True).dt.tz_convert('Etc/GMT+5').dt.tz_localize(None)
    for c in ['open', 'high', 'low', 'close']:
        q[c] = pd.to_numeric(q[c], errors='raise')
    dup = int(q['dt'].duplicated(keep='first').sum())
    q = q.drop_duplicates('dt', keep='first').sort_values('dt').reset_index(drop=True)
    invalid = int(((q[['open', 'high', 'low', 'close']] <= 0).any(axis=1) |
                   (q['high'] < q[['open', 'close']].max(axis=1)) |
                   (q['low'] > q[['open', 'close']].min(axis=1)) |
                   (q['high'] < q['low'])).sum())
    if invalid:
        raise ValueError(f'{path}: invalid OHLC rows={invalid}')
    out = q[['dt', 'open', 'high', 'low', 'close']].rename(columns={
        'open': f'{prefix}_open', 'high': f'{prefix}_high', 'low': f'{prefix}_low', 'close': f'{prefix}_close'
    })
    meta = {
        'path': str(path), 'bytes': path.stat().st_size, 'sha256': sha256_file(path),
        'raw_rows': raw_rows, 'unique_rows': len(out), 'duplicate_timestamps': dup,
        'start_fixed_est': str(out['dt'].iloc[0]), 'end_fixed_est': str(out['dt'].iloc[-1]),
    }
    return out, meta


def align_bid_ask(bid: pd.DataFrame, ask: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    m = bid.merge(ask, on='dt', how='inner', validate='one_to_one').sort_values('dt').reset_index(drop=True)
    if m.empty:
        raise ValueError('No aligned BID/ASK rows')
    spread_open = m['a_open'] - m['b_open']
    spread_min = pd.concat([
        m['a_open'] - m['b_open'], m['a_high'] - m['b_high'],
        m['a_low'] - m['b_low'], m['a_close'] - m['b_close']
    ], axis=1).min(axis=1)
    # Tiny negative cross-candle differences can occur because independent OHLC extrema do not happen at same instant;
    # only open spread is used as a synchronized spread QC statistic.
    meta = {
        'aligned_rows': int(len(m)),
        'alignment_vs_bid': float(len(m) / max(len(bid), 1)),
        'alignment_vs_ask': float(len(m) / max(len(ask), 1)),
        'open_spread_mean': float(spread_open.mean()),
        'open_spread_median': float(spread_open.median()),
        'open_spread_p95': float(spread_open.quantile(0.95)),
        'open_spread_p99': float(spread_open.quantile(0.99)),
        'open_spread_min': float(spread_open.min()),
        'open_spread_max': float(spread_open.max()),
        'negative_open_spread_rows': int((spread_open < -1e-9).sum()),
        'cross_extrema_negative_rows_info_only': int((spread_min < -1e-9).sum()),
    }
    if meta['alignment_vs_bid'] < 0.98 or meta['alignment_vs_ask'] < 0.98:
        raise ValueError(f'BID/ASK alignment below 98%: {meta}')
    if meta['negative_open_spread_rows'] > 0:
        raise ValueError(f'Negative synchronized open spreads detected: {meta["negative_open_spread_rows"]}')
    return m, meta


def build_m15_signals(m1: pd.DataFrame) -> pd.DataFrame:
    x = m1.set_index('dt')
    m15 = x[['b_open', 'b_high', 'b_low', 'b_close']].resample('15min').agg({
        'b_open': 'first', 'b_high': 'max', 'b_low': 'min', 'b_close': 'last'
    }).dropna().reset_index()
    C = m15['b_close']
    H = m15['b_high']
    L = m15['b_low']
    prev = C.shift(1)
    tr = pd.concat([(H-L).abs(), (H-prev).abs(), (L-prev).abs()], axis=1).max(axis=1)
    m15['atr'] = tr.ewm(alpha=1/14, adjust=False, min_periods=14).mean()
    e50 = C.ewm(span=50, adjust=False, min_periods=50).mean()
    e200 = C.ewm(span=200, adjust=False, min_periods=200).mean()
    up = (e50 > e200) & (C > e200)
    dn = (e50 < e200) & (C < e200)
    wkkey = m15['dt'].dt.to_period('W-SUN').astype(str)
    wk = pd.DataFrame({'week': wkkey, 'H': H, 'L': L}).groupby('week').agg(H=('H','max'), L=('L','min')).shift(1)
    prev_h = pd.Series(wkkey).map(wk.H).to_numpy()
    prev_l = pd.Series(wkkey).map(wk.L).to_numpy()
    side = np.where(up.to_numpy() & (C.to_numpy() > prev_h), 1,
                    np.where(dn.to_numpy() & (C.to_numpy() < prev_l), -1, 0)).astype(np.int8)
    price = np.where(side == 1, prev_h, prev_l)
    score = (m15['dt'] >= SCORE_START) & (m15['dt'] < SCORE_END)
    m15['side'] = np.where(score.to_numpy(), side, 0).astype(np.int8)
    m15['order_price'] = price
    return m15


def simulate(m1: pd.DataFrame, signals: pd.DataFrame) -> pd.DataFrame:
    bO = m1['b_open'].to_numpy(float); bH = m1['b_high'].to_numpy(float)
    bL = m1['b_low'].to_numpy(float); bC = m1['b_close'].to_numpy(float)
    aO = m1['a_open'].to_numpy(float); aH = m1['a_high'].to_numpy(float)
    aL = m1['a_low'].to_numpy(float); aC = m1['a_close'].to_numpy(float)
    dt = m1['dt'].to_numpy(dtype='datetime64[ns]')
    rows = []
    last_exit = -1
    expiry_m1 = FROZEN['expiry'] * 15
    maxhold_m1 = FROZEN['maxbars'] * 15

    candidates = signals[(signals['side'] != 0) & signals['order_price'].notna() & signals['atr'].notna()]
    for s in candidates.itertuples(index=False):
        activation_time = np.datetime64(s.dt + pd.Timedelta(minutes=15))
        start = int(np.searchsorted(dt, activation_time, side='left'))
        if start <= last_exit or start >= len(m1):
            continue
        sd = int(s.side); op = float(s.order_price); risk = float(s.atr) * FROZEN['riskATR']
        if not np.isfinite(risk) or risk <= 0:
            continue
        pend_end = min(len(m1), start + expiry_m1)
        fill = -1; entry = np.nan
        for j in range(start, pend_end):
            if sd == 1:
                if aL[j] <= op:
                    entry = aO[j] if aO[j] < op else op
                    fill = j; break
            else:
                if bH[j] >= op:
                    entry = bO[j] if bO[j] > op else op
                    fill = j; break
        if fill < 0:
            continue

        sl = entry - sd * risk
        tp = entry + sd * FROZEN['initialRR'] * risk
        lock_on = False; tpflag = 0; done = False; rv = 0.0; ex = fill; reason = 'TIME'
        end = min(len(m1), fill + maxhold_m1)
        for j in range(fill, end):
            if sd == 1:
                if bL[j] <= sl:
                    rv = (sl-entry)/risk; ex=j; done=True; reason='LOCK' if lock_on else 'SL'; break
                if bH[j] >= tp:
                    rv = FROZEN['initialRR']; ex=j; done=True; tpflag=1; reason='TP'; break
                if (not lock_on) and bH[j] >= entry + FROZEN['lockTrig']*risk:
                    sl = entry + FROZEN['lockProfit']*risk; lock_on=True
            else:
                if aH[j] >= sl:
                    rv = (entry-sl)/risk; ex=j; done=True; reason='LOCK' if lock_on else 'SL'; break
                if aL[j] <= tp:
                    rv = FROZEN['initialRR']; ex=j; done=True; tpflag=1; reason='TP'; break
                if (not lock_on) and aL[j] <= entry - FROZEN['lockTrig']*risk:
                    sl = entry - FROZEN['lockProfit']*risk; lock_on=True
        if not done:
            ex = max(fill, end-1)
            px = bC[ex] if sd == 1 else aC[ex]
            rv = sd*(px-entry)/risk
        rows.append({
            'signal_dt': str(s.dt), 'side': sd, 'order_price': op,
            'fill_dt': str(m1['dt'].iloc[fill]), 'entry': entry, 'risk': risk,
            'exit_dt': str(m1['dt'].iloc[ex]), 'R': rv, 'full_tp': tpflag,
            'lock_activated': bool(lock_on), 'outcome': reason,
        })
        last_exit = ex
    return pd.DataFrame(rows)


def metrics(trades: pd.DataFrame) -> dict:
    weeks = (SCORE_END - SCORE_START).total_seconds() / 604800.0
    n = len(trades)
    if n == 0:
        return dict(trades=0, fills_week=0.0, positive=0.0, full_tp=0.0, pf=0.0,
                    expectancy_R=0.0, net_R=0.0, max_dd_R=0.0)
    r = trades['R'].to_numpy(float)
    gp = r[r > 0].sum(); gl = -r[r < 0].sum(); eq = np.r_[0.0, np.cumsum(r)]
    return dict(
        trades=int(n), fills_week=float(n/weeks), positive=float((r > 0).mean()),
        full_tp=float(trades['full_tp'].mean()), pf=float(gp/gl if gl > 0 else 999.0),
        expectancy_R=float(r.mean()), net_R=float(r.sum()),
        max_dd_R=float((np.maximum.accumulate(eq)-eq).max()),
    )


def gate(m: dict) -> bool:
    return bool(m['trades'] >= 104 and m['fills_week'] >= 2.0 and m['positive'] >= 0.60 and
                m['pf'] >= 1.05 and m['expectancy_R'] > 0)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--bid', required=True)
    ap.add_argument('--ask', required=True)
    ap.add_argument('--output', default='p45_dukascopy_crossfeed_2025_result.json')
    args = ap.parse_args()

    bid, bid_meta = load_side(Path(args.bid), 'b')
    ask, ask_meta = load_side(Path(args.ask), 'a')
    m1, align_meta = align_bid_ask(bid, ask)
    signals = build_m15_signals(m1)
    trades = simulate(m1, signals)
    met = metrics(trades)
    decision = gate(met)

    out = {
        'strategy': 'P45 Previous-Week Breakout Retest Limit',
        'purpose': 'independent second-feed robustness; NOT production-broker certification',
        'frozen_parameters': FROZEN,
        'retuning_performed': False,
        'source': {
            'provider': 'Dukascopy', 'acquisition_library': 'dukascopy-node@1.50.0',
            'requested_utc_window': '2024-01-01 through 2026-01-01',
            'analysis_timezone': 'fixed EST UTC-5 without DST',
            'bid': bid_meta, 'ask': ask_meta,
        },
        'qc': align_meta,
        'm15_rows': int(len(signals)),
        'scored_signal_rows': int((signals['side'] != 0).sum()),
        'holdout_like_crossfeed_period': '2025-01-01 through 2025-12-31',
        'metrics': met,
        'gate': {'positive_min': 0.60, 'fills_week_min': 2.0, 'trades_min': 104,
                 'pf_min': 1.05, 'expectancy_min_exclusive': 0.0},
        'crossfeed_pass': bool(decision),
        'broker_certification': False,
        'note': 'Full +2R TP rate is recorded separately and is not the approved production positive-net gate.',
    }
    Path(args.output).write_text(json.dumps(out, indent=2), encoding='utf-8')
    trades.to_csv('p45_dukascopy_crossfeed_2025_trades.csv', index=False)
    print(json.dumps(out, indent=2))
    return 0 if decision else 2


if __name__ == '__main__':
    raise SystemExit(main())
