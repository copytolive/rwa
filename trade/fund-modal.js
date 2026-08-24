(()=>{
'use strict';

const FAUCET_URL='https://app.hyperliquid-testnet.xyz/drip';
const INFO_URL='https://api.hyperliquid-testnet.xyz/info';
const SESSION_KEY='rwa_wallet_link_v1';
let pollTimer=null;
let baselineEquity=0;
let modalReady=false;

const byId=id=>document.getElementById(id);
const short=a=>a?`${a.slice(0,6)}…${a.slice(-4)}`:'—';
const money=n=>`$${Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;

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
  if(!r.ok)throw Error(`Hyperliquid TESTNET HTTP ${r.status}`);
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
          <h2 id="fundModalTitle">Get test collateral</h2>
        </div>
        <button class="fund-icon-btn" type="button" data-fund-close aria-label="Close funding panel">×</button>
      </header>
      <div class="fund-status-row">
        <div><small>Wallet</small><b id="fundWallet">—</b></div>
        <div><small>TESTNET equity</small><b id="fundEquity">Checking…</b></div>
        <div><small>Status</small><b id="fundStatus">Official faucet</b></div>
      </div>
      <div class="fund-note">
        <b>Mock USDC only.</b> The official Hyperliquid TESTNET faucet is embedded below so you stay inside RWA Trade. Hyperliquid currently requires this same wallet address to have deposited on mainnet before a TESTNET faucet claim is eligible.
      </div>
      <div class="fund-frame-shell">
        <div id="fundFrameLoading" class="fund-frame-loading">Loading official Hyperliquid TESTNET faucet…</div>
        <iframe id="fundFrame" title="Official Hyperliquid TESTNET faucet" referrerpolicy="no-referrer" sandbox="allow-scripts allow-forms allow-same-origin allow-modals" allow="clipboard-read; clipboard-write"></iframe>
      </div>
      <footer class="fund-modal-actions">
        <span id="fundHint">Claim mock USDC in the embedded faucet, then RWA will detect the balance automatically.</span>
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
  byId('fundFrame').addEventListener('load',()=>{
    byId('fundFrameLoading').hidden=true;
    byId('fundStatus').textContent='Faucet loaded';
  });
}

async function refreshFunding(manual=false){
  try{
    const user=await currentWallet();
    byId('fundWallet').textContent=short(user);
    if(!user){
      byId('fundEquity').textContent='—';
      byId('fundStatus').textContent='Connect wallet first';
      return;
    }
    const equity=await testnetEquity(user);
    byId('fundEquity').textContent=money(equity);
    if(equity>0){
      byId('fundStatus').textContent='FUNDED';
      byId('fundHint').textContent='TESTNET collateral detected. You can continue without leaving RWA Trade.';
      byId('fundContinueBtn').disabled=false;
      document.getElementById('refreshBtn')?.click();
      document.getElementById('preflightBtn')?.click();
    }else{
      byId('fundStatus').textContent=manual?'Still waiting':'Waiting for claim';
      byId('fundContinueBtn').disabled=true;
    }
  }catch(error){
    byId('fundStatus').textContent='Balance check unavailable';
    if(manual)byId('fundHint').textContent=String(error?.message||error);
  }
}

async function openFunding(){
  ensureModal();
  const modal=byId('fundModal');
  modal.hidden=false;
  document.documentElement.classList.add('funding-open');
  byId('fundFrameLoading').hidden=false;
  byId('fundStatus').textContent='Loading faucet…';
  byId('fundContinueBtn').disabled=true;
  const user=await currentWallet();
  byId('fundWallet').textContent=short(user);
  baselineEquity=await testnetEquity(user).catch(()=>0);
  byId('fundEquity').textContent=money(baselineEquity);
  const frame=byId('fundFrame');
  if(frame.src!==FAUCET_URL)frame.src=FAUCET_URL;
  clearInterval(pollTimer);
  pollTimer=setInterval(()=>refreshFunding(false),4000);
  refreshFunding(false);
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

// Capture before app.js' legacy fund-button handler so it can never open a new tab.
document.addEventListener('click',event=>{
  const button=event.target?.closest?.('#fundBtn');
  if(!button)return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  openFunding().catch(error=>{
    ensureModal();
    byId('fundModal').hidden=false;
    byId('fundStatus').textContent='Funding panel error';
    byId('fundHint').textContent=String(error?.message||error);
  });
},true);

document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!byId('fundModal')?.hidden)closeFunding();
});

window.RWAFundingPanel={open:openFunding,close:closeFunding,refresh:refreshFunding};
})();
