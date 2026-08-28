import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const url=process.env.RWA_MARKETPLACE_URL||'http://127.0.0.1:4173/rwa/marketplace-v2.html';
const proof=process.env.RWA_PROOF_DIR||'proof/marketplace-v7';
await mkdir(proof,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
page.on('dialog',d=>d.dismiss().catch(()=>{}));
await page.route('https://li.quest/v1/tokens**',async route=>{
  const tokens={};
  for(const id of ['1','42161','8453','56','137','43114','143','1151111081099710'])tokens[id]=[
    {address:id==='1151111081099710'?'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v':'0x0000000000000000000000000000000000000001',chainId:Number(id),symbol:'USDC',coinKey:'USDC',name:'USD Coin',decimals:6,priceUSD:'1',tags:['stablecoin']},
    {address:id==='1151111081099710'?'So11111111111111111111111111111111111111112':'0x0000000000000000000000000000000000000002',chainId:Number(id),symbol:id==='1151111081099710'?'SOL':'WETH',coinKey:id==='1151111081099710'?'SOL':'ETH',name:id==='1151111081099710'?'Solana':'Wrapped Ether',decimals:id==='1151111081099710'?9:18,priceUSD:id==='1151111081099710'?'150':'3500'}
  ];
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({tokens})});
});
await page.goto(url,{waitUntil:'networkidle'});
await page.waitForFunction(()=>document.getElementById('tokenCount')?.textContent!=='—');
const initial=await page.evaluate(()=>({
  tokenCount:document.getElementById('tokenCount')?.textContent,
  networkCount:document.getElementById('networkCount')?.textContent,
  tokenRows:document.querySelectorAll('.token-row').length,
  executeDisabled:document.getElementById('executeRoute')?.disabled,
  launch:document.getElementById('launchState')?.textContent,
  universe:window.RWAMarketUniverse?.snapshot?.(),
  policy:window.RWATradeProtection?.policy
}));
if(Number(String(initial.tokenCount).replace(/,/g,''))<8)throw Error('dynamic token universe did not load');
if(Number(initial.networkCount)<8)throw Error('route network coverage narrowed');
if(initial.tokenRows<1)throw Error('token rows missing');
if(initial.executeDisabled!==true)throw Error('mainnet execution must remain locked without readiness');
await page.fill('#tokenSearch','USDC');
await page.waitForTimeout(50);
const searchRows=await page.locator('.token-row').count();if(searchRows<4)throw Error('cross-chain token search did not return provider-listed USDC');
const risk=await page.evaluate(()=>{
  const mk=(fromUSD,toUSD,createdAt=Date.now())=>({action:{toToken:{symbol:'USDC',decimals:6}},estimate:{toAmount:'1000000',toAmountMin:'995000',fromAmountUSD:String(fromUSD),toAmountUSD:String(toUSD)},__rwa:{createdAt}});
  return{
    pass:RWATradeProtection.assess(mk(100,99.5)),
    ack:RWATradeProtection.assess(mk(100,96)),
    block:RWATradeProtection.assess(mk(100,89)),
    stale:RWATradeProtection.assess(mk(100,99.5,Date.now()-60000))
  }
});
if(risk.pass.hardBlocked)throw Error('normal quote incorrectly blocked');
if(!risk.ack.requiresAck)throw Error('3%+ impact must require acknowledgement');
if(!risk.block.hardBlocked)throw Error('10%+ impact must hard block');
if(!risk.stale.hardBlocked)throw Error('stale quote must hard block');
await page.click('[data-tab="marketplace"]');
await page.waitForFunction(()=>document.getElementById('marketplacePanel')?.classList.contains('active'));
const marketplace=await page.evaluate(()=>({seller:document.getElementById('sellerCount')?.textContent,products:document.getElementById('productCount')?.textContent,checkout:document.getElementById('checkoutState')?.textContent,blueprints:document.querySelectorAll('.blueprint-card').length}));
if(marketplace.seller!=='0'||marketplace.products!=='0')throw Error('unverified sellers/products surfaced as live');
if(marketplace.checkout!=='LOCKED')throw Error('checkout must be locked without production backend/payment');
if(marketplace.blueprints<1)throw Error('marketplace blueprint surface missing');
await page.screenshot({path:`${proof}/desktop.png`,fullPage:true});
const result={contract:'rwa-marketplace-v2-browser-v1',url,ok:errors.length===0,initial,searchRows,risk:{pass:risk.pass.level,ack:risk.ack.level,block:risk.block.level,stale:risk.stale.level},marketplace,errors};
await writeFile(`${proof}/result.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
await browser.close();
if(errors.length)process.exit(1);
