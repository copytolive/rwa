(()=>{
'use strict';
if(window.RWAReferenceParityV21Seal)return;
const VERSION='1.0.0';
let observer=null,timer=null,applied=false;
const $=s=>document.querySelector(s);
function visible(el){return !!el&&el.hidden!==true&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden'}
function apply(){
  const canvas=$('#rwaV21Chart');
  const indicator=$('#rwaRefIndicatorOverlay');
  const line=$('#rwaRefLineChart');
  if(!canvas||!indicator||!line)return false;
  const overlay=visible(indicator)||visible(line);
  canvas.style.setProperty('z-index',overlay?'8':'108','important');
  canvas.dataset.v21SealLayer=overlay?'interactive-overlay':'clean-candles';
  document.documentElement.dataset.rwaV21ChartOverlay=overlay?'1':'0';
  document.documentElement.dataset.rwaV21CandleSeal=overlay?'interactive':'sealed';
  applied=true;
  return true
}
function watch(){
  observer?.disconnect();
  observer=new MutationObserver(()=>requestAnimationFrame(apply));
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class','style']});
  if(timer)clearInterval(timer);
  timer=setInterval(()=>{if(!document.hidden)apply()},50);
  apply();
  return true
}
function boot(){
  let tries=0;
  const spin=()=>{
    tries++;
    if($('#rwaV21Chart')&&$('#rwaRefIndicatorOverlay')&&$('#rwaRefLineChart')){
      watch();
      window.dispatchEvent(new CustomEvent('rwa:reference-v21-sealed',{detail:{version:VERSION,defaultLayer:108,interactiveLayer:8}}));
      return;
    }
    if(tries<120)setTimeout(spin,100)
  };
  spin()
}
window.RWAReferenceParityV21Seal={version:VERSION,apply,watch,get applied(){return applied},audit(){const c=$('#rwaV21Chart'),i=$('#rwaRefIndicatorOverlay'),l=$('#rwaRefLineChart');return{version:VERSION,applied,overlay:visible(i)||visible(l),canvasZ:c?Number.parseInt(getComputedStyle(c).zIndex,10)||0:null,indicatorHidden:i?.hidden===true,lineHidden:l?.hidden===true,mode:c?.dataset.v21SealLayer||''}}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
