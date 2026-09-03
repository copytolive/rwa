/* Fixed Renko source profile requested for production.
 * The chart always forms from Binance 1-second CLOSED klines using Close values.
 * No user-selectable timeframe/source control is exposed in production.
 */
(()=>{
'use strict';
if(window.RWARenko1sCloseLock)return;
const STORE='rwa_renko_tradingview_settings_v1';
function persist(){
  try{
    const raw=JSON.parse(localStorage.getItem(STORE)||'{}')||{};
    raw.source='close';raw.interval='1s';
    localStorage.setItem(STORE,JSON.stringify(raw));
  }catch{}
}
function lockDom(){
  const src=document.getElementById('sourceSelect'),intv=document.getElementById('intervalSelect');
  if(src)src.value='close';if(intv)intv.value='1s';
  const grid=document.querySelector('.source-grid');if(grid){grid.hidden=true;grid.setAttribute('aria-hidden','true')}
  const head=document.querySelector('.source-card .source-head');
  if(head)head.innerHTML='<div><small>FIXED RENKO SOURCE</small><b>1s CLOSE</b></div><small>Every confirmed source sample is a closed 1-second Binance kline · no selectable timeframe</small>';
}
persist();lockDom();
window.addEventListener('renko:tv-ready',()=>{
  persist();lockDom();
  const T=window.RWARenkoTV;if(!T)return;
  const wrong=T.settings.source!=='close'||T.settings.interval!=='1s';
  T.settings.source='close';T.settings.interval='1s';
  T.state.formationSource='fixed-1s-close';
  T.state.confirmationRule='1s-close';
  T.state.projectionRule='realtime-provisional-until-1s-close';
  T.state.fixedSourceProfile=true;
  if(wrong)void T.loadSymbol(T.state.symbol,{fit:false});
},{once:true});
const guard=()=>{
  const T=window.RWARenkoTV;if(!T)return;
  T.settings.source='close';T.settings.interval='1s';T.state.fixedSourceProfile=true;
  lockDom();
};
document.addEventListener('change',e=>{if(e.target?.id==='sourceSelect'||e.target?.id==='intervalSelect'){e.preventDefault();e.stopImmediatePropagation();guard()}},true);
window.RWARenko1sCloseLock={version:'1.0.0',rule:'fixed-binance-1s-closed-kline-close-no-selectable-timeframe',persist,lockDom,guard};
})();
