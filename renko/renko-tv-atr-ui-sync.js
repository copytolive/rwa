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
function loadPreset5Y(){
  if(window.RENKO_GOLD_ONLY)return false;
  if(!document.querySelector('link[data-renko-presets5y]')){const l=document.createElement('link');l.rel='stylesheet';l.href='renko-tv-presets-5y.css?v=1';l.dataset.renkoPresets5y='true';document.head.appendChild(l)}
  if(!window.RWARenkoPreset5Y&&!document.querySelector('script[data-renko-presets5y]')){const s=document.createElement('script');s.src='renko-tv-presets-5y.js?v=1';s.dataset.renkoPresets5y='true';document.body.appendChild(s)}
  return true;
}
window.addEventListener('renko:tv-ready',()=>setTimeout(sync,0));
window.addEventListener('renko:symbol-switch-end',()=>setTimeout(sync,0));
setInterval(sync,75);
if(!window.RENKO_GOLD_ONLY)loadPreset5Y();
window.RWARenkoATRUiSync={version:'1.3.0',rule:'visible-status-follows-current-real-deep-atr-state-no-legacy-presets-in-gold-only-shell',sync,loadPreset5Y};
})();
