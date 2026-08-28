/* Keep the visible XAUT deep-ATR status synchronized with the already-validated matrix state. */
(()=>{
'use strict';
if(window.RWARenkoATRUiSync)return;
const XAUT='XAUTUSDT', MATRIX=[1,10,100,1000,10000,100000,1000000];
const num=v=>Number(v);
function allReady(){const A=window.RWARenkoATRFixed1s,e=A?.entries;if(!(e instanceof Map)||e.size<MATRIX.length)return false;return MATRIX.every(n=>{const x=e.get(n);return !!x?.satisfied&&Number.isFinite(num(x.rawAtr))&&num(x.rawAtr)>0&&num(x.sourceCount)>=n})}
function sync(){
  const T=window.RWARenkoTV,A=window.RWARenkoATRFixed1s;if(!T||!A||T.state?.symbol!==XAUT||T.settings?.method!=='atr'||!T.state?.atrMatrixPrepared||!T.state?.atrHistorySatisfied||!allReady())return false;
  const s=T.state,n=Math.max(1,Math.floor(num(s.atrAppliedLength||T.settings.atrLength)||14)),count=Math.max(num(s.atrHistorySourceCount)||0,...MATRIX.map(k=>num(A.entries.get(k)?.sourceCount)||0));
  document.documentElement.dataset.atrMatrixReady='true';
  document.documentElement.dataset.atrMatrixAvailable=String(Math.max(num(document.documentElement.dataset.atrMatrixAvailable)||0,count));
  const metric=document.getElementById('atrFixed1sMetric');if(metric)metric.textContent=`ATR 1s MATRIX · READY 7/7 · ${count.toLocaleString()} OKX 1s bars`;
  const badge=document.querySelector('.method[data-method="atr"] .method-title span');if(badge)badge.textContent=`ACTIVE · ${n}`;
  const source=document.getElementById('sourceBarCount');if(source)source.textContent=count.toLocaleString();
  return true;
}
window.addEventListener('renko:tv-ready',()=>setTimeout(sync,0));
window.addEventListener('renko:symbol-switch-end',()=>setTimeout(sync,0));
setInterval(sync,100);
window.RWARenkoATRUiSync={version:'1.0.0',rule:'show-ready-only-when-all-seven-real-entries-satisfied',sync,allReady};
})();
