import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1672,height:941}});
await page.goto('http://127.0.0.1:4173/rwa/renko/?gold=1&wheelDebug=1',{waitUntil:'domcontentloaded',timeout:120000});
await page.waitForFunction(()=>document.querySelector('#chartHost canvas')&&window.RWARenkoTV?.state?.symbol==='XAUUSD'&&window.RWARenkoGoldWheelPanLock&&window.RWARenkoGoldTotalHistory,{timeout:120000});
await page.fill('#traditionalBox','10');await page.click('[data-apply-method="traditional"]');await page.waitForFunction(()=>RWARenkoTV.settings.method==='traditional'&&Math.abs(Number(RWARenkoTV.state.box)-10)<1e-9,{timeout:60000});
await page.click('#tvLive');await page.waitForTimeout(2200);
const state=()=>page.evaluate(()=>{const t=__RWARenkoChart.timeScale(),o=t.options(),r=t.getVisibleLogicalRange();return{now:performance.now(),barSpacing:Number(o.barSpacing),minBarSpacing:Number(o.minBarSpacing),rightOffset:Number(o.rightOffset),logical:r&&{from:Number(r.from),to:Number(r.to),width:Number(r.to)-Number(r.from)},scrollPosition:Number(t.scrollPosition?.()),prepends:Number(RWARenkoGoldTotalHistory.stats.prepends||0),autoTriggers:Number(RWARenkoGoldTotalHistory.stats.autoTriggers||0),suppressed:Number(RWARenkoGoldTotalHistory.stats.suppressedScrollEvents||0),busy:!!RWARenkoGoldTotalHistory.busy,manualMutation:!!RWARenkoGoldManualViewport?.inHistoryMutation,wheelVersion:RWARenkoGoldWheelPanLock.version,wheelImpl:RWARenkoGoldWheelPanLock.implementation,sizeLock:RWARenkoGoldWheelPanLock.sizeLockSpacing,wheelStats:{...RWARenkoGoldWheelPanLock.stats}}});
const host=await page.locator('#chartHost').boundingBox();await page.mouse.move(host.x+host.width*.55,host.y+host.height*.45);
const rows=[];rows.push({tag:'before',...(await state())});await page.mouse.wheel(-160,80);let last=0;for(const ms of [0,16,50,100,200,400,800,1200,1800,2600,3400]){await page.waitForTimeout(Math.max(0,ms-last));last=ms;rows.push({tag:`t${ms}`,...(await state())})}
console.log('RENKO_WHEEL_DEBUG_TRACE',JSON.stringify(rows));await browser.close();
