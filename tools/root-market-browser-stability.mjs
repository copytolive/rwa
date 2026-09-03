import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE=process.env.RWA_TEST_URL||'http://127.0.0.1:4173/';
const markets=Array.from({length:520},(_,i)=>{
  const base=i===0?'BTC':i===1?'ETH':`T${String(i).padStart(3,'0')}`;
  return {symbol:`${base}USDT`,baseAsset:base,quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true};
});
const tickers=markets.map((m,i)=>({
  symbol:m.symbol,lastPrice:String(100+i/10),openPrice:String(99+i/10),
  priceChangePercent:String((i%17)-8),highPrice:String(103+i/10),
  lowPrice:String(96+i/10),quoteVolume:String(1000000000-i*1000000)
}));
const klines=Array.from({length:180},(_,i)=>{
  const o=100+i*.05,c=o+(i%2?.2:-.15);
  return [Date.now()-(180-i)*3600000,String(o),String(Math.max(o,c)+.4),String(Math.min(o,c)-.4),String(c),'10'];
});
const depth={
  bids:Array.from({length:100},(_,i)=>[(100-i*.02).toFixed(2),String(1+i*.01)]),
  asks:Array.from({length:100},(_,i)=>[(100.10+i*.02).toFixed(2),String(1+i*.01)])
};

async function installDeterministicMarket(context){
  await context.addInitScript(()=>{
    class FakeWebSocket{
      static CONNECTING=0;static OPEN=1;static CLOSING=2;static CLOSED=3;
      constructor(url){this.url=url;this.readyState=0;setTimeout(()=>{if(this.readyState!==0)return;this.readyState=1;this.onopen?.({type:'open'})},8)}
      addEventListener(){} removeEventListener(){} send(){}
      close(){if(this.readyState===3)return;this.readyState=3;setTimeout(()=>this.onclose?.({type:'close'}),0)}
    }
    window.WebSocket=FakeWebSocket;
  });
  await context.route('**/api/v3/exchangeInfo',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({symbols:markets})}));
  await context.route('**/api/v3/ticker/24hr**',r=>{
    const u=new URL(r.request().url()),sym=u.searchParams.get('symbol');
    const body=sym?(tickers.find(x=>x.symbol===sym)||tickers[0]):tickers;
    return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await context.route('**/api/v3/klines**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(klines)}));
  await context.route('**/api/v3/depth**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(depth)}));
  await context.route('https://s3.tradingview.com/**',r=>r.abort());
}

async function open(browser,width,height){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block'});
  await installDeterministicMarket(context);
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForFunction(()=>window.RWALiveHome?.version==='4.1.0'&&window.RWAMarketRuntime?.version==='1.4.3'&&window.RWAMarketRuntime.state().pairs.length===520,{timeout:20000});
  await page.waitForFunction(()=>document.querySelectorAll('#bids .bookrow').length>=5&&document.querySelectorAll('#asks .bookrow').length>=5,{timeout:15000});
  await page.waitForTimeout(250);
  return {context,page,errors};
}

async function desktop(browser){
  const {context,page,errors}=await open(browser,1672,941);
  const info=await page.evaluate(()=>{
    const rect=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,display:getComputedStyle(e).display}};
    return {
      pairs:window.RWAMarketRuntime.state().pairs.length,
      rows:document.querySelectorAll('#pairList .pairrow').length,
      asks:document.querySelectorAll('#asks .bookrow').length,
      bids:document.querySelectorAll('#bids .bookrow').length,
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      commerce:/seablueprint|ecommerce|in-page commerce/i.test(document.body.innerText),
      mock:!!document.querySelector('#rwaScreenshotParity'),
      brand:document.querySelector('.brandcopy strong')?.textContent,
      layout:rect('.layout'),left:rect('.layout>.left'),right:rect('.layout>.right'),
      rail:rect('#liveRail'),footer:rect('#rwaGlobalTicker')
    };
  });
  assert.equal(info.pairs,520);
  assert.ok(info.rows>10&&info.rows<=140,`desktop watchlist DOM cap invalid: ${info.rows}`);
  assert.ok(info.asks>=5&&info.bids>=5,`depth100 book incomplete: ${info.asks}/${info.bids}`);
  assert.ok(info.overflow<=2,`desktop overflow: ${info.overflow}`);
  assert.equal(info.commerce,false);
  assert.equal(info.mock,false);
  assert.equal(info.brand,'Real World Asset');
  assert.equal(info.rail?.display,'flex');
  assert.ok(Math.abs(info.left?.w-286)<=3);
  assert.ok(Math.abs(info.right?.w-286)<=3);
  assert.ok(Math.abs(info.rail?.w-330)<=3);
  assert.ok(Math.abs(info.footer?.h-34)<=3);

  const menu=page.locator('#bookMenu');
  await menu.click();
  await page.waitForFunction(()=>{
    const s=window.RWAMarketRuntime?.state?.();
    return s?.bookLevels===10 && (s?.book?.bids?.length||0)>=8 && document.querySelectorAll('#bids .bookrow').length>=8;
  },{timeout:6000});
  const bookState=await page.evaluate(()=>window.RWAMarketRuntime.state());
  const ten=await page.locator('#bids .bookrow').count();
  assert.equal(bookState.bookLevels,10);
  assert.ok(bookState.book.bids.length>=8,`10-level grouped state incomplete: ${bookState.book.bids.length}`);
  assert.ok(ten>=8,`10-level book control did not expand DOM rows: ${ten}`);

  const search=page.locator('#search');
  if(await search.count()){
    await search.fill('T250');
    await page.waitForTimeout(80);
    assert.equal(await page.locator('#pairList .pairrow').count(),1);
    await search.fill('');
    await page.waitForTimeout(80);
    assert.ok((await page.locator('#pairList .pairrow').count())<=140);
  }

  assert.equal(errors.length,0,`desktop page errors: ${errors.join(' | ')}`);
  await context.close();
  return info;
}

async function compact(browser){
  const {context,page,errors}=await open(browser,1280,900);
  const x=await page.evaluate(()=>({
    rail:getComputedStyle(document.querySelector('#liveRail')).display,
    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    rows:document.querySelectorAll('#pairList .pairrow').length
  }));
  assert.equal(x.rail,'none');
  assert.ok(x.overflow<=2);
  assert.ok(x.rows<=140);
  assert.equal(errors.length,0);
  await context.close();
  return x;
}

async function mobile(browser,width,height){
  const {context,page,errors}=await open(browser,width,height);
  await page.locator('#rwaTargetOrderTicket').scrollIntoViewIfNeeded();
  const m=await page.evaluate(()=>{const r=s=>{const e=document.querySelector(s);if(!e)return null;const x=e.getBoundingClientRect();return{x:x.x,right:x.right,y:x.y,bottom:x.bottom,w:x.width,h:x.height,display:getComputedStyle(e).display}};return{
    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    rows:document.querySelectorAll('#pairList .pairrow').length,
    rail:getComputedStyle(document.querySelector('#liveRail')).display,
    buy:r('[data-order-side="BUY"]>button'),sell:r('[data-order-side="SELL"]>button'),
    input:r('[data-order-side="BUY"] label'),wallet:r('.top-actions .signin'),mc:r('#rwaMultiChainLaunch'),ticket:r('#rwaTargetOrderTicket')
  }});
  assert.ok(m.overflow<=2,`mobile overflow ${m.overflow}`);
  assert.ok(m.rows<=70,`mobile watchlist cap invalid: ${m.rows}`);
  assert.equal(m.rail,'none');
  assert.ok(m.buy?.h>=44&&m.sell?.h>=44&&m.input?.h>=42,`mobile touch target invalid ${JSON.stringify(m)}`);
  if(m.wallet)assert.ok(m.wallet.right<=width+1,`wallet clipped ${JSON.stringify(m.wallet)}`);
  if(m.mc&&m.ticket){const overlap=Math.min(m.mc.bottom,m.ticket.bottom)-Math.max(m.mc.y,m.ticket.y);assert.ok(overlap<=8,`MULTI CHAIN overlaps ticket by ${overlap}px`)}
  assert.equal(errors.length,0,`mobile page errors: ${errors.join(' | ')}`);
  await context.close();
  return m;
}

const browser=await chromium.launch({headless:true});
try{
  const result={desktop:await desktop(browser),compact:await compact(browser),mobile390:await mobile(browser,390,844),mobile430:await mobile(browser,430,932)};
  console.log(JSON.stringify({ok:true,contract:'rwa-root-market-stability-v7-target-v4',result},null,2));
}finally{await browser.close()}
