(()=>{
'use strict';

const INFO_URL='https://api.hyperliquid-testnet.xyz/info';
const SESSION_KEY='rwa_wallet_link_v1';
const CLAIM_AMOUNT=1000;
let pollTimer=null;
let modalReady=false;
let claiming=false;

const byId=id=>document.getElementById(id);
const short=a=>a?`${a.slice(0,6)}…${a.slice(-4)}`:'—';
const money=n=>`$${Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function cleanPrimaryBrand(){
  const subtitle=document.querySelector('.brand small');
  if(subtitle)subtitle.textContent='RWA execution network';
  const fund=document.getElementById('fundBtn');
  if(fund)fund.textContent='Get test balance';
  const micro=document.querySelector('.microcopy');
  if(micro)micro.textContent='If TP/SL is provided, RWA submits protection together with the entry.';
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

async function infoRequest(payload){
  const r=await fetch(INFO_URL,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload),
    cache:'no-store'
  });
  const text=await r.text();
  let body=text;
  try{body=text?JSON.parse(text):null}catch{}
  if(!r.ok){
    const detail=typeof body==='string'?body:(body?.error||body?.message||`HTTP ${r.status}`);
    throw Error(String(detail||`TESTNET network HTTP ${r.status}`));
  }
  if(body&&typeof body==='object'){
    const detail=body.error||body?.response?.error;
    if(detail)throw Error(String(detail));
    if(body.status&&String(body.status).toLowerCase()==='err')throw Error(String(body.message||'Claim rejected'));
  }
  return body;
}

async function testnetEquity(user){
  if(!user)return 0;
  const state=await infoRequest({type:'clearinghouseState',user});
  return Number(state?.marginSummary?.accountValue||0)||0;
}

async function claimDrip(user){
  if(!/^0x[a-f0-9]{40}$/.test(String(user||'').toLowerCase()))throw Error('Connect a valid wallet first.');
  return infoRequest({type:'claimDrip',user:String(user).toLowerCase()});
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
          <h2 id="fundModalTitle">Get test balance</h2>
        </div>
        <button class="fund-icon-btn" type="button" data-fund-close aria-label="Close funding panel">×</button>
      </header>

      <div class="fund-status-row">
        <div><small>Wallet</small><b id="fundWallet">—</b></div>
        <div><small>TESTNET balance</small><b id="fundEquity">Checking…</b></div>
        <div><small>Status</small><b id="fundStatus">Checking</b></div>
      </div>

      <div class="fund-native-card">
        <div class="fund-native-mark">R</div>
        <div>
          <small>RWA TEST BALANCE</small>
          <h3 id="fundNativeTitle">Checking your test balance…</h3>
          <p id="fundNativeText">RWA checks and requests TESTNET balance directly while keeping you inside this application.</p>
        </div>
      </div>

      <div class="fund-note">
        <b>TESTNET only.</b> Test balance has no real monetary value. Eligibility is controlled by the TESTNET network and a wallet may have a limited test allocation.
      </div>

      <footer class="fund-modal-actions">
        <span id="fundHint">Checking TESTNET balance…</span>
        <div>
          <button id="fundClaimBtn" class="button primary" type="button" disabled>Get 1,000 test USDC</button>
          <button id="fundCheckBtn" class="button ghost" type="button">Check balance</button>
          <button id="fundContinueBtn" class="button secondary" type="button" disabled>Continue trading</button>
        </div>
      </footer>
    </section>`;
  document.body.appendChild(root);

  root.querySelectorAll('[data-fund-close]').forEach(el=>el.addEventListener('click',closeFunding));
  byId('fundClaimBtn').addEventListener('click',claimFunding);
  byId('fundCheckBtn').addEventListener('click',()=>refreshFunding(true));
  byId('fundContinueBtn').addEventListener('click',closeFunding);
}

function setClaimBusy(yes){
  claiming=!!yes;
  const b=byId('fundClaimBtn');
  if(!b)return;
  b.textContent=yes?'Requesting…':'Get 1,000 test USDC';
  if(yes)b.disabled=true;
}

function renderZeroBalance(){
  byId('fundStatus').textContent='TEST BALANCE REQUIRED';
  byId('fundNativeTitle').textContent='Test balance is ready to request';
  byId('fundNativeText').textContent='Request the standard TESTNET allocation directly from RWA. You will remain on this page.';
  byId('fundHint').textContent='Request the TESTNET allocation, then RWA will verify the balance automatically.';
  byId('fundClaimBtn').disabled=claiming;
  byId('fundContinueBtn').disabled=true;
}

function renderFunded(equity){
  byId('fundStatus').textContent='READY';
  byId('fundNativeTitle').textContent='Test balance detected';
  byId('fundNativeText').textContent=`Your TESTNET account has ${money(equity)} available. You can continue to the one-time trading approval.`;
  byId('fundHint').textContent='TESTNET balance detected. Continue trading without leaving RWA Trade.';
  byId('fundClaimBtn').disabled=true;
  byId('fundContinueBtn').disabled=false;
  window.dispatchEvent(new CustomEvent('rwa:funding-changed',{detail:{equity}}));
}

async function refreshFunding(manual=false){
  try{
    const user=await currentWallet();
    byId('fundWallet').textContent=short(user);
    if(!user){
      byId('fundEquity').textContent='—';
      byId('fundStatus').textContent='CONNECT WALLET';
      byId('fundNativeTitle').textContent='Connect your wallet first';
      byId('fundNativeText').textContent='RWA needs the connected wallet address before it can request TESTNET balance.';
      byId('fundClaimBtn').disabled=true;
      byId('fundContinueBtn').disabled=true;
      return 0;
    }
    const equity=await testnetEquity(user);
    byId('fundEquity').textContent=money(equity);
    if(equity>0)renderFunded(equity);
    else{
      renderZeroBalance();
      if(manual)byId('fundHint').textContent='Balance is still $0.00. You can request the TESTNET allocation above.';
    }
    return equity;
  }catch(error){
    byId('fundStatus').textContent='CHECK FAILED';
    byId('fundNativeTitle').textContent='Balance check unavailable';
    byId('fundNativeText').textContent='RWA could not read TESTNET balance right now. No trading action was submitted.';
    if(manual)byId('fundHint').textContent=String(error?.message||error);
    return 0;
  }
}

async function claimFunding(){
  if(claiming)return;
  const user=await currentWallet();
  if(!user){
    byId('fundHint').textContent='Connect your wallet first.';
    return;
  }
  try{
    setClaimBusy(true);
    byId('fundStatus').textContent='REQUESTING';
    byId('fundHint').textContent=`Requesting ${CLAIM_AMOUNT.toLocaleString('en-US')} test USDC…`;
    await claimDrip(user);
    byId('fundStatus').textContent='VERIFYING';
    byId('fundHint').textContent='Request accepted. Waiting for TESTNET balance…';
    let equity=0;
    for(let i=0;i<20;i++){
      await sleep(i===0?1000:1500);
      equity=await refreshFunding(false);
      if(equity>0)break;
    }
    if(!(equity>0)){
      byId('fundStatus').textContent='PENDING';
      byId('fundNativeTitle').textContent='Request sent';
      byId('fundNativeText').textContent='The TESTNET network accepted the request but the account balance has not appeared yet.';
      byId('fundHint').textContent='Use “Check balance” in a moment. If the request is not eligible, the network may keep the balance at $0.00.';
    }
  }catch(error){
    const raw=String(error?.message||error||'Request failed');
    byId('fundStatus').textContent='NOT AVAILABLE';
    byId('fundNativeTitle').textContent='Test allocation was not issued';
    byId('fundNativeText').textContent='The TESTNET network did not issue a new allocation for this wallet. This can happen when network eligibility is not met or the allocation was already used.';
    byId('fundHint').textContent=raw.length>180?`${raw.slice(0,177)}…`:raw;
  }finally{
    setClaimBusy(false);
    const equity=Number(String(byId('fundEquity')?.textContent||'').replace(/[^0-9.-]/g,''))||0;
    if(equity<=0&&byId('fundClaimBtn'))byId('fundClaimBtn').disabled=false;
  }
}

async function openFunding(){
  ensureModal();
  cleanPrimaryBrand();
  const modal=byId('fundModal');
  modal.hidden=false;
  document.documentElement.classList.add('funding-open');
  byId('fundStatus').textContent='CHECKING';
  byId('fundClaimBtn').disabled=true;
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
  window.dispatchEvent(new CustomEvent('rwa:funding-changed'));
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
window.RWAFundingPanel={open:openFunding,close:closeFunding,refresh:refreshFunding,claim:claimFunding};
})();
