(()=>{
'use strict';
if(document.documentElement.dataset.renkoMethodBootstrap==='155')return;
document.documentElement.dataset.renkoMethodBootstrap='155';
const old=document.getElementById('v15BoxCard');
if(old){
  const clean=old.cloneNode(true);
  clean.dataset.controller='v15.5-instant-click';
  old.replaceWith(clean);
}
try{delete window.RWARenkoV15MethodProfiles}catch{window.RWARenkoV15MethodProfiles=null}
const s=document.createElement('script');
s.src='renko-v15-method-controller.js?v=155';
s.async=false;
s.dataset.renkoController='155';
s.onerror=()=>console.error('[RENKO] instant method controller failed to load');
document.body.appendChild(s);
})();
