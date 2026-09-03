(()=>{
'use strict';
if(document.documentElement.dataset.renkoMethodBootstrap==='186')return;
document.documentElement.dataset.renkoMethodBootstrap='186';
const old=document.getElementById('v15BoxCard');
if(old){const clean=old.cloneNode(true);clean.dataset.controller='v15.19-instant-apply';clean.removeAttribute('inert');clean.querySelectorAll('[inert]').forEach(x=>x.removeAttribute('inert'));clean.querySelectorAll('input,select,button').forEach(x=>{x.disabled=false;x.removeAttribute('disabled');x.removeAttribute('inert');x.style.pointerEvents='auto'});old.replaceWith(clean)}
let style=document.getElementById('v186InteractionStyle');if(!style){style=document.createElement('style');style.id='v186InteractionStyle';style.textContent='.v15-box-card,.v15-profile-grid,.v15-profile{pointer-events:auto!important}.v15-profile{opacity:1!important;filter:none!important}.v15-profile input,.v15-profile select,.v15-profile button,.v15-profile label,.v15-check,.v15-method{position:relative!important;z-index:40!important;pointer-events:auto!important}.v15-profile:before,.v15-profile:after,.v15-profile.applying:before,.v15-profile.applying:after{pointer-events:none!important}.v15-profile input{cursor:text!important}.v15-profile select,.v15-check,.v15-apply,.v15-method{cursor:pointer!important}.v15-profile [disabled]:not([type=hidden]){opacity:1!important;pointer-events:auto!important}.v15-profile[data-v15-profile="traditional"],.v15-profile[data-v15-profile="percentage"]{z-index:25!important}';document.head.appendChild(style)}
const q=new URLSearchParams(location.search),raw=String(q.get('symbol')||'BTC').toUpperCase().replace(/[^A-Z0-9]/g,''),symbol=raw.endsWith('USDT')?raw:`${raw}USDT`;
window.__RENKO_FIRST_FRAME_PRELOAD_SYMBOL__=symbol;
window.__RENKO_FIRST_FRAME_PRELOAD_PROMISE__=fetch(`preload/${encodeURIComponent(symbol)}.json?v=186`,{cache:'force-cache',credentials:'same-origin'}).then(r=>r.ok?r.json():null).catch(()=>null);
try{delete window.RWARenkoV15MethodProfiles}catch{window.RWARenkoV15MethodProfiles=null}
const loadController=()=>{const s=document.createElement('script');s.src='renko-v15-method-controller-v186.js?v=186';s.async=false;s.dataset.renkoController='186';s.onerror=()=>console.error('[RENKO] V186 controller failed to load');document.body.appendChild(s)};
const p=document.createElement('script');p.src='renko-v15-first-frame-preload.js?v=186';p.async=false;p.dataset.renkoFirstFrame='186';p.onload=loadController;p.onerror=()=>{console.error('[RENKO] V186 first-frame layer failed to load');loadController()};document.body.appendChild(p);
})();