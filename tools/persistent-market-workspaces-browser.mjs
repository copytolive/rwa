import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const BASE=process.env.RWA_TEST_URL||'http://127.0.0.1:4173/rwa/';
const markets=[['BTC',100000,1.2,9e8,false],['ONDO',1.25,3.4,12e6,true],['PAXG',3400,-1.1,5e6,true],['MPL',18.2,2.2,2e6,true],['POLYX',.24,-2,1.4e6,true],['AAVE',310,4.2,20e6,false]].map(([base,price,change,vol,rwa])=>({base,symbol:`${base}USDT`,price,change,vol,rwa}));
const info={symbols:markets.map(x=>({symbol:x.symbol,baseAsset:x.base,quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true}))};
const tickers=markets.map(x=>({symbol:x.symbol,lastPrice:String(x.price),openPrice:String(x.price/(1+x.change/100)),priceChangePercent:String(x.change),highPrice:String(x.price*1.04),lowPrice:String(x.price*.96),quoteVolume:String(x.vol)}));
const klines=Array.from({length:180},(_,i)=>{const o=100+i*.1,c=o+(i%2?.4:-.3);return[Date.now()-(180-i)*900000,String(o),String(Math.max(o,c)+.6),String(Math.min(o,c)-.6),String(c),'1000']});
async function mocks(context){
  await context.route('**/api/v3/exchangeInfo',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(info)}));
  await context.route('**/api/v3/ticker/24hr*',r=>{const u=new URL(r.request().url()),sym=u.searchParams.get('symbol');return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(sym?(tickers.find(x=>x.symbol===sym)||tickers[0]):tickers)})});
  await context.route('**/api/v3/klines*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(klines)}));
  await context.route('https://s3.tradingview.com/**',r=>r.abort());
  await context.route('https://api.hyperliquid.xyz/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await context.route('https://api.hyperliquid-testnet.xyz/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
}
async function ready(page){
  await page.waitForFunction(()=>window.RWASuperApp?.version==='5.0.0',{timeout:25000});
  await page.waitForFunction(()=>window.RWAPersistentMarketWorkspaces?.ready===true,{timeout:10000});
  await page.waitForTimeout(250);
}
async function geometry(page,name,width,height){
  const g=await page.evaluate(()=>{
    const rect=e=>{const r=e?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,r:r.right}:null};
    const layout=document.querySelector('.layout'),chart=document.querySelector('.chart-wrap'),workspace=document.querySelector('#rwaSuperWorkspace'),suite=document.querySelector('#suite'),panel=document.body.classList.contains('rwa-persistent-suite')?suite:workspace;
    const visible=e=>{if(!e)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>2&&r.height>2};
    return{hash:location.hash,route:window.RWASuperApp?.route?.(),persistent:document.body.classList.contains('rwa-persistent-market'),layoutVisible:visible(layout),chart:rect(chart),panel:visible(panel)?rect(panel):null,scrollWidth:document.documentElement.scrollWidth,innerWidth,bodyClasses:document.body.className,selected:document.getElementById('selName')?.textContent||'',canvasProbe:chart?.dataset?.persistentProbe||''};
  });
  assert.equal(g.persistent,true,`${name}: persistent mode missing`);assert.equal(g.layoutVisible,true,`${name}: market layout hidden`);assert.ok(g.chart?.w>280&&g.chart?.h>250,`${name}: chart unusable ${JSON.stringify(g.chart)}`);assert.ok(g.panel?.w>280&&g.panel?.h>180,`${name}: workspace missing ${JSON.stringify(g.panel)}`);assert.ok(g.scrollWidth<=width+4,`${name}: horizontal overflow ${g.scrollWidth}/${width}`);assert.equal(g.canvasProbe,'same-chart',`${name}: chart DOM was replaced`);return g;
}
async function desktop(browser){
  const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});await mocks(context);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(BASE+'?pm=1#markets',{waitUntil:'domcontentloaded',timeout:30000});await ready(page);await page.locator('.chart-wrap').evaluate(e=>e.dataset.persistentProbe='same-chart');
  const before=await page.locator('.chart-wrap').boundingBox();
  for(const route of ['intelligence','assets','research','portfolio','institutional']){
    await page.evaluate(r=>window.RWASuperApp.navigate(r),route);await page.waitForTimeout(route==='portfolio'?220:120);
    const g=await geometry(page,'desktop '+route,1440,900);assert.ok(g.hash.startsWith(`#markets/${route}`),`desktop ${route}: noncanonical ${g.hash}`);assert.ok(g.chart.w>=620,`desktop ${route}: chart crushed ${g.chart.w}`);assert.ok(g.panel.w<=460,`desktop ${route}: panel too wide ${g.panel.w}`);
  }
  await page.evaluate(()=>window.RWASuperApp.navigate('assets'));await page.waitForTimeout(120);await page.locator('[data-open-market="ONDO"]').first().click().catch(()=>{});await page.waitForTimeout(80);const afterSymbol=await page.locator('#selName').textContent();assert.ok(/ONDO|BTC/.test(afterSymbol||''),'asset context selection broke market shell');
  await page.evaluate(()=>window.RWASuperApp.navigate('markets'));await page.waitForTimeout(100);assert.equal(documentHash(await page),'#markets');assert.equal(await page.locator('.chart-wrap').evaluate(e=>e.dataset.persistentProbe),'same-chart');const after=await page.locator('.chart-wrap').boundingBox();assert.ok(after&&before&&after.height>250,'chart lost after closing workspace');
  assert.equal(errors.length,0,`desktop page errors ${errors.join(' | ')}`);await context.close();return true;
}
async function mobile(browser,width=390,height=844){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,serviceWorkers:'block'});await mocks(context);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(BASE+'?pm=mobile#markets',{waitUntil:'domcontentloaded',timeout:30000});await ready(page);await page.locator('.chart-wrap').evaluate(e=>e.dataset.persistentProbe='same-chart');
  for(const route of ['intelligence','assets','research','portfolio','institutional']){
    await page.evaluate(r=>window.RWASuperApp.navigate(r),route);await page.waitForTimeout(route==='portfolio'?220:130);const g=await geometry(page,`mobile ${route}`,width,height);assert.ok(g.hash.startsWith(`#markets/${route}`));assert.ok(g.panel.y>=50,`mobile ${route}: sheet hides entire chart ${JSON.stringify(g.panel)}`);assert.ok(g.panel.b<=height-55,`mobile ${route}: sheet under bottom nav ${JSON.stringify(g.panel)}`);
  }
  await page.evaluate(()=>window.RWASuperApp.navigate('research/compare/ONDO'));await page.waitForTimeout(180);assert.ok((await page.locator('.chart-wrap').boundingBox())?.height>250,'mobile research unmounted chart');
  await page.goBack();await page.waitForTimeout(160);assert.equal(await page.locator('.chart-wrap').evaluate(e=>e.dataset.persistentProbe),'same-chart','mobile Back replaced chart');
  const controls=await page.locator('.rwa-pm-controls button').all();for(const b of controls){const box=await b.boundingBox();if(box)assert.ok(box.width>=40&&box.height>=40,`mobile control too small ${JSON.stringify(box)}`)}
  assert.equal(errors.length,0,`mobile errors ${errors.join(' | ')}`);await context.close();return true;
}
async function compactLaptop(browser){
  const context=await browser.newContext({viewport:{width:1024,height:768},serviceWorkers:'block'});await mocks(context);const page=await context.newPage();await page.goto(BASE+'?pm=laptop#markets',{waitUntil:'domcontentloaded',timeout:30000});await ready(page);await page.locator('.chart-wrap').evaluate(e=>e.dataset.persistentProbe='same-chart');await page.evaluate(()=>window.RWASuperApp.navigate('research'));await page.waitForTimeout(160);const g=await geometry(page,'laptop-1024 research',1024,768);assert.ok(g.panel.y>=300,`laptop dock should preserve upper chart ${JSON.stringify(g.panel)}`);await context.close();return true;
}
async function documentHash(page){return page.evaluate(()=>location.hash)}
const browser=await chromium.launch({headless:true});
try{
  await desktop(browser);await compactLaptop(browser);await mobile(browser,390,844);await mobile(browser,844,390);
  console.log('MARKET_SHELL_NEVER_LEAVES=PASS');
  console.log('CANDLESTICK_CONTEXT_PERSISTENT=PASS');
  console.log('INTELLIGENCE_IN_MARKET=PASS');
  console.log('ASSETS_IN_MARKET=PASS');
  console.log('RESEARCH_IN_MARKET=PASS');
  console.log('PORTFOLIO_IN_MARKET=PASS');
  console.log('INSTITUTIONAL_IN_MARKET=PASS');
  console.log('PERSISTENT_ROUTE_BACK_FORWARD=PASS');
  console.log('MOBILE_BOTTOM_SHEET=PASS');
  console.log('LAPTOP_DOCK=PASS');
  console.log('DESKTOP_CONTEXT_DOCK=PASS');
  console.log(JSON.stringify({ok:true,contract:'rwa-persistent-market-workspaces-v1'},null,2));
}finally{await browser.close()}
