import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const base=process.env.RWA_BROWSER_BASE_URL||'http://127.0.0.1:4173/';
const outDir=resolve(process.env.RWA_BROWSER_OUT||'artifacts/rwa-business-console');mkdirSync(outDir,{recursive:true});
const viewports=[['desktop-1600x1000',1600,1000],['mobile-390x844',390,844]];const failures=[],results=[];
const browser=await chromium.launch({headless:true});
try{
  for(const [name,width,height] of viewports){
    const context=await browser.newContext({viewport:{width,height}}),extraPages=[];const page=await context.newPage();context.on('page',p=>{if(p!==page)extraPages.push(p)});
    page.on('pageerror',e=>{const s=String(e?.message||e);if(!/ResizeObserver loop|Script error/i.test(s))failures.push(`${name}:pageerror:${s}`)});
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>window.RWABusinessConsole?.version==='1.0.1'&&document.documentElement.dataset.rwaTargetDashboard==='v2',{timeout:15000});
    const launch=page.locator('#rwaSeablueprintCommerceLaunch,[data-rwa-seablueprint-commerce="1"]').filter({visible:true}).first();
    const pathBefore=new URL(page.url()).pathname;
    if(!(await page.locator('#rwaShopScreen.open').isVisible().catch(()=>false))){await launch.click();await page.waitForSelector('#rwaShopScreen.open',{timeout:15000})}
    await page.waitForSelector('[data-seablueprint-source]',{state:'visible',timeout:10000});
    await page.waitForFunction(()=>window.RWABusinessConsole?.audit?.().suppressedForTarget===true,{timeout:10000});
    const state=await page.evaluate(()=>({path:location.pathname,hash:location.hash,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,shopOpen:document.querySelector('#rwaShopScreen')?.classList.contains('open')===true,businessLaunchPresent:!!document.querySelector('#rwaBusinessConsoleLaunch'),businessPanelPresent:!!document.querySelector('#rwaBusinessConsole'),shopText:document.querySelector('#rwaShopScreen')?.textContent||'',audit:window.RWABusinessConsole?.audit?.(),bridge:window.RWASeablueprintCommerceBridge?.audit?.()}));
    if(state.path!==pathBefore)failures.push(`${name}:top-level-path-changed:${state.path}`);if(state.overflow>1)failures.push(`${name}:horizontal-overflow:${state.overflow}`);if(!state.shopOpen)failures.push(`${name}:commerce-not-open`);if(state.businessLaunchPresent||state.businessPanelPresent)failures.push(`${name}:business-rail-must-be-suppressed-in-target-shell`);if(/REAL BUSINESS OPERATING RAIL|Business & Wallet Transaction Validation/.test(state.shopText))failures.push(`${name}:business-copy-leaked-into-ecommerce`);if(state.audit?.ok!==true||state.audit?.suppressedForTarget!==true)failures.push(`${name}:suppression-audit-failed`);if(state.audit?.apiConfigured!==false)failures.push(`${name}:api-must-remain-fail-closed-in-repo`);if(state.bridge?.contentOwner!=='RWAEcommerceTargetController')failures.push(`${name}:canonical-content-owner-lost`);if(extraPages.length)failures.push(`${name}:popup-opened:${extraPages.length}`);
    await page.screenshot({path:resolve(outDir,`${name}.png`),fullPage:true});results.push({name,width,height,...state});await context.close();
  }
}finally{await browser.close()}
const result={ok:failures.length===0,base,results,failures};writeFileSync(resolve(outDir,'browser-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(failures.length)process.exit(1);