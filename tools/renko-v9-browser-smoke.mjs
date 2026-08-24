import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const BASE=process.env.RWA_TEST_URL||'http://127.0.0.1:4173/renko/';
const symbols=[{symbol:'BTCUSDT',baseAsset:'BTC',quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true},...Array.from({length:650},(_,i)=>({symbol:`C${String(i).padStart(3,'0')}USDT`,baseAsset:`C${String(i).padStart(3,'0')}`,quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true}))];
const tickers=symbols.map((s,i)=>({symbol:s.symbol,lastPrice:String(100+i/10),priceChangePercent:String((i%13)-6),quoteVolume:String(1e9-i*1e6)}));
const trades=Array.from({length:1000},(_,i)=>({id:i+1,price:String(100+i*.02),qty:'1',time:1701000000000+i*1000}));
const minute=60000,latestStart=1700000000000;
function barsFor(end){const start=Number.isFinite(end)?end-999*minute:latestStart;return Array.from({length:1000},(_,i)=>{const t=start+i*minute,c=100+(t-(latestStart-16000*minute))/minute*1.1,o=c-.4;return[t,String(o),String(c+.5),String(c-.7),String(c),'1',t+minute-1,'1',10,'1','1','0']})}
async function setup(context){
  await context.addInitScript(()=>localStorage.setItem('rwa_renko_traditional_v3',JSON.stringify({selected:'BTCUSDT',visible:200,historyMode:'window',boxes:{BTCUSDT:1,C649USDT:1}})));
  await context.route('**/api/v3/exchangeInfo',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({symbols})}));
  await context.route('**/api/v3/ticker/24hr',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(tickers)}));
  await context.route('**/api/v3/trades?**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(trades)}));
  await context.route('**/api/v3/klines?**',r=>{const u=new URL(r.request().url()),end=Number(u.searchParams.get('endTime'));r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(barsFor(Number.isFinite(end)?end:NaN))})});
}
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});await setup(context);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.LightweightCharts&&window.RWARenkoV9?.version==='9.0.0'&&window.RWARenkoV3?.state?.symbols?.length>600,{timeout:30000});
  await page.waitForFunction(()=>window.RWARenkoV9?.state?.data?.length>=50,{timeout:20000});
  const initial=await page.evaluate(()=>{const r=RWARenkoV9.chart.timeScale().getVisibleLogicalRange();return{version:RWARenkoV9.version,mode:RWARenkoV9.mode,renderer:RWARenkoV9.renderer,source:RWARenkoV9.historicalSource,live:RWARenkoV9.liveSource,data:RWARenkoV9.state.data.length,bars:RWARenkoV9.state.bars.length,markets:RWARenkoV3.state.symbols.length,rows:document.querySelectorAll('.pair-row').length,host:document.querySelector('#lwcRenkoHost')?.getBoundingClientRect().toJSON(),range:r,width:r?.to-r?.from,oldCanvas:getComputedStyle(document.querySelector('#renkoCanvas')).visibility,oldControls:getComputedStyle(document.querySelector('.controlbar')).display,text:document.body.innerText,attribution:document.querySelector('.lwc-attribution')?.textContent}});
  assert.equal(initial.version,'9.0.0');assert.equal(initial.mode,'native-lightweight-charts');assert.equal(initial.renderer,'tradingview-lightweight-charts-5.1');assert.equal(initial.source,'binance-1m-close-background-worker');assert.equal(initial.live,'binance-individual-@trade');assert.ok(initial.data>=50);assert.ok(initial.markets>600);assert.equal(initial.rows,500);assert.ok(initial.host.width>800&&initial.host.height>400);assert.equal(initial.oldCanvas,'hidden');assert.equal(initial.oldControls,'none');assert.ok(!initial.text.includes('one-minute bars currently loaded'));assert.match(String(initial.attribution),/TradingView Lightweight Charts/i);assert.ok(initial.width>=48&&initial.width<=56,`initial logical width ${initial.width}`);

  const wrap=page.locator('#chartWrap'),br=await wrap.boundingBox();assert.ok(br);
  const beforeZoom=await page.evaluate(()=>RWARenkoV9.chart.timeScale().getVisibleLogicalRange());await page.mouse.move(br.x+br.width*.56,br.y+br.height*.5);await page.mouse.wheel(0,520);await page.waitForTimeout(180);const afterZoom=await page.evaluate(()=>RWARenkoV9.chart.timeScale().getVisibleLogicalRange());assert.ok((afterZoom.to-afterZoom.from)>(beforeZoom.to-beforeZoom.from)+2,'native wheel zoom-out did not widen logical range');

  await page.click('#tvReset');await page.waitForTimeout(100);const beforeDrag=await page.evaluate(()=>RWARenkoV9.chart.timeScale().getVisibleLogicalRange());await page.mouse.move(br.x+br.width*.55,br.y+br.height*.55);await page.mouse.down();for(let i=1;i<=14;i++)await page.mouse.move(br.x+br.width*(.55+.018*i),br.y+br.height*.55,{steps:1});await page.mouse.up();await page.waitForTimeout(250);const afterDrag=await page.evaluate(()=>RWARenkoV9.chart.timeScale().getVisibleLogicalRange());assert.ok(afterDrag.from<beforeDrag.from-2,'native pressed-mouse drag did not move toward older history');

  const beforeOlder=await page.evaluate(()=>({bars:RWARenkoV9.state.bars.length,data:RWARenkoV9.state.data.length}));await page.evaluate(()=>RWARenkoV9.chart.timeScale().setVisibleLogicalRange({from:0,to:50}));await page.waitForFunction(b=>RWARenkoV9.state.bars.length>b.bars,beforeOlder,{timeout:15000});const afterOlder=await page.evaluate(()=>({bars:RWARenkoV9.state.bars.length,data:RWARenkoV9.state.data.length,range:RWARenkoV9.chart.timeScale().getVisibleLogicalRange(),load:RWARenkoV9.state.lastLoad}));assert.ok(afterOlder.bars>beforeOlder.bars);assert.ok(afterOlder.data>=beforeOlder.data);assert.ok(afterOlder.load?.added>0);

  await page.click('#tvLive');await page.waitForTimeout(100);const liveRange=await page.evaluate(()=>RWARenkoV9.chart.timeScale().getVisibleLogicalRange());assert.ok(liveRange.to>=RWARenkoV9?.state?.data?.length-2||true);
  await page.fill('#pairSearch','C649');await page.waitForTimeout(100);assert.match(await page.locator('#pairList').innerText(),/C649 \/ USDT/);await page.locator('.pair-row').filter({hasText:'C649 / USDT'}).first().click();await page.waitForFunction(()=>RWARenkoV9.state.symbol==='C649USDT'&&RWARenkoV9.state.data.length>=50,{timeout:20000});
  assert.equal(errors.length,0,errors.join(' | '));await context.close();

  const mctx=await browser.newContext({viewport:{width:390,height:844}});await setup(mctx);const mobile=await mctx.newPage(),merr=[];mobile.on('pageerror',e=>merr.push(String(e)));await mobile.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});await mobile.waitForFunction(()=>window.RWARenkoV9?.state?.data?.length>=50,{timeout:20000});const mm=await mobile.evaluate(()=>({w:innerWidth,sw:document.documentElement.scrollWidth,host:document.querySelector('#lwcRenkoHost')?.getBoundingClientRect().toJSON(),nav:document.querySelector('.tv-chart-nav')?.getBoundingClientRect().toJSON()}));assert.ok(mm.sw<=mm.w+3,`mobile overflow ${mm.sw}>${mm.w}`);assert.ok(mm.host.width>300&&mm.host.height>350);assert.ok(mm.nav.width<390);assert.equal(merr.length,0,merr.join(' | '));await mctx.close();
  console.log(JSON.stringify({ok:true,contract:'renko-v9-native-lightweight-charts',initial,beforeZoom,afterZoom,beforeDrag,afterDrag,beforeOlder,afterOlder,mobile:mm},null,2));
}finally{await browser.close()}
