#!/usr/bin/env python3
import argparse, json, re, sys
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

p=argparse.ArgumentParser()
p.add_argument('--base',required=True)
p.add_argument('--artifact',required=True)
a=p.parse_args()
BASE=a.base.rstrip('/')+'/'
ART=Path(a.artifact); ART.mkdir(parents=True,exist_ok=True)

viewports=[
 ('1672x941',1672,941),('1440x900',1440,900),('1024x768',1024,768),
 ('430x932',430,932),('390x844',390,844),('360x800',360,800),
]
routes=[
 '/', '/markets/', '/markets/btc-usdc/', '/businesses/', '/businesses/kopi-nusantara/',
 '/businesses/kopi-nusantara/store/', '/trade/kopi/', '/checkout/', '/account/orders/',
 '/community/', '/merchant/', '/settings/', '/intelligence/', '/merchant/tokenization/',
 '/account/api/', '/account/billing/', '/account/activity/'
]

failures=[]; metrics=[]; page_errors=[]; bad_responses=[]
current={'vp':'','route':''}

def add(kind, **kw): failures.append({'kind':kind,'vp':current['vp'],'route':current['route'],**kw})

def local_scroll_ancestor(page, selector, index):
 return page.locator(selector).nth(index).evaluate("""el=>{let p=el.parentElement;while(p&&p!==document.body){const s=getComputedStyle(p);if(['auto','scroll'].includes(s.overflowX)&&p.scrollWidth>p.clientWidth+2)return true;p=p.parentElement;}return false}""")

def rect(page, selector):
 loc=page.locator(selector).first
 if loc.count()<1 or not loc.is_visible(): return None
 return loc.evaluate("""e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,sw:e.scrollWidth,cw:e.clientWidth,sh:e.scrollHeight,ch:e.clientHeight,overflowX:s.overflowX,overflowY:s.overflowY}}""")

def safe_name(route): return route.strip('/').replace('/','-') or 'landing'

with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1672,'height':941},device_scale_factor=1)
 context.set_default_timeout(2500)
 page=context.new_page()
 page.on('pageerror',lambda e: page_errors.append({'vp':current['vp'],'route':current['route'],'error':str(e)}))
 def on_response(r):
  u=urlparse(r.url); b=urlparse(BASE)
  if r.status>=400 and (u.scheme,u.netloc)==(b.scheme,b.netloc):
   bad_responses.append({'vp':current['vp'],'route':current['route'],'status':r.status,'url':r.url})
 page.on('response',on_response)

 for vpname,w,h in viewports:
  page.set_viewport_size({'width':w,'height':h})
  mobile=w<=430
  for route in routes:
   current.update(vp=vpname,route=route)
   try:
    resp=page.goto(BASE+route.lstrip('/'),wait_until='domcontentloaded',timeout=15000)
    page.wait_for_timeout(120)
   except Exception as e:
    add('navigation',detail=str(e)[:700]); continue
   if resp and resp.status>=400: add('route-http',status=resp.status)

   dims=page.evaluate("""() => ({iw:innerWidth,sw:document.documentElement.scrollWidth,bw:document.body.getBoundingClientRect().width})""")
   if dims['sw']>dims['iw']+3: add('global-horizontal-overflow',**dims)
   if abs(dims['bw']-dims['iw'])>4: add('body-width-mismatch',**dims)

   hdr=rect(page,'.app-header')
   if hdr:
    if not (62<=hdr['height']<=70): add('header-height',rect=hdr)
    if hdr['left']<-2 or hdr['right']>w+2: add('header-offscreen',rect=hdr)

   # Headings and interactive controls may not be physically clipped by the viewport unless
   # they intentionally live inside a local horizontal scroll container.
   selectors=['h1:visible','h2:visible','h3:visible','button:visible','input:visible','select:visible','textarea:visible']
   clipped=[]
   for sel in selectors:
    loc=page.locator(sel)
    for i in range(min(loc.count(),180)):
     try:
      r=loc.nth(i).bounding_box()
      if not r or r['width']<1 or r['height']<1: continue
      if r['x'] < -3 or r['x']+r['width'] > w+3:
       if local_scroll_ancestor(page,sel,i): continue
       text=(loc.nth(i).get_attribute('aria-label') or loc.nth(i).inner_text() or '')
       clipped.append({'selector':sel,'text':re.sub(r'\s+',' ',text).strip()[:90],'rect':r})
     except Exception: pass
   if clipped: add('clipped-visible-elements',items=clipped[:12],count=len(clipped))

   if mobile and route=='/merchant/':
    side=rect(page,'.merchant-sidebar'); content=rect(page,'.merchant-content')
    if not side: add('merchant-sidebar-missing')
    else:
     if side['width'] < w-4: add('merchant-sidebar-not-full-width',rect=side)
     if side['height']>130: add('merchant-sidebar-too-tall',rect=side)
    if not content: add('merchant-content-missing')
    elif content['width'] < w-4: add('merchant-content-squeezed',rect=content,viewport=w)
    panels=page.locator('.merchant-kpis .merchant-panel:visible')
    widths=[]
    for i in range(panels.count()):
     b=panels.nth(i).bounding_box()
     if b: widths.append(b['width'])
    if widths and min(widths)<145: add('merchant-kpi-too-narrow',widths=widths)

   if mobile and route=='/account/orders/':
    banner=rect(page,'.success-banner')
    if not banner: add('orders-success-banner-missing')
    else:
     if banner['sh']>banner['ch']+3: add('orders-success-banner-overflow',rect=banner)
     title=rect(page,'.success-banner h2')
     if title and title['top']<banner['top']-1: add('orders-banner-title-escapes',banner=banner,title=title)
    table=rect(page,'.receipt-table')
    if table:
     if table['right']>w+3: add('orders-receipt-table-offscreen',rect=table)
     if table['sw']>table['cw']+3 and table['overflowX'] not in ('auto','scroll'):
      add('orders-table-not-locally-scrollable',rect=table)

   metrics.append({'vp':vpname,'route':route,'document':dims,'header':hdr})
   if route in ('/','/markets/','/businesses/kopi-nusantara/','/businesses/kopi-nusantara/store/','/trade/kopi/','/account/orders/','/community/','/merchant/','/settings/'):
    page.screenshot(path=str(ART/f'{vpname}-{safe_name(route)}.png'),full_page=False)

 browser.close()

# De-duplicate noisy response events.
seen=set(); br=[]
for x in bad_responses:
 k=(x['vp'],x['route'],x['status'],x['url'])
 if k not in seen: seen.add(k); br.append(x)
bad_responses=br
if bad_responses: failures.append({'kind':'same-origin-http-errors','count':len(bad_responses),'items':bad_responses[:30]})
if page_errors: failures.append({'kind':'page-errors','count':len(page_errors),'items':page_errors[:30]})

result={
 'status':'PASS' if not failures else 'FAIL',
 'viewports':[v[0] for v in viewports],
 'routes':routes,
 'routeViewportChecks':len(viewports)*len(routes),
 'failures':failures,
 'metrics':metrics,
 'pageErrors':page_errors,
 'badResponses':bad_responses,
}
(ART/'layout-consistency.json').write_text(json.dumps(result,indent=2)+'\n')
line=f"UI_LAYOUT_CONSISTENCY_{result['status']} checks={result['routeViewportChecks']} routes={len(routes)} viewports={len(viewports)} failures={len(failures)}\n"
(ART/'result.txt').write_text(line)
print(line,end='')
if failures:
 print(json.dumps(failures[:20],indent=2))
 sys.exit(1)
