(()=>{
'use strict';
if(!window.RENKO_GOLD_ONLY||window.RWARenkoGoldDisplayGuard)return;
const root=document.documentElement;
const $=id=>document.getElementById(id);
const stats={syncs:0,emptyStates:0,visibleStates:0,startupRecoveries:0,lastConfirmed:0,lastReason:''};
let startupRecoveryDone=false;
function methodLabel(T){
  if(T?.settings?.method==='traditional')return `Traditional ${Number(T.settings.boxSize)||1}`;
  if(T?.settings?.method==='atr')return `ATR ${Math.max(1,Math.floor(Number(T.settings.atrLength)||14))}`;
  return 'Renko';
}
function setEmptyContent(T){
  const empty=$('chartEmpty');if(!empty)return;
  let b=empty.querySelector('b'),s=empty.querySelector('small');
  if(!b){b=document.createElement('b');empty.appendChild(b)}
  if(!s){s=document.createElement('small');empty.appendChild(s)}
  b.textContent='No Renko bricks at this setting';
  s.textContent=`${methodLabel(T)} produced no confirmed brick in the loaded GOLD window. Use ATR 14 or Traditional 1, or move to a wider history window.`;
}
function sync(reason='sync'){
  const T=window.RWARenkoTV,empty=$('chartEmpty');
  if(!T?.state||!empty)return false;
  const n=Number(T.state.confirmedData?.length||T.state.confirmed?.length||0);
  stats.syncs++;stats.lastConfirmed=n;stats.lastReason=String(reason);
  root.dataset.renkoGoldConfirmedVisible=String(n);
  if(n>0){empty.classList.add('hide');empty.setAttribute('aria-hidden','true');stats.visibleStates++;root.dataset.renkoGoldChartVisible='true';try{window.__RWARenkoChart?.priceScale?.('right')?.applyOptions?.({autoScale:true})}catch(_){ }return true}
  setEmptyContent(T);empty.classList.remove('hide');empty.setAttribute('aria-hidden','false');stats.emptyStates++;root.dataset.renkoGoldChartVisible='false';return false;
}
async function recoverStartup(reason='startup'){
  if(startupRecoveryDone)return false;const T=window.RWARenkoTV;if(!T?.state)return false;const n=Number(T.state.confirmedData?.length||T.state.confirmed?.length||0);if(n>0){startupRecoveryDone=true;return true}
  if(sessionStorage.getItem('rwa_renko_gold_manual_setting_v1')==='1'){startupRecoveryDone=true;return false}startupRecoveryDone=true;
  try{if(window.RWARenkoATRControl?.applyLocal){const ok=await window.RWARenkoATRControl.applyLocal(14,`gold-display-${reason}`);if(ok){stats.startupRecoveries++;requestAnimationFrame(()=>sync('startup-atr14'));return true}}}catch(_){ }return false;
}
function markManual(e){if(e.target?.closest?.('[data-apply-method]'))sessionStorage.setItem('rwa_renko_gold_manual_setting_v1','1')}
document.addEventListener('click',markManual,true);
for(const ev of ['renko:gold-recent','renko:gold-total','renko:gold-origin','renko:atr-control-applied','renko:traditional-applied'])window.addEventListener(ev,()=>setTimeout(()=>{if(!sync(ev)&&ev==='renko:gold-recent')void recoverStartup(ev)},60));
window.addEventListener('renko:tv-ready',()=>setTimeout(()=>sync('tv-ready'),80));
window.addEventListener('load',()=>setTimeout(()=>{if(!sync('load'))void recoverStartup('load')},500),{once:true});
window.RWARenkoGoldDisplayGuard={version:'1.0.1',rule:'visible-chart-or-explicit-zero-brick-state-plus-one-time-stale-startup-recovery',stats,sync,recoverStartup};
})();

(()=>{
'use strict';
if(!window.RENKO_GOLD_ONLY||window.RWARenkoGoldViewportAuthority)return;
const M=window.RWARenkoGoldManualViewport;if(!M?.endHistoryMutation)return;
const root=document.documentElement;
const stats={holds:0,clears:0,rangeEvents:0,repairs:0,repairChecks:0,lastReason:'',lastHold:null};
let hold=null,queued=false,applying=false,bound=false;
const ts=()=>window.__RWARenkoChart?.timeScale?.()||null;
const finite=v=>Number.isFinite(Number(v));
const timeRange=r=>r&&finite(r.from)&&finite(r.to)?{from:Number(r.from),to:Number(r.to)}:null;
function options(t=ts()){try{const o=t?.options?.()||{};return{barSpacing:finite(o.barSpacing)?Number(o.barSpacing):null,rightOffset:finite(o.rightOffset)?Number(o.rightOffset):null}}catch(_){return{barSpacing:null,rightOffset:null}}}
function followingOff(){const T=window.RWARenkoTV;if(T?.state)T.state.following=false}
function clear(reason='user'){if(hold)stats.clears++;hold=null;stats.lastReason=reason;root.dataset.renkoGoldViewportAuthorityHold='false'}
function drift(){if(!hold)return false;const t=ts(),r=timeRange(t?.getVisibleRange?.()),o=options(t);if(!r)return true;return Math.abs(r.from-hold.time.from)>1||Math.abs(r.to-hold.time.to)>1||(finite(hold.barSpacing)&&finite(o.barSpacing)&&Math.abs(o.barSpacing-hold.barSpacing)>1e-9)||(finite(hold.rightOffset)&&finite(o.rightOffset)&&Math.abs(o.rightOffset-hold.rightOffset)>1e-9)}
function apply(reason='range-drift'){
  if(!hold||applying||M.inHistoryMutation)return false;const t=ts();if(!t)return false;applying=true;
  try{const o={};if(finite(hold.barSpacing))o.barSpacing=hold.barSpacing;if(finite(hold.rightOffset))o.rightOffset=hold.rightOffset;if(Object.keys(o).length)t.applyOptions?.(o);t.setVisibleRange(hold.time);followingOff();stats.repairs++;stats.lastReason=reason;root.dataset.renkoGoldViewportAuthorityRepairs=String(stats.repairs);return true}catch(_){return false}finally{applying=false}
}
function check(reason='range-event'){queued=false;if(!hold||M.inHistoryMutation)return;stats.repairChecks++;if(drift())apply(reason);else followingOff()}
function schedule(reason='range-event'){if(!hold||queued||applying)return;queued=true;requestAnimationFrame(()=>check(reason))}
function arm(result){const t=timeRange(result?.targetTime||result?.beforeTime);if(!t)return clear('no-target');hold={id:result?.id??null,time:t,barSpacing:finite(result?.barSpacingBefore)?Number(result.barSpacingBefore):null,rightOffset:finite(result?.rightOffsetBefore)?Number(result.rightOffsetBefore):null};stats.holds++;stats.lastHold={...hold,time:{...hold.time}};stats.lastReason='history-end';root.dataset.renkoGoldViewportAuthorityHold='true';root.dataset.renkoGoldViewportAuthorityId=String(hold.id??'');followingOff();schedule('history-end')}
const originalEnd=M.endHistoryMutation.bind(M);
M.endHistoryMutation=async(token,opts={})=>{const result=await originalEnd(token,opts);if(opts?.panOlder)clear('explicit-pan');else arm(result);return result};
function bind(){if(bound)return true;const t=ts();if(!t?.subscribeVisibleLogicalRangeChange)return false;bound=true;t.subscribeVisibleLogicalRangeChange(()=>{stats.rangeEvents++;if(hold&&!M.inHistoryMutation&&!applying)schedule('programmatic-range')});root.dataset.renkoGoldViewportAuthorityBound='true';return true}
const userStart=e=>{if(e.target?.closest?.('#chartWrap,#chartHost'))clear(e.type)};
document.addEventListener('wheel',userStart,{capture:true,passive:true});document.addEventListener('pointerdown',userStart,{capture:true,passive:true});document.addEventListener('touchstart',userStart,{capture:true,passive:true});
document.addEventListener('click',e=>{const id=e.target?.closest?.('button')?.id||'';if(id&&(['tvLive','tvReset','tvZoomIn','tvZoomOut','tvPanOlder','tvPanNewer','tvGoldOlder','tvGoldNewer','tvGoldOrigin','tvGoldMaxZoom'].includes(id)||e.target?.closest?.('[data-apply-method]')))clear(id||'method')},true);
for(const ev of ['renko:chart-ready','renko:tv-ready'])window.addEventListener(ev,bind);const poll=setInterval(()=>{if(bind())clearInterval(poll)},50);setTimeout(()=>clearInterval(poll),5000);
window.RWARenkoGoldViewportAuthority={version:'1.0.0-event-driven-history-hold',rule:'after-prepend viewport target remains authoritative against programmatic drift until next user gesture',stats,get hold(){return hold?{...hold,time:{...hold.time}}:null},clear,check,apply,bind};
})();
