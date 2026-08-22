import json, time, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parent
CFG=json.loads((ROOT/'config.json').read_text())
STATUS=ROOT/'status.json'

def post(url,payload,timeout=15):
    req=urllib.request.Request(url,data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=timeout) as r:return json.loads(r.read())

def get(url,timeout=15):
    with urllib.request.urlopen(url,timeout=timeout) as r:return json.loads(r.read())

def main():
    now=int(time.time()*1000); out={'updated_at':now,'providers':{},'alerts':[],'copy_signals':[],'note':'Monitoring only. No private key and no automatic order execution.'}
    try:
        t=time.time(); data=get('https://api.binance.com/api/v3/ticker/24hr'); out['providers']['binance']={'ok':True,'latency_ms':round((time.time()-t)*1000)}
        by={x.get('symbol'):x for x in data if isinstance(x,dict)}
    except Exception as e:
        out['providers']['binance']={'ok':False,'error':str(e)[:160]}; by={}
    try:
        t=time.time(); mids=post('https://api.hyperliquid.xyz/info',{'type':'allMids'}); out['providers']['hyperliquid']={'ok':True,'latency_ms':round((time.time()-t)*1000),'markets':len(mids)}
    except Exception as e: out['providers']['hyperliquid']={'ok':False,'error':str(e)[:160]}
    for a in CFG.get('alerts',[]):
        x=by.get(a.get('symbol'))
        if not x: continue
        price=float(x.get('lastPrice') or 0); change=float(x.get('priceChangePercent') or 0); vol=float(x.get('quoteVolume') or 0); typ=a.get('type'); th=float(a.get('threshold') or 0); hit=False
        if typ=='price_above':hit=price>=th
        elif typ=='price_below':hit=price<=th
        elif typ=='change_abs':hit=abs(change)>=th
        elif typ=='volume_min':hit=vol>=th
        if hit:out['alerts'].append({'id':a.get('id'),'symbol':a.get('symbol'),'type':typ,'threshold':th,'price':price,'change':change,'volume':vol,'triggered_at':now})
    for c in CFG.get('copy_targets',[]):
        w=c.get('wallet'); start=max(int(c.get('since_ms') or now-3600000),now-86400000)
        if not w:continue
        try:
            fills=post('https://api.hyperliquid.xyz/info',{'type':'userFillsByTime','user':w,'startTime':start,'aggregateByTime':True})
            for f in fills[-50:]: out['copy_signals'].append({'target':w,'coin':f.get('coin'),'side':'BUY' if f.get('side')=='B' else 'SELL','px':f.get('px'),'sz':f.get('sz'),'time':f.get('time'),'tid':f.get('tid')})
        except Exception as e: out.setdefault('copy_errors',[]).append({'wallet':w,'error':str(e)[:120]})
    STATUS.write_text(json.dumps(out,indent=2,sort_keys=True)+'\n')
if __name__=='__main__': main()
