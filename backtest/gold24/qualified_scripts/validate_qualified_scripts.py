from __future__ import annotations
import argparse,csv,importlib.util,json,math,re,sys
from pathlib import Path

HERE=Path(__file__).resolve().parent
GOLD24=HERE.parent
if str(HERE) not in sys.path: sys.path.insert(0,str(HERE))
if str(GOLD24) not in sys.path: sys.path.insert(0,str(GOLD24))
from core import audit_dataset,backtest_candidate  # noqa:E402

STRICT=['rank01_donchian_f3_s89_off3_exp4','rank02_candle_engulfing_f34_s144_off2_75_exp8','rank03_donchian_f3_s100_off1_exp7']
MULTI=['multi_rank01_donchian_f3_s89_off4_75_exp3','multi_rank02_candle_engulfing_f100_s144_off5_exp4','multi_rank03_candle_engulfing_f26_s144_off2_exp5','multi_rank04_candle_engulfing_f26_s144_off2_75_exp7','multi_rank05_candle_engulfing_f34_s144_off4_5_exp8','multi_rank06_candle_engulfing_f34_s144_off1_25_exp8','multi_rank07_candle_engulfing_f55_s100_off3_25_exp8','multi_rank08_candle_engulfing_f26_s144_off1_75_exp8']
ALL=STRICT+MULTI
METRICS={'trades':('trades',0.0),'win_rate_pct':('wr',1e-9),'profit_factor':('profit_factor',1e-9),'net_profit_usd':('net_profit',1e-6),'ev_per_trade_usd':('expectancy',1e-9),'max_dd_pct':('max_dd_pct',1e-9),'sqn':('sqn',1e-9)}
CSV_METRICS={'trades':'total_entry','win_rate_pct':'standard_lot_win_rate_pct','profit_factor':'standard_lot_profit_factor_same_cost_model','net_profit_usd':'standard_lot_net_profit_usd_same_cost_model','ev_per_trade_usd':'standard_lot_ev_per_trade_usd_same_cost_model','max_dd_pct':'standard_lot_max_dd_pct_starting_equity_10000','sqn':'standard_lot_sqn_same_cost_model','sl_pips':'sl_pips','tp_pips':'tp_pips'}

def load_module(stem):
    p=HERE/f'{stem}.py';spec=importlib.util.spec_from_file_location(f'q_{stem}',p);m=importlib.util.module_from_spec(spec);assert spec and spec.loader;spec.loader.exec_module(m);return m

def close(a,b,tol): return int(a)==int(b) if tol==0 else math.isclose(float(a),float(b),rel_tol=0.0,abs_tol=tol)
def read_csv(path):
    with path.open(newline='',encoding='utf-8-sig') as f:return list(csv.DictReader(f))
def macro(text,name):
    m=re.search(rf'^#define\s+{re.escape(name)}\s+(.+?)\s*$',text,re.M);return m.group(1).strip() if m else None

def check_wrapper(stem,m):
    text=(HERE/f'{stem}.mq5').read_text(encoding='utf-8');pref='MM' if stem.startswith('multi_') else 'QM';c=m.CANDIDATE;e=m.EXPECTED
    expected={f'{pref}_FAMILY_CODE':'1' if c.family=='DONCHIAN' else '2',f'{pref}_FAST':str(c.fast),f'{pref}_SLOW':str(c.slow),f'{pref}_SL_USD':str(float(c.sl)),f'{pref}_TP_USD':str(float(c.tp)),f'{pref}_OFFSET_USD':str(float(c.offset)),f'{pref}_EXPIRY_BARS':str(c.expiry),f'{pref}_DIRECTION_MODE':f'"{c.direction_mode}"'}
    errors=[]
    for k,v in expected.items():
        got=macro(text,k)
        if got is None: errors.append(f'{k} missing')
        elif k.endswith(('SL_USD','TP_USD','OFFSET_USD')):
            try:
                if not math.isclose(float(got),float(v),abs_tol=1e-12):errors.append(f'{k}={got} expected {v}')
            except ValueError:errors.append(f'{k} invalid {got}')
        elif got!=v:errors.append(f'{k}={got} expected {v}')
    include='multimethod_engine.mqh' if pref=='MM' else 'qualified_engine.mqh'
    if include not in text:errors.append(f'missing include {include}')
    if e['config_hash'] not in text:errors.append('MT5 wrapper missing exact canonical config_hash fingerprint')
    return errors

def main():
    p=argparse.ArgumentParser();p.add_argument('--state-dir');p.add_argument('--out',default='qualified_scripts_validation.json');a=p.parse_args()
    modules={s:load_module(s) for s in ALL};methods={s:modules[s].EXPECTED['method'] for s in ALL}
    strict_rows=read_csv(GOLD24/'runtime_mt5_lot/latest_entry100_net20000_standard_lot.csv');multi_rows=read_csv(GOLD24/'runtime_multimethod_v1/latest_multimethod_v1_discovery.csv')
    if [r['method'] for r in strict_rows] != [methods[s] for s in STRICT]:raise SystemExit('STRICT_SCRIPT_SET_STALE: runtime strict method set/order differs from scripts')
    if [r['method'] for r in multi_rows] != [methods[s] for s in MULTI]:raise SystemExit('MULTI_SCRIPT_SET_STALE: runtime Multi method set/order differs from scripts')
    rows_by_method={r['method']:r for r in strict_rows+multi_rows};results=[]
    for stem,m in modules.items():
        e=m.EXPECTED;c=m.CANDIDATE;errs=check_wrapper(stem,m);row=rows_by_method[e['method']]
        if row.get('config_hash') != e['config_hash']:errs.append(f"csv config_hash={row.get('config_hash')} expected {e['config_hash']}")
        for ek,ck in CSV_METRICS.items():
            actual=float(row[ck]);ref=float(e[ek]);tol=0.0 if ek=='trades' else (1e-6 if ek=='net_profit_usd' else 1e-9)
            if not close(actual,ref,tol):errs.append(f'csv {ck}={actual} expected {ref}')
        record={'stem':stem,'method':e['method'],'config_hash_expected':e['config_hash'],'wrapper_static':'PASS' if not errs else 'FAIL','errors':errs}
        if a.state_dir:
            state=Path(a.state_dir);d,audit=audit_dataset(state/'gate_a/GC1_COMEX_TRADINGVIEW_D1_PRIMARY.csv',state/'gate_a/gate_a_receipt.json',c.timeframe);res=backtest_candidate(d,c,flat_lot=100.0);mt=res['metrics']
            if res['config_hash']!=e['config_hash']:errs.append(f"config_hash {res['config_hash']} != {e['config_hash']}")
            for ek,(mk,tol) in METRICS.items():
                if not close(mt[mk],e[ek],tol):errs.append(f'canonical {mk}={mt[mk]} expected {e[ek]}')
            record['canonical_python_parity']='PASS' if not errs else 'FAIL';record['dataset_rows']=audit.get('rows')
        if errs:raise SystemExit(json.dumps(record,indent=2))
        results.append(record)
    payload={'status':'PASS','strict_count':len(STRICT),'multi_count':len(MULTI),'total_method_pairs':len(ALL),'checks':results,'contract':{'python':'exact canonical core.py qty=100 parity','mt5':'native MetaEditor clean compile plus custom-symbol Strategy Tester operational certification; wrapper config/hash must match Python candidate','family_parameter_note':'for currently selected DONCHIAN and CANDLE_ENGULFING families, p1/p2/p3 remain part of canonical identity/hash but signal_series does not consume them','broker_pnl_note':'broker-specific spread/commission/swap/tick sequence can differ from canonical stressed cost model'}}
    Path(a.out).write_text(json.dumps(payload,indent=2)+'\n',encoding='utf-8');print(json.dumps(payload,indent=2))
if __name__=='__main__':main()
