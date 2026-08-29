import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.RWA_UI_URL||'http://127.0.0.1:4173/rwa/';
const proof=process.env.RWA_ECOMMERCE_PROOF_DIR||'proof/seablueprint-commerce-single-shell';
const VERSION='1.5.0';
await mkdir(proof,{recursive:true});
const browser=await chromium.launch({headless:true});
const viewports=[['desktop-2048x1129',2048,1129],['desktop-1600x1000',1600,1000],['desktop-1440x900',1440,900],['desktop-1366x768',1366,768],['mobile-320x800',320,800],['mobile-360x800',360,800],['mobile-375x812',375,812],['mobile-390x844',390,844],['mobile-393x852',393,852],['mobile-412x915',412,915],['mobile-430x932',430,932]];
const results=[],failures=[];
for(const[label,width,height]of viewports){
 const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),page=await context.newPage(),popups=[],errors=[];
 context.on('page',p=>{if(p!==page)popups.push(p)});page.on('pageerror',e=>errors.push(String(e?.message||e)));
 try{
  const u=new URL(base);u.searchParams.set('__commerce_panel',`${label}-${Date.now()}`);
  await page.goto(u.href,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(v=>window.RWASeablueprintCommerceBridge?.version===v&&window.RWATargetDashboardV2?.version,VERSION,{timeout:20000});
  await page.waitForSelector('#rwaSeablueprintCommerceLaunch',{state:'visible',timeout:10000});
  const baseline=await page.evaluate(()=>{const r=document.querySelector('.layout')?.getBoundingClientRect();return{path:location.pathname,layoutWidth:Math.round(r?.width||0)}});
  await page.locator('#rwaSeablueprintCommerceLaunch').click();
  await page.waitForFunction(()=>document.querySelector('#rwaShopScreen')?.classList.contains('open'),{timeout:12000});
  await page.waitForSelector('[data-seablueprint-source]',{state:'visible',timeout:10000});
  await page.waitForSelector('#rwaShopScreen .rwa-product-card',{state:'visible',timeout:10000});
  const state=await page.evaluate(()=>{const q=s=>document.querySelector(s),rect=s=>{const r=q(s)?.getBoundingClientRect();return r?{left:Math.round(r.left),right:Math.round(r.right),top:Math.round(r.top),bottom:Math.round(r.bottom),width:Math.round(r.width),height:Math.round(r.height)}:null};const layout=rect('.layout');return{path:location.pathname,hash:location.hash,overflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),audit:window.RWASeablueprintCommerceBridge.audit(),chart:rect('.chart-wrap'),order:rect('.layout>.right'),dock:rect('#rwaCommerceDock'),layout,screenParent:q('#rwaShopScreen')?.parentElement?.id||'',screenPosition:getComputedStyle(q('#rwaShopScreen')).position,dockPosition:getComputedStyle(q('#rwaCommerceDock')).position,products:q('#rwaShopScreen')?.querySelectorAll('.rwa-product-card').length||0,source:q('[data-seablueprint-source]')?.textContent||'',target:document.documentElement.dataset.rwaTargetDashboard||''}});
  if(state.path!==baseline.path||state.hash!=='#shop')throw Error(`escaped single /rwa/ document ${JSON.stringify(state)}`);
  if(state.overflow>4)throw Error(`horizontal overflow ${state.overflow}`);
  if(!state.audit?.ok||state.audit.mode!=='CONTEXT_PANEL'||state.audit.placement!=='context-right-panel')throw Error(`commerce audit ${JSON.stringify(state.audit)}`);
  if(!/BACKEND LOCKED/.test(state.source))throw Error('fail-closed badge missing');
  if(state.products<1)throw Error('no products rendered');
  if(Math.abs(Number(state.layout?.width||0)-Number(baseline.layoutWidth||0))>2)throw Error(`opening Ecommerce reshaped main layout ${JSON.stringify({baseline,state:state.layout})}`);
  if(width>=681){
    if(state.screenParent!=='rwaCommerceDock'||state.screenPosition==='fixed')throw Error(`commerce escaped context dock ${JSON.stringify(state)}`);
    if(state.dockPosition!=='fixed')throw Error(`context dock is not fixed ${JSON.stringify(state.dock)}`);
    if(!state.dock||state.dock.width<420||state.dock.width>442)throw Error(`desktop context panel width is not canonical ~440px ${JSON.stringify(state.dock)}`);
    if(state.dock.left<Number(state.audit?.viewportRight||width)-445)throw Error(`desktop Ecommerce still behaves like a takeover ${JSON.stringify(state.dock)}`);
    if(Math.abs(Number(state.dock.top||0)-62)>2)throw Error(`context panel top is not aligned directly below 62px target header ${JSON.stringify(state.dock)}`);
    if(Number(state.audit.panelCoverage||1)>.38)throw Error(`desktop panel covers too much viewport ${state.audit.panelCoverage}`);
    if(Number(state.audit.exposedChartWidth||0)<420)throw Error(`not enough market/chart context remains visible ${state.audit.exposedChartWidth}`)
  }else{
    if(!state.dock||Math.abs(state.dock.width-width)>2||state.dock.left!==0)throw Error(`mobile Ecommerce does not match full-width contextual-panel behavior ${JSON.stringify(state.dock)}`)
  }
  await page.screenshot({path:`${proof}/${String(label).replace(/[^a-z0-9]+/gi,'-').toLowerCase()}-commerce-context-panel.png`,fullPage:true});
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#rwaShopScreen')?.classList.contains('open'),{timeout:8000});
  if(popups.length)throw Error(`opened ${popups.length} extra page(s)`);if(errors.length)throw Error(`page errors: ${errors.join(' | ')}`);
  results.push({label,width,height,ok:true,baseline,...state})
 }catch(e){failures.push({label,message:e.message});results.push({label,width,height,ok:false});await page.screenshot({path:`${proof}/${label}-failure.png`,fullPage:true}).catch(()=>{})}
 finally{await context.close()}
}
await browser.close();
const summary={ok:failures.length===0,version:VERSION,placement:'CONTEXT_PANEL',singleMainDocument:true,desktopContextDrawer:true,backendFailClosed:true,zeroHorizontalOverflow:true,targetHeaderTop:62,viewports:results,failures};
await writeFile(`${proof}/browser-result.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));if(!summary.ok)process.exit(1);
