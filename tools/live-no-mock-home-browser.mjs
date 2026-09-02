import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base=process.env.RWA_UI_URL||'http://127.0.0.1:4173/rwa/';
const proof=process.env.RWA_UI_PROOF_DIR||'proof/trading-multichain';
const publicMode=/^https:\/\//i.test(base);
await mkdir(proof,{recursive:true});
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:1672,height:941},deviceScaleFactor:1,serviceWorkers:'block'});
const page=await ctx.newPage();
const failures=[],errors=[];
const fail=(message,detail=null)=>failures.push({message,detail});
page.on('pageerror',e=>errors.push(String(e?.message||e)));
const rect=async sel=>page.locator(sel).first().evaluate(el=>{const r=el.getBoundingClientRect();return{left:Math.round(r.left),top:Math.round(r.top),width:Math.round(r.width),height:Math.round(r.height)}}).catch(()=>null);
const close=(a,b,t=5)=>Math.abs(Number(a)-Number(b))<=t;

try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:publicMode?50000:30000});
  await page.waitForFunction(()=>window.RWALiveHome?.audit?.().ready===true,{timeout:20000});
  await page.waitForFunction(()=>window.RWAMarketRuntime?.state?.().pairs?.length>50,{timeout:30000});
  await page.waitForFunction(()=>document.querySelector('#statPrice')?.textContent&&document.querySelector('#statPrice').textContent!=='—',{timeout:30000});
  await page.waitForFunction(()=>document.querySelectorAll('#bids .bookrow').length>0&&document.querySelectorAll('#asks .bookrow').length>0,{timeout:30000});
  await page.waitForFunction(()=>document.querySelector('#rwaTargetOrderTicket'),{timeout:15000});

  const data=await page.evaluate(()=>({
    body:document.body.innerText,
    html:document.documentElement.innerHTML,
    price:document.querySelector('#statPrice')?.textContent||'',
    pairs:window.RWAMarketRuntime?.state?.().pairs?.length||0,
    bids:document.querySelectorAll('#bids .bookrow').length,
    asks:document.querySelectorAll('#asks .bookrow').length,
    chart:!!document.querySelector('#fallbackChart')&&!!document.querySelector('#tvHost'),
    ticket:document.querySelector('#rwaTargetOrderTicket')?.innerText||'',
    home:window.RWALiveHome?.audit?.()||null,
    nav:[...document.querySelectorAll('.topnav [data-rwa-target-nav]')].map(x=>x.dataset.rwaTargetNav),
    multichainButton:!!document.querySelector('#rwaMultiChainLaunch'),
    commerceNodes:document.querySelectorAll('[id*="Commerce"],[id*="Shop"],[data-rwa-shop]').length
  }));
  if(/seablueprint|ecommerce|in-page commerce/i.test(data.body))fail('removed ecommerce UI is visible');
  if(/rwa-seablueprint-commerce-bridge/i.test(data.html))fail('removed Seablueprint bridge is still wired');
  if(data.commerceNodes)fail('commerce DOM remains',data.commerceNodes);
  if(data.pairs<50)fail('live market universe missing',data.pairs);
  if(!/^\$/.test(data.price))fail('live market price missing',data.price);
  if(data.bids<1||data.asks<1)fail('live order book missing',{bids:data.bids,asks:data.asks});
  if(!data.chart)fail('chart runtime missing');
  if(!/Hyperliquid Testnet/.test(data.ticket)||!/Mainnet locked/.test(data.ticket))fail('trading ticket status is not truthful',data.ticket);
  if(!data.multichainButton)fail('MULTI CHAIN launcher missing');
  if(data.nav.join('|')!=='markets|intelligence|portfolio|orders|reports')fail('trading-only nav mismatch',data.nav);

  const g={topbar:await rect('.topbar'),layout:await rect('.layout'),left:await rect('.layout>.left'),main:await rect('.layout>.main'),right:await rect('.layout>.right'),footer:await rect('#rwaGlobalTicker')};
  const want={topbar:{left:0,top:0,width:1672,height:59},layout:{left:0,top:59,width:1672,height:822},left:{left:0,top:59,width:291,height:822},main:{left:291,top:59,width:1142,height:822},right:{left:1433,top:59,width:239,height:822},footer:{left:0,top:881,width:1672,height:60}};
  for(const [k,w] of Object.entries(want)){const a=g[k];if(!a){fail('missing geometry '+k);continue}for(const p of ['left','top','width','height'])if(!close(a[p],w[p]))fail('geometry mismatch '+k+'.'+p,{want:w[p],got:a[p],full:a})}

  const eth=page.locator('.pairrow').filter({hasText:'ETH / USDT'}).first();
  if(await eth.count()){await eth.click();await page.waitForFunction(()=>document.querySelector('#selName')?.textContent?.includes('ETH'),{timeout:10000})}else fail('ETH market row missing');

  const mc=page.locator('#rwaMultiChainLaunch');
  await mc.click();
  await page.waitForFunction(()=>window.RWAMultiChain?.status?.().open===true,{timeout:15000});
  const mcs=await page.evaluate(()=>({status:window.RWAMultiChain.status(),buttons:document.querySelectorAll('#rwaMultiChainPanel [data-rwa-chain]').length,text:document.querySelector('#rwaMultiChainPanel')?.innerText||''}));
  if(mcs.buttons!==9)fail('MULTI CHAIN registry did not render 9 networks',mcs);
  if(!/Hyperliquid/.test(mcs.text)||!/Solana/.test(mcs.text)||!/Arbitrum/.test(mcs.text))fail('MULTI CHAIN network list incomplete',mcs.text);
  await page.locator('#rwaMultiChainPanel .rwa-mc-close').click();

  const amount=page.locator('#rwaTargetOrderTicket [data-live-amount]');
  const buy=page.locator('#rwaTargetOrderTicket [data-live-trade="BUY"]');
  await amount.fill('0.001');await buy.click();await page.waitForTimeout(800);
  const note=await page.locator('#rwaTargetOrderTicket .rwa-target-trade-note').innerText();
  if(/Order accepted/i.test(note))fail('headless user traded without wallet',note);

  if(errors.length)fail('page errors',errors);
  await page.screenshot({path:`${proof}/trading-multichain-1672x941.png`,fullPage:false});
  await writeFile(`${proof}/audit.json`,JSON.stringify({data,g,mcs,note,errors},null,2));
}catch(e){fail('unexpected failure',String(e?.stack||e));try{await page.screenshot({path:`${proof}/failure.png`,fullPage:false})}catch{}}
await browser.close();
const out={ok:failures.length===0,contract:'rwa-trading-multichain-no-ecommerce-v1',base,publicMode,failures};
await writeFile(`${proof}/browser-result.json`,JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
if(!out.ok)process.exit(1);
