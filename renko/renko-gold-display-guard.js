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
  if(n>0){
    empty.classList.add('hide');empty.setAttribute('aria-hidden','true');
    stats.visibleStates++;root.dataset.renkoGoldChartVisible='true';
    try{window.__RWARenkoChart?.priceScale?.('right')?.applyOptions?.({autoScale:true})}catch(_){ }
    return true;
  }
  setEmptyContent(T);empty.classList.remove('hide');empty.setAttribute('aria-hidden','false');
  stats.emptyStates++;root.dataset.renkoGoldChartVisible='false';
  return false;
}
async function recoverStartup(reason='startup'){
  if(startupRecoveryDone)return false;
  const T=window.RWARenkoTV;if(!T?.state)return false;
  const n=Number(T.state.confirmedData?.length||T.state.confirmed?.length||0);
  if(n>0){startupRecoveryDone=true;return true}
  // Only recover a stale persisted startup configuration once. Manual settings
  // chosen after the page is ready remain untouched and get a clear empty state.
  if(sessionStorage.getItem('rwa_renko_gold_manual_setting_v1')==='1'){startupRecoveryDone=true;return false}
  startupRecoveryDone=true;
  try{
    if(window.RWARenkoATRControl?.applyLocal){
      const ok=await window.RWARenkoATRControl.applyLocal(14,`gold-display-${reason}`);
      if(ok){stats.startupRecoveries++;requestAnimationFrame(()=>sync('startup-atr14'));return true}
    }
  }catch(_){ }
  return false;
}
function markManual(e){if(e.target?.closest?.('[data-apply-method]'))sessionStorage.setItem('rwa_renko_gold_manual_setting_v1','1')}
document.addEventListener('click',markManual,true);
for(const ev of ['renko:gold-recent','renko:gold-total','renko:gold-origin','renko:atr-control-applied','renko:traditional-applied']){
  window.addEventListener(ev,()=>setTimeout(()=>{if(!sync(ev)&&ev==='renko:gold-recent')void recoverStartup(ev)},60));
}
window.addEventListener('renko:tv-ready',()=>setTimeout(()=>sync('tv-ready'),80));
window.addEventListener('load',()=>setTimeout(()=>{if(!sync('load'))void recoverStartup('load')},500),{once:true});
window.RWARenkoGoldDisplayGuard={version:'1.0.0',rule:'visible-chart-or-explicit-zero-brick-state-plus-one-time-stale-startup-recovery',stats,sync,recoverStartup};
})();
