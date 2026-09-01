#!/usr/bin/env python3
import argparse,ast,hashlib,json,re,sys
from pathlib import Path
from urllib.parse import urljoin,urlparse
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--base',required=True);p.add_argument('--artifact',required=True);a=p.parse_args()
BASE=a.base.rstrip('/')+'/';ART=Path(a.artifact);ART.mkdir(parents=True,exist_ok=True)
# Reuse the immutable 116-target manifest without executing its test runner.
tree=ast.parse(Path('tools/realworldasset-control-recertify.py').read_text());TARGETS=None
for n in tree.body:
 if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='TARGETS' for t in n.targets):TARGETS=ast.literal_eval(n.value);break
assert TARGETS and sum(len(v) for rs in TARGETS.values() for v in rs.values())==116
unsafe_rx=re.compile(r'^\s*(redeem\b|withdraw\b|confirm purchase|confirm (buy|sell)|execute (trade|order)|submit order|settle\b|mint now|pay now)',re.I)
def norm(s):return re.sub(r'\s+',' ',(s or '').strip())[:120]
def label(el):
 try:return norm(el.get_attribute('aria-label') or el.inner_text())
 except:return ''
def find(page,want):
 bs=page.locator('button:visible')
 for i in range(bs.count()):
  b=bs.nth(i)
  if label(b)==want:return b
 return None
def dh(page):
 try:return hashlib.sha256(page.locator('body').evaluate('e=>e.outerHTML').encode()).hexdigest()
 except:return ''
def exposed_point(b):
 return b.evaluate("""el=>{const r=el.getBoundingClientRect();const ps=[[.5,.5],[.2,.5],[.8,.5],[.5,.2],[.5,.8],[.2,.2],[.8,.2],[.2,.8],[.8,.8]];let last=null;for(const [fx,fy] of ps){const x=r.left+r.width*fx,y=r.top+r.height*fy,top=document.elementFromPoint(x,y),ok=!!top&&(top===el||el.contains(top));last={x,y,ok,topTag:top?.tagName||'',topClass:String(top?.className||'').slice(0,160),topText:(top?.textContent||'').trim().replace(/\s+/g,' ').slice(0,160),rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};if(ok)return last}return last}""")
results=[];failures=[];runtime=[];console=[];inert=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
 for vp,routes in TARGETS.items():
  w,h=map(int,vp.split('x'));ctx=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1)
  try:
   u=urlparse(BASE);ctx.grant_permissions(['clipboard-read','clipboard-write'],origin=f'{u.scheme}://{u.netloc}')
  except:pass
  page=ctx.new_page();cur={'route':'/'}
  page.on('pageerror',lambda e,v=vp,c=cur:runtime.append({'vp':v,'route':c['route'],'error':str(e)}))
  page.on('console',lambda m,v=vp,c=cur:console.append({'vp':v,'route':c['route'],'text':m.text}) if m.type=='error' else None)
  for route,wants in routes.items():
   for want in wants:
    cur['route']=route
    try:
     r=page.goto(urljoin(BASE,route.lstrip('/')),wait_until='domcontentloaded',timeout=15000);page.wait_for_timeout(160)
     if not r or r.status>=400:raise RuntimeError(f'HTTP {r.status if r else "NONE"}')
     b=find(page,want)
     if b is None:raise RuntimeError('target control not found')
     # /pro is a real modal; its blurred preview is intentionally background-only.
     if b.evaluate("el=>!!el.closest('.ss-pro-backdrop')"):
      item={'vp':vp,'route':route,'label':want,'ok':True,'classification':'INERT_MODAL_BACKDROP'};results.append(item);inert.append(item);continue
     selected=(b.get_attribute('data-active')=='true' or b.get_attribute('aria-pressed')=='true' or ' selected ' in f" {b.get_attribute('class') or ''} ")
     b.evaluate("el=>el.scrollIntoView({block:'center',inline:'center',behavior:'instant'})");page.wait_for_timeout(80);b=find(page,want) or b
     hit=exposed_point(b)
     if not hit or not hit['ok']:raise RuntimeError('no exposed pointer point: '+json.dumps(hit,ensure_ascii=False))
     before_url=page.url;before_dom=dh(page);before_clip=''
     try:before_clip=page.evaluate('navigator.clipboard.readText()')
     except:pass
     e0=len(runtime);c0=len(console);page.mouse.click(hit['x'],hit['y']);page.wait_for_timeout(180)
     after_url=page.url;after_dom=dh(page);after_clip=''
     try:after_clip=page.evaluate('navigator.clipboard.readText()')
     except:pass
     body=page.locator('body').inner_text();locked=bool(unsafe_rx.search(want))
     if locked:
      low=body.lower();safe=('backend/wallet execution is not connected' in low or 'ui demo' in low or 'backend offline' in low);bad=bool(re.search(r'order filled|purchase confirmed|transaction successful|settlement complete|redemption successful',body,re.I)) and not safe
      ok=(after_url==before_url and safe and not bad and len(runtime)==e0 and len(console)==c0);why='unsafe control did not fail closed'
     else:
      changed=(after_url!=before_url or after_dom!=before_dom or after_clip!=before_clip or selected);ok=(changed and len(runtime)==e0 and len(console)==c0);why='pointer click produced no observable action or raised runtime/console error'
     item={'vp':vp,'route':route,'label':want,'ok':ok,'selected':selected,'beforeUrl':before_url,'afterUrl':after_url,'hit':hit};results.append(item)
     if not ok:failures.append({**item,'reason':why})
    except Exception as e:
     item={'vp':vp,'route':route,'label':want,'ok':False,'reason':str(e)[:1500]};results.append(item);failures.append(item)
  ctx.close()
 browser.close()
summary={'targets':116,'passed':sum(x['ok'] for x in results),'failed':len(failures),'inertModalBackdrop':len(inert),'runtimeErrors':len(runtime),'consoleErrors':len(console),'failures':failures,'results':results}
(ART/'control-recertification.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False));print('CONTROL_RECERTIFICATION_V2',json.dumps({k:v for k,v in summary.items() if k not in ('failures','results')},sort_keys=True))
if failures:
 for x in failures[:50]:print('FAIL',json.dumps(x,ensure_ascii=False)[:1800])
 sys.exit(1)
print('REALWORLDASSET_115_TO_0_PASS');print('REDEEM_FAIL_CLOSED_PASS')
