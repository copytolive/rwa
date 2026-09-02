import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base=process.env.RWA_UI_URL||'http://127.0.0.1:4173/rwa/';
const proof=process.env.RWA_UI_PROOF_DIR||'proof/live-no-mock';
const publicMode=/^https:\/\//i.test(base);
await mkdir(proof,{recursive:true});

const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:1672,height:941},deviceScaleFactor:1,serviceWorkers:'block'});
const page=await ctx.newPage();
const failures=[],pageErrors=[],failedResponses=[];
const fail=(message,detail=null)=>failures.push({message,detail});
page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));
page.on('response',res=>{if(res.status()>=400&&/copytolive\.github\.io|127\.0\.0\.1/.test(res.url()))failedResponses.push({url:res.url(),status:res.status()})});

const rect=async sel=>page.locator(sel).first().evaluate(el=>{const r=el.getBoundingClientRect();return{left:Math.round(r.left),top:Math.round(r.top),right:Math.round(r.right),bottom:Math.round(r.bottom),width:Math.round(r.width),height:Math.round(r.height)}}).catch(()=>null);
const close=(a,b,t=3)=>Math.abs(Number(a)-Number(b))<=t;

try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:50000});
  await page.waitForFunction(()=>window.RWALiveHome?.audit?.().ready===true&&window.RWAMarketRuntime?.state?.().pairs?.length>50,{timeout:35000});
  await page.waitForFunction(()=>document.querySelector('#statPrice')?.textContent&&document.querySelector('#statPrice').textContent!=='—',{timeout:30000});
  await page.waitForFunction(()=>document.querySelectorAll('#bids .bookrow').length>0&&document.querySelectorAll('#asks .bookrow').length>0,{timeout:30000});
  await page.waitForFunction(()=>document.querySelector('#rwaTargetOrderTicket')&&document.querySelector('#rwaTargetMarketCard'),{timeout:15000});
  await page.waitForFunction(()=>document.body.classList.contains('rwa-seablueprint-commerce-open')&&document.querySelector('#rwaCommerceDock')?.classList.contains('open'),{timeout:20000});
  await page.waitForTimeout(700);

  const data=await page.evaluate(()=>({
    price:document.querySelector('#statPrice')?.textContent||'',
    selected:document.querySelector('#selName')?.textContent||'',
    pairs:window.RWAMarketRuntime?.state?.().pairs?.length||0,
    bids:document.querySelectorAll('#bids .bookrow').length,
    asks:document.querySelectorAll('#asks .bookrow').length,
    home:window.RWALiveHome?.audit?.()||null,
    card:document.querySelector('#rwaTargetMarketCard')?.textContent||'',
    ticket:document.querySelector('#rwaTargetOrderTicket')?.textContent||'',
    depth:document.querySelector('.rwa-live-depth-meter')?.textContent||'',
    commerce:document.querySelector('#rwaShopBody')?.innerText||'',
    body:document.body.innerText,
    screenshotRoot:!!document.querySelector('#rwaScreenshotParity'),
    screenshotApi:!!window.RWAScreenshotToCodeParity,
    rootRenko:/renko/i.test(document.querySelector('body')?.innerHTML||''),
    rootNext:/\/rwa\/_next\//i.test(document.documentElement.innerHTML)
  }));

  const banned=['$9.87T','Marina Bay Residences Token','Blue Ocean Shipping Note','Phuket Seaview Villas Token','2,315.00 USDC','B 56%','44% S','UI PREVIEW'];
  const visibleBanned=banned.filter(s=>data.body.includes(s));
  if(visibleBanned.length)fail('mock literals visible',visibleBanned);
  if(data.screenshotRoot||data.screenshotApi)fail('screenshot/mock renderer present',{root:data.screenshotRoot,api:data.screenshotApi});
  if(data.rootRenko)fail('RENKO leaked into HOME');
  if(data.rootNext)fail('removed Next.js blue UI leaked into HOME');
  if(data.pairs<50)fail('live market universe missing',data.pairs);
  if(!/^\$/.test(data.price))fail('live BTC price missing',data.price);
  if(data.bids<1||data.asks<1)fail('live order book missing',{bids:data.bids,asks:data.asks});
  if(!data.card.includes('RWA-LINKED 24H VOLUME'))fail('live RWA volume card missing',data.card);
  if(!data.ticket.includes('Hyperliquid Testnet')||!data.ticket.includes('Real testnet execution'))fail('real Hyperliquid execution ticket missing',data.ticket);
  if(data.home?.backendConnected===false){
    if(data.home.verifiedStores!==0||data.home.liveProducts!==0)fail('commerce fabricated records while backend offline',data.home);
    if(!/No backend is configured|OFFLINE|No verified stores/i.test(data.commerce))fail('commerce offline truth not visible',data.commerce);
  }
  if(/56%/.test(data.depth)&&/44%/.test(data.depth)&&data.depth.includes('BUY')&&data.depth.includes('SELL')){
    const s=await page.evaluate(()=>window.RWAMarketRuntime?.state?.());
    const total=Number(s?.buyVol||0)+Number(s?.sellVol||0);
    if(!(total>0))fail('static 56/44 depth meter detected',data.depth);
  }

  const geometry={
    layout:await rect('.layout'),
    left:await rect('.layout>.left'),
    main:await rect('.layout>.main'),
    book:await rect('.layout>.right'),
    commerce:await rect('#rwaCommerceDock'),
    footer:await rect('#rwaGlobalTicker'),
    topbar:await rect('.topbar')
  };
  const want={
    topbar:{left:0,top:0,width:1672,height:59},
    layout:{left:0,top:59,width:1212,height:822},
    left:{left:0,top:59,width:291,height:822},
    main:{left:291,top:59,width:682,height:822},
    book:{left:973,top:59,width:239,height:822},
    commerce:{left:1212,top:59,width:460,height:822},
    footer:{left:0,top:881,width:1672,height:60}
  };
  for(const [key,w] of Object.entries(want)){
    const g=geometry[key];
    if(!g){fail('geometry element missing '+key);continue}
    for(const p of ['left','top','width','height'])if(!close(g[p],w[p],4))fail('geometry mismatch '+key+'.'+p,{want:w[p],got:g[p],full:g});
  }

  const eth=page.locator('.pairrow').filter({hasText:'ETH / USDT'}).first();
  if(await eth.count()){
    await eth.click();
    await page.waitForFunction(()=>document.querySelector('#selName')?.textContent?.includes('ETH'),{timeout:10000});
    await page.waitForFunction(()=>document.querySelectorAll('#bids .bookrow').length>0,{timeout:10000});
  }else fail('ETH live market row unavailable');

  const tf=page.locator('#timeframes button[data-iv="60"]').first();
  if(await tf.count()){
    await tf.click();
    await page.waitForTimeout(250);
    if(!(await tf.evaluate(el=>el.classList.contains('active'))))fail('1H timeframe interaction failed');
  }

  const limit=page.locator('#rwaTargetOrderTicket [data-live-mode="LIMIT"]').first();
  if(await limit.count()){
    await limit.click();
    const enabled=await page.locator('#rwaTargetOrderTicket [data-live-price]').evaluate(el=>!el.disabled);
    if(!enabled)fail('Limit order input did not activate');
  } else fail('Limit order control missing');

  const products=page.locator('[data-live-ecom-tab="products"]').first();
  if(await products.count()){await products.click();await page.waitForTimeout(100)} else fail('live Products tab missing');
  const cart=page.locator('[data-live-ecom-tab="cart"]').first();
  if(await cart.count()){await cart.click();await page.waitForTimeout(100)} else fail('live Cart tab missing');
  const stores=page.locator('[data-live-ecom-tab="stores"]').first();
  if(await stores.count()){await stores.click();await page.waitForTimeout(100)} else fail('live Stores tab missing');

  const help=page.locator('[data-live-top-action="help"]').first();
  if(await help.count()){
    await help.click();
    await page.waitForTimeout(100);
    const open=await page.locator('#rwaLiveHelp').evaluate(el=>el.classList.contains('open')).catch(()=>false);
    const copy=await page.locator('#rwaLiveHelp').innerText().catch(()=>'');
    if(!open||!/HYPERLIQUID TESTNET/.test(copy)||!/MARKET DATA/.test(copy))fail('Help control did not open live status',copy);
    await page.locator('[data-live-help-close]').click();
  }else fail('Help control missing');

  const theme=page.locator('[data-live-top-action="theme"]').first();
  if(await theme.count()){
    const before=await page.evaluate(()=>document.documentElement.classList.contains('rwa-live-dim'));
    await theme.click();await page.waitForTimeout(60);
    const after=await page.evaluate(()=>document.documentElement.classList.contains('rwa-live-dim'));
    if(after===before)fail('Theme control did not change display mode');
    await theme.click();
  }else fail('Theme control missing');

  const amount=page.locator('#rwaTargetOrderTicket [data-live-amount]').first();
  const buy=page.locator('#rwaTargetOrderTicket [data-live-trade="BUY"]').first();
  if(await amount.count()&&await buy.count()){
    await amount.fill('0.001');
    await buy.click();
    await page.waitForFunction(()=>{const t=document.querySelector('#rwaTargetOrderTicket .rwa-target-trade-note')?.textContent||'';return !/Checking wallet/.test(t)&&!/Real testnet execution/.test(t)},{timeout:10000}).catch(()=>{});
    const note=await page.locator('#rwaTargetOrderTicket .rwa-target-trade-note').innerText();
    if(/accepted by protected|Order accepted/i.test(note))fail('Execution unexpectedly succeeded without a wallet',note);
    if(!/wallet|EVM|provider|connect/i.test(note))fail('Execution did not fail closed without wallet',note);
  }else fail('Buy execution control missing');

  if(pageErrors.length)fail('page errors',pageErrors);
  if(failedResponses.length)fail('same-origin failed responses',failedResponses);
  await page.screenshot({path:`${proof}/live-no-mock-1672x941.png`,fullPage:false});
  await writeFile(`${proof}/audit.json`,JSON.stringify({data,geometry,pageErrors,failedResponses},null,2));
}catch(e){
  fail('unexpected failure',String(e?.stack||e));
  try{await page.screenshot({path:`${proof}/failure.png`,fullPage:false})}catch{}
}
await browser.close();
const out={ok:failures.length===0,contract:'rwa-live-no-mock-home-v2',base,publicMode,failures};
await writeFile(`${proof}/browser-result.json`,JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
if(!out.ok)process.exit(1);
