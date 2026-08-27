(()=>{
'use strict';
if(document.documentElement.dataset.renkoMethodBootstrap==='153')return;
document.documentElement.dataset.renkoMethodBootstrap='153';
const old=document.getElementById('v15BoxCard');
if(old){
  const clean=old.cloneNode(true);
  clean.dataset.controller='v15.3-verified-only';
  old.replaceWith(clean);
}
try{delete window.RWARenkoV15MethodProfiles}catch{window.RWARenkoV15MethodProfiles=null}
const s=document.createElement('script');
s.src='renko-v15-method-controller.js?v=153';
s.async=false;
s.dataset.renkoController='153';
s.onerror=()=>console.error('[RENKO] verified method controller failed to load');
document.body.appendChild(s);
})();
