import { chromium } from 'playwright';
const BASE=process.env.RENKO_TEST_BASE||'http://127.0.0.1:8080/';
const TARGET=60;
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1900,height:900}});
const fail=m=>{throw new Error(m)};
async function hit(locator,label){await locator.scrollIntoViewIfNeeded();if(!(await locator.isEnabled())||!(await locator.isVisible()))fail(`${label}: disabled/hidden`);const out=await locator.evaluate(el=>{const r=el.getBoundingClientRect(),n=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return{same:n===el||el.contains(n)||n?.closest?.('[data-v15-profile]')===el.closest?.('[data-v15-profile]'),tag:n?.tagName||'',id:n?.id||'',pointer:getComputedStyle(el).pointerEvents}});if(!out.same||out.pointer==='none')fail(`${label}: blocked ${JSON.stringify(out)}`);return out}
async function assertControls(method){const p=page.locator(`[data-v15-profile="${method}"]`);await hit(p,`${method}: panel`);await hit(p.locator('input').first(),`${method}: main input`);await hit(p.locator('input[type="checkbox"]'),`${method}: wicks`);await hit(p.locator('select'),`${method}: entry confirm`);await hit(p.locator('[data-v15-apply]'),`${method}: apply`)}
async function snap(method){return page.evaluate(m=>({method:RWARenkoV15.settings.method,box:Number(RWARenkoV15.state.box),bricks:RWARenkoV15.state.data.length,ticks:RWARenkoV15.state.ticks.length,oldest:Number(RWARenkoV15.state.oldestAggId),loading:RWARenkoV15.state.loading,building:RWARenkoV15.state.building,wicks:RWARenkoV15.settings.wicks,confirm:RWARenkoV15.settings.confirmBricks,active:document.querySelector('[data-v15-profile].active')?.dataset.v15Profile,state:document.querySelector(`[data-v15-profile="${m}"] .v15-state`)?.textContent,applyMs:Number(document.querySelector('#v15BoxCard')?.dataset.applyMs||0),verified:RWARenkoV15MethodProfiles.verify(m),background:document.querySelector('#v15BoxCard')?.dataset.backgroundHistory,backgroundRound:document.querySelector('#v15BoxCard')?.dataset.backgroundRound,backgroundComplete:document.querySelector('#v15BoxCard')?.dataset.backgroundComplete,historyTarget:Number(document.querySelector('#v15BoxCard')?.dataset.historyTarget||0),operation:document.querySelector('#v15BoxCard')?.dataset.operationContract,audit:RWARenkoV15.uniformAudit()}),method)}
async function waitActive(method,timeout=12000){await page.waitForFunction(m=>{const r=document.querySelector('#v15BoxCard'),p=document.querySelector(`[data-v15-profile="${m}"]`);return window.RWARenkoV15MethodProfiles?.version==='1.7.1'&&RWARenkoV15.settings.method===m&&p?.classList.contains('active')&&r?.dataset.lastApplied===m&&r?.dataset.methodActivated==='true'},method,{timeout});return snap(method)}
async function apply(method){const start=Date.now();await page.locator(`[data-v15-apply="${method}"]`).click({timeout:1800});const out=await waitActive(method);out.wall=Date.now()-start;if(out.wall>12000)fail(`${method}: activation too slow ${out.wall}ms`);if(!out.verified||out.active!==method||out.historyTarget!==TARGET||out.operation!=='activate-first-fill-one-screen-history')fail(`${method}: invalid active state ${JSON.stringify(out)}`);return out}
async function waitFull(method,timeout=210000){await page.waitForFunction(({m,target})=>RWARenkoV15.settings.method===m&&!RWARenkoV15.state.building&&RWARenkoV15.state.data.length>=target,{m:method,target:TARGET},{timeout});await page.waitForFunction(m=>{const r=document.querySelector('#v15BoxCard');return RWARenkoV15.settings.method===m&&(r?.dataset.backgroundHistory==='0'||RWARenkoV15.state.data.length>=60)},method,{timeout:15000}).catch(()=>{});const out=await snap(method);if(out.bricks<TARGET||!out.audit?.ok||!out.verified)fail(`${method}: history did not fill ${JSON.stringify(out)}`);return out}
try{
  await page.goto(`${BASE}renko/?symbol=SOL&qa=171`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.RWARenkoV15?.version==='15.1.0'&&document.documentElement.dataset.renkoMethodBootstrap==='171'&&window.RWARenkoV15MethodProfiles?.version==='1.7.1',null,{timeout:90000});
  await page.waitForFunction(()=>RWARenkoV15.state.symbol==='SOLUSDT'&&RWARenkoV15.state.ticks.length>0&&!RWARenkoV15.state.building,null,{timeout:90000});
  const initial=await page.evaluate(()=>({ticks:RWARenkoV15.state.ticks.length,bricks:RWARenkoV15.state.data.length,oldest:Number(RWARenkoV15.state.oldestAggId)}));
  const boot=await page.evaluate(()=>({controller:document.querySelector('#v15BoxCard')?.dataset.controller,interactive:document.querySelector('#v15BoxCard')?.dataset.controlsInteractive,contract:RWARenkoV15MethodProfiles.setupContract,history:RWARenkoV15MethodProfiles.historyContract,target:RWARenkoV15MethodProfiles.historyTarget}));
  if(boot.controller!=='v15.11-fill-active-history'||boot.interactive!=='1'||boot.contract!=='atr-traditional-percentage-all-operable'||boot.history!=='active-method-retries-backfill-until-one-screen-or-source-exhausted'||boot.target!==TARGET)fail(`bad boot ${JSON.stringify(boot)}`);
  for(const m of ['atr','traditional','percentage'])await assertControls(m);

  await page.locator('#v15AtrLength').fill('200');
  const atr=await apply('atr');

  // Exact screenshot regression: SOL around 100, Traditional box 10 previously stopped at 1 brick.
  await page.locator('#v15TraditionalBox').fill('10');
  const tw=page.locator('#v15TraditionalWicks');if(!(await tw.isChecked()))await tw.click();
  await page.locator('#v15TraditionalConfirm').selectOption('1');
  const traditionalActivated=await apply('traditional');
  if(Math.abs(traditionalActivated.box-10)>.011)fail(`Traditional box mismatch ${JSON.stringify(traditionalActivated)}`);
  const traditionalFull=await waitFull('traditional');

  // Exact screenshot regression: SOL Percentage 1% previously stopped at 9 bricks.
  await page.locator('#v15Percentage').fill('1');
  const pw=page.locator('#v15PercentageWicks');if(!(await pw.isChecked()))await pw.click();
  await page.locator('#v15PercentageConfirm').selectOption('1');
  const percentageActivated=await apply('percentage');
  const expectedPct=await page.evaluate(()=>{const p=Math.abs(Number(RWARenkoV15.state.ltpSnapshot))*.01,mag=10**Math.floor(Math.log10(p)),v=Math.round(p/mag)*mag,t=Number(RWARenkoV15.state.tickSize),s=String(t),d=s.includes('e-')?Math.min(12,Number(s.split('e-')[1])||0):(s.includes('.')?Math.min(12,s.length-s.indexOf('.')-1):0);return Number((Math.max(1,Math.round(v/t))*t).toFixed(d))});
  if(Math.abs(percentageActivated.box-expectedPct)>Math.max(.011,expectedPct*1e-9))fail(`Percentage box mismatch expected=${expectedPct} ${JSON.stringify(percentageActivated)}`);
  const percentageFull=await waitFull('percentage');

  // Re-enter Traditional after Percentage; the already-fetched deep tick set must remain reusable.
  const traditionalAgainActivated=await apply('traditional');
  const traditionalAgain=await waitFull('traditional',60000);
  if(traditionalAgain.ticks<=initial.ticks||!(traditionalAgain.oldest<initial.oldest))fail(`deep history did not persist ${JSON.stringify({initial,traditionalAgain})}`);
  const result=await page.evaluate(()=>({controller:RWARenkoV15MethodProfiles.version,method:RWARenkoV15.settings.method,box:RWARenkoV15.state.box,bricks:RWARenkoV15.state.data.length,ticks:RWARenkoV15.state.ticks.length,active:document.querySelector('[data-v15-profile].active')?.dataset.v15Profile,historyTarget:RWARenkoV15MethodProfiles.historyTarget,history:RWARenkoV15MethodProfiles.historyContract,operation:document.querySelector('#v15BoxCard')?.dataset.operationContract,audit:RWARenkoV15.uniformAudit()}));
  if(result.method!=='traditional'||result.active!=='traditional'||result.bricks<TARGET||!result.audit?.ok)fail(`final invalid ${JSON.stringify(result)}`);
  console.log('RENKO V15.11 SOL TRADITIONAL + PERCENTAGE FULL HISTORY PASS',JSON.stringify({initial,atr,traditionalActivated,traditionalFull,percentageActivated,percentageFull,traditionalAgainActivated,traditionalAgain,result}));
} finally {await browser.close()}
