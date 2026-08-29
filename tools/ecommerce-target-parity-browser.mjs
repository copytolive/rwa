import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base=process.env.RWA_UI_URL||'http://127.0.0.1:4173/rwa/';
const proof=process.env.RWA_UI_PROOF_DIR||'proof/ecommerce-target-parity';
const publicMode=/^https:\/\//i.test(base);
const sizes=[['target-1672x941',1672,941],['desktop-2048x1129',2048,1129],['desktop-1600x1000',1600,1000],['desktop-1440x900',1440,900],['desktop-1366x768',1366,768],['mobile-390x844',390,844]];
await mkdir(proof,{recursive:true});
const browser=await chromium.launch({headless:true});
const failures=[],results=[];
const fail=(scope,message,detail=null)=>failures.push({scope,message,detail});
const rect=async(page,sel)=>page.locator(sel).evaluate(el=>{const r=el.getBoundingClientRect();return{left:Math.round(r.left),right:Math.round(r.right),top:Math.round(r.top),bottom:Math.round(r.bottom),width:Math.round(r.width),height:Math.round(r.height)}}).catch(()=>null);
const domClick=async(page,sel)=>page.locator(sel).first().evaluate(el=>el.click());
async function stabilize(page){await page.evaluate(()=>window.RWAEcommerceTargetController?.render?.());await page.waitForFunction(()=>{const a=window.RWAEcommerceTargetController?.audit?.();return !!(a?.rendered&&a?.backendLocked&&a?.tabCount===3&&a?.productCards>=4)},{timeout:12000})}

async function run(label,width,height){
  const ctx=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),page=await ctx.newPage(),errors=[],popups=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));ctx.on('page',p=>{if(p!==page)popups.push(p)});
  try{
    const u=new URL(base);u.searchParams.set('__target_parity',`${label}-${Date.now()}`);
    await page.goto(u.href,{waitUntil:'domcontentloaded',timeout:publicMode?50000:30000});
    await page.waitForFunction(()=>window.RWASeablueprintCommerceBridge?.version==='1.5.0'&&window.RWATargetDashboardV2?.version==='2.2.0'&&window.RWAEcommerceTargetController?.version==='2.3.0'&&window.RWATargetTopbarCleanup?.version==='1.6.0'&&window.RWAEcommerceProductionVisualV1?.version==='1.7.0',{timeout:publicMode?30000:20000});
    const before=await rect(page,'.layout'),launcher=page.locator('#rwaSeablueprintCommerceLaunch,[data-rwa-seablueprint-commerce="1"]').filter({visible:true}).first();
    if(!(await launcher.isVisible().catch(()=>false)))throw new Error('Ecommerce launcher not visible');
    await launcher.click();await page.waitForFunction(()=>document.querySelector('#rwaShopScreen')?.classList.contains('open'),{timeout:12000});await stabilize(page);
    await page.evaluate(()=>{window.RWAEcommerceProductionVisualV1?.apply?.();window.RWATargetTopbarCleanup?.apply?.()});
    await page.waitForSelector('[data-rwa-ecom-target="2.3.0"]',{state:'attached',timeout:12000});
    const a=await page.evaluate(()=>({bridge:window.RWASeablueprintCommerceBridge.audit(),target:window.RWAEcommerceTargetController.audit(),visual:window.RWAEcommerceProductionVisualV1.audit(),topbar:window.RWATargetTopbarCleanup.audit(),path:location.pathname,hash:location.hash,heading:document.querySelector('.rwa-ecom-head-title')?.innerText||'',tabs:[...document.querySelectorAll('[data-ecom-target-tab]')].map(x=>x.textContent.trim()),store:document.querySelector('.rwa-ecom-store h3')?.textContent||'',source:[...document.querySelectorAll('[data-seablueprint-source]')].map(x=>x.textContent||'').join(' '),cartPosition:getComputedStyle(document.querySelector('#rwaCommerceDock .rwa-ecom-cart-preview')||document.body).position,transitions:[...document.querySelectorAll('#rwaCommerceDock,[data-ecom-target-tab],[data-ecom-action]')].slice(0,40).map(x=>({t:getComputedStyle(x).transitionDuration,a:getComputedStyle(x).animationDuration}))}));
    const after=await rect(page,'.layout'),dock=await rect(page,'#rwaCommerceDock');
    if(a.path!=='/rwa/'||a.hash!=='#shop')fail(label,'single /rwa/ route contract failed',a);
    if(!a.bridge?.ok||a.bridge?.mode!=='CONTEXT_PANEL'||a.bridge?.apiBaseConfigured)fail(label,'canonical Ecommerce bridge failed',a.bridge);
    if(!a.target?.rendered||!a.target?.backendLocked||a.target?.tabCount!==3)fail(label,'target Ecommerce render/truth failed',a.target);
    if(!/Seablueprint Ecommerce/.test(a.heading)||a.store!=='Seablue Estate Marketplace'||!/BACKEND LOCKED/i.test(a.source))fail(label,'target visual copy missing',a);
    if(a.tabs.join('|')!=='Stores|Products|Cart (2)')fail(label,'target tabs mismatch',a.tabs);
    if(Math.abs((before?.width||0)-(after?.width||0))>2)fail(label,'opening Ecommerce changed outer .layout width',{before,after});
    if(a.transitions.some(x=>x.t!=='0s'||x.a!=='0s'))fail(label,'non-zero Ecommerce CSS transition detected',a.transitions);
    if(width>680){
      if(!dock||dock.width<420||dock.width>442)fail(label,'desktop dock not ~440px',dock);
      if(Math.abs(Number(dock?.top||0)-62)>2)fail(label,'desktop Ecommerce dock must begin directly below 62px target header',dock);
      if(Math.abs(Number(a.visual?.topbar?.height||0)-62)>2)fail(label,'target header rail is not 62px',a.visual);
      if(Number(a.bridge?.exposedChartWidth||0)<420)fail(label,'market/chart not visibly preserved',a.bridge);
      if(!a.visual?.orderVisible||!a.visual?.orderClearOfDock)fail(label,'Order Book is not visibly preserved beside Ecommerce',a.visual);
      if(Math.abs(Number(a.visual?.orderDockGap??999))>2)fail(label,'Order Book does not end exactly at Ecommerce dock edge',a.visual);
      if(Math.abs(Number(a.visual?.reservedDockWidth||0)-Number(a.visual?.dock?.width||0))>2)fail(label,'layout does not reserve exact Ecommerce dock span',a.visual);
      if(a.visual?.orderPosition!=='sticky')fail(label,'Order Book did not return to sticky grid geometry',a.visual);
      const ow=Number(a.visual?.order?.width||0);if(ow<218||ow>238)fail(label,'Order Book width is not canonical 220/236px',a.visual);
      if(a.visual?.preOrderContextVisible)fail(label,'CONTEXT / AI INSIGHT still appears above Order Book',a.visual);
      if(a.visual?.marketDepthLabelVisible)fail(label,'extra MARKET DEPTH strip still appears above Order Book',a.visual);
      if(!a.visual?.contextSuppressed||(a.visual?.contextVisible||[]).length)fail(label,'persistent Context workspace is visible',a.visual);
      if((a.visual?.topActionExtras||[]).length||a.visual?.marketplaceVisible||a.visual?.multichainVisible)fail(label,'extra target header controls remain visible',a.visual);
      if(width>1450){const expected='markets|ecommerce|intelligence|portfolio|orders|reports';if(a.topbar?.labels?.join('|')!==expected)fail(label,'desktop target navigation DOM is incomplete',a.topbar);if(a.topbar?.visibleLabels?.join('|')!==expected)fail(label,'all six desktop target navigation items are not visibly rendered',a.topbar);if(Number(a.topbar?.ecommerceVisibleCount)!==1)fail(label,'desktop target must have exactly one visible Ecommerce launcher',a.topbar)}
      if(width>1400&&Number(a.visual?.left?.width||0)<280)fail(label,'watchlist is too narrow',a.visual);if(width<=1400&&Number(a.visual?.left?.width||0)<250)fail(label,'compact watchlist is too narrow',a.visual);if(Number(a.visual?.main?.width||0)<420)fail(label,'main market column is too narrow',a.visual);
    }else{
      if(!dock||Math.abs(dock.width-width)>2||dock.left!==0)fail(label,'mobile contextual panel not full width',dock);
      if(a.cartPosition!=='static')fail(label,'mobile cart preview must stay in document flow',a);
      if(Number(a.visual?.mobileCartOverlapPx||0)>1)fail(label,'mobile cart preview overlaps product cards',a.visual);
    }
    const sync=await page.evaluate(()=>{const click=(sel,key)=>{const e=document.querySelector(sel),t=performance.now();e?.click();return{elapsed:performance.now()-t,active:!!document.querySelector(`[data-ecom-target-tab="${key}"]`)?.classList.contains('active')}};const p=click('[data-ecom-target-tab="products"]','products'),c=click('[data-ecom-target-tab="cart"]','cart'),s=click('[data-ecom-target-tab="stores"]','stores');return{p,c,s,state:window.RWAEcommerceTargetController.state()}});
    if(!sync.p.active||!sync.c.active||!sync.s.active||sync.state.tab!=='stores')fail(label,'tab transitions are not synchronous',sync);if(Math.max(sync.p.elapsed,sync.c.elapsed,sync.s.elapsed)>8)fail(label,'tab handler exceeded 8ms execution budget',sync);
    await stabilize(page);await domClick(page,'[data-ecom-action="view-store"]');if(!(await page.locator('.rwa-ecom-detail').isVisible().catch(()=>false)))fail(label,'View Store failed');await domClick(page,'[data-ecom-action="back"]');await domClick(page,'[data-ecom-action="favorite"]');if(await page.locator('[data-ecom-action="favorite"]').first().getAttribute('aria-pressed')!=='true')fail(label,'favorite failed');await domClick(page,'[data-ecom-action="view-all"]');if(!(await page.locator('[data-ecom-target-tab="products"]').evaluate(el=>el.classList.contains('active')).catch(()=>false)))fail(label,'View all failed');await domClick(page,'[data-ecom-target-tab="stores"]');await domClick(page,'[data-ecom-action="review-cart"]');if(!(await page.locator('[data-ecom-target-tab="cart"]').evaluate(el=>el.classList.contains('active')).catch(()=>false)))fail(label,'Review Cart failed');await domClick(page,'[data-ecom-action="checkout-locked"]');if(!/Verification, payment and settlement evidence/.test(await page.locator('[data-ecom-lock-result]').textContent().catch(()=>'')))fail(label,'locked checkout explanation missing');await domClick(page,'[data-ecom-target-tab="stores"]');
    const actions=await page.evaluate(()=>[...new Set([...document.querySelectorAll('[data-ecom-action]')].map(x=>x.dataset.ecomAction))].sort());for(const needed of ['cart-icon','favorite','product','review-cart','view-all','view-store'])if(!actions.includes(needed))fail(label,`missing first-party action ${needed}`,actions);
    await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`${proof}/${label}-ecommerce.png`,fullPage:false});await page.evaluate(()=>window.RWASeablueprintCommerceBridge?.close?.({restore:false}));await page.waitForFunction(()=>!document.querySelector('#rwaShopScreen')?.classList.contains('open'),{timeout:5000});
    if(errors.length)fail(label,'uncaught page errors',errors);if(popups.length)fail(label,'unexpected popup',popups.length);results.push({label,width,height,ok:!failures.some(x=>x.scope===label),openAudit:a,sync,actions});
  }catch(e){fail(label,'unexpected failure',String(e?.stack||e))}finally{await ctx.close()}
}
for(const s of sizes)await run(...s);await browser.close();const out={ok:failures.length===0,contract:'ecommerce-target-parity-v3.2',base,publicMode,results,failures};await writeFile(`${proof}/browser-result.json`,JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));if(!out.ok)process.exit(1);
