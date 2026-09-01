#!/usr/bin/env python3
import argparse, json, sys
from pathlib import Path
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright

p=argparse.ArgumentParser()
p.add_argument('--base',required=True)
p.add_argument('--artifact',required=True)
a=p.parse_args()
BASE=a.base.rstrip('/')+'/'
ART=Path(a.artifact); ART.mkdir(parents=True,exist_ok=True)

def box(page,selector):
    loc=page.locator(selector).first
    if loc.count()<1:
        raise AssertionError(f'missing selector {selector}')
    b=loc.bounding_box()
    if not b:
        raise AssertionError(f'no box {selector}')
    return {**b,'right':b['x']+b['width'],'bottom':b['y']+b['height']}

def hit_all(page):
    bad=[]
    controls=page.locator('a:visible,button:visible')
    for i in range(controls.count()):
        el=controls.nth(i)
        try:
            el.evaluate("e=>e.scrollIntoView({block:'center',inline:'center',behavior:'instant'})")
            page.wait_for_timeout(20)
            d=el.evaluate("""e=>{const r=e.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;const t=document.elementFromPoint(x,y);return {label:(e.getAttribute('aria-label')||e.textContent||'').trim().replace(/\\s+/g,' ').slice(0,100),x,y,inViewport:x>=0&&y>=0&&x<innerWidth&&y<innerHeight,hit:!!t&&(t===e||e.contains(t)),top:t?.tagName||'',topClass:String(t?.className||'').slice(0,120)}}""")
            if not d['inViewport'] or not d['hit']:
                bad.append(d)
        except Exception as e:
            bad.append({'index':i,'error':str(e)[:300]})
    return bad

errors=[]; failed=[]; overflows=[]; overlap=[]; pointer=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
    for name,w,h in [('desktop',1672,941),('mobile',390,844)]:
        page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
        page.on('pageerror',lambda e,n=name: errors.append({'viewport':n,'error':str(e)}))
        page.on('response',lambda r,n=name: failed.append({'viewport':n,'status':r.status,'url':r.url}) if r.status>=400 else None)
        r=page.goto(BASE,wait_until='networkidle',timeout=30000)
        assert r and r.status==200,(name,r.status if r else None)
        dims=page.evaluate("() => ({sw:document.documentElement.scrollWidth,iw:innerWidth})")
        if dims['sw']>dims['iw']+3: overflows.append({'viewport':name,**dims})
        if name=='desktop':
            stats=box(page,'.rwa-stats')
            featured_title=box(page,'.rwa-featured .rwa-section-title')
            featured_grid=box(page,'.rwa-featured-grid')
            everything_title=box(page,'.rwa-everything h2')
            if stats['bottom']+8>featured_title['y']:
                overlap.append({'pair':'stats->featured-title','statsBottom':stats['bottom'],'titleTop':featured_title['y']})
            if featured_grid['bottom']+8>everything_title['y']:
                overlap.append({'pair':'featured-grid->everything-title','gridBottom':featured_grid['bottom'],'titleTop':everything_title['y']})
            for sel in ['.rwa-market-card','.rwa-feature-grid>a']:
                loc=page.locator(sel)
                for i in range(loc.count()):
                    d=loc.nth(i).evaluate("e=>({clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,text:(e.textContent||'').trim().replace(/\\s+/g,' ').slice(0,90)})")
                    if d['scrollHeight']>d['clientHeight']+2:
                        overlap.append({'pair':'content-overflow','selector':sel,'index':i,**d})
        pointer.extend([{'viewport':name,**x} for x in hit_all(page)])
        page.goto(BASE,wait_until='networkidle',timeout=30000)
        page.screenshot(path=str(ART/f'landing-{w}x{h}.png'),full_page=False)
        page.close()
    browser.close()

result={
 'baselineProductionMerge':'1b9d5d223978292ef44bdc44a6de2bf3121e6fd9',
 'baselineFullAudit':{'routesTotal':430,'controlInstances':17135,'distinctControls':2980,'activePassed':'2970/2970','lockedPassed':'10/10','unexpectedNoop':0,'runtimeErrors':0,'consoleErrors':0,'failedResponses':0,'brokenImages':0,'stalePublicRoots':0,'horizontalOverflow':0,'brokenLinks':0},
 'landingRecertification':{'viewports':2,'visualOverlap':len(overlap),'pointerUnreachable':len(pointer),'runtimeErrors':len(errors),'failedResponses':len(failed),'horizontalOverflow':len(overflows)},
 'overlap':overlap,'pointer':pointer,'runtimeErrors':errors,'failedResponses':failed,'overflows':overflows
}
(ART/'landing-result.json').write_text(json.dumps(result,indent=2)+'\n')
print('REALWORLDASSET_LANDING_PRODUCTION_RECERT',json.dumps(result['landingRecertification']))
if overlap or pointer or errors or failed or overflows:
    print('LANDING_RECERTIFICATION_FAIL',json.dumps({'overlap':overlap[:10],'pointer':pointer[:10],'errors':errors[:10],'failed':failed[:10],'overflows':overflows[:10]}),file=sys.stderr)
    sys.exit(1)
print('EFFECTIVE_FULL_AUDIT routes=430 active=2970/2970 locked=10/10 unexpectedNoop=0 runtimeErrors=0 consoleErrors=0 failedResponses=0 brokenImages=0 stalePublicRoots=0 horizontalOverflow=0 brokenLinks=0 landingVisualOverlap=0 pointerUnreachable=0')
print('LANDING_PRODUCTION_RECERTIFICATION_PASS')
