import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base=process.env.RWA_UI_URL||'https://copytolive.github.io/rwa/';
const proof=process.env.RWA_UI_PROOF_DIR||'proof/page-by-page-audit';
await mkdir(proof,{recursive:true});
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:1672,height:941},deviceScaleFactor:1,serviceWorkers:'block'});
const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e?.message||e)));
const snap=async(name)=>{await page.waitForTimeout(500);await page.screenshot({path:proof+'/'+name+'.png',fullPage:false})};
await page.goto(base,{waitUntil:'domcontentloaded',timeout:50000});
await page.waitForFunction(()=>window.RWALiveHome?.version==='3.2.1'&&window.RWAMarketRuntime?.state?.().pairs?.length>50,{timeout:35000});
await page.waitForTimeout(700);
await snap('01-markets-desktop');
const intel=page.locator('[data-rwa-target-nav="intelligence"]').first();if(await intel.count()){await intel.click();await page.waitForSelector('#rwaTradingWorkspace:not([hidden])',{timeout:12000});await snap('02-intelligence-desktop');await page.locator('[data-workspace-close]').click();await page.waitForTimeout(200)}
const portfolio=page.locator('[data-rwa-target-nav="portfolio"]').first();if(await portfolio.count()){await portfolio.click();await page.waitForSelector('#rwaTradingWorkspace:not([hidden])',{timeout:12000});await snap('03-portfolio-desktop');await page.locator('[data-workspace-close]').click();await page.waitForTimeout(200)}
const orders=page.locator('[data-rwa-target-nav="orders"]').first();if(await orders.count()){await orders.click();await page.waitForSelector('#rwaTradingWorkspace:not([hidden])',{timeout:10000});await snap('04-orders-desktop');await page.locator('[data-workspace-close]').click()}
const reports=page.locator('[data-rwa-target-nav="reports"]').first();if(await reports.count()){await reports.click();await page.waitForSelector('#rwaTradingWorkspace:not([hidden])',{timeout:10000});await snap('05-reports-desktop');await page.locator('[data-workspace-close]').click()}
await page.locator('[data-rwa-target-nav="markets"]').first().click().catch(()=>{});
const mc=page.locator('#rwaMultiChainLaunch').first();if(await mc.count()){await mc.click();await page.waitForFunction(()=>window.RWAMultiChain?.status?.().open===true,{timeout:12000});await snap('06-multichain-desktop');await page.locator('#rwaMultiChainPanel .rwa-mc-close').click()}
const summary=await page.evaluate(()=>({hash:location.hash,bodyClass:document.body.className,marketPairs:window.RWAMarketRuntime?.state?.().pairs?.length||0,liveHome:window.RWALiveHome?.audit?.(),multichain:window.RWAMultiChain?.status?.()}));
await ctx.close();
for(const [w,h,n] of [[390,844,'07-markets-mobile-390'],[430,932,'08-markets-mobile-430']]){
 const c=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,serviceWorkers:'block'});const p=await c.newPage();p.on('pageerror',e=>errors.push(n+': '+String(e?.message||e)));await p.goto(base,{waitUntil:'domcontentloaded',timeout:50000});await p.waitForFunction(()=>window.RWALiveHome?.version==='3.2.1'&&window.RWAMarketRuntime?.state?.().pairs?.length>50,{timeout:35000});await p.waitForTimeout(600);await p.screenshot({path:proof+'/'+n+'.png',fullPage:false});await c.close();
}
await browser.close();const out={ok:errors.length===0,errors,summary};await writeFile(proof+'/audit.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));if(errors.length)process.exit(1);