import { chromium } from 'playwright';
const BASE=process.env.RENKO_TEST_BASE||'http://127.0.0.1:8080/';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1900,height:900}});
const fail=m=>{throw new Error(m)};
const sig=()=>page.evaluate(()=>JSON.stringify(RWARenkoV15.state.data.slice(-100).map(x=>[x.open,x.close,x._box,x._dir,x.high,x.low])));
const active=()=>page.evaluate(()=>document.querySelector('[data-v15-profile].active')?.dataset.v15Profile||'');
async function hit(locator,label){await locator.scrollIntoViewIfNeeded();if(!(await locator.isEnabled())||!(await locator.isVisible()))fail(`${label}: disabled/hidden`);const out=await locator.evaluate(el=>{const r=el.getBoundingClientRect(),n=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return{same:n===el||el.contains(n)||n?.closest?.('[data-v15-profile]')===el.closest?.('[data-v15-profile]'),tag:n?.tagName||'',id:n?.id||'',pointer:getComputedStyle(el).pointerEvents,z:getComputedStyle(el).zIndex}});if(!out.same||out.pointer==='none')fail(`${label}: blocked hit target ${JSON.stringify(out)}`);return out}
async function assertControls(method){const p=page.locator(`[data-v15-profile="${method}"]`);await hit(p.locator('input').first(),`${method}: input`);await hit(p.locator('input[type="checkbox"]'),`${method}: wicks`);await hit(p.locator('select'),`${method}: entry confirm`);await hit(p.locator('[data-v15-apply]'),`${method}: apply`)}
async function applyFast(method,expectBox,maxMs=5000){const before=await sig(),start=Date.now();await page.locator(`[data-v15-apply="${method}"]`).click({timeout:1200});await page.waitForFunction(({m,b})=>{const root=document.querySelector('#v15BoxCard');return window.RWARenkoV15MethodProfiles?.version==='1.6.1'&&RWARenkoV15.settings.method===m&&!RWARenkoV15.state.building&&RWARenkoV15.state.data.length>0&&root?.dataset.lastApplied===m&&root?.dataset.applyVerified==='1'&&(!Number.isFinite(b)||Math.abs(Number(RWARenkoV15.state.box)-b)<Math.max(.02,Math.abs(b)*1e-9))},{m:method,b:expectBox},{timeout:7000});const wall=Date.now()-start;if(wall>maxMs)fail(`${method}: ${wall}ms > ${maxMs}ms`);if(await active()!==method)fail(`${method}: ACTIVE mismatch`);const out=await page.evaluate(()=>({box:RWARenkoV15.state.box,bricks:RWARenkoV15.state.data.length,applyMs:Number(document.querySelector('#v15BoxCard')?.dataset.applyMs||0),backgroundLoadingIgnored:document.querySelector('#v15BoxCard')?.dataset.backgroundLoadingIgnored,verified:RWARenkoV15MethodProfiles.verify(RWARenkoV15.settings.method),audit:RWARenkoV15.uniformAudit()}));if(!out.verified||!out.audit?.ok||out.bricks<=0||out.applyMs>maxMs)fail(`${method}: invalid ${JSON.stringify(out)}`);return{before,after:await sig(),wall,out}}
try{
  await page.goto(`${BASE}renko/?symbol=BTC&qa=158`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.RWARenkoV15?.version==='15.1.0'&&document.documentElement.dataset.renkoMethodBootstrap==='158'&&window.RWARenkoV15MethodProfiles?.version==='1.6.1',null,{timeout:90000});
  await page.waitForFunction(()=>RWARenkoV15.state.symbol==='BTCUSDT'&&RWARenkoV15.state.ticks.length>0&&!RWARenkoV15.state.building,null,{timeout:90000});
  const boot=await page.evaluate(()=>({controller:document.querySelector('#v15BoxCard')?.dataset.controller,autoApply:document.querySelector('#v15BoxCard')?.dataset.autoApply,interactive:document.querySelector('#v15BoxCard')?.dataset.controlsInteractive,bricks:RWARenkoV15.state.data.length}));
  if(boot.controller!=='v15.8-fast-abortable-controls'||boot.autoApply!=='0'||boot.interactive!=='1'||boot.bricks<=0)fail(`bad boot ${JSON.stringify(boot)}`);
  for(const m of ['atr','traditional','percentage'])await assertControls(m);

  await page.locator('#v15TraditionalBox').fill('10');
  const t10=await applyFast('traditional',10,4000);if(t10.before===t10.after)fail('Traditional 10 no chart change');

  // Delay all signal-aware aggregate-trade fetches. This deliberately leaves lazy history
  // loading active while we edit/apply, proving Apply only waits for the Renko build itself.
  await page.evaluate(()=>{
    const native=window.fetch.bind(window);window.__RENKO_NATIVE_FETCH__=native;
    window.fetch=(url,opts={})=>{
      const u=String(url||'');
      if(u.includes('/api/v3/aggTrades?')&&opts?.signal){
        return new Promise((resolve,reject)=>{
          let done=false;const finish=(fn,v)=>{if(done)return;done=true;fn(v)};
          const tm=setTimeout(()=>native(url,opts).then(v=>finish(resolve,v),e=>finish(reject,e)),5000);
          const abort=()=>{clearTimeout(tm);finish(reject,new DOMException('Aborted','AbortError'))};
          if(opts.signal.aborted)return abort();opts.signal.addEventListener('abort',abort,{once:true});
        });
      }
      return native(url,opts);
    };
  });

  await page.locator('#v15TraditionalBox').fill('100');
  await page.locator('[data-v15-apply="traditional"]').click({timeout:1200});
  await page.waitForFunction(()=>{const r=document.querySelector('#v15BoxCard'),s=document.querySelector('[data-v15-profile="traditional"] .v15-state')?.textContent||'';return r?.dataset.pendingHistory==='1'&&/LOADING|APPLYING|QUEUED/.test(s)&&RWARenkoV15.state.data.length>0},null,{timeout:3000});
  const beforeAbort=await page.evaluate(()=>Number(document.querySelector('#v15BoxCard')?.dataset.historyAborts||0));
  await assertControls('traditional');
  const box=page.locator('#v15TraditionalBox');await box.click({timeout:800});await box.fill('10');
  await page.waitForFunction(n=>Number(document.querySelector('#v15BoxCard')?.dataset.historyAborts||0)>n,beforeAbort,{timeout:800});
  const wicks=page.locator('#v15TraditionalWicks');await wicks.click({timeout:800});
  const confirm=page.locator('#v15TraditionalConfirm');await confirm.selectOption('1',{timeout:800});
  const edited=await page.evaluate(()=>({box:document.querySelector('#v15TraditionalBox')?.value,wicks:document.querySelector('#v15TraditionalWicks')?.checked,confirm:document.querySelector('#v15TraditionalConfirm')?.value,aborts:Number(document.querySelector('#v15BoxCard')?.dataset.historyAborts||0),pending:document.querySelector('#v15BoxCard')?.dataset.pendingHistory,state:document.querySelector('[data-v15-profile="traditional"] .v15-state')?.textContent,lastAbort:document.querySelector('#v15BoxCard')?.dataset.lastAbortReason}));
  if(edited.box!=='10'||edited.wicks!==false||edited.confirm!=='1'||edited.aborts<=beforeAbort||edited.pending!=='0')fail(`controls did not abort/edit during hydration ${JSON.stringify(edited)}`);
  const switched=await applyFast('traditional',10,4000);
  const settings=await page.evaluate(()=>({wicks:RWARenkoV15.settings.wicks,confirm:RWARenkoV15.settings.confirmBricks}));
  if(settings.wicks!==false||settings.confirm!==1)fail(`Traditional edited settings not applied ${JSON.stringify(settings)}`);

  // A separate slow background load must not delay a method rebuild.
  await page.evaluate(()=>{RWARenkoV15.state.loading=true;setTimeout(()=>{RWARenkoV15.state.loading=false},6000)});
  await page.locator('#v15TraditionalBox').fill('11');
  const ignoresLoading=await applyFast('traditional',11,4000);
  if(ignoresLoading.wall>=4000)fail(`Apply still coupled to state.loading: ${ignoresLoading.wall}ms`);

  // Start another pending history job, then touch ATR. The obsolete fetch must abort immediately.
  await page.locator('#v15Percentage').fill('10');
  await page.locator('[data-v15-apply="percentage"]').click({timeout:1200});
  await page.waitForFunction(()=>document.querySelector('#v15BoxCard')?.dataset.pendingHistory==='1',null,{timeout:3000});
  const abort2=await page.evaluate(()=>Number(document.querySelector('#v15BoxCard')?.dataset.historyAborts||0));
  await page.locator('#v15AtrLength').click({timeout:800});await page.locator('#v15AtrLength').fill('14');
  await page.waitForFunction(n=>Number(document.querySelector('#v15BoxCard')?.dataset.historyAborts||0)>n,abort2,{timeout:800});
  // clear synthetic loading before ATR because its own source calculation is independent of this assertion
  await page.evaluate(()=>{RWARenkoV15.state.loading=false});
  const atrStart=Date.now();await page.locator('[data-v15-apply="atr"]').click({timeout:1200});await page.waitForFunction(()=>RWARenkoV15.settings.method==='atr'&&document.querySelector('#v15BoxCard')?.dataset.lastApplied==='atr'&&document.querySelector('#v15BoxCard')?.dataset.applyVerified==='1',null,{timeout:6000});if(Date.now()-atrStart>4000)fail(`ATR latest click waited on aborted history: ${Date.now()-atrStart}ms`);

  await page.evaluate(()=>{if(window.__RENKO_NATIVE_FETCH__)window.fetch=window.__RENKO_NATIVE_FETCH__});
  const result=await page.evaluate(()=>({controller:RWARenkoV15MethodProfiles.version,method:RWARenkoV15.settings.method,box:RWARenkoV15.state.box,bricks:RWARenkoV15.state.data.length,ticks:RWARenkoV15.state.ticks.length,active:document.querySelector('[data-v15-profile].active')?.dataset.v15Profile,applyMs:document.querySelector('#v15BoxCard')?.dataset.applyMs,historyAborts:document.querySelector('#v15BoxCard')?.dataset.historyAborts,controlsInteractive:document.querySelector('#v15BoxCard')?.dataset.controlsInteractive,latency:RWARenkoV15MethodProfiles.latencyContract,audit:RWARenkoV15.uniformAudit()}));
  console.log('RENKO V15.8 FAST ABORTABLE CONTROLS PASS',JSON.stringify(result));
} finally {await browser.close()}
