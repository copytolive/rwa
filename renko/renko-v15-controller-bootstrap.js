(()=>{
'use strict';
if(document.documentElement.dataset.renkoMethodBootstrap==='157')return;
document.documentElement.dataset.renkoMethodBootstrap='157';
const old=document.getElementById('v15BoxCard');
if(old){
  const clean=old.cloneNode(true);
  clean.dataset.controller='v15.7-abortable-controls';
  old.replaceWith(clean);
}
try{delete window.RWARenkoV15MethodProfiles}catch{window.RWARenkoV15MethodProfiles=null}
const s=document.createElement('script');
s.src='renko-v15-method-controller.js?v=157';
s.async=false;
s.dataset.renkoController='157';
s.onerror=()=>console.error('[RENKO] abortable method controller failed to load');
document.body.appendChild(s);
})();
