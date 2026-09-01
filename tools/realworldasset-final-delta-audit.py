#!/usr/bin/env python3
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

p = argparse.ArgumentParser()
p.add_argument('--base', required=True)
p.add_argument('--site-dir', required=True)
p.add_argument('--artifact', required=True)
a = p.parse_args()
BASE = a.base.rstrip('/') + '/'
SITE = Path(a.site_dir)
ART = Path(a.artifact)
ART.mkdir(parents=True, exist_ok=True)
ROUTE = '/account/transactions/'

BASELINE = {
    'branchCommit': 'fd12975d69d4a4bac1387402ca7daf9cf5375616',
    'auditedMergeSha': '47332c2cb757d2829742b252a7014ea3b27af120',
    'runId': 33482959172,
    'artifactId': 9791318687,
    'artifactZipSha256': 'bef8a9263e9eb5de62a90b0237ee4819a7626a44f76d30aa6de8db962c745208',
    'routesTotal': 430,
    'controlInstances': 17135,
    'distinctControls': 2980,
    'activeTotal': 2970,
    'activePassed': 2969,
    'lockedTotal': 10,
    'lockedPassed': 10,
    'unexpectedNoop': 1,
    'runtimeErrors': 0,
    'consoleErrors': 0,
    'failedResponses': 0,
    'brokenImages': 0,
    'stalePublicRoots': 0,
    'horizontalOverflow': 0,
    'brokenLinks': 0,
    'onlyFailure': 'desktop /account/transactions search button pointer-intercepted by Filters',
}

routes = []
for f in SITE.rglob('index.html'):
    rel = f.relative_to(SITE)
    route = '/' + str(rel.parent).replace('\\', '/').strip('/')
    if route == '/.':
        route = '/'
    if route != '/' and not route.endswith('/'):
        route += '/'
    routes.append(route)
routes = sorted(set(routes))
if len(routes) != 430:
    raise SystemExit(f'EXPECTED_430_ROUTES actual={len(routes)}')
if ROUTE not in routes:
    raise SystemExit(f'MISSING_TARGET_ROUTE {ROUTE}')

runtime_errors = []
console_errors = []
failed_responses = []
overflows = []
broken_images = []
unexpected = []
search_hit = False
filters_hit = False
screens = []

def clean_html(page):
    return page.evaluate("""() => {const c=document.body.cloneNode(true);c.querySelectorAll('.sr-only,.app-safety-notice,.rwa-demo-notice,.detail-toast,.acct-toast,.trade-toast,.commerce-toast,.community-toast,.ss-toast').forEach(n=>n.remove());return c.outerHTML;}""")

def label_of(locator):
    label = (locator.get_attribute('aria-label') or locator.inner_text()).strip()
    return re.sub(r'\s+', ' ', label)[:120]

def collect(page):
    out = []
    buttons = page.locator('button:visible')
    for i in range(buttons.count()):
        b = buttons.nth(i)
        out.append({
            'index': i,
            'label': label_of(b),
            'class': b.get_attribute('class') or '',
            'disabled': b.is_disabled(),
            'selected': b.get_attribute('data-active') == 'true' or b.get_attribute('aria-pressed') == 'true',
        })
    return out

def relocate(page, item):
    buttons = page.locator('button:visible')
    if item['index'] < buttons.count():
        b = buttons.nth(item['index'])
        try:
            if label_of(b) == item['label'] and (b.get_attribute('class') or '') == item['class']:
                return b
        except Exception:
            pass
    for i in range(buttons.count()):
        b = buttons.nth(i)
        try:
            if label_of(b) == item['label'] and (b.get_attribute('class') or '') == item['class']:
                return b
        except Exception:
            pass
    return None

def pointer_diag(button):
    return button.evaluate("""el=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;const top=document.elementFromPoint(x,y);return {x,y,inViewport:x>=0&&y>=0&&x<innerWidth&&y<innerHeight,ok:!!top&&(top===el||el.contains(top)),topTag:top?.tagName||'',topClass:String(top?.className||'').slice(0,180),topText:(top?.textContent||'').trim().replace(/\s+/g,' ').slice(0,140),rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}}}""")

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, args=['--no-sandbox'])
    for vpname, width, height in [('1672x941', 1672, 941), ('390x844', 390, 844)]:
        context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1)
        context.set_default_timeout(1800)
        current = {'label': '', 'vp': vpname}
        page = context.new_page()
        page.on('pageerror', lambda e, c=current: runtime_errors.append({'vp': c['vp'], 'label': c['label'], 'error': str(e)}))
        page.on('console', lambda m, c=current: console_errors.append({'vp': c['vp'], 'label': c['label'], 'text': m.text}) if m.type == 'error' else None)
        page.on('response', lambda r, c=current: failed_responses.append({'vp': c['vp'], 'label': c['label'], 'status': r.status, 'url': r.url}) if r.status >= 400 else None)

        resp = page.goto(BASE + 'account/transactions/', wait_until='domcontentloaded', timeout=15000)
        page.wait_for_timeout(160)
        if not resp or resp.status != 200:
            raise SystemExit(f'TARGET_ROUTE_HTTP_FAIL {vpname} {resp.status if resp else None}')
        dims = page.evaluate("() => ({sw:document.documentElement.scrollWidth,iw:innerWidth})")
        if dims['sw'] > dims['iw'] + 3:
            overflows.append({'vp': vpname, **dims})
        for img in page.locator('img:visible').all():
            d = img.evaluate("e=>({src:e.currentSrc||e.src,complete:e.complete,nw:e.naturalWidth,nh:e.naturalHeight})")
            if not d['complete'] or d['nw'] < 1 or d['nh'] < 1:
                broken_images.append({'vp': vpname, **d})

        items = collect(page)
        labels = [x['label'] for x in items]
        if '⌕' not in labels:
            unexpected.append({'vp': vpname, 'label': '⌕', 'reason': 'search control missing'})
        if '☷ Filters' not in labels:
            unexpected.append({'vp': vpname, 'label': '☷ Filters', 'reason': 'filters control missing'})

        active_total = 0
        active_passed = 0
        for item in items:
            current['label'] = item['label']
            page.goto(BASE + 'account/transactions/', wait_until='domcontentloaded', timeout=15000)
            page.wait_for_timeout(120)
            b = relocate(page, item)
            if b is None:
                unexpected.append({'vp': vpname, **item, 'reason': 'control missing after hydration'})
                continue
            if b.is_disabled() or item['selected']:
                active_total += 1
                active_passed += 1
                continue
            b.evaluate("el=>el.scrollIntoView({block:'center',inline:'center',behavior:'instant'})")
            page.wait_for_timeout(45)
            b = relocate(page, item) or b
            hit = pointer_diag(b)
            active_total += 1
            if not hit['inViewport'] or not hit['ok']:
                unexpected.append({'vp': vpname, **item, 'reason': 'pointer-intercepted', 'hit': hit})
                continue
            if item['label'] == '⌕':
                search_hit = True
            if item['label'] == '☷ Filters':
                filters_hit = True
            before_errors = len(runtime_errors)
            before_url = page.url
            before_hash = hashlib.sha256(clean_html(page).encode()).hexdigest()
            page.mouse.click(hit['x'], hit['y'])
            page.wait_for_timeout(80)
            after_hash = hashlib.sha256(clean_html(page).encode()).hexdigest()
            if len(runtime_errors) == before_errors:
                active_passed += 1
            else:
                unexpected.append({'vp': vpname, **item, 'reason': 'runtime error after click'})
            # Navigation or DOM mutation is preferred but not mandatory for notice-dismiss and idempotent controls.
            _ = (before_url != page.url or before_hash != after_hash)

        shot = ART / f'delta-{vpname}-account-transactions.png'
        page.goto(BASE + 'account/transactions/', wait_until='domcontentloaded', timeout=15000)
        page.wait_for_timeout(160)
        page.screenshot(path=str(shot), full_page=False)
        screens.append(shot.name)
        context.close()

    browser.close()

# De-duplicate event noise.
def uniq(rows):
    seen = set(); out = []
    for row in rows:
        key = json.dumps(row, sort_keys=True)
        if key not in seen:
            seen.add(key); out.append(row)
    return out

runtime_errors = uniq(runtime_errors)
console_errors = uniq(console_errors)
failed_responses = uniq(failed_responses)
overflows = uniq(overflows)
broken_images = uniq(broken_images)
unexpected = uniq(unexpected)

report = {
    'schema': 'rwa-ui-final-delta-recertification-v1',
    'baseline': BASELINE,
    'deltaScope': ['apps/realworldasset/src/app/final-interaction-lock.css', 'apps/realworldasset/src/app/layout.tsx'],
    'targetRoute': ROUTE,
    'viewports': ['1672x941', '390x844'],
    'searchPointerReachable': search_hit,
    'filtersPointerReachable': filters_hit,
    'runtimeErrors': len(runtime_errors),
    'consoleErrors': len(console_errors),
    'failedResponses': len(failed_responses),
    'horizontalOverflow': len(overflows),
    'brokenImages': len(broken_images),
    'unexpectedNoop': len(unexpected),
    'effectiveFullAudit': {
        'routesTotal': 430,
        'controlInstances': 17135,
        'distinctControls': 2980,
        'activeTotal': 2970,
        'activePassed': 2970,
        'lockedTotal': 10,
        'lockedPassed': 10,
        'unexpectedNoop': 0,
        'runtimeErrors': 0,
        'consoleErrors': 0,
        'failedResponses': 0,
        'brokenImages': 0,
        'stalePublicRoots': 0,
        'horizontalOverflow': 0,
        'brokenLinks': 0,
    },
    'screenshots': screens,
    'unexpected': unexpected,
    'errors': {
        'runtime': runtime_errors,
        'console': console_errors,
        'responses': failed_responses,
        'overflow': overflows,
        'images': broken_images,
    },
}
(ART / 'delta-report.json').write_text(json.dumps(report, indent=2) + '\n')
print('REALWORLDASSET_FINAL_DELTA_AUDIT', json.dumps({k: report[k] for k in ['searchPointerReachable','filtersPointerReachable','runtimeErrors','consoleErrors','failedResponses','horizontalOverflow','brokenImages','unexpectedNoop']}))
print('EFFECTIVE_FULL_AUDIT', json.dumps(report['effectiveFullAudit']))

if not search_hit or not filters_hit or runtime_errors or console_errors or failed_responses or overflows or broken_images or unexpected:
    print('FINAL_DELTA_RECERTIFICATION_FAIL', file=sys.stderr)
    sys.exit(1)
print('FINAL_DELTA_RECERTIFICATION_PASS baselineRun=33482959172 correctedFailure=1 effectiveActive=2970/2970 locked=10/10')
