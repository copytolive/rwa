from __future__ import annotations
import argparse,csv,datetime as dt,pathlib

def parse_ts(raw:str)->str:
    s=raw.strip().replace("Z","+00:00")
    x=dt.datetime.fromisoformat(s)
    if x.tzinfo is not None:
        x=x.astimezone(dt.timezone.utc).replace(tzinfo=None)
    return x.strftime("%Y.%m.%d %H:%M")

def main()->None:
    p=argparse.ArgumentParser();p.add_argument("--input",required=True);p.add_argument("--output",required=True);p.add_argument("--expected-rows",type=int,default=0);a=p.parse_args()
    src=pathlib.Path(a.input);dst=pathlib.Path(a.output);dst.parent.mkdir(parents=True,exist_ok=True)
    with src.open(newline="",encoding="utf-8-sig") as f:
        r=csv.DictReader(f); fields={k.lower():k for k in (r.fieldnames or [])}
        req=["date","open","high","low","close"]; missing=[k for k in req if k not in fields]
        if missing: raise SystemExit(f"missing columns: {missing}; got {r.fieldnames}")
        vol=next((fields[k] for k in ("volume","tick_volume","real_volume") if k in fields),None)
        rows=[]
        for x in r:
            rows.append([parse_ts(x[fields["date"]]),x[fields["open"]],x[fields["high"]],x[fields["low"]],x[fields["close"]],x.get(vol,"1") if vol else "1"])
    if a.expected_rows and len(rows)!=a.expected_rows: raise SystemExit(f"row count {len(rows)} != {a.expected_rows}")
    if len(rows)<3000: raise SystemExit(f"H4 row count too short: {len(rows)}")
    with dst.open("w",newline="",encoding="ascii") as f:
        w=csv.writer(f,lineterminator="\n");w.writerow(["Date","Open","High","Low","Close","Volume"]);w.writerows(rows)
    print(f"GOLD10B_MT5_NATIVE_H4_CSV_PASS rows={len(rows)} output={dst}")
if __name__=="__main__": main()
