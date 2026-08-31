#!/usr/bin/env python3
import concurrent.futures as cf
import datetime as dt
import gzip
import hashlib
import json
import math
import os
import time
import urllib.parse
import urllib.request

ROOT='https://www.okx.com/api/v5/market/history-candles'
INST='XAUT-USDT'
BAR='1s'
INTERVAL_MS=1000
TARGET=1_005_000
PAGE=300
BATCH=10
PACK='renko/xaut-okx-1s-pack.csv.gz'
META='renko/xaut-okx-1s-pack.meta.json'
UA='copytolive-rwa-renko-pack/1.0'


def get_page(after_ms):
    q=urllib.parse.urlencode({'instId':INST,'bar':BAR,'after':str(after_ms),'limit':str(PAGE)})
    url=ROOT+'?'+q
    last=None
    for attempt in range(8):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'application/json'})
            with urllib.request.urlopen(req,timeout=30) as r:
                obj=json.load(r)
            if obj.get('code')!='0':
                raise RuntimeError(f"OKX code={obj.get('code')} msg={obj.get('msg')}")
            rows=obj.get('data') or []
            out=[]
            for x in rows:
                if not isinstance(x,list) or len(x)<9 or str(x[8])!='1':
                    continue
                t=int(x[0]); o=float(x[1]); h=float(x[2]); l=float(x[3]); c=float(x[4]); v=float(x[5] or 0)
                out.append((t,o,h,l,c,v))
            return out
        except Exception as e:
            last=e
            time.sleep(min(8,0.7*(attempt+1)))
    raise RuntimeError(f'page failed after={after_ms}: {last}')


def fmt(n):
    s=f'{n:.12f}'.rstrip('0').rstrip('.')
    return s if s else '0'


def main():
    if BAR != '1s' or INTERVAL_MS != 1000:
        raise SystemExit(f'fixed-1s contract changed: BAR={BAR} INTERVAL_MS={INTERVAL_MS}')
    now_ms=int(time.time()*1000)
    anchor=(now_ms//1000-2)*1000
    pages=math.ceil(TARGET/PAGE)+2
    all_rows={}
    started=time.time()
    for base in range(0,pages,BATCH):
        ids=list(range(base,min(pages,base+BATCH)))
        with cf.ThreadPoolExecutor(max_workers=len(ids)) as ex:
            futs={ex.submit(get_page,anchor+1000-i*PAGE*INTERVAL_MS):i for i in ids}
            for fut in cf.as_completed(futs):
                i=futs[fut]
                rows=fut.result()
                for row in rows:
                    all_rows[row[0]]=row
                if i%100==0:
                    print(f'page={i}/{pages} unique={len(all_rows):,}',flush=True)
        time.sleep(1.05)
    rows=sorted(all_rows.values(),key=lambda x:x[0])
    if len(rows)<TARGET:
        raise SystemExit(f'insufficient provider-native OKX 1s rows: {len(rows):,} < {TARGET:,}')
    rows=rows[-TARGET:]
    if len(rows)!=TARGET:
        raise SystemExit(f'expected exactly {TARGET:,} rows after trim, got {len(rows):,}')
    bad=[]
    for i in range(1,len(rows)):
        if rows[i][0]-rows[i-1][0]!=INTERVAL_MS:
            bad.append((i,rows[i-1][0],rows[i][0]))
            if len(bad)>=5: break
    if bad:
        raise SystemExit(f'non-contiguous provider-native OKX 1s pack: {bad}')
    os.makedirs(os.path.dirname(PACK),exist_ok=True)
    sha=hashlib.sha256()
    with gzip.open(PACK,'wt',encoding='utf-8',newline='\n',compresslevel=9) as f:
        for t,o,h,l,c,v in rows:
            line=f'{t},{fmt(o)},{fmt(h)},{fmt(l)},{fmt(c)},{fmt(v)}\n'
            f.write(line); sha.update(line.encode())
    meta={
        'schema':'renko-xaut-okx-1s-pack-v2',
        'provider':'OKX Spot',
        'instrument':INST,
        'interval':'1s',
        'intervalMs':INTERVAL_MS,
        'rows':len(rows),
        'fromMs':rows[0][0],
        'toMs':rows[-1][0],
        'fromUtc':dt.datetime.fromtimestamp(rows[0][0]/1000,dt.timezone.utc).isoformat(),
        'toUtc':dt.datetime.fromtimestamp(rows[-1][0]/1000,dt.timezone.utc).isoformat(),
        'sha256UncompressedCsv':sha.hexdigest(),
        'builtAtUtc':dt.datetime.now(dt.timezone.utc).isoformat(),
        'api':ROOT,
        'zeroVolumeBars':'provider-native OKX 1s candles; no synthetic gap fill',
        'provenance':{
            'sourceBar':'1s',
            'sourceIntervalMs':INTERVAL_MS,
            'upsampled':False,
            'synthetic1s':False,
            'continuity':'provider-native OKX 1s candles'
        }
    }
    with open(META,'w',encoding='utf-8') as f:
        json.dump(meta,f,indent=2,sort_keys=True)
        f.write('\n')
    print(json.dumps(meta,indent=2,sort_keys=True),flush=True)
    print(f'pack_bytes={os.path.getsize(PACK):,} elapsed={time.time()-started:.1f}s',flush=True)


if __name__=='__main__':
    main()
