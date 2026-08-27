(()=>{
'use strict';
if(document.documentElement.dataset.renkoMethodBootstrap==='158')return;
document.documentElement.dataset.renkoMethodBootstrap='158';
const old=document.getElementById('v15BoxCard');
if(old){
  const clean=old.cloneNode(true);
  clean.dataset.controller='v15.8-fast-abortable-controls';
  old.replaceWith(clean);
}
let style=document.getElementById('v158InteractionStyle');
if(!style){
  style=document.createElement('style');style.id='v158InteractionStyle';
  style.textContent='.v15-box-card,.v15-profile-grid,.v15-profile{pointer-events:auto!important}.v15-profile input,.v15-profile select,.v15-profile button,.v15-profile label,.v15-check{position:relative!important;z-index:20!important;pointer-events:auto!important}.v15-profile.hydrating:before,.v15-profile.hydrating:after,.v15-profile.applying:before,.v15-profile.applying:after{pointer-events:none!important}.v15-profile input,.v15-profile select{cursor:text}.v15-profile select,.v15-check,.v15-apply{cursor:pointer!important}.v15-profile [disabled]:not([type=hidden]){pointer-events:auto!important}';
  document.head.appendChild(style);
}
try{delete window.RWARenkoV15MethodProfiles}catch{window.RWARenkoV15MethodProfiles=null}
const s=document.createElement('script');
s.src='renko-v15-method-controller.js?v=158';
s.async=false;
s.dataset.renkoController='158';
s.onerror=()=>console.error('[RENKO] fast abortable method controller failed to load');
document.body.appendChild(s);
})();
