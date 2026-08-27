(()=>{
'use strict';
if(document.documentElement.dataset.renkoMethodBootstrap==='154')return;
document.documentElement.dataset.renkoMethodBootstrap='154';
const old=document.getElementById('v15BoxCard');
if(old){
  const clean=old.cloneNode(true);
  clean.dataset.controller='v15.4-renderable-only';
  old.replaceWith(clean);
}
try{delete window.RWARenkoV15MethodProfiles}catch{window.RWARenkoV15MethodProfiles=null}
const s=document.createElement('script');
s.src='renko-v15-method-controller.js?v=154';
s.async=false;
s.dataset.renkoController='154';
s.onerror=()=>console.error('[RENKO] renderable method controller failed to load');
document.body.appendChild(s);
})();
