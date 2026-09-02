import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base=process.env.RWA_UI_URL||'http://127.0.0.1:4173/rwa/';
const proof=process.env.RWA_UI_PROOF_DIR||'proof/trading-ui-v3';
await mkdir(proof,{recursive:true});
const browser=await chromium.launch({headless:true});
const failures=[],errors=[];const fail=(m,d=null)=>failures.push({message:m,detail:d});
async function ready(page){
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:50000});
  await page.waitForFunction(()=>window.RWALiveHome?.version==='3.0.0'&&window.RWAMarketRuntime?.state?.().pairs?.length>50,{timeout:35000});
  await page.waitForFunction(()=>document.querySelectorAll('#bids .bookrow').length>0&&document.querySelectorAll('#asks .bookrow').length>0,{timeout:30000});
  await page.waitForFunction(()=>document.querySelector('#rwaTargetOrderTicket'),{timeout:15000});
  await page.waitForTimeout(500);
}
async function desktop(){
  const ctx=await browser.newContext({viewport:{width:1672,height:941},deviceScaleFactor:1,serviceWorkers:'block'});
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push('desktop: '+String(e?.message||e)));await ready(page);
  const r=sel=>page.locator(sel).first().evaluate(el=>{const x=el.getBoundingClientRect();return{left:Math.round(x.left),top:Math.round(x.top),width:Math.round(x.width),height:Math.round(x.height)}}).catch(()=>null);
  const data=await page.evaluate(()=>({
    pairs:window.RWAMarketRuntime.state().pairs.length,
    context:!!document.querySelector('#rwaContextBrief'),
    commerce:/seablueprint|ecommerce|in-page commerce/i.test(document.body.innerText),
    orderbookFont:parseFloat(getComputedStyle(document.querySelector('#bids .bookrow')).fontSize),
    pairFont:parseFloat(getComputedStyle(document.querySelector('.pairrow .pairname b')).fontSize),
    navFont:parseFloat(getComputedStyle(document.querySelector('.topnav button')).fontSize),
    chartH:document.querySelector('.chart-wrap')?.getBoundingClientRect().height||0,
    rightW:document.querySelector('.layout>.right')?.getBoundingClientRect().width||0,
    tickerH:document.querySelector('#rwaGlobalTicker')?.getBoundingClientRect().height||0,
    buyAmount:!!document.querySelector('[data-order-side="BUY"] [data-live-amount]'),
    sellAmount:!!document.querySelector('[data-order-side="SELL"] [data-live-amount]'),
    sellCopy:(document.querySelector('[data-order-side="SELL"]')?.innerText||'').includes('Uses amount entered at left'),
    stopDisabled:document.querySelector('.rwa-target-order-modes button[disabled]')?.disabled===true,
    wallet:document.querySelector('.signin')?.textContent||'',
    mc:document.querySelector('#rwaMultiChainLaunch')?.innerText||''
  }));
  if(data.context)fail('AI Insight is still in HOME');
  if(data.commerce)fail('removed commerce is visible');
  if(data.pairs<50)fail('market universe missing',data.pairs);
  if(data.orderbookFont<10)fail('orderbook font below 10px',data.orderbookFont);
  if(data.pairFont<12)fail('watchlist pair font below 12px',data.pairFont);
  if(data.navFont<12)fail('nav font below 12px',data.navFont);
  if(data.chartH<330||data.chartH>435)fail('responsive chart height out of range',data.chartH);
  if(Math.abs(data.rightW-250)>3)fail('orderbook rail must be 250px',data.rightW);
  if(Math.abs(data.tickerH-38)>2)fail('ticker must be 38px',data.tickerH);
  if(!data.buyAmount||!data.sellAmount||data.sellCopy)fail('BUY/SELL independent amounts missing',data);
  if(!data.stopDisabled)fail('unsupported Stop Limit must be disabled');
  if(!/MULTI CHAIN/.test(data.mc)||!/NETWORKS/.test(data.mc))fail('MULTI CHAIN live status missing',data.mc);
  const parity=await page.evaluate(()=>({
    marketCardH:document.querySelector('#rwaTargetMarketCard')?.getBoundingClientRect().height||0,
    logoText:document.querySelector('.brandmark b')?getComputedStyle(document.querySelector('.brandmark b')).display:'missing',
    brandFont:parseFloat(getComputedStyle(document.querySelector('.brandcopy strong')).fontSize),
    priceFont:parseFloat(getComputedStyle(document.querySelector('.price-stat b')).fontSize),
    sliderCount:document.querySelectorAll('[data-live-percent]').length
  }));
  if(parity.marketCardH<220)fail('left live activity card is not reference-height',parity);
  if(parity.logoText!=='none')fail('reference cube logo not active',parity);
  if(parity.brandFont<18)fail('brand typography too small',parity);
  if(parity.priceFont<18)fail('headline price typography too small',parity);
  if(parity.sliderCount!==2)fail('functional percentage sliders missing',parity);

  await page.locator('[data-rwa-target-nav="orders"]').click();await page.waitForSelector('#rwaTradingWorkspace:not([hidden])');
  let txt=await page.locator('#rwaTradingWorkspace').innerText();if(!/Orders/.test(txt)||!/Wallet required|Open orders/.test(txt))fail('Orders does not open real account workspace',txt);await page.locator('[data-workspace-close]').click();
  await page.locator('[data-rwa-target-nav="reports"]').click();await page.waitForSelector('#rwaTradingWorkspace:not([hidden])');
  txt=await page.locator('#rwaTradingWorkspace').innerText();if(!/Trading Report/.test(txt)||!/Wallet required|Hyperliquid/.test(txt))fail('Reports does not open real venue report workspace',txt);await page.locator('[data-workspace-close]').click();

  const before=await page.evaluate(()=>getComputedStyle(document.querySelector('.topbar')).backgroundColor);
  await page.locator('[data-live-top-action="theme"]').click();await page.waitForTimeout(80);
  const after=await page.evaluate(()=>getComputedStyle(document.querySelector('.topbar')).backgroundColor);if(before===after)fail('theme tokens did not change surface',{before,after});await page.locator('[data-live-top-action="theme"]').click();

  await page.locator('#rwaMultiChainLaunch').click();await page.waitForFunction(()=>window.RWAMultiChain?.status?.().open===true,{timeout:15000});await page.waitForFunction(()=>document.querySelectorAll('#rwaMultiChainPanel [data-rwa-chain]').length===9,{timeout:15000});await page.locator('#rwaMultiChainPanel .rwa-mc-close').click();

  const buyBox=page.locator('[data-order-side="BUY"]');await buyBox.locator('[data-live-amount]').fill('0.001');await buyBox.locator('[data-live-trade="BUY"]').click();await page.waitForTimeout(700);
  const note=await page.locator('#rwaTargetOrderTicket .rwa-target-trade-note').innerText();if(/Order accepted/i.test(note))fail('headless execution succeeded without a wallet',note);

  const g={topbar:await r('.topbar'),layout:await r('.layout'),left:await r('.layout>.left'),main:await r('.layout>.main'),right:await r('.layout>.right'),header:await r('.terminal-header'),chart:await r('.chart-wrap'),footer:await r('#rwaGlobalTicker')};
  const vw=await page.evaluate(()=>document.documentElement.clientWidth),vh=941,mainW=vw-290-250;
  const expect={topbar:{left:0,top:0,width:vw,height:59},layout:{left:0,top:59,width:vw,height:vh-59-38},left:{left:0,top:59,width:290,height:vh-59-38},main:{left:290,top:59,width:mainW,height:vh-59-38},right:{left:vw-250,top:59,width:250,height:vh-59-38},header:{left:290,top:59,width:mainW,height:72},footer:{left:0,top:vh-38,width:vw,height:38}};
  for(const [k,w] of Object.entries(expect)){const a=g[k];if(!a){fail('missing geometry '+k);continue}for(const p of Object.keys(w))if(Math.abs(Number(a[p])-Number(w[p]))>3)fail('placement mismatch '+k+'.'+p,{want:w[p],got:a[p],full:a})}
  if(!g.chart||Math.abs(g.chart.top-(59+72))>4)fail('chart must begin below terminal header',g.chart);
  await page.screenshot({path:proof+'/desktop-1672x941.png',fullPage:false});await ctx.close();return{data,g,note};
}
async function mobile(width,height,name){
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block'});const page=await ctx.newPage();page.on('pageerror',e=>errors.push(name+': '+String(e?.message||e)));await ready(page);
  await page.locator('#rwaTargetOrderTicket').scrollIntoViewIfNeeded();await page.waitForTimeout(100);
  const m=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,multichain:!!document.querySelector('#rwaMultiChainLaunch'),ticket:!!document.querySelector('#rwaTargetOrderTicket'),commerce:/seablueprint|ecommerce|in-page commerce/i.test(document.body.innerText),buyH:document.querySelector('[data-order-side="BUY"]>button')?.getBoundingClientRect().height||0,inputH:document.querySelector('[data-order-side="BUY"] label')?.getBoundingClientRect().height||0,ticketDisplay:getComputedStyle(document.querySelector('#rwaTargetOrderTicket')).display}));
  if(m.sw>m.cw+2)fail(name+' horizontal overflow',m);if(!m.multichain||!m.ticket||m.ticketDisplay==='none')fail(name+' core controls missing',m);if(m.commerce)fail(name+' commerce visible');if(m.buyH<44||m.inputH<42)fail(name+' touch targets too small',m);
  await page.locator('#rwaMultiChainLaunch').click();await page.waitForFunction(()=>window.RWAMultiChain?.status?.().open===true,{timeout:15000});const pw=await page.locator('#rwaMultiChainPanel').evaluate(el=>Math.round(el.getBoundingClientRect().width));if(Math.abs(pw-width)>3)fail(name+' MULTI CHAIN width',{width,pw});await page.locator('#rwaMultiChainPanel .rwa-mc-close').click();
  await page.screenshot({path:proof+'/'+name+'.png',fullPage:false});await ctx.close();return m;
}
let audit={};try{audit.desktop=await desktop();audit.mobile390=await mobile(390,844,'mobile-390x844');audit.mobile430=await mobile(430,932,'mobile-430x932')}catch(e){fail('unexpected failure',String(e?.stack||e))}
await browser.close();if(errors.length)fail('page errors',errors);
const out={ok:failures.length===0,contract:'rwa-trading-ui-v3-live-only',base,failures,audit};await writeFile(proof+'/browser-result.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));if(!out.ok)process.exit(1);