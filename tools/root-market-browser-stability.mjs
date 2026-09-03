import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE=process.env.RWA_TEST_URL||'http://127.0.0.1:4173/';
const markets=Array.from({length:520},(_,i)=>{
  const base=i===0?'BTC':i===1?'ETH':i===2?'ONDO':i===3?'PAXG':`T${String(i).padStart(3,'0')}`;
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
  await page.waitForFunction(()=>window.RWALiveHome?.version==='5.0.0'&&window.RWATerminalV5?.version==='1.0.0'&&window.RWAMarketRuntime?.version==='1.4.3'&&window.RWAMarketRuntime.state().pairs.length===520,{timeout:25000});
  await page.waitForFunction(()=>document.querySelectorAll('#bids .bookrow').length>=5&&document.querySelectorAll('#asks .bookrow').length>=5&&document.querySelector('#liveRail #rwaTargetOrderTicket'),{timeout:15000});
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
      globalNav:[...document.querySelectorAll('.topnav [data-v5-global]')].map(x=>x.dataset.v5Global),
      marketNav:[...document.querySelectorAll('#liveRail .rwa-v5-market-nav>button[data-v5-nav]')].map(x=>x.dataset.v5Nav),
      bottomTabs:[...document.querySelectorAll('#rwaV5Bottom [data-v5-bottom]')].map(x=>x.dataset.v5Bottom),
      leftTabs:[...document.querySelectorAll('.rwa-v5-left-tabs [data-v5-left]')].map(x=>x.dataset.v5Left),
      ticketInside:!!document.querySelector('#liveRail #rwaTargetOrderTicket'),
      layout:rect('.layout'),left:rect('.left'),main:rect('.main'),book:rect('.right'),trade:rect('#liveRail'),bottom:rect('#rwaV5Bottom'),footer:rect('#rwaV5Footer')
    };
  });
  assert.equal(info.pairs,520);
  assert.ok(info.rows<=140);
  assert.ok(info.asks>=5&&info.bids>=5);
  assert.ok(info.overflow<=2);
  assert.equal(info.commerce,false);
  assert.equal(info.mock,false);
  assert.equal(info.brand,'Real World Asset');
  assert.deepEqual(info.globalNav,['markets']);
  assert.deepEqual(info.marketNav,['trade','portfolio','orders','analytics','rewards','more']);
  assert.equal(await page.locator('.topnav [data-v5-nav]').count(),0);
  assert.deepEqual(info.bottomTabs,['positions','orders','holders','feed','analytics','thesis','history']);
  assert.deepEqual(info.leftTabs,['watchlist','feed','pulse','live']);
  assert.equal(info.ticketInside,true);
  assert.ok(Math.abs(info.left.w-238)<=3);
  assert.ok(Math.abs(info.book.w-250)<=3);
  assert.ok(Math.abs(info.trade.w-300)<=3);
  assert.ok(Math.abs(info.bottom.h-220)<=3);
  assert.ok(Math.abs(info.footer.h-28)<=2);
  assert.equal(await locationHash(page),'#markets');

  await page.locator('#liveRail .rwa-v5-market-nav>button[data-v5-nav="more"]').click();await page.locator('#liveRail [data-v5-more-menu] [data-v5-nav="discover"]').click();await page.waitForTimeout(40);
  assert.match(await page.locator('[data-v5-bottom-body]').innerText(),/Top movers|Top volume/i);
  await page.locator('#liveRail .rwa-v5-market-nav>button[data-v5-nav="analytics"]').click();await page.waitForTimeout(40);
  assert.match(await page.locator('[data-v5-bottom-body]').innerText(),/LIVE PAIRS|RWA-LINKED/i);
  await page.locator('#liveRail .rwa-v5-market-nav>button[data-v5-nav="rewards"]').click();await page.waitForTimeout(40);
  assert.match(await page.locator('[data-v5-bottom-body]').innerText(),/INACTIVE|No verified rewards|Rewards ledger unavailable|LOCKED/i);

  await page.locator('#liveRail .rwa-v5-market-nav>button[data-v5-nav="trade"]').click();
  await page.locator('.rwa-v5-side-switch [data-v5-side="SELL"]').click();
  assert.equal(await page.locator('#rwaTargetOrderTicket').getAttribute('data-v5-side'),'SELL');
  await page.locator('.rwa-v5-side-switch [data-v5-side="BUY"]').click();
  await page.locator('#rwaTargetOrderTicket [data-live-mode="STOP"]').click();
  assert.ok(await page.locator('#rwaTargetOrderTicket [data-live-mode="STOP"]').evaluate(el=>el.classList.contains('active')));
  assert.equal(await page.locator('#rwaTargetOrderTicket [data-order-side="BUY"] [data-live-price]').isDisabled(),false);
  await page.locator('#rwaTargetOrderTicket [data-live-mode="MARKET"]').click();
  await page.locator('#asks .bookrow').last().click();
  assert.ok(await page.locator('#rwaTargetOrderTicket [data-live-mode="LIMIT"]').evaluate(el=>el.classList.contains('active')));
  assert.ok(Number(await page.locator('#rwaTargetOrderTicket [data-order-side="BUY"] [data-live-price]').inputValue())>0);

  await page.locator('.rwa-v5-left-tabs [data-v5-left="pulse"]').click();
  assert.match(await page.locator('[data-v5-left-pane="pulse"]').innerText(),/Top Movers/i);
  await page.locator('#rwaV5Bottom [data-v5-bottom="holders"]').click();
  await page.waitForFunction(()=>/SOURCE GATED|VERIFIED|NEEDS HOLDER BACKEND|NEEDS AUTHORITATIVE SOURCE|Holder source not configured|Holders data unavailable/i.test(document.querySelector('[data-v5-bottom-body]')?.innerText||''),{timeout:8000});
  assert.match(await page.locator('[data-v5-bottom-body]').innerText(),/SOURCE GATED|VERIFIED|NEEDS HOLDER BACKEND|NEEDS AUTHORITATIVE SOURCE|Holder source not configured|Holders data unavailable/i);
  await page.locator('#rwaV5Bottom [data-v5-bottom="thesis"]').click();
  await page.locator('[data-v5-thesis-text]').fill('Deterministic local thesis');
  await page.locator('[data-v5-thesis-publish]').click();
  await page.waitForFunction(()=>/Deterministic local thesis/.test(document.querySelector('[data-v5-bottom-body]')?.innerText||''),{timeout:3000});
  assert.match(await page.locator('[data-v5-bottom-body]').innerText(),/Deterministic local thesis/);

  const search=page.locator('#rwaV5GlobalSearch input');await search.fill('T250');await page.waitForTimeout(40);
  assert.ok(await page.locator('#rwaV5GlobalSearch [data-v5-symbol="T250USDT"]').count());
  await search.fill('');

  assert.equal(errors.length,0,`desktop page errors: ${errors.join(' | ')}`);
  await context.close();return info;
}
async function locationHash(page){return await page.evaluate(()=>location.hash)}
async function mobile(browser,width,height){
  const {context,page,errors}=await open(browser,width,height);
  let x=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,mode:document.body.dataset.v5MobileMode,chart:getComputedStyle(document.querySelector('.chart-wrap')).display,mini:getComputedStyle(document.querySelector('#rwaV5MiniBook')).display,book:getComputedStyle(document.querySelector('.right')).display,trade:getComputedStyle(document.querySelector('#liveRail')).display}));
  assert.ok(x.overflow<=2,`mobile overflow ${x.overflow}`);
  assert.equal(x.mode,'chart');assert.notEqual(x.chart,'none');assert.notEqual(x.mini,'none');assert.equal(x.book,'none');assert.equal(x.trade,'none');
  await page.locator('.rwa-v5-mobile-worktabs [data-v5-mobile-mode="book"]').click();await page.waitForTimeout(30);
  x=await page.evaluate(()=>({mode:document.body.dataset.v5MobileMode,book:getComputedStyle(document.querySelector('.right')).display,chart:getComputedStyle(document.querySelector('.chart-wrap')).display}));
  assert.equal(x.mode,'book');assert.notEqual(x.book,'none');assert.equal(x.chart,'none');
  await page.locator('.rwa-v5-mobile-worktabs [data-v5-mobile-mode="trade"]').click();await page.waitForTimeout(30);
  x=await page.evaluate(()=>({mode:document.body.dataset.v5MobileMode,trade:getComputedStyle(document.querySelector('#liveRail')).display,ticket:!!document.querySelector('#liveRail #rwaTargetOrderTicket')}));
  assert.equal(x.mode,'trade');assert.notEqual(x.trade,'none');assert.equal(x.ticket,true);
  await page.locator('.rwa-v5-mobile-worktabs [data-v5-mobile-mode="feed"]').click();assert.ok(await page.locator('#rwaV5MobileFeed').isVisible());
  await page.locator('.rwa-v5-mobile-worktabs [data-v5-action="open-markets"]').click();assert.ok(await page.locator('.left').isVisible());
  await page.locator('[data-v5-action="close-markets"]').click();
  await page.locator('.rwa-v5-mobile-worktabs [data-v5-mobile-mode="trade"]').click();
  await page.locator('#liveRail .rwa-v5-market-nav>button[data-v5-nav="portfolio"]').click();assert.ok(await page.locator('#rwaV5Bottom').isVisible());
  assert.equal(await page.locator('.mobile-tabs [data-v5-mobile-nav],.topnav [data-v5-nav]').count(),0);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert.ok(overflow<=2);
  assert.equal(errors.length,0,`mobile page errors: ${errors.join(' | ')}`);
  await context.close();return x;
}
const browser=await chromium.launch({headless:true});
try{
  const result={desktop:await desktop(browser),mobile390:await mobile(browser,390,844),mobile430:await mobile(browser,430,932)};
  console.log(JSON.stringify({ok:true,contract:'rwa-terminal-v5-stability',result},null,2));
}finally{await browser.close()}
