import { chromium } from 'playwright';
const BASE=process.env.RENKO_TEST_BASE||'http://127.0.0.1:8080/';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1900,height:900}});
const fail=m=>{throw new Error(m)};
const sig=()=>page.evaluate(()=>JSON.stringify(RWARenkoV15.state.data.slice(-100).map(x=>[x.open,x.close,x._box,x._dir,x.high,x.low])));
const active=()=>page.evaluate(()=>document.querySelector('[data-v15-profile].active')?.dataset.v15Profile||'');
async function assertClickable(method){const b=page.locator(`[data-v15-apply="${method}"]`);await b.scrollIntoViewIfNeeded();if(!(await b.isEnabled())||!(await b.isVisible()))fail(`${method}: APPLY disabled/hidden`);const hit=await b.evaluate(el=>{const r=el.getBoundingClientRect(),n=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return{apply:n?.closest?.('[data-v15-apply]')?.dataset?.v15Apply||'',pointer:getComputedStyle(el).pointerEvents}});if(hit.apply!==method||hit.pointer==='none')fail(`${method}: blocked hit target ${JSON.stringify(hit)}`)}
async function applyFast(method,expectBox,maxMs=6000){await assertClickable(method);const before=await sig(),start=Date.now();await page.locator(`[data-v15-apply="${method}"]`).click({timeout:2500});await page.waitForFunction(({m,b})=>{const root=document.querySelector('#v15BoxCard');return window.RWARenkoV15MethodProfiles?.version==='1.5.1'&&RWARenkoV15.settings.method===m&&!RWARenkoV15.state.building&&RWARenkoV15.state.data.length>0&&root?.dataset.lastApplied===m&&root?.dataset.applyVerified==='1'&&(!Number.isFinite(b)||Math.abs(Number(RWARenkoV15.state.box)-b)<Math.max(.02,Math.abs(b)*1e-9))},{m:method,b:expectBox},{timeout:12000});const wall=Date.now()-start;if(wall>maxMs)fail(`${method}: ${wall}ms > ${maxMs}ms`);if(await active()!==method)fail(`${method}: ACTIVE mismatch`);const out=await page.evaluate(()=>({box:RWARenkoV15.state.box,bricks:RWARenkoV15.state.data.length,applyMs:Number(document.querySelector('#v15BoxCard')?.dataset.applyMs||0),verified:RWARenkoV15MethodProfiles.verify(RWARenkoV15.settings.method),audit:RWARenkoV15.uniformAudit()}));if(!out.verified||!out.audit?.ok||out.bricks<=0||out.applyMs>maxMs)fail(`${method}: invalid ${JSON.stringify(out)}`);return{before,after:await sig(),wall,out}}
try{
  await page.goto(`${BASE}renko/?symbol=BTC&qa=156`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.RWARenkoV15?.version==='15.1.0'&&document.documentElement.dataset.renkoMethodBootstrap==='156'&&window.RWARenkoV15MethodProfiles?.version==='1.5.1',null,{timeout:90000});
  await page.waitForFunction(()=>RWARenkoV15.state.symbol==='BTCUSDT'&&RWARenkoV15.state.ticks.length>0&&!RWARenkoV15.state.building,null,{timeout:90000});
  const boot=await page.evaluate(()=>({controller:document.querySelector('#v15BoxCard')?.dataset.controller,autoApply:document.querySelector('#v15BoxCard')?.dataset.autoApply,bricks:RWARenkoV15.state.data.length}));
  if(boot.controller!=='v15.6-nonblocking-click'||boot.autoApply!=='0'||boot.bricks<=0)fail(`bad boot ${JSON.stringify(boot)}`);
  for(const m of ['atr','traditional','percentage'])await assertClickable(m);

  await page.locator('#v15TraditionalBox').fill('10');
  const t=await applyFast('traditional',10,5000);if(t.before===t.after)fail('Traditional 10 no chart change');

  await page.locator('#v15AtrLength').fill('140');
  const a=await applyFast('atr',NaN,6000);if(a.before===a.after)fail('ATR 140 no chart change');

  // A small percentage should commit quickly from recent ticks.
  await page.locator('#v15Percentage').fill('0.05');
  const p=await applyFast('percentage',NaN,7000);if(p.before===p.after)fail('Percentage 0.05 no chart change');

  // A large 1% BTC box may need deep history. It must acknowledge instantly,
  // keep the current chart visible, and remain cancellable by the next click.
  await page.locator('#v15Percentage').fill('1');
  const deepStart=Date.now();
  await page.locator('[data-v15-apply="percentage"]').click({timeout:2500});
  await page.waitForFunction(()=>{const root=document.querySelector('#v15BoxCard'),s=document.querySelector('[data-v15-profile="percentage"] .v15-state')?.textContent||'';return root?.dataset.requestedMethod==='percentage'&&root?.dataset.clickAcceptedAt&&/QUEUED|APPLYING|HISTORY/.test(s)&&RWARenkoV15.state.data.length>0},null,{timeout:1500});
  if(Date.now()-deepStart>1500)fail(`Percentage 1% click acknowledgement slow: ${Date.now()-deepStart}ms`);
  await assertClickable('traditional');
  await page.locator('#v15TraditionalBox').fill('10');
  const cancelStart=Date.now();
  await page.locator('[data-v15-apply="traditional"]').click({timeout:2500});
  await page.waitForFunction(()=>RWARenkoV15.settings.method==='traditional'&&document.querySelector('#v15BoxCard')?.dataset.lastApplied==='traditional'&&document.querySelector('#v15BoxCard')?.dataset.applyVerified==='1'&&RWARenkoV15.state.data.length>0,null,{timeout:8000});
  if(Date.now()-cancelStart>6000)fail(`Latest click waited on old history job: ${Date.now()-cancelStart}ms`);

  const result=await page.evaluate(()=>({controller:RWARenkoV15MethodProfiles.version,method:RWARenkoV15.settings.method,box:RWARenkoV15.state.box,bricks:RWARenkoV15.state.data.length,ticks:RWARenkoV15.state.ticks.length,active:document.querySelector('[data-v15-profile].active')?.dataset.v15Profile,applyMs:document.querySelector('#v15BoxCard')?.dataset.applyMs,autoApply:document.querySelector('#v15BoxCard')?.dataset.autoApply,audit:RWARenkoV15.uniformAudit()}));
  console.log('RENKO V15.6 NONBLOCKING CLICK PASS',JSON.stringify(result));
} finally {await browser.close()}
