import { chromium } from 'playwright';
const BASE=process.env.RENKO_TEST_BASE||'http://127.0.0.1:8080/';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1900,height:900}});
const fail=m=>{throw new Error(m)};
const sig=()=>page.evaluate(()=>JSON.stringify(RWARenkoV15.state.data.slice(-100).map(x=>[x.open,x.close,x._box,x._dir,x.high,x.low])));
const active=()=>page.evaluate(()=>document.querySelector('[data-v15-profile].active')?.dataset.v15Profile||'');
async function apply(method,expectBox){
  const before=await sig();
  await page.locator(`[data-v15-apply="${method}"]`).click();
  await page.waitForFunction(({m,b})=>{
    const root=document.querySelector('#v15BoxCard');
    return window.RWARenkoV15MethodProfiles?.version==='1.4.0'&&RWARenkoV15.settings.method===m&&!RWARenkoV15.state.building&&!RWARenkoV15.state.loading&&RWARenkoV15.state.data.length>0&&root?.dataset.lastApplied===m&&root?.dataset.applyVerified==='1'&&root?.dataset.renderReady==='1'&&(!Number.isFinite(b)||Math.abs(Number(RWARenkoV15.state.box)-b)<Math.max(.02,Math.abs(b)*1e-9));
  },{m:method,b:expectBox},{timeout:180000});
  if(await active()!==method)fail(`${method}: ACTIVE badge mismatch`);
  const out=await page.evaluate(()=>{const text=document.querySelector('#tvBrickMeta')?.textContent||'';const visible=Number((text.match(/^(\d+)/)||[])[1]||0);return{method:RWARenkoV15.settings.method,box:RWARenkoV15.state.box,bricks:RWARenkoV15.state.data.length,visible,brickMeta:text,summary:document.querySelector('#v11MethodLabel')?.textContent,verified:RWARenkoV15MethodProfiles.verify(RWARenkoV15.settings.method),audit:RWARenkoV15.uniformAudit(),changed:document.querySelector('#v15BoxCard')?.dataset.chartChanged,renderReady:document.querySelector('#v15BoxCard')?.dataset.renderReady,controller:RWARenkoV15MethodProfiles.switchContract}});
  if(!out.verified||!out.audit?.ok||out.controller!=='verified-renderable-latest-click-wins'||out.bricks<=0||out.visible<=0||out.renderReady!=='1')fail(`${method}: render verification failed ${JSON.stringify(out)}`);
  const after=await sig();
  return{before,after,out};
}
try{
  await page.goto(`${BASE}renko/?symbol=BTC&qa=154`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.RWARenkoV15?.version==='15.1.0'&&document.documentElement.dataset.renkoMethodBootstrap==='154'&&window.RWARenkoV15MethodProfiles?.version==='1.4.0',null,{timeout:120000});
  await page.waitForFunction(()=>RWARenkoV15.state.symbol==='BTCUSDT'&&RWARenkoV15.state.ticks.length>0&&!RWARenkoV15.state.building,null,{timeout:120000});
  if(await page.locator('iframe').count())fail('Standalone page unexpectedly contains iframe');
  const legacy=await page.evaluate(()=>({controller:document.querySelector('#v15BoxCard')?.dataset.controller,hasResolution:!!document.querySelector('[id*=Resolution],select[name*=resolution]'),text:document.body.innerText}));
  if(legacy.controller!=='v15.4-renderable-only')fail(`renderable controller DOM missing ${JSON.stringify(legacy)}`);
  if(legacy.hasResolution||/\bRESOLUTION\b|1 minute|3 minutes|5 minutes|15 minutes|30 minutes|1 hour|4 hours|1 day/i.test(legacy.text))fail('timeframe UI returned');

  await page.locator('#v15TraditionalBox').fill('10');
  await page.locator('#v15TraditionalWicks').check();
  await page.locator('#v15TraditionalConfirm').selectOption('2');
  const t=await apply('traditional',10);
  if(t.before===t.after)fail('Traditional BOX 10 did not change chart signature');

  await page.locator('#v15Percentage').fill('1');
  await page.locator('#v15PercentageWicks').check();
  await page.locator('#v15PercentageConfirm').selectOption('2');
  const p=await apply('percentage',NaN);
  if(!(p.out.box>0)||p.before===p.after||p.out.bricks<=0||p.out.visible<=0)fail(`Percentage 1% produced blank chart ${JSON.stringify(p.out)}`);

  await page.locator('#v15AtrLength').fill('140');
  await page.locator('#v15AtrWicks').check();
  await page.locator('#v15AtrConfirm').selectOption('2');
  const a=await apply('atr',NaN);
  if(!(a.out.box>0)||a.before===a.after||a.out.bricks<=0)fail(`ATR 140 did not rebuild ${JSON.stringify(a.out)}`);

  await page.locator('#v15TraditionalBox').fill('100');
  const t100=await apply('traditional',100);
  if(t100.out.bricks<=0||t100.out.visible<=0)fail(`Traditional BOX 100 produced blank chart ${JSON.stringify(t100.out)}`);
  await page.locator('#v15TraditionalBox').fill('10');
  const t10=await apply('traditional',10);
  if(t100.after===t10.after)fail('Traditional 100 -> 10 changed state but not chart');

  const result=await page.evaluate(()=>({controller:RWARenkoV15MethodProfiles.version,method:RWARenkoV15.settings.method,box:RWARenkoV15.state.box,bricks:RWARenkoV15.state.data.length,ticks:RWARenkoV15.state.ticks.length,brickMeta:document.querySelector('#tvBrickMeta')?.textContent,active:document.querySelector('[data-v15-profile].active')?.dataset.v15Profile,lastApplied:document.querySelector('#v15BoxCard')?.dataset.lastApplied,verified:document.querySelector('#v15BoxCard')?.dataset.applyVerified,renderReady:document.querySelector('#v15BoxCard')?.dataset.renderReady,audit:RWARenkoV15.uniformAudit()}));
  console.log('RENKO V15.4 RENDERABLE METHOD PASS',JSON.stringify(result));
} finally {await browser.close()}
