#!/usr/bin/env node
import {chromium} from 'playwright';
const base=process.env.BASE_URL||'http://127.0.0.1:8000/';
async function run(viewport){const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport});
 await page.route('**/api/v3/exchangeInfo',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({symbols:[{symbol:'BTCUSDT',status:'TRADING',baseAsset:'BTC',quoteAsset:'USDT',isSpotTradingAllowed:true},{symbol:'ETHUSDT',status:'TRADING',baseAsset:'ETH',quoteAsset:'USDT',isSpotTradingAllowed:true}]})}));
 await page.route('**/api/v3/ticker/24hr',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{symbol:'BTCUSDT',lastPrice:'65000',openPrice:'64000',priceChangePercent:'1.56',highPrice:'66000',lowPrice:'63000',quoteVolume:'1000000000'},{symbol:'ETHUSDT',lastPrice:'3500',openPrice:'3450',priceChangePercent:'1.44',highPrice:'3550',lowPrice:'3400',quoteVolume:'500000000'}])}));
 await page.route('**/api/v3/klines**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([[Date.now()-60000,'64000','65000','63500','64800','10'],[Date.now(),'64800','65500','64500','65000','12']])}));
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.RWAGlobalAssetTerminal?.runtime==='global-asset-terminal-v1',{timeout:15000});
 const pathname=await page.evaluate(()=>location.pathname);if(!pathname.endsWith('/rwa/')&&!pathname.endsWith('/'))throw new Error(`canonical root moved: ${pathname}`);
 if(viewport.width<681){await page.locator('[data-mobile-nav="markets"]').click();await page.waitForFunction(()=>document.body.classList.contains('market-drawer-open'));}
 const stock=page.locator('[data-filter="stocks"]');await stock.waitFor({state:'visible'});await stock.click();await page.waitForSelector('[data-stock-id="US-XNAS-AAPL"]',{state:'visible',timeout:10000});
 const tf=await page.locator('#stockTfBadge').textContent();if(!/10M ONLY/.test(tf||''))throw new Error('10m-only badge missing');
 await page.locator('[data-stock-id="US-XNAS-AAPL"]').click();await page.waitForFunction(()=>window.RWAGlobalAssetTerminal?.state?.active==='US-XNAS-AAPL');
 const name=await page.locator('#selName').textContent();if(!/AAPL/.test(name||''))throw new Error('stock selection failed');
 const status=await page.locator('#liveText').textContent();if(!/STOCK · 10M/.test(status||''))throw new Error(`stock data status missing: ${status}`);
 const topBadge=await page.locator('.verified-badge').first().textContent();if(/\bLIVE\b/.test(topBadge||''))throw new Error(`source-gated stock falsely labelled LIVE: ${topBadge}`);if(!/SOURCE GATED|DELAYED|EOD|UNAVAILABLE/.test(topBadge||''))throw new Error(`stock source badge missing: ${topBadge}`);
 const gated=await page.locator('#globalStockSnapshotBody').textContent();if(!/SOURCE GATED|REGULATOR FILED/.test(gated||''))throw new Error('fail-closed fundamentals state missing');
 if(await page.locator('.order-section').isVisible())throw new Error('unlicensed stock order book must be hidden');
 const urlAfter=page.url();if(new URL(urlAfter).pathname!==pathname)throw new Error('stock mode navigated away from canonical root');
 const fbtn=page.locator('.rwa-fundamentals-trigger').first();if(await fbtn.count()&&await fbtn.isVisible()){await fbtn.click();await page.waitForSelector('#globalStockFundamentals.open');const txt=await page.locator('#globalStockFundBody').textContent();if(!/No regulator-backed fundamentals|Revenue/.test(txt||''))throw new Error('stock fundamentals overlay failed');await page.locator('#globalStockFundamentals header button').click();}
 if(viewport.width<681){await page.evaluate(()=>document.querySelector('[data-filter="crypto"]')?.click());}else{const crypto=page.locator('[data-filter="crypto"]');await crypto.waitFor({state:'visible'});await crypto.click();}
 await page.waitForFunction(()=>window.RWAGlobalAssetTerminal?.state?.mode==='crypto');if(await page.locator('#stockTfBadge').isVisible())throw new Error('10m badge leaked into crypto mode');
 const cryptoBadge=await page.locator('.verified-badge').first().textContent();if(!/\bLIVE\b/.test(cryptoBadge||''))throw new Error(`crypto LIVE badge not restored: ${cryptoBadge}`);if(!(await page.locator('.order-section').isVisible()))throw new Error('crypto order book not restored');
 if(new URL(page.url()).pathname!==pathname)throw new Error('crypto restore navigated away from canonical root');await browser.close()}
await run({width:1440,height:1000});await run({width:390,height:844});console.log('GLOBAL ASSET TERMINAL DESKTOP + MOBILE PASS');
