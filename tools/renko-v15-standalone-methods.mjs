import { chromium } from 'playwright';
const BASE=process.env.RENKO_TEST_BASE||'http://127.0.0.1:8080/';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1900,height:900}});
const fail=m=>{throw new Error(m)};
async function hit(locator,label){await locator.scrollIntoViewIfNeeded();if(!(await locator.isEnabled())||!(await locator.isVisible()))fail(`${label}: disabled/hidden`);const out=await locator.evaluate(el=>{const r=el.getBoundingClientRect(),n=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return{same:n===el||el.contains(n)||n?.closest?.('[data-v15-profile]')===el.closest?.('[data-v15-profile]'),tag:n?.tagName||'',id:n?.id||'',pointer:getComputedStyle(el).pointerEvents}});if(!out.same||out.pointer==='none')fail(`${label}: blocked ${JSON.stringify(out)}`);return out}
async function assertControls(method){const p=page.locator(`[data-v15-profile="${method}"]`);await hit(p,`${method}: panel`);await hit(p.locator('input').first(),`${method}: main input`);await hit(p.locator('input[type="checkbox"]'),`${method}: wicks`);await hit(p.locator('select'),`${method}: entry confirm`);await hit(p.locator('[data-v15-apply]'),`${method}: apply`)}
async function waitActive(method,timeout=10000){await page.waitForFunction(m=>{const r=document.querySelector('#v15BoxCard'),p=document.querySelector(`[data-v15-profile="${m}"]`);return window.RWARenkoV15MethodProfiles?.version==='1.7.0'&&RWARenkoV15.settings.method===m&&p?.classList.contains('active')&&r?.dataset.lastApplied===m&&r?.dataset.methodActivated==='true'},{timeout},method);return page.evaluate(m=>({method:RWARenkoV15.settings.method,box:Number(RWARenkoV15.state.box),bricks:RWARenkoV15.state.data.length,ticks:RWARenkoV15.state.ticks.length,loading:RWARenkoV15.state.loading,building:RWARenkoV15.state.building,wicks:RWARenkoV15.settings.wicks,confirm:RWARenkoV15.settings.confirmBricks,active:document.querySelector('[data-v15-profile].active')?.dataset.v15Profile,state:document.querySelector(`[data-v15-profile="${m}"] .v15-state`)?.textContent,applyMs:Number(document.querySelector('#v15BoxCard')?.dataset.applyMs||0),verified:RWARenkoV15MethodProfiles.verify(m),zeroBrickAllowed:document.querySelector('#v15BoxCard')?.dataset.zeroBrickAllowed,contract:document.querySelector('#v15BoxCard')?.dataset.operationContract,audit:RWARenkoV15.uniformAudit()}),method)}
async function apply(method){const start=Date.now();await page.locator(`[data-v15-apply="${method}"]`).click({timeout:1500});const out=await waitActive(method);out.wall=Date.now()-start;if(out.wall>10000)fail(`${method}: apply too slow ${out.wall}ms`);if(!out.verified||out.active!==method||out.zeroBrickAllowed!=='1'||out.contract!=='activate-first-history-background')fail(`${method}: invalid active state ${JSON.stringify(out)}`);return out}
try{
  await page.goto(`${BASE}renko/?symbol=BTC&qa=170`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.RWARenkoV15?.version==='15.1.0'&&document.documentElement.dataset.renkoMethodBootstrap==='170'&&window.RWARenkoV15MethodProfiles?.version==='1.7.0',null,{timeout:90000});
  await page.waitForFunction(()=>RWARenkoV15.state.symbol==='BTCUSDT'&&RWARenkoV15.state.ticks.length>0&&!RWARenkoV15.state.building,null,{timeout:90000});
  const boot=await page.evaluate(()=>({controller:document.querySelector('#v15BoxCard')?.dataset.controller,interactive:document.querySelector('#v15BoxCard')?.dataset.controlsInteractive,contract:RWARenkoV15MethodProfiles.setupContract,history:RWARenkoV15MethodProfiles.historyContract}));
  if(boot.controller!=='v15.10-all-methods-operable'||boot.interactive!=='1'||boot.contract!=='atr-traditional-percentage-all-operable'||boot.history!=='history-is-background-never-a-prerequisite-to-activate')fail(`bad boot ${JSON.stringify(boot)}`);
  for(const m of ['atr','traditional','percentage'])await assertControls(m);

  await page.locator('#v15AtrLength').fill('14');
  const atr=await apply('atr');

  await page.locator('#v15TraditionalBox').fill('100');
  const tw=page.locator('#v15TraditionalWicks');if(await tw.isChecked())await tw.click();
  await page.locator('#v15TraditionalConfirm').selectOption('1');
  const traditional=await apply('traditional');
  if(Math.abs(traditional.box-100)>.02||traditional.wicks!==false||traditional.confirm!==1)fail(`Traditional settings not applied ${JSON.stringify(traditional)}`);

  await page.locator('#v15Percentage').fill('1');
  const pw=page.locator('#v15PercentageWicks');if(!(await pw.isChecked()))await pw.click();
  await page.locator('#v15PercentageConfirm').selectOption('2');
  const percentage=await apply('percentage');
  const expectedPct=await page.evaluate(()=>{const p=Math.abs(Number(RWARenkoV15.state.ltpSnapshot))*.01,mag=10**Math.floor(Math.log10(p)),v=Math.round(p/mag)*mag,t=Number(RWARenkoV15.state.tickSize),s=String(t),d=s.includes('e-')?Math.min(12,Number(s.split('e-')[1])||0):(s.includes('.')?Math.min(12,s.length-s.indexOf('.')-1):0);return Number((Math.max(1,Math.round(v/t))*t).toFixed(d))});
  if(Math.abs(percentage.box-expectedPct)>Math.max(.02,expectedPct*1e-9)||percentage.wicks!==true||percentage.confirm!==2)fail(`Percentage settings not applied expected=${expectedPct} ${JSON.stringify(percentage)}`);

  await page.evaluate(()=>{RWARenkoV15.state.loading=true});
  await page.locator('#v15TraditionalBox').fill('125');
  const traditionalWhileLoading=await apply('traditional');
  if(Math.abs(traditionalWhileLoading.box-125)>.02)fail(`Traditional blocked by loading ${JSON.stringify(traditionalWhileLoading)}`);
  await page.evaluate(()=>{RWARenkoV15.state.loading=true});
  await page.locator('#v15Percentage').fill('2');
  const percentageWhileLoading=await apply('percentage');
  const pctSetting=await page.evaluate(()=>RWARenkoV15.settings.percentage);
  if(Math.abs(pctSetting-.02)>1e-12)fail(`Percentage blocked by loading ${JSON.stringify(percentageWhileLoading)}`);
  await page.evaluate(()=>{RWARenkoV15.state.loading=false});

  await page.locator('#v15TraditionalBox').fill('100000');
  const hugeTraditional=await apply('traditional');
  if(hugeTraditional.method!=='traditional')fail(`Huge Traditional reverted ${JSON.stringify(hugeTraditional)}`);
  await page.locator('#v15Percentage').fill('10');
  const hugePercentage=await apply('percentage');
  if(hugePercentage.method!=='percentage')fail(`Huge Percentage reverted ${JSON.stringify(hugePercentage)}`);

  await page.locator('#v15TraditionalBox').fill('100');
  const finalTraditional=await apply('traditional');
  const result=await page.evaluate(()=>({controller:RWARenkoV15MethodProfiles.version,method:RWARenkoV15.settings.method,box:RWARenkoV15.state.box,bricks:RWARenkoV15.state.data.length,ticks:RWARenkoV15.state.ticks.length,active:document.querySelector('[data-v15-profile].active')?.dataset.v15Profile,controlsInteractive:document.querySelector('#v15BoxCard')?.dataset.controlsInteractive,zeroBrickAllowed:document.querySelector('#v15BoxCard')?.dataset.zeroBrickAllowed,operation:document.querySelector('#v15BoxCard')?.dataset.operationContract,setup:RWARenkoV15MethodProfiles.setupContract,history:RWARenkoV15MethodProfiles.historyContract,audit:RWARenkoV15.uniformAudit()}));
  if(result.method!=='traditional'||result.active!=='traditional'||result.controlsInteractive!=='1'||!result.audit?.ok)fail(`final invalid ${JSON.stringify(result)}`);
  console.log('RENKO V15.10 ALL THREE METHODS OPERABLE PASS',JSON.stringify({atr,traditional,percentage,traditionalWhileLoading,percentageWhileLoading,hugeTraditional,hugePercentage,finalTraditional,result}));
} finally {await browser.close()}
