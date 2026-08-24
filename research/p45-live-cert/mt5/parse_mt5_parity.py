import argparse, csv, json, re
from datetime import datetime, timedelta
from pathlib import Path

DT='%Y.%m.%d %H:%M:%S'

def dt(s):
    return datetime.strptime(s,DT)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--events',required=True)
    ap.add_argument('--logs',required=True)
    ap.add_argument('--output',required=True)
    a=ap.parse_args()
    events=[]
    with open(a.events,newline='',encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            events.append(r)
    text=Path(a.logs).read_text(encoding='utf-8',errors='replace')
    lines=text.splitlines()

    place=[]; entries=[]; exits=[]; markers=[]
    hard_errors=[]
    for line in lines:
        if 'PO_PLACE_FAIL' in line or 'INIT_SLTP_FAIL' in line or 'IMPORT_FAIL' in line:
            hard_errors.append(line[-500:])
        m=re.search(r'PARITY_PLACE method=(\S+) actual=([0-9.]+ [0-9:]+) ref=([0-9.]+ [0-9:]+) actualType=(\S+) refType=(\S+) actualPrice=([0-9.]+) refPrice=([0-9.]+) actualExpiry=([0-9.]+ [0-9:]+) refExpiry=([0-9.]+ [0-9:]+)',line)
        if m: place.append(m.groups()); continue
        m=re.search(r'PARITY_ENTRY method=(\S+) refFilled=(\d+) actual=([0-9.]+ [0-9:]+) ref=([0-9.]+ [0-9:]+) actualSide=(\S+) refSide=(\S+) actualPrice=([0-9.]+) refPrice=([0-9.]+)',line)
        if m: entries.append(m.groups()); continue
        m=re.search(r'PARITY_EXIT method=(\S+) actual=([0-9.]+ [0-9:]+) actualBar=([0-9.]+ [0-9:]+) refBar=([0-9.]+ [0-9:]+) actualOutcome=(\S+) refOutcome=(\S+) actualPrice=([0-9.]+) reason=(\d+)',line)
        if m: exits.append(m.groups()); continue
        m=re.search(r'EVENT_EXPIRED method=(\S+) now=([0-9.]+ [0-9:]+) refFilled=(\d+)',line)
        if m: markers.append(('EXPIRED',m.groups())); continue
        m=re.search(r'EVENT_DONE method=(\S+) now=([0-9.]+ [0-9:]+) refOutcome=(\S+) refR=([-0-9.]+)',line)
        if m: markers.append(('DONE',m.groups())); continue

    mismatches=[]
    def add(kind,idx,detail):
        if len(mismatches)<1000: mismatches.append({'kind':kind,'event_index':idx,'detail':detail})

    if len(markers)!=len(events): add('event_count',None,f'actual markers {len(markers)} != reference events {len(events)}')
    for i,(ev,mk) in enumerate(zip(events,markers),1):
        exp='DONE' if int(ev['filled']) else 'EXPIRED'
        if mk[0]!=exp: add('event_fill_state',i,f'actual {mk[0]} != {exp}')

    if len(place)!=len(events): add('placement_count',None,f'actual placements {len(place)} != events {len(events)}')
    for i,(ev,p) in enumerate(zip(events,place),1):
        _,actual,ref,at,rt,apx,rpx,aexp,rexp=p
        expected_exp=dt(ev['expiry_bar_time'])+timedelta(minutes=15)
        checks=[
          (actual==ev['activation_time'],'activation',f'{actual} != {ev["activation_time"]}'),
          (ref==ev['activation_time'],'logged_ref_activation',f'{ref} != {ev["activation_time"]}'),
          (at==ev['pending_type'],'pending_type',f'{at} != {ev["pending_type"]}'),
          (rt==ev['pending_type'],'logged_ref_type',f'{rt} != {ev["pending_type"]}'),
          (abs(float(apx)-float(ev['pending_price']))<=0.0011,'pending_price',f'{apx} != {ev["pending_price"]}'),
          (abs(float(rpx)-float(ev['pending_price']))<=0.0011,'logged_ref_price',f'{rpx} != {ev["pending_price"]}'),
          (dt(aexp)==expected_exp,'expiration',f'{aexp} != {expected_exp.strftime(DT)}'),
          (dt(rexp)==expected_exp,'logged_ref_expiration',f'{rexp} != {expected_exp.strftime(DT)}'),
        ]
        for ok,k,d in checks:
            if not ok: add(k,i,d)

    ref_filled=[e for e in events if int(e['filled'])]
    if len(entries)!=len(ref_filled): add('entry_count',None,f'actual entries {len(entries)} != ref filled {len(ref_filled)}')
    for j,(ev,e) in enumerate(zip(ref_filled,entries),1):
        method,rf,actual,ref,aside,rside,apx,rpx=e
        expected_side='BUY' if ev['pending_type'].startswith('BUY_') else 'SELL'
        checks=[
          (rf=='1','ref_filled_flag',rf),
          (actual==ev['reference_fill_time'],'fill_time',f'{actual} != {ev["reference_fill_time"]}'),
          (ref==ev['reference_fill_time'],'logged_ref_fill_time',f'{ref} != {ev["reference_fill_time"]}'),
          (aside==expected_side,'side',f'{aside} != {expected_side}'),
          (rside==expected_side,'logged_ref_side',f'{rside} != {expected_side}'),
          (abs(float(apx)-float(ev['reference_fill_price']))<=0.0011,'fill_price',f'{apx} != {ev["reference_fill_price"]}'),
          (abs(float(rpx)-float(ev['reference_fill_price']))<=0.0011,'logged_ref_fill_price',f'{rpx} != {ev["reference_fill_price"]}'),
        ]
        for ok,k,d in checks:
            if not ok: add(k,j,d)

    if len(exits)!=len(ref_filled): add('exit_count',None,f'actual exits {len(exits)} != ref filled {len(ref_filled)}')
    for j,(ev,x) in enumerate(zip(ref_filled,exits),1):
        method,actual,abar,rbar,aout,rout,apx,reason=x
        checks=[
          (abar==ev['reference_exit_time'],'exit_bar',f'{abar} != {ev["reference_exit_time"]}'),
          (rbar==ev['reference_exit_time'],'logged_ref_exit_bar',f'{rbar} != {ev["reference_exit_time"]}'),
          (aout==ev['reference_outcome'],'outcome',f'{aout} != {ev["reference_outcome"]}'),
          (rout==ev['reference_outcome'],'logged_ref_outcome',f'{rout} != {ev["reference_outcome"]}'),
        ]
        for ok,k,d in checks:
            if not ok: add(k,j,d)

    all_done='ALL_EVENTS_DONE' in text
    if not all_done: add('all_events_done',None,'marker absent')
    if hard_errors: add('hard_execution_errors',None,f'{len(hard_errors)} errors')

    result={
      'strategy':'P45 Previous-Week Breakout Retest Limit',
      'native_mt5_same_dataset':True,
      'reference_events':len(events),
      'reference_filled':len(ref_filled),
      'actual_event_markers':len(markers),
      'actual_placements':len(place),
      'actual_entries':len(entries),
      'actual_exits':len(exits),
      'all_events_done':all_done,
      'hard_execution_error_count':len(hard_errors),
      'mismatch_count':len(mismatches),
      'parity_pass':len(mismatches)==0,
      'first_mismatches':mismatches[:50],
      'hard_errors':hard_errors[:20],
      'criteria':'100% event fill-state + placement time/type/price/expiry + fill time/side/price + exit M15 bar/outcome',
    }
    Path(a.output).write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result,indent=2))
    raise SystemExit(0 if result['parity_pass'] else 2)

if __name__=='__main__': main()
