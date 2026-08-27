import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE=process.env.RWA_TEST_URL||'http://127.0.0.1:4173/rwa/';
const markets=[
  ['BTC',100000,1.1,900000000,false],['ONDO',1.25,3.5,12000000,true],['PAXG',3400,-1.2,5000000,true],
  ['MPL',18.2,2.4,2100000,true],['POLYX',0.24,-2.1,1500000,true],['AAVE',310,4.2,20000000,false],
  ['CPOOL',0.17,7.8,1000000,true],['TRU',0.08,-3.3,900000,true],['OM',0.95,5.1,7000000,true]
].map(([base,price,change,vol,rwa])=>({base,symbol:`${base}USDT`,price,change,vol,rwa}));
const info={symbols:markets.map(x=>({symbol:x.symbol,baseAsset:x.base,quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true}))};
const tickers=markets.map(x=>({symbol:x.symbol,lastPrice:String(x.price),openPrice:String(x.price/(1+x.change/100)),priceChangePercent:String(x.change),highPrice:String(x.price*1.04),lowPrice:String(x.price*.96),quoteVolume:String(x.vol)}));
const klines=Array.from({length:180},(_,i)=>{const o=1+i*.001,c=o+(i%2?.004:-.003);return [Date.now()-(180-i)*900000,String(o),String(Math.max(o,c)+.006),String(Math.min(o,c)-.006),String(c),'1000']});

async function mocks(context){
  await context.route('**/api/v3/exchangeInfo',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(info)}));
  await context.route('**/api/v3/ticker/24hr*',r=>{const u=new URL(r.request().url());const sym=u.searchParams.get('symbol');const body=sym?(tickers.find(x=>x.symbol===sym)||tickers[0]):tickers;return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
  await context.route('**/api/v3/klines*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(klines)}));
  await context.route('https://s3.tradingview.com/**',r=>r.abort());
  await context.route('https://api.hyperliquid.xyz/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await context.route('https://api.hyperliquid-testnet.xyz/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
}
async function waitV5(page){await page.waitForFunction(()=>window.RWASuperApp?.version==='5.0.0',{timeout:20000});}
async function assertRoot(page,label){const u=new URL(page.url());assert.equal(u.pathname,'/rwa/',`${label}: pathname escaped /rwa/: ${u.pathname}`)}

const browser=await chromium.launch({headless:true});
const result={desktop:{},mobile:{}};
try{
  {
    const context=await browser.newContext({locale:'en-US',viewport:{width:1440,height:960},serviceWorkers:'block'});await mocks(context);const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
    await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});await waitV5(page);await page.waitForTimeout(1200);await assertRoot(page,'root');
    assert.ok(await page.locator('[data-v5-route="markets"]').count(),'desktop nav missing');
    assert.ok(await page.locator('#rwaGlobalTicker').count(),'global ticker missing');
    assert.ok(await page.locator('#rwaHealth').count(),'health indicator missing');
    const localeProbe=await page.evaluate(()=>{/* RWA_LOCALE_CI_PROBE_V2 */ const bad='en-US@posix';return{safe:window.__RWA_SAFE_LOCALE__,number:new Intl.NumberFormat(bad).format(1234.5),date:new Intl.DateTimeFormat(bad).format(new Date(0)),proto:(1234.5).toLocaleString(bad),canonical:Intl.getCanonicalLocales(bad)[0],locale:typeof Intl.Locale==='function'?new Intl.Locale(bad).toString():'en-US'}});assert.equal(localeProbe.safe,'en-US','safe locale not normalized');assert.ok(localeProbe.number&&localeProbe.date&&localeProbe.proto,'invalid locale runtime fallback failed');assert.equal(localeProbe.canonical,'en-US','invalid locale canonicalization failed');
    const rootRuntime=await page.evaluate(()=>({scriptCount:[...document.scripts].filter(s=>s.src).length,eager:[...document.scripts].map(s=>s.src).filter(x=>/product-os-v3|wallet-core|quick-actions|rwa-fundamentals|global-asset-terminal/.test(x))}));assert.ok(rootRuntime.scriptCount<=8,`root eager script count ${rootRuntime.scriptCount}`);assert.equal(rootRuntime.eager.length,0,`legacy eager scripts loaded on startup: ${rootRuntime.eager.join(',')}`);

    const routes=['markets','intelligence','assets','asset/ONDO','research','portfolio','social','institutional','trade/ONDO'];
    for(const route of routes){
      await page.evaluate(r=>window.RWASuperApp.navigate(r),route);await page.waitForTimeout(route==='portfolio'||route==='social'?800:250);await assertRoot(page,route);
      const hash=decodeURIComponent(new URL(page.url()).hash.slice(1));assert.ok(hash===route||hash.startsWith(route.split('/')[0]),`${route}: bad hash ${hash}`);
    }
    await page.evaluate(()=>window.RWASuperApp.navigate('asset/ONDO'));await page.waitForTimeout(300);
    assert.equal(await page.locator('#rwaSuperWorkspace').isVisible(),true,'asset drawer missing');
    assert.notEqual(await page.locator('.layout').evaluate(e=>getComputedStyle(e).display),'none','desktop chart hidden behind asset detail');
    assert.ok(await page.locator('[data-asset-tab="tokenization"]').count(),'asset tokenization tab missing');
    assert.ok(await page.locator('[data-asset-tab="risk"]').count(),'asset risk tab missing');

    await page.evaluate(()=>window.RWASuperApp.navigate('research'));await page.waitForTimeout(250);
    for(const tab of ['screener','compare','signals','report','saved','backtest','renko'])assert.ok(await page.locator(`[data-research-tab="${tab}"]`).count(),`research ${tab} missing`);
    await page.locator('[data-research-tab="backtest"]').click();await page.waitForTimeout(120);assert.ok((await page.locator('.rwa-research-legacy-frame').getAttribute('src')).includes('backtest/?embed=1'),'backtest not embedded');
    await page.locator('[data-research-tab="renko"]').click();await page.waitForTimeout(120);assert.ok((await page.locator('.rwa-research-legacy-frame').getAttribute('src')).includes('renko/?embed=1'),'renko not embedded');
    await page.evaluate(()=>window.RWASuperApp.navigate('research'));
    await page.evaluate(()=>window.RWASuperApp.openCommand('Treasury'));await page.waitForTimeout(150);assert.equal(await page.locator('#rwaSuperCommand').isVisible(),true,'universal search missing');assert.ok(await page.locator('#rwaSuperCommandResults button').count(),'Treasury search empty');await page.keyboard.press('Escape');

    await page.evaluate(()=>{const a=document.createElement('a');a.href='https://example.com/evidence.pdf';a.textContent='Evidence';a.id='qaExternal';document.body.appendChild(a)});await page.locator('#qaExternal').click();await page.waitForTimeout(100);await assertRoot(page,'external preview');assert.equal(await page.locator('#rwaInAppPreview').isVisible(),true,'external source did not open in app');await page.locator('[data-preview-close]').click();

    await page.evaluate(()=>window.RWASuperApp.navigate('assets'));await page.evaluate(()=>window.RWASuperApp.navigate('research'));await page.goBack();await page.waitForTimeout(200);await assertRoot(page,'history back');assert.equal(new URL(page.url()).hash,'#assets','Back did not restore assets route');await page.goForward();await page.waitForTimeout(200);assert.equal(new URL(page.url()).hash,'#research','Forward did not restore research route');

    const overflow=await page.evaluate(()=>({w:innerWidth,sw:document.documentElement.scrollWidth}));assert.ok(overflow.sw<=overflow.w+3,`desktop overflow ${overflow.sw}/${overflow.w}`);
    // Network failures that are intentionally caught are allowed; uncaught runtime errors are not.
    assert.equal(errors.length,0,`desktop uncaught errors: ${errors.join(' | ')}`);
    for(const [legacyPath,expected] of [['trade/?coin=ONDO','#trade/ONDO'],['asset/?symbol=PAXG','#asset/PAXG'],['backtest/?symbol=ONDO','#research/backtest/ONDO']]){
      await page.goto(BASE+legacyPath,{waitUntil:'domcontentloaded',timeout:30000});await waitV5(page);await page.waitForTimeout(250);await assertRoot(page,'legacy '+legacyPath);assert.equal(new URL(page.url()).hash,expected,`legacy ${legacyPath} not canonicalized`);
    }
    await page.goto(BASE+'renko/?symbol=ONDO',{waitUntil:'domcontentloaded',timeout:30000});await page.waitForTimeout(250);
    const renkoStandalone=await page.evaluate(()=>({pathname:location.pathname,mode:document.documentElement.dataset.rwaRenkoStandalone||''}));
    assert.equal(renkoStandalone.pathname,'/rwa/renko/','RENKO standalone pathname changed');assert.equal(renkoStandalone.mode,'tick-native','RENKO standalone tick-native marker missing');
    result.desktop={routes:routes.length,pathname:'/rwa/',assetDrawer:true,history:true,search:true,preview:true,legacyRedirects:true,renkoStandalone:true,noOverflow:true};await context.close();
  }
  {
    const context=await browser.newContext({locale:'en-US',viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});await mocks(context);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
    await page.goto(BASE+'#markets',{waitUntil:'domcontentloaded',timeout:30000});await waitV5(page);await page.waitForTimeout(900);await assertRoot(page,'mobile root');
    for(const key of ['markets','search','trade','social','portfolio'])assert.ok(await page.locator(`[data-v5-mobile="${key}"]`).count(),`mobile ${key} missing`);
    await page.evaluate(()=>window.RWASuperApp.navigate('asset/ONDO'));await page.waitForTimeout(250);await assertRoot(page,'mobile asset');assert.equal(await page.locator('#rwaSuperWorkspace').isVisible(),true,'mobile asset internal sheet missing');
    const size=await page.evaluate(()=>({w:innerWidth,sw:document.documentElement.scrollWidth,workspace:getComputedStyle(document.getElementById('rwaSuperWorkspace')).position}));assert.ok(size.sw<=size.w+3,`mobile overflow ${size.sw}/${size.w}`);assert.equal(size.workspace,'fixed','mobile asset should be full-screen internal sheet');
    await page.evaluate(()=>window.RWASuperApp.navigate('trade/ONDO'));await page.waitForSelector('#exCoin',{timeout:12000});await page.waitForTimeout(250);assert.equal(await page.locator('#exCoin').inputValue(),'ONDO','mobile trade symbol not synced');await assertRoot(page,'mobile trade');
    assert.equal(errors.length,0,`mobile uncaught errors: ${errors.join(' | ')}`);
    result.mobile={pathname:'/rwa/',bottomNav:true,assetSheet:true,tradeInternal:true,noOverflow:true};await context.close();
  }
  console.log(JSON.stringify({ok:true,contract:'rwa-superapp-v5-browser',...result},null,2));
}finally{await browser.close()}
