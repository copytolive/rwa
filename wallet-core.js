(()=>{
'use strict';
if(window.RWAWalletAuth)return;
const KEY='rwa_wallet_link_v1';
const $=id=>document.getElementById(id);
const providers=[];
let verified=false,current=null,busy=false;
const short=a=>a?`${a.slice(0,6)}…${a.slice(-4)}`:'—';
const toast=t=>typeof window.toast==='function'?window.toast(t):console.log(t);
function session(){try{const s=JSON.parse(localStorage.getItem(KEY)||'null');return s&&/^0x[a-fA-F0-9]{40}$/.test(s.wallet||'')?s:null}catch{return null}}
function validSession(s){return !!(s&&/^0x[a-fA-F0-9]{40}$/.test(s.wallet||'')&&typeof s.signature==='string'&&s.signature.startsWith('0x')&&typeof s.message==='string'&&s.message.includes('RWA Wallet Login')&&s.message.includes(`Domain: ${location.host}`))}
function addProvider(info,provider){if(!provider)return;const id=info?.uuid||info?.rdns||info?.name||String(providers.length);if(providers.some(x=>x.id===id||x.provider===provider))return;providers.push({id,info:info||{name:'Browser Wallet'},provider})}
window.addEventListener('eip6963:announceProvider',e=>addProvider(e.detail?.info,e.detail?.provider));
try{window.dispatchEvent(new Event('eip6963:requestProvider'))}catch{}
if(window.ethereum?.providers)for(const p of window.ethereum.providers)addProvider({name:p.isMetaMask?'MetaMask':p.isCoinbaseWallet?'Coinbase Wallet':'Browser Wallet'},p);
else if(window.ethereum)addProvider({name:window.ethereum.isMetaMask?'MetaMask':window.ethereum.isCoinbaseWallet?'Coinbase Wallet':'Browser Wallet'},window.ethereum);
function ensureUI(){
  const top=document.querySelector('.top-actions');
  if(top&&!document.querySelector('.mobile-wallet-auth')){const b=document.createElement('button');b.className='mobile-wallet-auth';b.type='button';b.textContent='Wallet';top.appendChild(b)}
  if(!document.getElementById('wallet-core-style')){const s=document.createElement('style');s.id='wallet-core-style';s.textContent='.mobile-wallet-auth{display:none;height:32px;padding:0 9px;border:1px solid #2a3442;border-radius:9px;background:#0d1219;color:#dfe3ea;font:800 7px/1 system-ui}.rwa-wallet-picker{position:fixed;inset:0;z-index:99999;background:rgba(2,5,9,.78);backdrop-filter:blur(10px);display:grid;place-items:center;padding:20px}.rwa-wallet-card{width:min(390px,100%);background:#0c1219;border:1px solid #263241;border-radius:16px;padding:14px;box-shadow:0 25px 80px #000}.rwa-wallet-card h3{margin:0 0 4px;font:800 16px system-ui;color:#fff}.rwa-wallet-card p{margin:0 0 12px;font:500 11px/1.45 system-ui;color:#8391a1}.rwa-wallet-list{display:grid;gap:7px}.rwa-wallet-list button{display:flex;align-items:center;gap:10px;width:100%;min-height:48px;padding:9px 11px;border:1px solid #263241;border-radius:10px;background:#111923;color:#eef3f8;text-align:left;font:750 12px system-ui}.rwa-wallet-list img{width:26px;height:26px;border-radius:7px}.rwa-wallet-cancel{margin-top:9px!important;justify-content:center!important;color:#8e9bab!important}@media(max-width:680px){.mobile-wallet-auth{display:block}.top-actions .signin{display:none!important}}';document.head.appendChild(s)}
}
function labels(){ensureUI();const s=session(),logged=verified&&validSession(s);const b=document.querySelector('.signin');if(b){b.textContent=logged?`${short(s.wallet)} · Logout`:'Connect Wallet';b.disabled=busy}const m=document.querySelector('.mobile-wallet-auth');if(m){m.textContent=logged?short(s.wallet):'Wallet';m.disabled=busy}document.querySelectorAll('#connectWallet,#portfolioConnect,#tradeConnect').forEach(x=>{x.textContent=logged?'Wallet connected':'Connect Wallet';x.disabled=logged||busy});const ws=$('walletStatus');if(ws){ws.textContent=logged?short(s.wallet):'Wallet offline';ws.className='suite-status'+(logged?' ok':'')}}
function picker(list){return new Promise(resolve=>{const root=document.createElement('div');root.className='rwa-wallet-picker';const card=document.createElement('div');card.className='rwa-wallet-card';card.innerHTML='<h3>Connect wallet</h3><p>Your wallet is your RWA account. Choose a wallet and approve one login signature.</p>';const box=document.createElement('div');box.className='rwa-wallet-list';for(const x of list){const b=document.createElement('button');if(x.info?.icon){const im=document.createElement('img');im.src=x.info.icon;b.appendChild(im)}const sp=document.createElement('span');sp.textContent=x.info?.name||'Browser Wallet';b.appendChild(sp);b.onclick=()=>{root.remove();resolve(x.provider)};box.appendChild(b)}const cancel=document.createElement('button');cancel.className='rwa-wallet-cancel';cancel.textContent='Cancel';cancel.onclick=()=>{root.remove();resolve(null)};box.appendChild(cancel);card.appendChild(box);root.appendChild(card);document.body.appendChild(root)})}
async function chooseProvider(){if(window.RWAProvider)return window.RWAProvider;try{window.dispatchEvent(new Event('eip6963:requestProvider'));await new Promise(r=>setTimeout(r,100))}catch{};if(providers.length===1)return providers[0].provider;if(providers.length>1)return picker(providers);if(window.ethereum)return window.ethereum;const project=localStorage.getItem('rwa_wc_project_v1');if(project&&window.RWAWalletConnect){await window.RWAWalletConnect.connect(project);return window.RWAProvider||null}return null}
async function providerRecover(p,hex,signature,expected){try{const recovered=String(await p.request({method:'personal_ecRecover',params:[hex,signature]})).toLowerCase();return recovered===expected.toLowerCase()}catch{return true}}
async function signWith(p){
  let accounts=await p.request({method:'eth_accounts'}).catch(()=>[]);
  if(!accounts?.length)accounts=await p.request({method:'eth_requestAccounts'});
  const addr=String(accounts?.[0]||'').toLowerCase();
  if(!/^0x[a-f0-9]{40}$/.test(addr))throw Error('Wallet address unavailable');
  const chain=await p.request({method:'eth_chainId'}).catch(()=>''),issued=new Date().toISOString(),nonce=crypto.getRandomValues(new Uint32Array(4)).join('-');
  const msg=`RWA Wallet Login\nDomain: ${location.host}\nURI: ${location.origin+location.pathname}\nWallet: ${addr}\nChain: ${chain}\nIssued At: ${issued}\nNonce: ${nonce}`;
  const hex='0x'+[...new TextEncoder().encode(msg)].map(b=>b.toString(16).padStart(2,'0')).join('');
  let signature;
  try{signature=await p.request({method:'personal_sign',params:[hex,addr]})}catch(first){signature=await p.request({method:'personal_sign',params:[addr,hex]})}
  if(!signature)throw Error('Wallet signature was not returned');
  if(!await providerRecover(p,hex,signature,addr))throw Error('Wallet signature verification failed');
  const row={wallet:addr,message:msg,signature,ts:Date.now(),chain,via:'wallet-core-v2',verified:true};
  localStorage.setItem(KEY,JSON.stringify(row));
  window.RWAProvider=p;current=p;verified=true;labels();
  window.dispatchEvent(new CustomEvent('rwa:wallet-login',{detail:{wallet:addr}}));
  return row;
}
async function login(){if(busy)return;busy=true;labels();try{const s=session();if(validSession(s)){verified=true;labels();toast(`Wallet connected ${short(s.wallet)}`);return s}const p=await chooseProvider();if(!p)throw Error('No EVM wallet detected. Use MetaMask, Rabby, Coinbase Wallet, or configure WalletConnect.');const row=await signWith(p);toast(`Login successful · ${short(row.wallet)}`);setTimeout(()=>{try{window.RWASuite?.loadHyperliquid?.(row.wallet)}catch{}},0);return row}catch(e){toast(e?.message||'Wallet connection failed');throw e}finally{busy=false;labels()}}
async function logout(){if(busy)return;busy=true;labels();try{localStorage.removeItem(KEY);verified=false;current=null;try{await window.RWAWalletConnect?.disconnect?.()}catch{};window.RWAProvider=null;window.dispatchEvent(new CustomEvent('rwa:wallet-logout'));toast('Wallet logged out')}finally{busy=false;labels()}}
async function boot(){ensureUI();const s=session();verified=validSession(s);if(s&&!verified)localStorage.removeItem(KEY);labels();if(window.RWAWalletConnect?.restore)try{await window.RWAWalletConnect.restore()}catch{};if(window.ethereum?.on)window.ethereum.on('accountsChanged',a=>{const active=session()?.wallet?.toLowerCase(),next=String(a?.[0]||'').toLowerCase();if(active&&next&&active!==next){localStorage.removeItem(KEY);verified=false;labels();toast('Wallet account changed. Connect again.')}})}
window.addEventListener('click',e=>{const b=e.target.closest?.('.signin,.mobile-wallet-auth,#connectWallet,#portfolioConnect,#tradeConnect');if(!b)return;e.preventDefault();e.stopImmediatePropagation();if(verified&&validSession(session()))logout();else login().catch(()=>{})},true);
window.RWAWalletAuth={login,logout,isLoggedIn:()=>verified&&validSession(session()),session,provider:()=>window.RWAProvider||current||window.ethereum};
boot();
})();