(()=>{
'use strict';
if(window.RWAReferenceParityV21Visual)return;
const VERSION='1.0.0';
let applied=false;
function normalize(){
  if(applied)return;
  const line=document.querySelector('#rwaRefLineChart');
  const style=document.querySelector('[data-ref-chart-style]');
  if(line&&style&&!line.hidden)style.click();
  const indicator=document.querySelector('#rwaRefIndicatorOverlay');
  const indicatorButton=document.querySelector('[data-ref-indicator]');
  if(indicator&&indicatorButton&&!indicator.hidden)indicatorButton.click();
  applied=true;
  document.documentElement.dataset.rwaReferenceV21Visual='candles-clean';
  window.dispatchEvent(new CustomEvent('rwa:reference-v21-visual-ready',{detail:{version:VERSION,chart:'candles',indicator:'off-by-default'}}));
}
function boot(){
  requestAnimationFrame(()=>setTimeout(normalize,0));
  setTimeout(normalize,400);
}
window.RWAReferenceParityV21Visual={version:VERSION,normalize,get applied(){return applied}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
