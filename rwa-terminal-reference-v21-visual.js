(()=>{
'use strict';
if(window.RWAReferenceParityV21Visual)return;
const VERSION='1.0.1';
let applied=false,tries=0;
function normalize(){
  if(applied)return true;
  tries++;
  const parity=window.RWAReferenceParity;
  const indicator=document.querySelector('#rwaRefIndicatorOverlay');
  const indicatorButton=document.querySelector('[data-ref-indicator]');
  const line=document.querySelector('#rwaRefLineChart');
  if(!parity||!indicator||!indicatorButton||!line){if(tries<20)setTimeout(normalize,100);return false}
  /* v20 starts in candles + indicator=true. Toggle ONLY the indicator once.
     Never touch chart-style: candles is already the truthful reference default. */
  indicatorButton.click();
  requestAnimationFrame(()=>{
    applied=indicator.hidden===true && line.hidden===true;
    document.documentElement.dataset.rwaReferenceV21Visual=applied?'candles-clean':'pending';
    if(applied)window.dispatchEvent(new CustomEvent('rwa:reference-v21-visual-ready',{detail:{version:VERSION,chart:'candles',indicator:'off-by-default'}}));
    else if(tries<20)setTimeout(normalize,100);
  });
  return true
}
function boot(){setTimeout(normalize,250)}
window.RWAReferenceParityV21Visual={version:VERSION,normalize,get applied(){return applied}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
