import json, time, urllib.request, urllib.parse
from pathlib import Path

ROOT=Path(__file__).resolve().parent
CFG=json.loads((ROOT/'config.json').read_text())
STATUS=ROOT/'status.json'
UA='Mozilla/5.0 RWA-Monitor/2.0'

def request_json(url,payload=None,timeout=15):
    data=json.dumps(payload).encode() if payload is not None else None
    headers={'User-Agent':UA,'Accept':'application/json'}
    if payload is not None: headers['Content-Type']='application/json'
    req=urllib.request.Request(url,data=data,headers=headers)
    with urllib.request.urlopen(req,timeout=timeout) as r:return json.loads(r.read())

def provider_test(url,payload=None):
    t=time.time()
    try:return request_json(url,payload),{'ok':True,'latency_ms':round((time.time()-t)*1000)}
    except Exception as e:return None,{'ok':False,'error':str(e)[:180]}

def previous():
    try:return json.loads(STATUS.read_text())
    except:return {}

def normalize(rows,provider):
    out={}
    for x in rows or []:
        if not isinstance(x,dict) or not x.get('symbol'):continue
        out[x['symbol']]={'symbol':x['symbol'],'price':float(x.get('lastPrice') or 0),'change':float(x.get('priceChangePercent') or 0),'volume':float(x.get('quoteVolume') or 0),'high':float(x.get('highPrice') or 0),'low':float(x.get('lowPrice') or 0),'provider':provider}
    return out

def coinbase_quote(symbol):
    base=symbol[:-4] if symbol.endswith('USDT') else symbol[:-3] if symbol.endswith('USD') else symbol
    product=f'{base}-USD';q=urllib.parse.quote(product)
    ticker=request_json(f'https://api.exchange.coinbase.com/products/{q}/ticker')
    stats=request_json(f'https://api.exchange.coinbase.com/products/{q}/stats')
    price=float(ticker.get('price') or 0);open24=float(stats.get('open') or 0)
    return {'symbol':symbol,'price':price,'change':((price-open24)/open24*100) if open24 else 0,'volume':float(stats.get('volume') or 0)*price,'high':float(stats.get('high') or 0),'low':float(stats.get('low') or 0),'provider':'coinbase-usd'}

def kraken_quote(symbol):
    base=symbol[:-4] if symbol.endswith('USDT') else symbol[:-3] if symbol.endswith('USD') else symbol
    base={'BTC':'XBT','DOGE':'XDG'}.get(base,base)
    data=request_json('https://api.kraken.com/0/public/Ticker?pair='+urllib.parse.quote(base+'USD'))
    row=next(iter((data.get('result') or {}).values()));price=float(row['c'][0]);open24=float(row['o'] or 0)
    return {'symbol':symbol,'price':price,'change':((price-open24)/open24*100) if open24 else 0,'volume':float(row['v'][1] or 0)*price,'high':float(row['h'][1] or 0),'low':float(row['l'][1] or 0),'provider':'kraken-usd'}

def market_quote(symbol,by,cache):
    if symbol in by:return by[symbol]
    if symbol in cache:return cache[symbol]
    try:q=coinbase_quote(symbol)
    except Exception:
        try:q=kraken_quote(symbol)
        except Exception:return None
    cache[symbol]=q;return q

def is_hit(a,x):
    typ=a.get('type');th=float(a.get('threshold') or 0);price=x['price'];change=x['change'];vol=x['volume']
    if typ=='price_above':return price>=th
    if typ=='price_below':return price<=th
    if typ=='change_abs':return abs(change)>=th
    if typ=='volume_min':return vol>=th
    if typ=='breakout':return price>float(a.get('baseline_high') or a.get('baselineHigh') or 1e99)
    return False

def main():
    now=int(time.time()*1000);prev=previous();providers={};rows=None;active_provider=None
    for name,url in [('binance_vision','https://data-api.binance.vision/api/v3/ticker/24hr'),('binance_global','https://api.binance.com/api/v3/ticker/24hr'),('binance_api1','https://api1.binance.com/api/v3/ticker/24hr')]:
        data,h=provider_test(url);providers[name]=h
        if rows is None and isinstance(data,list):rows=data;active_provider=name;providers[name]['active']=True;providers[name]['markets']=len(data)
        else:providers[name]['active']=False
    by=normalize(rows or [],active_provider or 'none')

    _,providers['coinbase']=provider_test('https://api.exchange.coinbase.com/products/BTC-USD/ticker')
    _,providers['kraken']=provider_test('https://api.kraken.com/0/public/Ticker?pair=XBTUSD')
    mids,providers['hyperliquid']=provider_test('https://api.hyperliquid.xyz/info',{'type':'allMids'})
    if providers['hyperliquid'].get('ok') and isinstance(mids,dict):providers['hyperliquid']['markets']=len(mids)

    out={'updated_at':now,'market_data_provider':active_provider or 'coinbase/kraken-on-demand','providers':providers,'alerts':list(prev.get('alerts') or [])[-100:],'active_alerts':[],'copy_signals':list(prev.get('copy_signals') or [])[-100:],'note':'Monitoring only. No private key and no automatic order execution; execution remains wallet-signature-required.'}
    prev_active={str(x.get('id')) for x in prev.get('active_alerts') or []};cache={}
    for i,a in enumerate(CFG.get('alerts',[])):
        aid=str(a.get('id') or f'alert-{i}');sym=a.get('symbol');x=market_quote(sym,by,cache) if sym else None
        if not x:continue
        if is_hit(a,x):
            active={'id':aid,'symbol':sym,'type':a.get('type'),'threshold':float(a.get('threshold') or 0),'price':x['price'],'change':x['change'],'volume':x['volume'],'provider':x['provider']}
            out['active_alerts'].append(active)
            if aid not in prev_active:out['alerts'].append({**active,'event_id':f'{aid}-{now}','triggered_at':now})
    out['alerts']=out['alerts'][-100:]

    copies={str(x.get('event_id') or f"{x.get('target')}-{x.get('tid') or x.get('time')}-{x.get('coin')}"):x for x in out['copy_signals']}
    for c in CFG.get('copy_targets',[]):
        w=c.get('wallet');start=max(int(c.get('since_ms') or now-3600000),now-86400000)
        if not w:continue
        try:
            fills=request_json('https://api.hyperliquid.xyz/info',{'type':'userFillsByTime','user':w,'startTime':start,'aggregateByTime':True})
            for f in (fills or [])[-50:]:
                eid=f"{w}-{f.get('tid') or f.get('time')}-{f.get('coin')}"
                copies[eid]={'event_id':eid,'target':w,'coin':f.get('coin'),'side':'BUY' if f.get('side')=='B' else 'SELL','px':f.get('px'),'sz':f.get('sz'),'time':f.get('time'),'tid':f.get('tid'),'provider':'hyperliquid'}
        except Exception as e:out.setdefault('copy_errors',[]).append({'wallet':w,'error':str(e)[:140]})
    out['copy_signals']=sorted(copies.values(),key=lambda x:int(x.get('time') or 0))[-100:]
    STATUS.write_text(json.dumps(out,indent=2,sort_keys=True)+'\n')

if __name__=='__main__':main()
