import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const URL=process.env.RWA_RENKO_LIVE_URL||'https://narzulalistiqlal.github.io/rwa/renko/';
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(URL,{waitUntil:'domcontentloaded',timeout:35000});
  const started=Date.now();
  await page.waitForFunction(()=>window.LightweightCharts&&window.RWARenkoV9?.version==='9.1.0'&&document.querySelector('#chartEmpty')?.classList.contains('hide'),{timeout:15000});
  const firstInteractiveMs=Date.now()-started;
  await page.waitForFunction(()=>window.RWARenkoV9?.state?.data?.length>0,{timeout:60000});
  await page.waitForFunction(()=>window.RWARenkoV3?.state?.symbols?.length>=500,{timeout:45000});
  await page.waitForFunction(()=>window.RWARenkoV3?.state?.tickCount>0&&Number.isFinite(window.RWARenkoV3?.state?.lastPrice),{timeout:35000});
  const tick=await page.evaluate(()=>({id:RWARenkoV3.state.lastTradeId,t:RWARenkoV3.state.lastTickTime,n:RWARenkoV3.state.tickCount}));
  await page.waitForFunction(b=>RWARenkoV3.state.tickCount>b.n||RWARenkoV3.state.lastTradeId!==b.id||RWARenkoV3.state.lastTickTime>b.t,tick,{timeout:35000});
  await page.waitForFunction(()=>RWARenkoV9.state.data.length>=50,{timeout:90000});
  const initial=await page.evaluate(()=>{const r=RWARenkoV9.chart.timeScale().getVisibleLogicalRange();return{version:RWARenkoV9.version,mode:RWARenkoV9.mode,renderer:RWARenkoV9.renderer,markets:RWARenkoV3.state.symbols.length,feed:document.querySelector('#feedPill b')?.textContent,data:RWARenkoV9.state.data.length,bars:RWARenkoV9.state.bars.length,range:r,width:r?.to-r?.from,host:document.querySelector('#lwcRenkoHost')?.getBoundingClientRect().toJSON(),legacy:getComputedStyle(document.querySelector('.controlbar')).display,source:document.querySelector('#sourceText')?.textContent,text:document.body.innerText,attribution:document.querySelector('.lwc-attribution')?.textContent}});
  assert.equal(initial.version,'9.1.0');assert.equal(initial.mode,'native-lightweight-charts');assert.equal(initial.renderer,'tradingview-lightweight-charts-5.1');assert.ok(initial.markets>=500);assert.match(String(initial.feed),/^LIVE/);assert.ok(initial.data>=50);assert.ok(initial.host.width>800&&initial.host.height>400);assert.equal(initial.legacy,'none');assert.match(String(initial.source),/Lightweight Charts/i);assert.match(String(initial.attribution),/TradingView Lightweight Charts/i);assert.ok(!initial.text.includes('one-minute bars currently loaded'));assert.ok(initial.width>=48&&initial.width<=56,`initial logical width ${initial.width}`);assert.ok(firstInteractiveMs<5000,`interactive chart shell ${firstInteractiveMs}ms`);
  const wrap=page.locator('#chartWrap'),br=await wrap.boundingBox();assert.ok(br);const before=await page.evaluate(()=>RWARenkoV9.chart.timeScale().getVisibleLogicalRange());await page.mouse.move(br.x+br.width*.55,br.y+br.height*.5);await page.mouse.wheel(0,450);await page.waitForTimeout(200);const zoom=await page.evaluate(()=>RWARenkoV9.chart.timeScale().getVisibleLogicalRange());assert.ok((zoom.to-zoom.from)>(before.to-before.from)+1);
  await page.click('#tvReset');await page.waitForTimeout(100);const drag0=await page.evaluate(()=>RWARenkoV9.chart.timeScale().getVisibleLogicalRange());await page.mouse.move(br.x+br.width*.55,br.y+br.height*.55);await page.mouse.down();for(let i=1;i<=12;i++)await page.mouse.move(br.x+br.width*(.55+.02*i),br.y+br.height*.55);await page.mouse.up();await page.waitForTimeout(250);const drag1=await page.evaluate(()=>RWARenkoV9.chart.timeScale().getVisibleLogicalRange());assert.ok(drag1.from<drag0.from-1,'public native drag did not move chart');await page.click('#tvLive');
  assert.equal(errors.length,0,errors.join(' | '));console.log(JSON.stringify({ok:true,url:URL,firstInteractiveMs,tick,initial,before,zoom,drag0,drag1},null,2));
}finally{await browser.close()}
