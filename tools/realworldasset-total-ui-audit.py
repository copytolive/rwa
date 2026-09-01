#!/usr/bin/env python3
import argparse, hashlib, json, os, re, sys
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

p=argparse.ArgumentParser()
p.add_argument('--base',required=True); p.add_argument('--source',required=True); p.add_argument('--site-dir',required=True); p.add_argument('--artifact',required=True)
a=p.parse_args(); BASE=a.base.rstrip('/')+'/'; SOURCE=Path(a.source); SITE=Path(a.site_dir); ART=Path(a.artifact); ART.mkdir(parents=True,exist_ok=True)

network_patterns={
 'fetch':re.compile(r'\bfetch\s*\('),'axios':re.compile(r'\baxios\b'),'websocket':re.compile(r'\bWebSocket\b'),
 'eventsource':re.compile(r'\bEventSource\b'),'xhr':re.compile(r'\bXMLHttpRequest\b'),'graphql':re.compile(r'\bgraphql\b',re.I),
 'wallet_provider':re.compile(r'window\.ethereum|walletconnect|\bwagmi\b|\bviem\b|\bethers\b',re.I),'payment_provider':re.compile(r'\bstripe\b|paypal|adyen',re.I),
}
source_hits={k:[] for k in network_patterns}; demo_hits=[]
for f in SOURCE.rglob('*'):
 if f.suffix.lower() not in {'.ts','.tsx','.js','.jsx','.mjs','.cjs'} or not f.is_file(): continue
 try: text=f.read_text(errors='ignore')
 except Exception: continue
 rel=str(f.relative_to(SOURCE))
 for k,rx in network_patterns.items():
  if rx.search(text): source_hits[k].append(rel)
 if re.search(r'\bDEMO_|UI DEMO|Backend Offline|BACKEND_CONNECTED\s*=\s*false',text,re.S): demo_hits.append(rel)

routes=[]
for f in SITE.rglob('index.html'):
 rel=f.relative_to(SITE); route='/' + str(rel.parent).replace(os.sep,'/').strip('/')
 if route=='/.': route='/'
 if route!='/' and not route.endswith('/'): route+='/'
 routes.append(route)
routes=sorted(set(routes),key=lambda x:(x.count('/'),x)); route_set=set(routes)

viewports=[('1672x941',1672,941),('2048x1129',2048,1129),('1600x1000',1600,1000),('1440x900',1440,900),('1366x768',1366,768),('1280x800',1280,800),('1024x768',1024,768),('412x915',412,915),('390x844',390,844)]
sweep_viewports=[viewports[0],viewports[-1]]
core=['/','/home/','/markets/','/markets/btc-usdc/','/businesses/','/businesses/kopi-nusantara/','/rwa/marina-bay-residences/','/trade/kopi/','/checkout/','/account/orders/','/community/','/merchant/','/settings/']
core=[r for r in core if r in route_set]

runtime_errors=[]; console_errors=[]; failed_responses=[]; broken_images=[]; stale_paths=[]; overflows=[]; broken_links=[]; api_requests=[]; control_occurrences=0; distinct={}; screens=[]; current={'vp':'','route':''}

def url_for(route): return BASE+route.lstrip('/')
def clean_html(page): return page.evaluate("""() => {const c=document.body.cloneNode(true);c.querySelectorAll('.sr-only,.app-safety-notice,.rwa-demo-notice,.detail-toast,.acct-toast,.trade-toast,.commerce-toast').forEach(n=>n.remove());return c.outerHTML;}""")
def normalized_route_from_href(href):
 u=urlparse(href); base=urlparse(BASE)
 if u.scheme and (u.scheme,u.netloc)!=(base.scheme,base.netloc): return None
 original=u.path or '/'; base_path=base.path.rstrip('/'); candidate=original
 if base_path and candidate.startswith(base_path): candidate=candidate[len(base_path):] or '/'
 def norm(path):
  if not path.startswith('/'): path='/'+path
  if '.' in Path(path).name: return 'FILE'
  if path!='/' and not path.endswith('/'): path+='/'
  return path
 stripped=norm(candidate); raw=norm(original)
 if stripped in route_set: return stripped
 if raw in route_set: return raw
 return stripped

def uniq(items,key_fn):
 out=[]; seen=set()
 for x in items:
  k=key_fn(x)
  if k in seen: continue
  seen.add(k); out.append(x)
 return out

def button_label(b):
 try:
  label=(b.get_attribute('aria-label') or b.inner_text()).strip()
  return re.sub(r'\s+',' ',label)[:120]
 except Exception:
  return ''

def relocate_button(page,item):
 buttons=page.locator('button:visible')
 count=buttons.count()
 if item['index'] < count:
  candidate=buttons.nth(item['index'])
  try:
   if button_label(candidate)==item['label'] and (candidate.get_attribute('class') or '')==item['class']:
    return candidate
  except Exception:
   pass
 try:
  match_index=buttons.evaluate_all("""(els,t)=>els.findIndex(e=>{const aria=e.getAttribute('aria-label');const raw=(aria||e.innerText||'').trim().replace(/\s+/g,' ').slice(0,120);return raw===t.label&&(e.getAttribute('class')||'')===t.cls})""",{'label':item['label'],'cls':item['class']})
  if isinstance(match_index,int) and match_index>=0: return buttons.nth(match_index)
 except Exception:
  pass
 return None

def click_stable(page,item):
 b=relocate_button(page,item)
 if b is None: raise PlaywrightTimeoutError('control not found after hydration')
 last=None
 for settle,timeout in ((0,2600),(260,5000)):
  try:
   if settle: page.wait_for_timeout(settle); b=relocate_button(page,item) or b
   b.scroll_into_view_if_needed(timeout=1800)
   b.click(timeout=timeout)
   return b
  except PlaywrightTimeoutError as e:
   last=e
 raise last or PlaywrightTimeoutError('click timeout')

with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1672,'height':941},device_scale_factor=1)
 try:
  u=urlparse(BASE); context.grant_permissions(['clipboard-read','clipboard-write'],origin=f'{u.scheme}://{u.netloc}')
 except Exception: pass
 page=context.new_page()
 page.on('pageerror',lambda e: runtime_errors.append({'vp':current['vp'],'route':current['route'],'error':str(e)}))
 page.on('console',lambda m: console_errors.append({'vp':current['vp'],'route':current['route'],'text':m.text}) if m.type=='error' else None)
 page.on('response',lambda r: failed_responses.append({'vp':current['vp'],'route':current['route'],'status':r.status,'url':r.url,'resourceType':r.request.resource_type}) if r.status>=400 else None)
 page.on('request',lambda req: api_requests.append({'vp':current['vp'],'route':current['route'],'type':req.resource_type,'url':req.url}) if req.resource_type in ('xhr','fetch','websocket') else None)

 for vpname,w,h in sweep_viewports:
  page.set_viewport_size({'width':w,'height':h})
  for route in routes:
   current.update(vp=vpname,route=route)
   try:
    resp=page.goto(url_for(route),wait_until='domcontentloaded',timeout=12000); page.wait_for_timeout(120)
   except Exception as e:
    runtime_errors.append({'vp':vpname,'route':route,'error':'navigation: '+str(e)}); continue
   if resp and resp.status>=400 and route!='/404/': runtime_errors.append({'vp':vpname,'route':route,'error':f'HTTP {resp.status}'})
   dims=page.evaluate("() => ({sw:document.documentElement.scrollWidth,iw:window.innerWidth,bw:document.body.getBoundingClientRect().width})")
   if dims['sw']>dims['iw']+3:
    offender=page.evaluate("""() => {let best=null;for(const el of document.querySelectorAll('body *')){const r=el.getBoundingClientRect();const excess=Math.max(0,r.right-window.innerWidth)+Math.max(0,-r.left);if(excess>3&&(!best||excess>best.excess))best={tag:el.tagName,cls:String(el.className||'').slice(0,160),id:el.id||'',left:r.left,right:r.right,width:r.width,excess};}return best;}""")
    overflows.append({'vp':vpname,'route':route,**dims,'offender':offender})
   for img in page.locator('img').all():
    try:
     if not img.is_visible(): continue
     d=img.evaluate("e=>({src:e.currentSrc||e.src,complete:e.complete,nw:e.naturalWidth,nh:e.naturalHeight,alt:e.getAttribute('alt')})")
     if (not d['complete']) or d['nw']<1 or d['nh']<1: broken_images.append({'vp':vpname,'route':route,**d})
     if '/realworldasset/' in (d['src'] or ''): stale_paths.append({'vp':vpname,'route':route,'kind':'image','value':d['src']})
    except Exception as e: broken_images.append({'vp':vpname,'route':route,'error':str(e)})
   links=page.locator('a:visible')
   for i in range(links.count()):
    try:
     href=links.nth(i).get_attribute('href') or ''
     if not href or href.startswith('javascript:'): broken_links.append({'vp':vpname,'route':route,'href':href,'reason':'empty-or-placeholder'}); continue
     if href.startswith('#'):
      target=href[1:]
      if not target or page.locator(f'[id="{target}"]').count()<1: broken_links.append({'vp':vpname,'route':route,'href':href,'reason':'missing-anchor-target'})
      continue
     absolute=page.evaluate('(h)=>new URL(h,location.href).href',href); nr=normalized_route_from_href(absolute)
     if nr and nr!='FILE' and nr not in route_set: broken_links.append({'vp':vpname,'route':route,'href':href,'normalized':nr,'reason':'missing-static-route'})
     if '/realworldasset/' in absolute: stale_paths.append({'vp':vpname,'route':route,'kind':'link','value':absolute})
    except Exception as e: broken_links.append({'vp':vpname,'route':route,'reason':str(e)})
   buttons=page.locator('button:visible'); control_occurrences+=buttons.count()
   for i in range(buttons.count()):
    try:
     b=buttons.nth(i); label=button_label(b); cls=b.get_attribute('class') or ''
     key=(vpname,label,cls)
     if key not in distinct:
      distinct[key]={'vp':vpname,'route':route,'index':i,'label':label,'class':cls,'disabled':b.is_disabled(),'selected':b.get_attribute('data-active')=='true' or b.get_attribute('aria-pressed')=='true' or ' active' in f' {cls} ' or ' selected' in f' {cls} '}
    except Exception: pass

 for vpname,w,h in viewports:
  page.set_viewport_size({'width':w,'height':h})
  for route in core:
   current.update(vp=vpname,route=route)
   try:
    page.goto(url_for(route),wait_until='domcontentloaded',timeout=12000); page.wait_for_timeout(160)
    name=route.strip('/').replace('/','-') or 'landing'; out=ART/f'{vpname}-{name}.png'; page.screenshot(path=str(out),full_page=False); screens.append(out.name)
   except Exception as e: runtime_errors.append({'vp':vpname,'route':route,'error':'screenshot: '+str(e)})

 active_total=active_passed=locked_total=locked_passed=0; unexpected=[]; locked_fail=[]
 unsafe_rx=re.compile(r'^\s*(confirm purchase|confirm (buy|sell)|execute (trade|order)|submit order|settle\b|withdraw\b|redeem\b|mint now|pay now)\b',re.I)
 for item in distinct.values():
  vpname=item['vp']; w,h=next((w,h) for n,w,h in viewports if n==vpname); page.set_viewport_size({'width':w,'height':h}); route=item['route']; current.update(vp=vpname,route=route)
  try:
   page.goto(url_for(route),wait_until='domcontentloaded',timeout=12000); page.wait_for_timeout(180)
   b=relocate_button(page,item)
   if b is None: continue
   label=item['label']; is_locked=b.is_disabled() or bool(unsafe_rx.search(label)); before_url=page.url; before=clean_html(page); err_before=len(runtime_errors)
   if b.is_disabled(): locked_total+=1; locked_passed+=1; continue
   if item.get('selected'): active_total+=1; active_passed+=1; continue
   try:
    b=click_stable(page,item); page.wait_for_timeout(55)
   except PlaywrightTimeoutError as e:
    detail=str(e).split('\n')[0][:300]
    if is_locked: locked_total+=1; locked_fail.append({**item,'reason':'unclickable locked control','detail':detail}); continue
    active_total+=1; unexpected.append({**item,'reason':'click timeout','detail':detail}); continue
   after_url=page.url; after=clean_html(page); changed=after_url!=before_url or hashlib.sha256(after.encode()).hexdigest()!=hashlib.sha256(before.encode()).hexdigest()
   if is_locked:
    locked_total+=1; body=page.locator('body').inner_text(); unsafe_success=bool(re.search(r'order filled|purchase confirmed|transaction successful|settlement complete',body,re.I)) and not re.search(r'backend.*not connected|UI DEMO',body,re.I); safe_notice='backend/wallet execution is not connected' in body or 'UI DEMO' in body or b.is_disabled()
    if after_url==before_url and safe_notice and not unsafe_success: locked_passed+=1
    else: locked_fail.append({**item,'beforeUrl':before_url,'afterUrl':after_url,'changed':changed,'reason':'unsafe action did not fail closed'})
   else:
    active_total+=1
    if len(runtime_errors)==err_before: active_passed+=1
    else: unexpected.append({**item,'reason':'runtime error after click'})
  except Exception as e:
   if unsafe_rx.search(item['label']): locked_total+=1; locked_fail.append({**item,'reason':str(e)})
   else: active_total+=1; unexpected.append({**item,'reason':str(e)})
 browser.close()

runtime_errors=uniq(runtime_errors,lambda x:(x.get('vp'),x.get('route'),x.get('error'))); console_errors=uniq(console_errors,lambda x:(x.get('vp'),x.get('route'),x.get('text'))); failed_responses=uniq(failed_responses,lambda x:(x.get('vp'),x.get('route'),x.get('status'),x.get('url'))); broken_images=uniq(broken_images,lambda x:json.dumps(x,sort_keys=True)); stale_paths=uniq(stale_paths,lambda x:json.dumps(x,sort_keys=True)); overflows=uniq(overflows,lambda x:(x.get('vp'),x.get('route'))); broken_links=uniq(broken_links,lambda x:json.dumps(x,sort_keys=True))
base_host=urlparse(BASE).netloc; external_api=[r for r in api_requests if urlparse(r['url']).netloc and urlparse(r['url']).netloc!=base_host]; classification='NO_RUNTIME_BACKEND_CONNECTION' if not external_api else 'RUNTIME_BACKEND_TRAFFIC_DETECTED'; backend={'classification':classification,'sourceNetworkHits':source_hits,'demoSourceFiles':sorted(set(demo_hits)),'runtimeApiRequests':api_requests,'externalApiRequests':external_api}
result={'routesTotal':len(routes),'viewports':[x[0] for x in viewports],'coreScreenshotRoutes':core,'backend':backend,'controlInstances':control_occurrences,'distinctControls':len(distinct),'activeTotal':active_total,'activePassed':active_passed,'lockedTotal':locked_total,'lockedPassed':locked_passed,'unexpectedNoop':len(unexpected),'runtimeErrors':len(runtime_errors),'consoleErrors':len(console_errors),'failedResponses':len(failed_responses),'brokenImages':len(broken_images),'stalePublicRoots':len(stale_paths),'horizontalOverflow':len(overflows),'brokenLinks':len(broken_links),'screenshots':screens,'unexpected':unexpected,'lockedFailures':locked_fail,'runtimeErrorDetails':runtime_errors,'consoleErrorDetails':console_errors,'failedResponseDetails':failed_responses,'brokenImageDetails':broken_images,'stalePathDetails':stale_paths,'overflowDetails':overflows,'brokenLinkDetails':broken_links}
(ART/'audit.json').write_text(json.dumps(result,indent=2)); (ART/'backend-audit.json').write_text(json.dumps(backend,indent=2)); keys=['routesTotal','controlInstances','distinctControls','activeTotal','activePassed','lockedTotal','lockedPassed','unexpectedNoop','runtimeErrors','consoleErrors','failedResponses','brokenImages','stalePublicRoots','horizontalOverflow','brokenLinks']; print(json.dumps({k:result[k] for k in keys},indent=2)); print('BACKEND_CLASSIFICATION',classification)
fail=[]
for key in ['runtimeErrors','failedResponses','brokenImages','stalePublicRoots','horizontalOverflow','brokenLinks','unexpectedNoop']:
 if result[key]: fail.append(f'{key}={result[key]}')
if active_passed!=active_total: fail.append(f'active={active_passed}/{active_total}')
if locked_passed!=locked_total: fail.append(f'locked={locked_passed}/{locked_total}')
if classification!='NO_RUNTIME_BACKEND_CONNECTION': fail.append(f'backend={classification}')
if fail: print('UI_TOTAL_AUDIT_FAIL '+' '.join(fail),file=sys.stderr); sys.exit(1)
print(f'UI_TOTAL_AUDIT_PASS activePassed={active_passed} activeTotal={active_total} lockedPassed={locked_passed} lockedTotal={locked_total} unexpectedNoop=0 runtimeErrors=0 failedResponses=0 horizontalOverflow=0')
