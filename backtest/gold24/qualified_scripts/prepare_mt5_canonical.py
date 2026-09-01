from __future__ import annotations
import argparse,csv,datetime as dt,pathlib

def parse_date(raw:str)->str:
    x=raw.strip().replace('Z','+00:00')
    try:
        d=dt.datetime.fromisoformat(x).date()
    except ValueError:
        d=dt.datetime.strptime(raw[:10],'%Y-%m-%d').date()
    return d.strftime('%Y.%m.%d 00:00')

def main():
    p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--output',required=True);p.add_argument('--expected-rows',type=int,default=6500);a=p.parse_args()
    src=pathlib.Path(a.input);dst=pathlib.Path(a.output);dst.parent.mkdir(parents=True,exist_ok=True)
    with src.open(newline='',encoding='utf-8-sig') as f:
        r=csv.DictReader(f); fields={k.lower():k for k in (r.fieldnames or [])}
        req=['date','open','high','low','close']; missing=[k for k in req if k not in fields]
        if missing: raise SystemExit(f'missing columns: {missing}; got {r.fieldnames}')
        vol=next((fields[k] for k in ('volume','tick_volume','real_volume') if k in fields),None)
        rows=[]
        for x in r:
            rows.append([parse_date(x[fields['date']]),x[fields['open']],x[fields['high']],x[fields['low']],x[fields['close']],x.get(vol,'1') if vol else '1'])
    if len(rows)!=a.expected_rows: raise SystemExit(f'row count {len(rows)} != {a.expected_rows}')
    with dst.open('w',newline='',encoding='ascii') as f:
        w=csv.writer(f,lineterminator='\n');w.writerow(['Date','Open','High','Low','Close','Volume']);w.writerows(rows)
    print(f'GOLD24_MT5_CANONICAL_CSV_PASS rows={len(rows)} output={dst}')
if __name__=='__main__': main()
