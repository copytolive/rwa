import json, time, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parent
CFG=json.loads((ROOT/'config.json').read_text())
STATUS=ROOT/'status.json'

def post(url,payload,timeout=15):
    req=urllib.request.Request(url,data=json.dumps(payload).encode(),headers={'Content-Type':'application/json','User-Agent':'RWA-Monitor/1.0'})
    with urllib.request.urlopen(req,timeout=timeout) as r:return json.loads(r.read())

def get(url,timeout=15):
    req=urllib.request.Request(url,headers={'User-Agent':'RWA-Monitor/1.0'})
    with urllib.request.urlopen(req,timeout=timeout) as r:return json.loads(r.read())

def binance_tickers(out):
    errors=[]
    for name,url in [
        ('binance_vision','https://data-api.binance.vision/api/v3/ticker/24hr'),
        ('binance_global','https://api.binance.com/api/v3/ticker/24hr'),
        ('binance_api1','https://api1.binance.com/api/v3/ticker/24hr')
    ]:
        try:
            t=time.time(); data=get(url)
            if not isinstance(data,list): raise ValueError('unexpected ticker payload')
            out['providers'][name]={'ok':True,'latency_ms':round((time.time()-t)*1000),'markets':len(data),'active':True}
            for prev,_ in [('binance_vision',''),('binance_global',''),('binance_api1','')]:
                if prev!=name and prev not in out['providers']: out['providers'][prev]={'ok':False,'active':False}
            return data,name
        except Exception as e:
            errors.append((name,str(e)[:160]));out['providers'][name]={'ok':False,'active':False,'error':str(e)[:160]}
    out['provider_errors']=[{'provider':n,'error':e} for n,e in errors]
    return [],None

def main():
    now=int(time.time()*1000); out={'updated_at':now,'providers':{},'alerts':[],'copy_signals':[],'note':'Monitoring only. No private key and no automatic order execution.'}
    data,active=binance_tickers(out);out['market_data_provider']=active or 'unavailable';by={x.get('symbol'):x for x in data if isinstance(x,dict)}
    try:
        t=time.time(); mids=post('https://api.hyperliquid.xyz/info',{'type':'allMids'}); out['providers']['hyperliquid']={'ok':True,'latency_ms':round((time.time()-t)*1000),'markets':len(mids),'active':True}
    except Exception as e: out['providers']['hyperliquid']={'ok':False,'active':False,'error':str(e)[:160]}
    for a in CFG.get('alerts',[]):
        x=by.get(a.get('symbol'))
        if not x: continue
        price=float(x.get('lastPrice') or 0); change=float(x.get('priceChangePercent') or 0); vol=float(x.get('quoteVolume') or 0); typ=a.get('type'); th=float(a.get('threshold') or 0); hit=False
        if typ=='price_above':hit=price>=th
        elif typ=='price_below':hit=price<=th
        elif typ=='change_abs':hit=abs(change)>=th
        elif typ=='volume_min':hit=vol>=th
        if hit:out['alerts'].append({'id':a.get('id'),'symbol':a.get('symbol'),'type':typ,'threshold':th,'price':price,'change':change,'volume':vol,'triggered_at':now,'provider':active})
    for c in CFG.get('copy_targets',[]):
        w=c.get('wallet'); start=max(int(c.get('since_ms') or now-3600000),now-86400000)
        if not w:continue
        try:
            fills=post('https://api.hyperliquid.xyz/info',{'type':'userFillsByTime','user':w,'startTime':start,'aggregateByTime':True})
            for f in fills[-50:]: out['copy_signals'].append({'target':w,'coin':f.get('coin'),'side':'BUY' if f.get('side')=='B' else 'SELL','px':f.get('px'),'sz':f.get('sz'),'time':f.get('time'),'tid':f.get('tid'),'provider':'hyperliquid'})
        except Exception as e: out.setdefault('copy_errors',[]).append({'wallet':w,'error':str(e)[:120]})
    STATUS.write_text(json.dumps(out,indent=2,sort_keys=True)+'\n')
if __name__=='__main__': main()
