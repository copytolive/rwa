import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE=process.env.RWA_TEST_URL||'http://127.0.0.1:4173/';
const markets=Array.from({length:520},(_,i)=>{
  const base=i===0?'BTC':`T${String(i).padStart(3,'0')}`;
  return {symbol:`${base}USDT`,baseAsset:base,quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true};
});
const tickers=markets.map((m,i)=>({
  symbol:m.symbol,lastPrice:String(100+i/10),openPrice:String(99+i/10),priceChangePercent:String((i%17)-8),highPrice:String(103+i/10),lowPrice:String(96+i/10),quoteVolume:String(1000000-i*100)
}));
const klines=Array.from({length:180},(_,i)=>{const o=100+i*.05,c=o+(i%2?.2:-.15);return [Date.now()-(180-i)*900000,String(o),String(Math.max(o,c)+.4),String(Math.min(o,c)-.4),String(c),'10'];});

async function installMocks(context){
  await context.addInitScript(()=>{
    class FakeWebSocket{
      static CONNECTING=0;static OPEN=1;static CLOSING=2;static CLOSED=3;
      constructor(url){this.url=url;this.readyState=0;this.__listeners=new Map();setTimeout(()=>{if(this.readyState!==0)return;this.readyState=1;this.onopen?.({type:'open'});for(const fn of this.__listeners.get('open')||[])fn({type:'open'})},12)}
      addEventListener(type,fn){if(!this.__listeners.has(type))this.__listeners.set(type,new Set());this.__listeners.get(type).add(fn)}
      removeEventListener(type,fn){this.__listeners.get(type)?.delete(fn)}
      send(){}
      close(){if(this.readyState===3)return;this.readyState=3;setTimeout(()=>{this.onclose?.({type:'close'});for(const fn of this.__listeners.get('close')||[])fn({type:'close'})},0)}
    }
    window.WebSocket=FakeWebSocket;
  });
  await context.route('**/api/v3/exchangeInfo',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({symbols:markets})}));
  await context.route('**/api/v3/ticker/24hr',r=>{
    const u=new URL(r.request().url());
    const sym=u.searchParams.get('symbol');
    if(sym){const t=tickers.find(x=>x.symbol===sym)||tickers[0];return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(t)});}
    return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(tickers)});
  });
  await context.route('**/api/v3/klines**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(klines)}));
  await context.route('https://s3.tradingview.com/**',r=>r.abort());
}

async function desktop(browser){
  const context=await browser.newContext({viewport:{width:1440,height:900}});await installMocks(context);const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForFunction(()=>window.RWAMarketPerformanceGuard?.runtime==='root-terminal-low-jank-v1',{timeout:10000});
  await page.waitForFunction(()=>document.querySelectorAll('#pairList .pairrow').length>10,{timeout:10000});
  const info=await page.evaluate(()=>{const h=document.querySelector('.topbar');const r=h.getBoundingClientRect();return {rows:document.querySelectorAll('#pairList .pairrow').length,total:S.pairs.length,scrollWidth:document.documentElement.scrollWidth,innerWidth,guard:window.RWAMarketPerformanceGuard,quick:window.RWAQuickActions?.performance,header:{h:r.height,scrollH:h.scrollHeight,scrollW:h.scrollWidth,clientW:h.clientWidth,single:h.dataset.rwaSingleRow,productbar:!!document.querySelector('.productbar'),trustbar:!!document.querySelector('.trustbar')}}});
  assert.equal(info.total,520);assert.ok(info.rows<=140&&info.rows>=10,`desktop market DOM cap invalid: ${info.rows}`);assert.ok(info.scrollWidth<=info.innerWidth+2,`desktop horizontal overflow ${info.scrollWidth}/${info.innerWidth}`);
  assert.equal(info.header.single,'1');assert.equal(info.header.productbar,false);assert.equal(info.header.trustbar,false);assert.ok(info.header.h<=49&&info.header.scrollH<=49,`desktop header wrapped: ${JSON.stringify(info.header)}`);
  const stress=await page.evaluate(async()=>{
    const start=performance.now();for(let n=0;n<40;n++)for(const x of S.pairs)updatePairDOM(x,x.price);const queueMs=performance.now()-start;
    let observerCalls=0;const mo=new MutationObserver(()=>observerCalls++);mo.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
    const temp=document.createElement('div');document.body.appendChild(temp);for(let i=0;i<2000;i++)temp.textContent=String(i);
    for(let i=0;i<2500;i++)addTrade({m:i%2===0,p:String(100+i/10000),q:'0.01',T:Date.now()});
    await new Promise(r=>setTimeout(r,1450));mo.disconnect();temp.remove();
    return {queueMs,observerCalls,tape:document.querySelectorAll('#tradeTape .trade').length,rows:document.querySelectorAll('#pairList .pairrow').length};
  });
  assert.ok(stress.queueMs<1200,`queued market updates blocked main thread: ${stress.queueMs}ms`);assert.ok(stress.observerCalls<=2,`hot MutationObserver fired too often: ${stress.observerCalls}`);assert.ok(stress.tape<=28,`trade tape unbounded: ${stress.tape}`);assert.ok(stress.rows<=140);
  assert.equal(errors.length,0,`desktop page errors: ${errors.join(' | ')}`);await context.close();return {info,stress};
}

async function compactDesktop(browser){
  const context=await browser.newContext({viewport:{width:1024,height:820}});await installMocks(context);const page=await context.newPage();await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:20000});await page.waitForFunction(()=>window.RWAMarketPerformanceGuard,{timeout:10000});
  const x=await page.evaluate(()=>({right:getComputedStyle(document.querySelector('.right')).display,layout:document.querySelector('.layout').getBoundingClientRect().width,scrollWidth:document.documentElement.scrollWidth,innerWidth,headerH:document.querySelector('.topbar').scrollHeight}));
  assert.equal(x.right,'none');assert.ok(x.layout<=x.innerWidth+1);assert.ok(x.scrollWidth<=x.innerWidth+2);assert.ok(x.headerH<=49,`compact header wrapped to ${x.headerH}`);await context.close();return x;
}

async function mobile(browser){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await installMocks(context);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:20000});await page.waitForFunction(()=>window.RWAMarketPerformanceGuard,{timeout:10000});await page.waitForTimeout(800);
  const m=await page.evaluate(()=>{
    const de=document.documentElement,chart=document.querySelector('.chart-wrap')?.getBoundingClientRect(),exchange=document.querySelector('#rwaExchange')?.getBoundingClientRect(),app=document.querySelector('.app')?.getBoundingClientRect(),h=document.querySelector('.topbar'),hr=h.getBoundingClientRect();
    return {innerWidth,scrollWidth:de.scrollWidth,bodyWidth:document.body.scrollWidth,chart:chart&&{w:chart.width,h:chart.height},exchange:exchange&&{x:exchange.x,w:exchange.width},app:app&&{x:app.x,w:app.width},rows:document.querySelectorAll('#pairList .pairrow').length,header:{h:hr.height,scrollH:h.scrollHeight,scrollW:h.scrollWidth,clientW:h.clientWidth,single:h.dataset.rwaSingleRow}};
  });
  assert.ok(m.scrollWidth<=m.innerWidth+2,`mobile html overflow ${m.scrollWidth}/${m.innerWidth}`);assert.ok(m.bodyWidth<=m.innerWidth+2,`mobile body overflow ${m.bodyWidth}/${m.innerWidth}`);assert.ok(m.app.w<=m.innerWidth+1&&m.app.x>=-1,`mobile app width invalid ${JSON.stringify(m.app)}`);assert.ok(m.chart.w<=m.innerWidth+1&&m.chart.h>=280&&m.chart.h<=505,`mobile chart invalid ${JSON.stringify(m.chart)}`);if(m.exchange)assert.ok(m.exchange.w<=m.innerWidth+1&&m.exchange.x>=-1,`mobile exchange overflow ${JSON.stringify(m.exchange)}`);assert.ok(m.rows<=70,`mobile pair DOM cap invalid ${m.rows}`);assert.equal(m.header.single,'1');assert.ok(m.header.h<=47&&m.header.scrollH<=47,`mobile header wrapped: ${JSON.stringify(m.header)}`);
  await page.evaluate(()=>document.querySelector('[data-mobile-nav="markets"]')?.click());await page.waitForTimeout(80);const drawer=await page.evaluate(()=>({open:document.body.classList.contains('market-drawer-open'),left:getComputedStyle(document.querySelector('.left')).display,scrollWidth:document.documentElement.scrollWidth}));assert.equal(drawer.open,true);assert.notEqual(drawer.left,'none');assert.ok(drawer.scrollWidth<=390+2);
  assert.equal(errors.length,0,`mobile page errors: ${errors.join(' | ')}`);await context.close();return {m,drawer};
}

const browser=await chromium.launch({headless:true});
try{
  const d=await desktop(browser),c=await compactDesktop(browser),m=await mobile(browser);
  console.log(JSON.stringify({ok:true,contract:'rwa-root-market-browser-stability-v2-single-row-header',desktop:d,compact:c,mobile:m},null,2));
}finally{await browser.close()}
