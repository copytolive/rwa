import { chromium } from 'playwright';
const BASE=process.env.RENKO_TEST_BASE||'http://127.0.0.1:8080/';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1900,height:900}});
const fail=m=>{throw new Error(m)};
const sig=()=>page.evaluate(()=>JSON.stringify(RWARenkoV15.state.data.slice(-100).map(x=>[x.open,x.close,x._box,x._dir,x.high,x.low])));
const active=()=>page.evaluate(()=>document.querySelector('[data-v15-profile].active')?.dataset.v15Profile||'');
async function assertClickable(method){
  const b=page.locator(`[data-v15-apply="${method}"]`);
  await b.scrollIntoViewIfNeeded();
  if(!(await b.isEnabled())||!(await b.isVisible()))fail(`${method}: APPLY is not enabled/visible`);
  const hit=await b.evaluate(el=>{const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,n=document.elementFromPoint(x,y);return{tag:n?.tagName,apply:n?.closest?.('[data-v15-apply]')?.dataset?.v15Apply||'',pointer:getComputedStyle(el).pointerEvents,z:getComputedStyle(el).zIndex}});
  if(hit.apply!==method||hit.pointer==='none')fail(`${method}: APPLY hit target blocked ${JSON.stringify(hit)}`);
}
async function apply(method,expectBox,maxMs=7000){
  await assertClickable(method);
  const before=await sig(),started=Date.now();
  await page.locator(`[data-v15-apply="${method}"]`).click({timeout:3000});
  await page.waitForFunction(({m,b})=>{
    const root=document.querySelector('#v15BoxCard');
    return window.RWARenkoV15MethodProfiles?.version==='1.5.0'&&RWARenkoV15.settings.method===m&&!RWARenkoV15.state.building&&RWARenkoV15.state.data.length>0&&root?.dataset.lastApplied===m&&root?.dataset.applyVerified==='1'&&(!Number.isFinite(b)||Math.abs(Number(RWARenkoV15.state.box)-b)<Math.max(.02,Math.abs(b)*1e-9));
  },{m:method,b:expectBox},{timeout:20000});
  const wallMs=Date.now()-started;
  if(wallMs>maxMs)fail(`${method}: APPLY too slow ${wallMs}ms > ${maxMs}ms`);
  if(await active()!==method)fail(`${method}: ACTIVE badge mismatch`);
  const out=await page.evaluate(()=>{const text=document.querySelector('#tvBrickMeta')?.textContent||'';const visible=Number((text.match(/^(\d+)/)||[])[1]||0),root=document.querySelector('#v15BoxCard');return{method:RWARenkoV15.settings.method,box:RWARenkoV15.state.box,bricks:RWARenkoV15.state.data.length,visible,brickMeta:text,verified:RWARenkoV15MethodProfiles.verify(RWARenkoV15.settings.method),audit:RWARenkoV15.uniformAudit(),applyMs:Number(root?.dataset.applyMs||0),autoApply:root?.dataset.autoApply,controller:RWARenkoV15MethodProfiles.switchContract}});
  if(!out.verified||!out.audit?.ok||out.controller!=='instant-click-latest-wins'||out.bricks<=0||out.visible<=0||out.autoApply!=='0')fail(`${method}: verification failed ${JSON.stringify(out)}`);
  if(out.applyMs>maxMs)fail(`${method}: internal APPLY too slow ${out.applyMs}ms > ${maxMs}ms`);
  return{before,after:await sig(),out,wallMs};
}
try{
  await page.goto(`${BASE}renko/?symbol=BTC&qa=155`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.RWARenkoV15?.version==='15.1.0'&&document.documentElement.dataset.renkoMethodBootstrap==='155'&&window.RWARenkoV15MethodProfiles?.version==='1.5.0',null,{timeout:90000});
  await page.waitForFunction(()=>RWARenkoV15.state.symbol==='BTCUSDT'&&RWARenkoV15.state.ticks.length>0&&!RWARenkoV15.state.building,null,{timeout:90000});
  const legacy=await page.evaluate(()=>({controller:document.querySelector('#v15BoxCard')?.dataset.controller,autoApply:document.querySelector('#v15BoxCard')?.dataset.autoApply,hasResolution:!!document.querySelector('[id*=Resolution],select[name*=resolution]'),text:document.body.innerText}));
  if(legacy.controller!=='v15.5-instant-click'||legacy.autoApply!=='0')fail(`instant controller not ready ${JSON.stringify(legacy)}`);
  if(legacy.hasResolution||/\bRESOLUTION\b|1 minute|3 minutes|5 minutes|15 minutes|30 minutes|1 hour|4 hours|1 day/i.test(legacy.text))fail('timeframe UI returned');
  for(const m of ['atr','traditional','percentage'])await assertClickable(m);

  await page.locator('#v15TraditionalBox').fill('10');
  const t10=await apply('traditional',10,5000);
  if(t10.before===t10.after)fail('Traditional 10 did not change chart');

  await page.locator('#v15Percentage').fill('1');
  const p=await apply('percentage',NaN,7000);
  if(p.before===p.after)fail('Percentage 1% did not change chart');

  await page.locator('#v15AtrLength').fill('140');
  const a=await apply('atr',NaN,7000);
  if(a.before===a.after)fail('ATR 140 did not change chart');

  // Latest click must win without waiting for a long history job.
  await page.locator('#v15Percentage').fill('0.5');
  const startRapid=Date.now();
  await page.locator('[data-v15-apply="percentage"]').click();
  await page.waitForTimeout(25);
  await page.locator('#v15TraditionalBox').fill('10');
  await page.locator('[data-v15-apply="traditional"]').click();
  await page.waitForFunction(()=>RWARenkoV15.settings.method==='traditional'&&document.querySelector('#v15BoxCard')?.dataset.lastApplied==='traditional'&&document.querySelector('#v15BoxCard')?.dataset.applyVerified==='1'&&RWARenkoV15.state.data.length>0,null,{timeout:10000});
  if(Date.now()-startRapid>7000)fail(`rapid latest-click-wins too slow: ${Date.now()-startRapid}ms`);

  const result=await page.evaluate(()=>({controller:RWARenkoV15MethodProfiles.version,method:RWARenkoV15.settings.method,box:RWARenkoV15.state.box,bricks:RWARenkoV15.state.data.length,ticks:RWARenkoV15.state.ticks.length,brickMeta:document.querySelector('#tvBrickMeta')?.textContent,active:document.querySelector('[data-v15-profile].active')?.dataset.v15Profile,applyMs:document.querySelector('#v15BoxCard')?.dataset.applyMs,autoApply:document.querySelector('#v15BoxCard')?.dataset.autoApply,audit:RWARenkoV15.uniformAudit()}));
  console.log('RENKO V15.5 INSTANT CLICK PASS',JSON.stringify(result));
} finally {await browser.close()}
