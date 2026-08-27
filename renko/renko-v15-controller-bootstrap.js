(()=>{
'use strict';
if(document.documentElement.dataset.renkoMethodBootstrap==='156')return;
document.documentElement.dataset.renkoMethodBootstrap='156';
const old=document.getElementById('v15BoxCard');
if(old){
  const clean=old.cloneNode(true);
  clean.dataset.controller='v15.6-nonblocking-click';
  old.replaceWith(clean);
}
try{delete window.RWARenkoV15MethodProfiles}catch{window.RWARenkoV15MethodProfiles=null}
const s=document.createElement('script');
s.src='renko-v15-method-controller.js?v=156';
s.async=false;
s.dataset.renkoController='156';
s.onerror=()=>console.error('[RENKO] nonblocking method controller failed to load');
document.body.appendChild(s);
})();
