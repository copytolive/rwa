/* Keep the visible XAUT deep-ATR status synchronized with the currently applied, validated deep ATR state. */
(()=>{
'use strict';
if(window.RWARenkoATRUiSync)return;
const XAUT='XAUTUSDT';
const num=v=>Number(v);
let geometryBusy=false,geometryBox=0,geometryRevision=0;
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
async function ensureDeepGeometry(){
  const T=window.RWARenkoTV,A=window.RWARenkoATRFixed1s,d=document.documentElement.dataset;
  if(geometryBusy||!T||T.state?.symbol!==XAUT||T.state?.status!=='live'||d.atrMatrixReady!=='true'||!A?.entries||!T.engine?.build||typeof T.loadOlderPage!=='function')return false;
  const positive=[...A.entries.values()].map(e=>num(e?.rawAtr)).filter(x=>Number.isFinite(x)&&x>0),maxBox=positive.length?Math.max(...positive):0;
  if(!(maxBox>0))return false;
  const rev=num(A.revision)||0;
  const probe=()=>{try{return num(T.engine.build(T.state.closedBars,{...T.settings,method:'atr',atrLength:1,_exactBox:maxBox},T.state.tickSize)?.bricks?.length)>0}catch{return true}};
  if(probe()){geometryBox=maxBox;geometryRevision=rev;d.atrGeometryReady='true';d.atrGeometryHistoryPages=String(num(T.state.historyPages)||1);return true}
  if(geometryBox===maxBox&&geometryRevision===rev&&d.atrGeometryReady==='false')return false;
  geometryBusy=true;d.atrGeometryReady='warming';
  try{
    let ready=false,pages=0;
    while(!(ready=probe())&&pages<64){const added=await T.loadOlderPage();if(!added)break;pages++}
    geometryBox=maxBox;geometryRevision=rev;d.atrGeometryReady=ready?'true':'false';d.atrGeometryHistoryPages=String(num(T.state.historyPages)||1);
    if(ready&&T.settings?.method==='atr'&&num(T.state?.atrRaw)>0&&num(T.state?.confirmed?.length)===0)T.rebuild({fit:false});
    return ready;
  }catch(e){d.atrGeometryReady='error';d.atrGeometryError=String(e?.message||e).slice(0,300);return false}finally{geometryBusy=false}
}
function loadPreset5Y(){
  if(!document.querySelector('link[data-renko-presets5y]')){const l=document.createElement('link');l.rel='stylesheet';l.href='renko-tv-presets-5y.css?v=1';l.dataset.renkoPresets5y='true';document.head.appendChild(l)}
  if(!window.RWARenkoPreset5Y&&!document.querySelector('script[data-renko-presets5y]')){const s=document.createElement('script');s.src='renko-tv-presets-5y.js?v=1';s.dataset.renkoPresets5y='true';document.body.appendChild(s)}
}
window.addEventListener('renko:tv-ready',()=>setTimeout(()=>{sync();void ensureDeepGeometry()},0));
window.addEventListener('renko:symbol-switch-end',()=>setTimeout(()=>{sync();void ensureDeepGeometry()},0));
setInterval(()=>{sync();void ensureDeepGeometry()},50);
loadPreset5Y();
window.RWARenkoATRUiSync={version:'1.3.0',rule:'visible-status-plus-live-refresh-deep-atr-geometry-sufficiency',sync,ensureDeepGeometry,loadPreset5Y,get geometryBusy(){return geometryBusy}};
})();
