(()=>{
'use strict';
if(document.documentElement.dataset.renkoMethodBootstrap==='170')return;
document.documentElement.dataset.renkoMethodBootstrap='170';
const old=document.getElementById('v15BoxCard');
if(old){
  const clean=old.cloneNode(true);
  clean.dataset.controller='v15.10-all-methods-operable';
  clean.removeAttribute('inert');
  clean.querySelectorAll('[inert]').forEach(x=>x.removeAttribute('inert'));
  clean.querySelectorAll('input,select,button').forEach(x=>{x.disabled=false;x.removeAttribute('disabled');x.removeAttribute('inert');x.style.pointerEvents='auto'});
  old.replaceWith(clean);
}
let style=document.getElementById('v170InteractionStyle');
if(!style){
  style=document.createElement('style');style.id='v170InteractionStyle';
  style.textContent='.v15-box-card,.v15-profile-grid,.v15-profile{pointer-events:auto!important}.v15-profile{opacity:1!important;filter:none!important}.v15-profile input,.v15-profile select,.v15-profile button,.v15-profile label,.v15-check,.v15-method{position:relative!important;z-index:40!important;pointer-events:auto!important}.v15-profile:before,.v15-profile:after,.v15-profile.hydrating:before,.v15-profile.hydrating:after,.v15-profile.applying:before,.v15-profile.applying:after{pointer-events:none!important}.v15-profile input{cursor:text!important}.v15-profile select,.v15-check,.v15-apply,.v15-method{cursor:pointer!important}.v15-profile [disabled]:not([type=hidden]){opacity:1!important;pointer-events:auto!important}.v15-profile[data-v15-profile="traditional"],.v15-profile[data-v15-profile="percentage"]{z-index:25!important}';
  document.head.appendChild(style);
}
try{delete window.RWARenkoV15MethodProfiles}catch{window.RWARenkoV15MethodProfiles=null}
const s=document.createElement('script');
s.src='renko-v15-method-controller-v170.js?v=170';
s.async=false;
s.dataset.renkoController='170';
s.onerror=()=>console.error('[RENKO] all-method controller failed to load');
document.body.appendChild(s);
})();
