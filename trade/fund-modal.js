(()=>{
'use strict';

const INFO_URL='https://api.hyperliquid-testnet.xyz/info';
const SESSION_KEY='rwa_wallet_link_v1';
let pollTimer=null;
let modalReady=false;

const byId=id=>document.getElementById(id);
const short=a=>a?`${a.slice(0,6)}…${a.slice(-4)}`:'—';
const money=n=>`$${Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;

function cleanPrimaryBrand(){
  const subtitle=document.querySelector('.brand small');
  if(subtitle)subtitle.textContent='RWA execution network';
  const fund=document.getElementById('fundBtn');
  if(fund)fund.textContent='Test collateral';
  const micro=document.querySelector('.microcopy');
  if(micro)micro.textContent='Entry + TP/SL are submitted as one atomic protected order group when protection is provided.';
  const meta=document.querySelector('meta[name="description"]');
  if(meta)meta.setAttribute('content','Secure non-custodial trading interface for RWA Markets.');
}

function sessionWallet(){
  try{
    const row=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');
    const w=String(row?.wallet||'').toLowerCase();
    return /^0x[a-f0-9]{40}$/.test(w)?w:'';
  }catch{return ''}
}
async function currentWallet(){
  const stored=sessionWallet();
  if(stored)return stored;
  try{
    const accounts=await window.ethereum?.request?.({method:'eth_accounts'});
    const w=String(accounts?.[0]||'').toLowerCase();
    return /^0x[a-f0-9]{40}$/.test(w)?w:'';
  }catch{return ''}
}
async function testnetEquity(user){
  if(!user)return 0;
  const r=await fetch(INFO_URL,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({type:'clearinghouseState',user}),
    cache:'no-store'
  });
  if(!r.ok)throw Error(`TESTNET network HTTP ${r.status}`);
  const state=await r.json();
  return Number(state?.marginSummary?.accountValue||0)||0;
}

function ensureModal(){
  if(modalReady)return;
  modalReady=true;
  const root=document.createElement('div');
  root.id='fundModal';
  root.className='fund-modal';
  root.hidden=true;
  root.innerHTML=`
    <div class="fund-modal-backdrop" data-fund-close></div>
    <section class="fund-modal-panel" role="dialog" aria-modal="true" aria-labelledby="fundModalTitle">
      <header class="fund-modal-head">
        <div>
          <small>RWA TRADE · TESTNET</small>
          <h2 id="fundModalTitle">Test collateral</h2>
        </div>
        <button class="fund-icon-btn" type="button" data-fund-close aria-label="Close funding panel">×</button>
      </header>

      <div class="fund-status-row">
        <div><small>Wallet</small><b id="fundWallet">—</b></div>
        <div><small>TESTNET equity</small><b id="fundEquity">Checking…</b></div>
        <div><small>Status</small><b id="fundStatus">Checking</b></div>
      </div>

      <div class="fund-native-card">
        <div class="fund-native-mark">R</div>
        <div>
          <small>RWA TEST COLLATERAL</small>
          <h3 id="fundNativeTitle">Checking your test balance…</h3>
          <p id="fundNativeText">RWA checks your TESTNET collateral directly and keeps the complete user experience inside this application.</p>
        </div>
      </div>

      <div class="fund-note">
        <b>TESTNET only.</b> Test collateral has no real monetary value. RWA does not embed, disguise, or visually proxy third-party trading pages inside the product.
      </div>

      <footer class="fund-modal-actions">
        <span id="fundHint">Checking TESTNET balance…</span>
        <div>
          <button id="fundCheckBtn" class="button ghost" type="button">Check balance</button>
          <button id="fundContinueBtn" class="button primary" type="button" disabled>Continue trading</button>
          <button class="button secondary" type="button" data-fund-close>Close</button>
        </div>
      </footer>
    </section>`;
  document.body.appendChild(root);

  root.querySelectorAll('[data-fund-close]').forEach(el=>el.addEventListener('click',closeFunding));
  byId('fundCheckBtn').addEventListener('click',()=>refreshFunding(true));
  byId('fundContinueBtn').addEventListener('click',closeFunding);
}

function renderZeroBalance(){
  byId('fundStatus').textContent='TEST BALANCE REQUIRED';
  byId('fundNativeTitle').textContent='No test collateral detected';
  byId('fundNativeText').textContent='Your RWA TESTNET account is connected, but its trading equity is still $0.00. Native RWA test-faucet distribution is not enabled in this build.';
  byId('fundHint').textContent='RWA will automatically unlock trading as soon as TESTNET equity is detected.';
  byId('fundContinueBtn').disabled=true;
}

async function refreshFunding(manual=false){
  try{
    const user=await currentWallet();
    byId('fundWallet').textContent=short(user);
    if(!user){
      byId('fundEquity').textContent='—';
      byId('fundStatus').textContent='CONNECT WALLET';
      byId('fundNativeTitle').textContent='Connect your wallet first';
      byId('fundNativeText').textContent='RWA needs the connected wallet address before it can read TESTNET collateral.';
      byId('fundContinueBtn').disabled=true;
      return;
    }
    const equity=await testnetEquity(user);
    byId('fundEquity').textContent=money(equity);
    if(equity>0){
      byId('fundStatus').textContent='READY';
      byId('fundNativeTitle').textContent='Test collateral detected';
      byId('fundNativeText').textContent=`Your TESTNET account has ${money(equity)} available. You can continue to the one-time trading approval.`;
      byId('fundHint').textContent='TESTNET collateral detected. Continue trading without leaving RWA Trade.';
      byId('fundContinueBtn').disabled=false;
      document.getElementById('refreshBtn')?.click();
      document.getElementById('preflightBtn')?.click();
    }else{
      renderZeroBalance();
      if(manual)byId('fundHint').textContent='Balance is still $0.00. RWA is not opening any external funding page.';
    }
  }catch(error){
    byId('fundStatus').textContent='CHECK FAILED';
    byId('fundNativeTitle').textContent='Balance check unavailable';
    byId('fundNativeText').textContent='RWA could not read TESTNET collateral right now. Your wallet and trading controls remain unchanged.';
    if(manual)byId('fundHint').textContent=String(error?.message||error);
  }
}

async function openFunding(){
  ensureModal();
  cleanPrimaryBrand();
  const modal=byId('fundModal');
  modal.hidden=false;
  document.documentElement.classList.add('funding-open');
  byId('fundStatus').textContent='CHECKING';
  byId('fundContinueBtn').disabled=true;
  const user=await currentWallet();
  byId('fundWallet').textContent=short(user);
  clearInterval(pollTimer);
  pollTimer=setInterval(()=>refreshFunding(false),4000);
  await refreshFunding(false);
}

function closeFunding(){
  const modal=byId('fundModal');
  if(!modal)return;
  modal.hidden=true;
  document.documentElement.classList.remove('funding-open');
  clearInterval(pollTimer);
  pollTimer=null;
  document.getElementById('refreshBtn')?.click();
  document.getElementById('preflightBtn')?.click();
}

document.addEventListener('click',event=>{
  const button=event.target?.closest?.('#fundBtn');
  if(!button)return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  openFunding().catch(error=>{
    ensureModal();
    byId('fundModal').hidden=false;
    byId('fundStatus').textContent='ERROR';
    byId('fundHint').textContent=String(error?.message||error);
  });
},true);

document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!byId('fundModal')?.hidden)closeFunding();
});

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',cleanPrimaryBrand,{once:true});else cleanPrimaryBrand();
setTimeout(cleanPrimaryBrand,1200);
window.RWAFundingPanel={open:openFunding,close:closeFunding,refresh:refreshFunding};
})();
