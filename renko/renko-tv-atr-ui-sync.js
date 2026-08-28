/* Keep the visible XAUT deep-ATR status synchronized with the currently applied, validated deep ATR state. */
(()=>{
'use strict';
if(window.RWARenkoATRUiSync)return;
const XAUT='XAUTUSDT';
const num=v=>Number(v);
function sync(){
  const T=window.RWARenkoTV;if(!T||T.state?.symbol!==XAUT||T.settings?.method!=='atr')return false;
  const s=T.state,n=Math.max(1,Math.floor(num(s.atrAppliedLength||T.settings.atrLength)||14)),count=num(s.atrHistorySourceCount)||0,raw=num(s.atrRaw),box=num(s.box),tol=Math.max(1e-12,Math.abs(raw)*1e-10);
  const valid=!!s.atrHistorySatisfied&&count>=n&&Number.isFinite(raw)&&raw>0&&Number.isFinite(box)&&Math.abs(raw-box)<=tol;
  if(!valid)return false;
  const metric=document.getElementById('atrFixed1sMetric');if(metric)metric.textContent=`ATR 1s ACTIVE · LENGTH ${n.toLocaleString()} · ${count.toLocaleString()} OKX 1s bars`;
  const badge=document.querySelector('.method[data-method="atr"] .method-title span');if(badge)badge.textContent=`ACTIVE · ${n}`;
  const source=document.getElementById('sourceBarCount');if(source)source.textContent=count.toLocaleString();
  return true;
}
window.addEventListener('renko:tv-ready',()=>setTimeout(sync,0));
window.addEventListener('renko:symbol-switch-end',()=>setTimeout(sync,0));
setInterval(sync,75);
window.RWARenkoATRUiSync={version:'1.1.0',rule:'visible-status-follows-current-real-deep-atr-state',sync};
})();
