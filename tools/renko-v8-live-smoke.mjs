import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const URL=process.env.RWA_RENKO_LIVE_URL||'https://narzulalistiqlal.github.io/rwa/renko/';
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(URL,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.RWARenkoV8?.version==='8.0.0'&&window.RWARenkoV3?.state?.symbols?.length>=500,{timeout:30000});
  await page.waitForFunction(()=>window.RWARenkoV3?.state?.tickCount>0&&Number.isFinite(window.RWARenkoV3?.state?.lastPrice),{timeout:30000});
  const tick=await page.evaluate(()=>({id:RWARenkoV3.state.lastTradeId,t:RWARenkoV3.state.lastTickTime,n:RWARenkoV3.state.tickCount}));
  await page.waitForFunction(b=>RWARenkoV3.state.tickCount>b.n||RWARenkoV3.state.lastTradeId!==b.id||RWARenkoV3.state.lastTickTime>b.t,tick,{timeout:30000});
  await page.waitForFunction(()=>RWARenkoV8.state.bricks.length>=50,{timeout:90000});
  const initial=await page.evaluate(()=>({v:RWARenkoV8.version,visible:RWARenkoV8.state.visible,bricks:RWARenkoV8.state.bricks.length,markets:RWARenkoV3.state.symbols.length,feed:document.querySelector('#feedPill b')?.textContent,canvas:document.querySelector('#smoothRenkoCanvas')?.getBoundingClientRect().toJSON(),legacy:getComputedStyle(document.querySelector('.controlbar')).display,status:document.querySelector('#tvLoadState')?.textContent,text:document.body.innerText}));
  assert.equal(initial.v,'8.0.0');assert.equal(initial.visible,50);assert.ok(initial.bricks>=50);assert.ok(initial.markets>=500);assert.match(String(initial.feed),/^LIVE/);assert.ok(initial.canvas.width>800&&initial.canvas.height>400);assert.equal(initial.legacy,'none');assert.ok(!initial.text.includes('one-minute bars currently loaded'));
  const wrap=page.locator('#chartWrap'),r=await wrap.boundingBox();assert.ok(r);await page.mouse.move(r.x+r.width*.5,r.y+r.height*.5);await page.mouse.wheel(0,420);await page.waitForTimeout(150);assert.ok((await page.evaluate(()=>RWARenkoV8.state.visible))>50);
  await page.click('#tvReset');await page.waitForTimeout(80);const before=await page.evaluate(()=>({offset:RWARenkoV8.state.offset,frames:RWARenkoV8.state.frames}));await page.mouse.move(r.x+r.width*.5,r.y+r.height*.55);await page.mouse.down();for(let i=0;i<10;i++)await page.mouse.move(r.x+r.width*(.5+.025*i),r.y+r.height*.55);await page.mouse.up();await page.waitForTimeout(120);const after=await page.evaluate(()=>({offset:RWARenkoV8.state.offset,frames:RWARenkoV8.state.frames}));assert.ok(after.offset>before.offset);assert.ok(after.frames>before.frames);await page.click('#tvLive');
  assert.equal(errors.length,0,errors.join(' | '));console.log(JSON.stringify({ok:true,url:URL,initial,before,after},null,2));
}finally{await browser.close()}
