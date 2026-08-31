(()=>{
'use strict';
if(window.RWAWalletAuth)return;
const WALLET_KEY='rwa_wallet_link_v1';
const SCOPED_KEY='rwa_wallet_scoped_v1';
const SCOPED=['rwa_profile_local_v1','rwa_watchlist_v1','rwa_alerts_v1','rwa_copy_v1','rwa_bookmarks_v1','rwa_asset_drafts_v1','rwa_copy_queue_v1'];
const $=id=>document.getElementById(id);
const short=a=>a?`${a.slice(0,6)}…${a.slice(-4)}`:'—';
const jget=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const jset=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const toastSafe=t=>typeof toast==='function'?toast(t):console.log(t);
let verified=false, currentWallet='';
function session(){const s=jget(WALLET_KEY,null);return s&&/^0x[a-fA-F0-9]{40}$/.test(s.wallet||'')?s:null}
function scoped(){return jget(SCOPED_KEY,{})}
function persistWalletScope(wallet=currentWallet){
  if(!wallet)return;const all=scoped(),row={};
  for(const k of SCOPED){const raw=localStorage.getItem(k);if(raw!=null)row[k]=raw}
  all[wallet.toLowerCase()]=row;jset(SCOPED_KEY,all);
}
function restoreWalletScope(wallet){
  const row=scoped()[wallet.toLowerCase()]||{};
  for(const k of SCOPED){if(Object.prototype.hasOwnProperty.call(row,k))localStorage.setItem(k,row[k]);else localStorage.removeItem(k)}
}
async function verifyStored(s){
  if(!s?.wallet||!s?.signature||!s?.message)return false;
  try{
    const {verifyMessage}=await import('https://esm.sh/ethers@6.15.0');
    return String(verifyMessage(s.message,s.signature)).toLowerCase()===String(s.wallet).toLowerCase();
  }catch{return false}
}
function ensureUI(){
  const top=document.querySelector('.top-actions');
  if(top&&!$('.mobile-wallet-auth')){const b=document.createElement('button');b.className='mobile-wallet-auth';b.type='button';b.textContent='Wallet';top.appendChild(b)}
  const head=document.querySelector('.suite-head-actions');
  if(head&&!$('walletLogout')){const b=document.createElement('button');b.id='walletLogout';b.className='suite-secondary wallet-logout';b.type='button';b.textContent='Logout';head.appendChild(b)}
  const p=document.querySelector('[data-suite-panel="profile"] .suite-grid');
  if(p&&!$('systemHealth')){
    const c=document.createElement('div');c.id='systemHealth';c.className='suite-card span-12 system-health';
    c.innerHTML='<div class="suite-card-head"><div><small>LIVE DIAGNOSTICS</small><h3>System health</h3></div><button id="runHealth">Run checks</button></div><div class="health-grid"><div><small>MARKET ENGINE</small><b id="healthMarket">Checking…</b></div><div><small>CHART</small><b id="healthChart">Checking…</b></div><div><small>WALLET LOGIN</small><b id="healthWallet">Checking…</b></div><div><small>HYPERLIQUID</small><b id="healthHL">Checking…</b></div><div><small>LOCAL STORAGE</small><b id="healthStorage">Checking…</b></div><div><small>ALERTS</small><b id="healthAlerts">Checking…</b></div><div><small>RWA REGISTRY</small><b id="healthRwa">Checking…</b></div><div><small>SOCIAL RELAY</small><b id="healthSocial">Optional</b></div></div>';
    p.appendChild(c);
  }
  if(!document.getElementById('wallet-auth-style')){
    const st=document.createElement('style');st.id='wallet-auth-style';st.textContent=`
      .mobile-wallet-auth{display:none;height:32px;padding:0 9px;border:1px solid #2a3442;border-radius:9px;background:#0d1219;color:#dfe3ea;font:800 7px/1 system-ui}.wallet-logout{display:none}.health-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.health-grid>div{padding:8px;border:1px solid #202a35;border-radius:8px;background:#0d131a;min-width:0}.health-grid small{display:block;font-size:5.5px;color:#697584}.health-grid b{display:block;margin-top:3px;font-size:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.health-ok{color:#39dca2!important}.health-warn{color:#f1c46c!important}.health-bad{color:#ff697a!important}@media(max-width:680px){.mobile-wallet-auth{display:block}.health-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.wallet-logout{display:block!important}.top-actions .signin{display:none!important}}
    `;document.head.appendChild(st)
  }
}
function mark(id,text,kind=''){const e=$(id);if(!e)return;e.textContent=text;e.className=kind?`health-${kind}`:''}
function updateLabels(){
  ensureUI();const s=session(),logged=!!(s&&verified),wallet=s?.wallet||'';
  currentWallet=wallet.toLowerCase();
  const sign=document.querySelector('.signin');if(sign){sign.textContent=logged?`${short(wallet)} · Logout`:'Connect Wallet';sign.title=logged?'Logout wallet session':'Login with wallet signature'}
  const mobile=document.querySelector('.mobile-wallet-auth');if(mobile){mobile.textContent=logged?short(wallet):'Wallet';mobile.title=logged?'Logout':'Connect Wallet'}
  const logout=$('walletLogout');if(logout){logout.style.display=logged?'inline-flex':'none'}
  const ws=$('walletStatus');if(ws){ws.textContent=logged?short(wallet):'Wallet offline';ws.className='suite-status'+(logged?' ok':'')}
  const ns=$('nostrStatus');if(ns&&!ns.classList.contains('ok')){ns.textContent='Social relay optional';ns.className='suite-status'}
  const identity=$('profileIdentity');if(identity)identity.textContent=logged?'Wallet signature':'Connect wallet';
  const pw=$('profileWallet');if(pw)pw.textContent=logged?short(wallet):'Not connected';
  const strip=document.querySelector('[data-suite-panel="profile"] .identity-strip');if(strip){const labels=strip.querySelectorAll('small');if(labels[0])labels[0].textContent='LOGIN';if(labels[1])labels[1].textContent='WALLET'}
  document.querySelectorAll('#connectNostr').forEach(b=>{b.textContent='Enable Social Relay';b.title='Optional publishing layer — not a login method'});
  document.querySelectorAll('#connectWallet,#portfolioConnect,#tradeConnect').forEach(b=>{b.textContent=logged?'Wallet connected':'Connect Wallet';b.disabled=logged});
  const feed=document.querySelector('[data-suite-panel="feed"] .suite-muted');if(feed)feed.textContent='Wallet is the only login. Social Relay is optional for public signed publishing.';
  if(logged&&$('pnlVerifyStatus')){$('pnlVerifyStatus').textContent='SIGNED WALLET · VENUE DATA';$('pnlVerifyStatus').className='suite-status ok'}
  rewriteEmptyStates();
}
function rewriteEmptyStates(){
  document.querySelectorAll('.suite-empty').forEach(e=>{
    if(/Connect Nostr \+ wallet/i.test(e.textContent||''))e.textContent='No public traders found yet. Wallet is the login; enable optional Social Relay if you want your wallet profile discoverable on the public leaderboard.';
    if(/Connect social identity to publish/i.test(e.textContent||''))e.textContent='Wallet is your login. Enable optional Social Relay only when you want to publish signed posts to the public network.';
  })
}
async function login(){
  const existing=session();if(existing&&await verifyStored(existing)){verified=true;currentWallet=existing.wallet.toLowerCase();updateLabels();return}
  if(!window.RWASuite?.connectWallet){toastSafe('Wallet module is still loading');return}
  const before=session()?.wallet?.toLowerCase()||'';
  await window.RWASuite.connectWallet();
  const s=session();if(!s)return;
  const ok=await verifyStored(s);if(!ok){localStorage.removeItem(WALLET_KEY);toastSafe('Wallet signature could not be verified');return}
  verified=true;currentWallet=s.wallet.toLowerCase();
  if(before!==currentWallet)restoreWalletScope(currentWallet);
  sessionStorage.setItem('rwa_wallet_just_logged_in','1');
  location.reload();
}
function logout(reason='Wallet logged out'){
  const s=session();if(s?.wallet)persistWalletScope(s.wallet);
  localStorage.removeItem(WALLET_KEY);sessionStorage.removeItem('rwa_active_copy_signal');
  for(const k of SCOPED)localStorage.removeItem(k);
  try{const c=jget('rwa_copy_v1',null);if(c){c.enabled=false;jset('rwa_copy_v1',c)}}catch{}
  sessionStorage.setItem('rwa_wallet_logout_message',reason);location.reload();
}
function saveProfileScope(){const s=session();if(!s?.wallet)return;setTimeout(()=>{persistWalletScope(s.wallet);toastSafe('Profile saved for this wallet. Social Relay remains optional.')},80)}
async function runHealth(){
  mark('healthMarket',typeof S!=='undefined'&&Array.isArray(S.pairs)&&S.pairs.length?`${S.pairs.length} markets`:'Not ready',typeof S!=='undefined'&&S.pairs?.length?'ok':'warn');
  mark('healthChart',document.querySelector('#tvHost iframe')?'TradingView live':$('fallbackChart')?'Fallback ready':'Unavailable',document.querySelector('#tvHost iframe')?'ok':$('fallbackChart')?'warn':'bad');
  mark('healthWallet',verified&&session()?short(session().wallet):'Not logged in',verified?'ok':'warn');
  try{localStorage.setItem('__rwa_test','1');localStorage.removeItem('__rwa_test');mark('healthStorage','Ready','ok')}catch{mark('healthStorage','Blocked','bad')}
  mark('healthAlerts','Notification'in window?(Notification.permission==='granted'?'Ready':Notification.permission==='denied'?'Blocked':'Permission needed'):'Unsupported','Notification'in window?(Notification.permission==='denied'?'bad':'ok'):'bad');
  mark('healthSocial',window.nostr?'Available · optional':'Optional signer absent',window.nostr?'ok':'warn');
  try{const r=await fetch('https://api.hyperliquid.xyz/info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'allMids'})});mark('healthHL',r.ok?'API reachable':`HTTP ${r.status}`,r.ok?'ok':'bad')}catch{mark('healthHL','Unreachable','bad')}
  try{const r=await fetch(`rwa-assets.json?h=${Date.now()}`,{cache:'no-store'}),j=await r.json();mark('healthRwa',Array.isArray(j.verified)?`${j.verified.length} verified`:'Invalid registry',Array.isArray(j.verified)?'ok':'bad')}catch{mark('healthRwa','Registry error','bad')}
}
async function boot(){
  ensureUI();
  const s=session();verified=await verifyStored(s);if(s&&!verified)localStorage.removeItem(WALLET_KEY);
  if(verified&&s?.wallet){currentWallet=s.wallet.toLowerCase();try{await window.RWASuite?.loadHyperliquid?.(s.wallet)}catch{};persistWalletScope(s.wallet)}
  updateLabels();runHealth();
  const msg=sessionStorage.getItem('rwa_wallet_logout_message');if(msg){sessionStorage.removeItem('rwa_wallet_logout_message');toastSafe(msg)}
  if(sessionStorage.getItem('rwa_wallet_just_logged_in')){sessionStorage.removeItem('rwa_wallet_just_logged_in');toastSafe('Wallet login verified')}
  if(window.ethereum?.on){window.ethereum.on('accountsChanged',accounts=>{const active=session()?.wallet?.toLowerCase();const next=(accounts?.[0]||'').toLowerCase();if(active&&next!==active)logout('Wallet account changed — please login again')})}
  const observer=new MutationObserver(()=>{updateLabels();rewriteEmptyStates()});const suite=$('suite');if(suite)observer.observe(suite,{childList:true,subtree:true});
}
document.addEventListener('click',e=>{
  const auth=e.target.closest('.signin,.mobile-wallet-auth,#connectWallet,#portfolioConnect,#tradeConnect');if(auth){e.preventDefault();e.stopImmediatePropagation();if(verified&&session())logout();else login();return}
  if(e.target.closest('#walletLogout')){e.preventDefault();e.stopImmediatePropagation();logout();return}
  if(e.target.closest('#runHealth')){e.preventDefault();runHealth();return}
  if(e.target.closest('#saveProfile'))saveProfileScope();
},true);
addEventListener('beforeunload',()=>{if(currentWallet)persistWalletScope(currentWallet)});
window.RWAWalletAuth={login,logout,runHealth,isLoggedIn:()=>verified&&!!session()};
setTimeout(boot,0);
})();