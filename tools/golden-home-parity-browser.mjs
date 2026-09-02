import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base=process.env.RWA_UI_URL||'http://127.0.0.1:4173/rwa/';
const proof=process.env.RWA_UI_PROOF_DIR||'proof/golden-home';
const publicMode=/^https:\/\//i.test(base);
await mkdir(proof,{recursive:true});
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:1672,height:941},deviceScaleFactor:1,serviceWorkers:'block'});
const page=await ctx.newPage();
const failures=[],errors=[];
page.on('pageerror',e=>errors.push(String(e?.message||e)));
const fail=(message,detail=null)=>failures.push({message,detail});
const rect=async sel=>page.locator(sel).evaluate(el=>{const r=el.getBoundingClientRect();return{left:Math.round(r.left),top:Math.round(r.top),width:Math.round(r.width),height:Math.round(r.height)}}).catch(()=>null);
try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:publicMode?50000:30000});
  await page.waitForFunction(()=>window.RWAGoldenHome?.audit?.().ready===true&&window.RWAScreenshotToCodeParity?.audit?.().open===true,{timeout:publicMode?30000:15000});
  const want={'.stc-stage':[0,0,1672,941],'.stc-top':[0,0,1672,59],'.stc-left':[0,59,291,822],'.stc-center':[291,59,682,822],'.stc-book':[973,59,239,822],'.stc-ecom':[1212,59,460,822],'.stc-footer':[0,881,1672,60]};
  for(const [sel,[left,top,width,height]] of Object.entries(want)){
    const got=await rect(sel);
    if(!got||Math.abs(got.left-left)>1||Math.abs(got.top-top)>1||Math.abs(got.width-width)>1||Math.abs(got.height-height)>1)fail('geometry '+sel,{want:{left,top,width,height},got});
  }
  const copy=await page.evaluate(()=>({
    brand:document.querySelector('.stc-brand b')?.textContent.trim(),
    market:document.querySelector('.stc-instr-copy b')?.textContent.trim(),
    store:document.querySelector('.stc-store h3')?.textContent.trim(),
    cart:document.querySelector('.stc-carthead')?.textContent.trim(),
    inpage:document.querySelector('.stc-commerce-pill')?.textContent.replace(/\s+/g,' ').trim(),
    audit:window.RWAGoldenHome.audit()
  }));
  if(copy.brand!=='RWA × Seablueprint')fail('brand mismatch',copy.brand);
  if(copy.market!=='BTC/USDT ☆')fail('market mismatch',copy.market);
  if(!copy.store?.includes('Seablue Estate Marketplace'))fail('store mismatch',copy.store);
  if(!copy.cart?.includes('2,315.00 USDC'))fail('cart mismatch',copy.cart);
  if(!/IN-PAGE COMMERCE/.test(copy.inpage||''))fail('commerce pill mismatch',copy.inpage);
  if(copy.audit.renkoInRoot)fail('RENKO leaked into HOME');
  if(copy.audit.nextInRoot)fail('Next.js blue UI leaked into HOME');

  await page.locator('[data-stc-watch="ETH/USDT"]').click();
  let state=await page.evaluate(()=>window.RWAScreenshotToCodeParity.state());
  if(state.watch!=='ETH/USDT')fail('watchlist interaction failed',state);
  await page.locator('[data-stc-watch="BTC/USDT"]').click();

  await page.locator('[data-stc-tf="15m"]').click();
  state=await page.evaluate(()=>window.RWAScreenshotToCodeParity.state());
  if(state.tf!=='15m')fail('timeframe interaction failed',state);
  await page.locator('[data-stc-tf="1H"]').click();

  await page.locator('[data-stc-mode="Market"]').click();
  state=await page.evaluate(()=>window.RWAScreenshotToCodeParity.state());
  if(state.orderMode!=='Market')fail('order-mode interaction failed',state);
  await page.locator('[data-stc-mode="Limit"]').click();

  await page.locator('[data-stc-etab="products"]').click();
  state=await page.evaluate(()=>window.RWAScreenshotToCodeParity.state());
  if(state.ecomTab!=='products')fail('Products tab failed',state);
  await page.locator('[data-stc-etab="cart"]').click();
  state=await page.evaluate(()=>window.RWAScreenshotToCodeParity.state());
  if(state.ecomTab!=='cart')fail('Cart tab failed',state);
  await page.locator('[data-stc-etab="stores"]').click();
  await page.locator('[data-stc-action="view-store"]').click();
  state=await page.evaluate(()=>window.RWAScreenshotToCodeParity.state());
  if(state.detail!=='store')fail('View Store failed',state);
  await page.locator('[data-stc-action="back"]').click();

  await page.screenshot({path:`${proof}/production-1672x941.png`,fullPage:false});
  if(errors.length)fail('page errors',errors);
}catch(e){fail('unexpected failure',String(e?.stack||e))}
await browser.close();
const out={ok:failures.length===0,contract:'rwa-golden-home-production-v1',base,publicMode,failures};
await writeFile(`${proof}/browser-result.json`,JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
if(!out.ok)process.exit(1);
