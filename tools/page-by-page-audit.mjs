import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base=process.env.RWA_UI_URL||'https://copytolive.github.io/rwa/';
const proof=process.env.RWA_UI_PROOF_DIR||'proof/page-by-page-v5';
await mkdir(proof,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[];
async function root(page){
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:50000});
 await page.waitForFunction(()=>window.RWALiveHome?.version==='5.0.0'&&window.RWATerminalV5?.version==='1.0.0'&&window.RWAMarketRuntime?.state?.().pairs?.length>50,{timeout:50000});
 await page.waitForFunction(()=>document.querySelector('#liveRail #rwaTargetOrderTicket')&&document.querySelectorAll('#asks .bookrow').length>=5,{timeout:30000});
 await page.waitForTimeout(450);
}
async function snap(page,name){await page.waitForTimeout(160);const path=proof+'/'+name+'.png';try{await page.screenshot({path,fullPage:false,timeout:12000})}catch{const cdp=await page.context().newCDPSession(page);try{const out=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});await writeFile(path,Buffer.from(out.data,'base64'))}finally{await cdp.detach().catch(()=>{})}}}
async function invariant(page,label){
 const x=await page.evaluate(()=>({route:location.hash,nav:[...document.querySelectorAll('.topnav [data-v5-nav]')].map(e=>e.dataset.v5Nav),ticket:!!document.querySelector('#liveRail #rwaTargetOrderTicket'),mock:!!document.querySelector('#rwaScreenshotParity'),commerce:/seablueprint|ecommerce|in-page commerce/i.test(document.body.innerText)}));
 if(x.route!=='#markets'||!x.ticket||x.mock||x.commerce||JSON.stringify(x.nav)!==JSON.stringify(['trade','discover','portfolio','analytics','rewards','more']))errors.push(label+': '+JSON.stringify(x));
}
const ctx=await browser.newContext({viewport:{width:1672,height:941},deviceScaleFactor:1,serviceWorkers:'block'}),page=await ctx.newPage();page.on('pageerror',e=>errors.push('desktop: '+String(e?.message||e)));
await root(page);await invariant(page,'market');await snap(page,'01-market-desktop');
await page.locator('.topnav [data-v5-nav="discover"]').click();await invariant(page,'discover');await snap(page,'02-discover-desktop');
await page.locator('.topnav [data-v5-nav="portfolio"]').click();await invariant(page,'portfolio');await snap(page,'03-portfolio-desktop');
await page.locator('#rwaV5Bottom [data-v5-bottom="orders"]').click();await invariant(page,'orders');await snap(page,'04-orders-desktop');
await page.locator('.topnav [data-v5-nav="analytics"]').click();await invariant(page,'analytics');await snap(page,'05-analytics-desktop');
await page.locator('.topnav [data-v5-nav="rewards"]').click();await invariant(page,'rewards');await snap(page,'06-rewards-desktop');
await page.locator('.topnav [data-v5-nav="trade"]').click();await page.locator('#liveRail [data-v5-trade-tab="alerts"]').click();await invariant(page,'alerts');await snap(page,'07-alerts-desktop');
await page.locator('#rwaMultiChainLaunch').click();await page.waitForFunction(()=>window.RWAMultiChain?.status?.().open===true,{timeout:15000});await snap(page,'08-multichain-desktop');await page.locator('#rwaMultiChainPanel .rwa-mc-close').click();
const summary=await page.evaluate(()=>({route:location.hash,pairs:window.RWAMarketRuntime.state().pairs.length,terminal:window.RWATerminalV5.audit(),market:window.RWALiveHome.audit(),multichain:window.RWAMultiChain?.status?.()}));await ctx.close();

for(const [w,h,prefix] of [[390,844,'390'],[430,932,'430']]){
 const c=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,serviceWorkers:'block'}),p=await c.newPage();p.on('pageerror',e=>errors.push('mobile-'+prefix+': '+String(e?.message||e)));await root(p);
 await snap(p,'09-mobile-'+prefix+'-chart');
 await p.locator('[data-v5-mobile-mode="book"]').click();await snap(p,'10-mobile-'+prefix+'-book');
 await p.locator('[data-v5-mobile-mode="trade"]').click();await snap(p,'11-mobile-'+prefix+'-trade');
 await p.locator('[data-v5-mobile-mode="feed"]').click();await snap(p,'12-mobile-'+prefix+'-feed');
 const state=await p.evaluate(()=>({route:location.hash,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,mode:document.body.dataset.v5MobileMode,ticket:!!document.querySelector('#liveRail #rwaTargetOrderTicket')}));
 if(state.route!=='#markets'||state.overflow>2||!state.ticket)errors.push('mobile-'+prefix+' invariant '+JSON.stringify(state));await c.close();
}
await browser.close();
const out={ok:errors.length===0,errors,summary};await writeFile(proof+'/audit.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));if(errors.length)process.exit(1);
