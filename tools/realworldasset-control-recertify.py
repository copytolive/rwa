#!/usr/bin/env python3
import argparse, hashlib, json, re, sys
from pathlib import Path
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright

p=argparse.ArgumentParser()
p.add_argument('--base',required=True)
p.add_argument('--artifact',required=True)
a=p.parse_args(); BASE=a.base.rstrip('/')+'/'; ART=Path(a.artifact); ART.mkdir(parents=True,exist_ok=True)

TARGETS={
"1672x941":{
"/account/":["◉ View Public Profile","▣ Manage Privacy","View All","▣ Manage Wallets Manage account settings","♢ Security Manage account settings","♧ Notifications Manage account settings","◇ KYC Status Manage account settings","⌁ Linked Accounts Manage account settings","▣ Privacy Controls Manage account settings","Go to full settings","Manage Privacy","◎ Profile Visibility Your privacy setting Public ›","♙ Activity Visibility Your privacy setting Followers ›","▣ Holdings Visibility Your privacy setting Private ›","View Privacy Center","Following 312 ▲ 24 this month"],
"/portfolio/":["◈ KOPI Kopi Nusantara $2.48 +8.72%","≋ SEAB Southeast Bullet Estate $0.5423 +3.18%","▥ MBAY Marina Bay Residences $1,250.00 +2.10%","₿ BTC Bitcoin $66,842.35 +1.82%","$ USDC USD Coin $1.00 +0.01%","View Rewards","♙ Claim Rewards","♙ Received Rewards 10 min ago +250 KOPI","♧ Price Alert MBAY is up 5% 1h ago","▣ Buy Order Filled Bought 100 KOPI @ $2.32 3h ago","▤ Dividend Received SEAB Dividend 1d ago","View More","Best Performer (24H) KOPI +8.72%","Worst Performer (24H) USDC +0.01%","⚠ Your portfolio is well diversified across 18 assets. 78/100"],
"/account/deposit/":["Refresh Status","⬡ Arbitrum One ~2–5 min","◆ Ethereum ~5–15 min","⬡ Optimism ~2–5 min","Learn about network fees →","☑ Always verify the address and network before sending.","☑ Do not share your deposit address with anyone.","☑ RWA.MS will never ask for your private keys.","Learn more about staying safe →","$ USDC Polygon Pending +250.00","$ USDC Arbitrum One Completed","₮ USDT Polygon Completed","View Full History"],
"/account/transactions/":["⌕","☷ Filters","More actions for KOPI","More actions for MBAY","More actions for SSEA","More actions for SBLUE","More actions for SPHUKET","More actions for SGOLDX","More actions for SOCEAN","More actions for SRWA","Rows per page 10⌄","Close selected order","Fills","View Order","⇩ Download Receipt","× Cancel"],
"/account/withdraw/":["$ USDC 0x8b12...e8f99 500 USDC Completed","₮ USDT 0x8b12...e8f99 1,250 USDT Completed","◆ ETH 0x8b12...e8f99 0.75 ETH Processing","$ USDC 0x8b12...e8f99 250 USDC Pending Review","⬡ MATIC 0x8b12...e8f99 1,000 MATIC Completed","View all withdrawals →","♢ Double-check the address Ensure the destination address is correct. Transactions cannot be reversed.","♧ Use saved addresses Save frequently used addresses to avoid errors and speed up transactions.","◇ Enable 2FA Keep your account secure with Two-Factor Authentication.","ⓘ Beware of scams RWA.MS will never ask for your private keys or seed phrase.","Learn more about security →"],
"/markets/blue-port-logistics-infrastructure/":["$10K","$50K","$100K","Redeem"],
"/markets/btc-usdc/":["Sell"],
"/markets/marina-bay-residences-regulated/":["View Disclosures →"]},
"390x844":{
"/account/":["✎ Edit Profile","Saved","Followers"],
"/community/":["Share a thesis, insight, question, or update..."],
"/portfolio/":["↻","▣ Buy","▣ Sell","▣ Add Funds","RWAs","Crypto","Cash","◈ KOPI Kopi Nusantara Current Value $24,800.00 +8.72%","≋ SEAB Southeast Bullet Estate Current Value $2,711.50 +3.18%","▥ MBAY Marina Bay Residences Current Value $1,250.00 +2.10%","₿ BTC Bitcoin Current Value $21,055.64 +1.82%","$ USDC USD Coin Current Value $8,945.20 +0.01%","☷ All Types⌄","View","Rows per page: 5⌄"],
"/pro/":["Marina Bay Residences +5.12%","Harbourview Credit Fund +5.12%","Blue Ocean Shipping Note +5.12%","Phuket Seaview Villas +5.12%","Solar Future Yield +5.12%"],
"/account/orders/":["View Store"],
"/account/transactions/":["⌕","«","Fills"],
"/account/withdraw/":["Slow ~5–10 min 0.45 USDC","Fast ~30 sec – 2 min 1.45 USDC"],
"/orders/ORD-20240517-8F4A2C9D/":["On-Chain Tx Hash 0x9f11…c82a9f3b1d4e6c0b ⧉","Venue Tx ID HL-20240517-8F4A2C9D ⧉","Settlement Tx 0xbc21…9d44b73b11a2c6c0b ⧉","Block / Time 19,842,331 / May 17, 2024 ⧉"],
"/trade/blue-port-logistics-infrastructure/":["4H"],
"/businesses/blue-ocean-shipping/rewards/":["◉ $SEA $4.21 +5.18%"],
"/account/orders/RWA-ORD-20240516-9F7A2B/dispute/":["○ Damaged Item Item arrived damaged","○ Replacement Send correct item","Contact Support"]}}

unsafe_rx=re.compile(r'^\s*(redeem\b|withdraw\b|confirm purchase|confirm (buy|sell)|execute (trade|order)|submit order|settle\b|mint now|pay now)',re.I)

def norm(s): return re.sub(r'\s+',' ',(s or '').strip())[:120]
def label_of(el):
    try: return norm(el.get_attribute('aria-label') or el.inner_text())
    except Exception: return ''
def dom_hash(page):
    try: return hashlib.sha256(page.locator('body').evaluate('e=>e.outerHTML').encode()).hexdigest()
    except Exception: return ''
def find_button(page,label):
    buttons=page.locator('button:visible')
    for i in range(buttons.count()):
        b=buttons.nth(i)
        if label_of(b)==label: return b
    return None

results=[]; failures=[]; runtime=[]; console=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
    for vp,routes in TARGETS.items():
        w,h=map(int,vp.split('x'))
        context=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1)
        try:
            from urllib.parse import urlparse
            u=urlparse(BASE); context.grant_permissions(['clipboard-read','clipboard-write'],origin=f'{u.scheme}://{u.netloc}')
        except Exception: pass
        page=context.new_page(); current={'route':'/'}
        page.on('pageerror',lambda e,v=vp,c=current: runtime.append({'vp':v,'route':c['route'],'error':str(e)}))
        page.on('console',lambda m,v=vp,c=current: console.append({'vp':v,'route':c['route'],'text':m.text}) if m.type=='error' else None)
        for route,labels in routes.items():
            for label in labels:
                current['route']=route
                try:
                    r=page.goto(urljoin(BASE,route.lstrip('/')),wait_until='domcontentloaded',timeout=15000)
                    if not r or r.status>=400: raise RuntimeError(f'HTTP {r.status if r else "NONE"}')
                    page.wait_for_timeout(180)
                    b=find_button(page,label)
                    if b is None: raise RuntimeError('target control not found')
                    selected=(b.get_attribute('data-active')=='true' or b.get_attribute('aria-pressed')=='true' or ' selected ' in f" {b.get_attribute('class') or ''} ")
                    b.evaluate("el=>el.scrollIntoView({block:'center',inline:'center',behavior:'instant'})")
                    page.wait_for_timeout(60)
                    b=find_button(page,label) or b
                    hit=b.evaluate("""el=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;const top=document.elementFromPoint(x,y);return {x,y,ok:!!top&&(top===el||el.contains(top)),topTag:top?.tagName||'',topClass:String(top?.className||'').slice(0,160),topText:(top?.textContent||'').trim().replace(/\s+/g,' ').slice(0,160),rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}}}""")
                    if not hit['ok']: raise RuntimeError('pointer intercepted: '+json.dumps(hit,ensure_ascii=False))
                    before_url=page.url; before_dom=dom_hash(page); before_clip=''
                    try: before_clip=page.evaluate('navigator.clipboard.readText()')
                    except Exception: pass
                    err0=len(runtime); con0=len(console)
                    page.mouse.click(hit['x'],hit['y'])
                    page.wait_for_timeout(180)
                    after_url=page.url; after_dom=dom_hash(page); after_clip=''
                    try: after_clip=page.evaluate('navigator.clipboard.readText()')
                    except Exception: pass
                    body=page.locator('body').inner_text()
                    locked=bool(unsafe_rx.search(label))
                    if locked:
                        safe=('backend/wallet execution is not connected' in body.lower() or 'ui demo' in body.lower() or 'backend offline' in body.lower())
                        unsafe=bool(re.search(r'order filled|purchase confirmed|transaction successful|settlement complete|redemption successful',body,re.I)) and not safe
                        ok=(after_url==before_url and safe and not unsafe and len(runtime)==err0 and len(console)==con0)
                        reason='' if ok else 'unsafe control did not fail closed'
                    else:
                        changed=(after_url!=before_url or after_dom!=before_dom or after_clip!=before_clip or selected)
                        ok=(changed and len(runtime)==err0 and len(console)==con0)
                        reason='' if ok else 'pointer click produced no observable action or raised runtime/console error'
                    item={'vp':vp,'route':route,'label':label,'ok':ok,'selected':selected,'beforeUrl':before_url,'afterUrl':after_url,'hit':hit}
                    results.append(item)
                    if not ok: failures.append({**item,'reason':reason})
                except Exception as e:
                    item={'vp':vp,'route':route,'label':label,'ok':False,'reason':str(e)[:1200]}
                    results.append(item); failures.append(item)
        context.close()
    browser.close()

summary={'baselineSha':'b1201e3325889d65c4a0d9ebd5e30901e229fb68','baselineArtifactSha256':'e6809b9646d1a40a3543299d46cf3398f7f47c19b8815a344c081b93d276de05','baselineRoutes':430,'baselineActivePassed':2895,'baselineActiveTotal':3010,'baselineLockedPassed':9,'baselineLockedTotal':10,'targets':sum(len(v) for rs in TARGETS.values() for v in rs.values()),'passed':sum(1 for x in results if x['ok']),'failed':len(failures),'runtimeErrors':len(runtime),'consoleErrors':len(console),'failures':failures,'results':results}
(ART/'control-recertification.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False))
print(f"CONTROL_RECERTIFICATION targets={summary['targets']} passed={summary['passed']} failed={summary['failed']} runtimeErrors={summary['runtimeErrors']} consoleErrors={summary['consoleErrors']}")
if failures:
    for x in failures[:40]: print('FAIL',json.dumps(x,ensure_ascii=False)[:1800])
    sys.exit(1)
print('REALWORLDASSET_115_TO_0_PASS')
print('REDEEM_FAIL_CLOSED_PASS')
