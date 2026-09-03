import { chromium } from 'playwright';
const BASE=process.env.RWA_TEST_URL||'http://127.0.0.1:4173/rwa/';
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({locale:'en-US',viewport:{width:1280,height:800},serviceWorkers:'block'});
  const page=await context.newPage();
  const pageErrors=[],consoleErrors=[],failed=[],responses=[];
  page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  page.on('requestfailed',r=>failed.push({url:r.url(),failure:r.failure()?.errorText||''}));
  page.on('response',r=>{if(/\.(?:js|css)(?:\?|$)/.test(r.url()))responses.push({status:r.status(),url:r.url()})});
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForTimeout(5000);
  const state=await page.evaluate(()=>({
    href:location.href,path:location.pathname,hash:location.hash,ready:document.readyState,
    app:window.RWASuperApp?.version||null,product:window.RWAProductOS?.version||null,
    perf:window.RWAMarketPerformanceGuard?.version||null,router:window.RWAPersistentMarketRouterV2?.version||null,
    scripts:[...document.scripts].filter(s=>s.src).map(s=>({src:s.src,async:s.async,defer:s.defer})),
    layout:!!document.querySelector('.layout'),bodyClass:document.body.className
  }));
  console.log(JSON.stringify({state,responses,failed,pageErrors,consoleErrors},null,2));
  if(state.app!=='5.0.0')process.exitCode=1;
}finally{await browser.close()}
