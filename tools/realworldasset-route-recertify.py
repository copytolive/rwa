#!/usr/bin/env python3
import argparse,json,os,sys
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--base',required=True);p.add_argument('--site-dir',required=True);p.add_argument('--artifact',required=True);a=p.parse_args()
BASE=a.base.rstrip('/')+'/';SITE=Path(a.site_dir);ART=Path(a.artifact);ART.mkdir(parents=True,exist_ok=True)
routes=[]
for f in SITE.rglob('index.html'):
 rel=f.relative_to(SITE);r='/' + str(rel.parent).replace(os.sep,'/').strip('/')
 if r=='/.':r='/'
 if r!='/' and not r.endswith('/'):r+='/'
 routes.append(r)
routes=sorted(set(routes));route_set=set(routes)
assert len(routes)==430,len(routes)
errors=[];console=[];failed=[];images=[];overflow=[];links=[];stale=[];current={'vp':'','route':''}
def u(route):return BASE+route.lstrip('/')
def normalize(href):
 x=urlparse(href);b=urlparse(BASE)
 if x.scheme and (x.scheme,x.netloc)!=(b.scheme,b.netloc):return None
 path=x.path or '/';bp=b.path.rstrip('/')
 if bp and path.startswith(bp):path=path[len(bp):] or '/'
 if '.' in Path(path).name:return 'FILE'
 if not path.startswith('/'):path='/'+path
 if path!='/' and not path.endswith('/'):path+='/'
 return path
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,args=['--no-sandbox'])
 for vp,w,h in [('desktop',1672,941),('mobile',390,844)]:
  page=b.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
  page.on('pageerror',lambda e,v=vp,c=current:errors.append({'vp':v,'route':c['route'],'error':str(e)}))
  page.on('console',lambda m,v=vp,c=current:console.append({'vp':v,'route':c['route'],'text':m.text}) if m.type=='error' else None)
  page.on('response',lambda r,v=vp,c=current:failed.append({'vp':v,'route':c['route'],'status':r.status,'url':r.url}) if r.status>=400 else None)
  for route in routes:
   current.update(vp=vp,route=route)
   try:
    resp=page.goto(u(route),wait_until='domcontentloaded',timeout=15000);page.wait_for_timeout(80)
    if not resp or resp.status>=400: errors.append({'vp':vp,'route':route,'error':f'HTTP {resp.status if resp else "NONE"}'})
    dims=page.evaluate('()=>({sw:document.documentElement.scrollWidth,iw:innerWidth})')
    if dims['sw']>dims['iw']+3:overflow.append({'vp':vp,'route':route,**dims})
    for img in page.locator('img').all():
     try:
      if not img.is_visible():continue
      d=img.evaluate('e=>({src:e.currentSrc||e.src,complete:e.complete,nw:e.naturalWidth,nh:e.naturalHeight})')
      if not d['complete'] or d['nw']<1 or d['nh']<1:images.append({'vp':vp,'route':route,**d})
      if '/realworldasset/' in (d['src'] or ''):stale.append({'vp':vp,'route':route,'kind':'image','value':d['src']})
     except Exception as e:images.append({'vp':vp,'route':route,'error':str(e)})
    ls=page.locator('a:visible')
    for i in range(ls.count()):
     try:
      href=ls.nth(i).get_attribute('href') or ''
      if not href or href.startswith('javascript:'):links.append({'vp':vp,'route':route,'href':href,'reason':'empty-or-placeholder'});continue
      if href.startswith('#'):
       target=href[1:]
       if not target or page.locator(f'[id="{target}"]').count()<1:links.append({'vp':vp,'route':route,'href':href,'reason':'missing-anchor'})
       continue
      absolute=page.evaluate('(h)=>new URL(h,location.href).href',href);nr=normalize(absolute)
      if nr and nr!='FILE' and nr not in route_set:links.append({'vp':vp,'route':route,'href':href,'normalized':nr,'reason':'missing-static-route'})
      if '/realworldasset/' in absolute:stale.append({'vp':vp,'route':route,'kind':'link','value':absolute})
     except Exception as e:links.append({'vp':vp,'route':route,'reason':str(e)})
   except Exception as e:errors.append({'vp':vp,'route':route,'error':'navigation: '+str(e)})
  page.close()
 b.close()
def uniq(xs):
 out=[];seen=set()
 for x in xs:
  k=json.dumps(x,sort_keys=True)
  if k not in seen:seen.add(k);out.append(x)
 return out
errors,console,failed,images,overflow,links,stale=map(uniq,[errors,console,failed,images,overflow,links,stale])
result={'routesTotal':430,'viewports':2,'routeVisits':860,'runtimeErrors':len(errors),'consoleErrors':len(console),'failedResponses':len(failed),'brokenImages':len(images),'horizontalOverflow':len(overflow),'brokenLinks':len(links),'stalePublicRoots':len(stale),'details':{'runtimeErrors':errors[:100],'consoleErrors':console[:100],'failedResponses':failed[:100],'brokenImages':images[:100],'horizontalOverflow':overflow[:100],'brokenLinks':links[:100],'stalePublicRoots':stale[:100]}}
(ART/'route-recertification.json').write_text(json.dumps(result,indent=2))
print('ROUTE_RECERTIFICATION',json.dumps({k:v for k,v in result.items() if k!='details'},sort_keys=True))
if any(result[k] for k in ['runtimeErrors','consoleErrors','failedResponses','brokenImages','horizontalOverflow','brokenLinks','stalePublicRoots']):sys.exit(1)
print('REALWORLDASSET_430_ROUTE_RECERTIFICATION_PASS')
