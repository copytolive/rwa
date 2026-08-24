(()=>{
'use strict';
if(window.RWATradeE2E)return;

const SESSION_KEY='rwa_wallet_link_v1';
const EVIDENCE_PREFIX='rwa_trade_e2e_v1';
const REQUIRED=['wallet','collateral','agent','entry','position','tpsl','modify','cancel','close','history','pnl'];
const LABELS={wallet:'Wallet ownership',collateral:'Test balance',agent:'Trading approval',entry:'Filled entry',position:'Position observed',tpsl:'Atomic TP / SL',modify:'Order modified',cancel:'Order canceled',close:'Position closed',history:'Trade history',pnl:'PnL observed'};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function wallet(){
  try{
    const row=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');
    const value=String(row?.wallet||'').toLowerCase();
    return /^0x[a-f0-9]{40}$/.test(value)?value:'';
  }catch{return ''}
}
function evidenceKey(){return `${EVIDENCE_PREFIX}:${wallet()||'none'}`}
function load(){try{return JSON.parse(localStorage.getItem(evidenceKey())||'{}')||{}}catch{return{}}}
function save(value){localStorage.setItem(evidenceKey(),JSON.stringify(value));render();return value}
function mark(key,detail,source='venue'){
  if(!REQUIRED.includes(key)||!wallet())return;
  const state=load();
  state[key]={ts:Date.now(),detail:String(detail||''),source};
  save(state);
}
function clear(){if(wallet())localStorage.removeItem(evidenceKey());render()}
function passed(state=load()){return REQUIRED.every(key=>state?.[key]?.ts&&(key==='wallet'?state[key].source==='wallet-signature':state[key].source==='venue'))}
function orderIds(value,out=new Set(),depth=0){
  if(depth>9||value==null)return out;
  if(Array.isArray(value)){for(const item of value)orderIds(item,out,depth+1);return out}
  if(typeof value!=='object')return out;
  for(const [key,item] of Object.entries(value)){
    if(/^(oid|orderId)$/i.test(key)&&(typeof item==='number'||typeof item==='string')&&String(item).trim())out.add(String(item));
    else orderIds(item,out,depth+1);
  }
  return out;
}
function venueDetail(result,fallback){
  const ids=[...orderIds(result)];
  return ids.length?`${fallback} · order ${ids.slice(0,8).join(',')}`:`${fallback} · venue accepted`;
}
function money(value){const n=Number(value);return Number.isFinite(n)?`$${n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`:'—'}
function short(value){return value?`${value.slice(0,6)}…${value.slice(-4)}`:'—'}
async function execution(){
  for(let i=0;i<80;i++){
    if(window.RWAExecutionAPI?.version==='2.0.0')return window.RWAExecutionAPI;
    await sleep(100);
  }
  throw Error('Execution engine is not ready');
}
async function signChallenge(address){
  const provider=window.RWAProvider||window.ethereum;
  if(!provider?.request)throw Error('Wallet provider unavailable');
  const message=`RWA TRADE TESTNET VERIFICATION\nWallet: ${address}\nNonce: ${Date.now()}`;
  const hex='0x'+[...new TextEncoder().encode(message)].map(b=>b.toString(16).padStart(2,'0')).join('');
  try{return await provider.request({method:'personal_sign',params:[hex,address]})}
  catch{return provider.request({method:'personal_sign',params:[address,hex]})}
}
async function waitFor(fn,timeout=15000,step=700){
  const end=Date.now()+timeout;
  let value=null;
  while(Date.now()<end){value=await fn();if(value)return value;await sleep(step)}
  return null;
}
async function currentEquity(api){
  const state=await api.account.state(true);
  return Number(state?.marginSummary?.accountValue||0)||0;
}
async function currentPositions(api){
  const state=await api.account.state(true);
  return (state?.assetPositions||[]).map(x=>x?.position||x).filter(x=>Number(x?.szi||0)!==0);
}
async function agentReady(api){
  const check=await api.agent.verify(true,{force:true}).catch(()=>({valid:false}));
  if(check?.valid===true)return check;
  await api.agent.authorize(true);
  const verified=await api.agent.verify(true,{force:true});
  if(verified?.valid!==true)throw Error('Trading approval was not verified by the TESTNET venue');
  return verified;
}
function setBusy(yes,label='Running…'){
  const button=document.getElementById('tradeE2ERun');
  if(!button)return;
  if(yes){button.dataset.old=button.textContent;button.textContent=label;button.disabled=true}
  else{button.textContent=button.dataset.old||'Run full TESTNET verification';button.disabled=false}
}
function statusText(text,type=''){
  const el=document.getElementById('tradeE2EStatus');
  if(!el)return;
  el.textContent=String(text||'');
  el.className=`trade-e2e-status ${type}`;
}

async function run(){
  const address=wallet();
  if(!address)throw Error('Connect wallet first');
  if(!confirm('Run full TESTNET verification? RWA will place a small test order, verify TP/SL + modify/cancel, then close the position. No mainnet order can be placed.'))return false;
  clear();
  setBusy(true,'Verifying wallet…');
  statusText('Wallet confirmation required once to bind the verification session.');
  await signChallenge(address);
  mark('wallet',short(address),'wallet-signature');

  const api=await execution();
  const equity=await currentEquity(api);
  if(!(equity>0))throw Error('Get test balance first');
  mark('collateral',`equity ${money(equity)}`);

  setBusy(true,'Checking approval…');
  const verified=await agentReady(api);
  const agentAddress=String(verified?.row?.address||verified?.remote?.address||api.agent.status(true)?.address||'').toLowerCase();
  if(!/^0x[a-f0-9]{40}$/.test(agentAddress))throw Error('Verified trading approval address is unavailable');
  mark('agent',agentAddress);

  const mids=await api.info('allMids',{},true);
  const coin=Number(mids?.BTC)>0?'BTC':Object.keys(mids||{}).find(name=>Number(mids[name])>0);
  if(!coin)throw Error('No TESTNET market is available');
  const mid=Number(mids[coin]);
  const notional=Math.max(12,Math.min(25,equity*0.02));

  setBusy(true,'Testing modify / cancel…');
  const restingPrice=mid*0.95;
  const restingSize=notional/restingPrice;
  const resting=await api.orders.limit({coin,side:'BUY',price:restingPrice,size:restingSize,reduceOnly:false,leverage:1,testnet:true,preferAgent:true});
  let oid=[...orderIds(resting)][0]||'';
  if(!oid){
    oid=String(await waitFor(async()=>{
      const rows=await api.orders.open(true);
      const row=(rows||[]).find(x=>String(x?.coin||'').toUpperCase()===coin&&String(x?.side||'').toUpperCase().includes('B'));
      return row?.oid||null;
    },10000)||'');
  }
  if(!oid)throw Error('Resting TESTNET order was not observed');
  const modified=await api.orders.modify({coin,oid:Number(oid),side:'BUY',price:mid*0.96,size:restingSize,reduceOnly:false,testnet:true,preferAgent:true});
  mark('modify',venueDetail(modified,`${coin} #${oid}`));
  const canceled=await api.orders.cancel({coin,oid:Number(oid),testnet:true,preferAgent:true});
  mark('cancel',venueDetail(canceled,`${coin} #${oid}`));

  setBusy(true,'Testing protected entry…');
  const size=notional/mid;
  const bracket=await api.orders.bracket({coin,side:'BUY',size,type:'MARKET',tp:mid*1.05,sl:mid*0.95,leverage:1,testnet:true,preferAgent:true});
  if(bracket?.mode&&bracket.mode!=='agent')throw Error('Risk-increasing entry did not use delegated trading approval');
  mark('entry',venueDetail(bracket,`MARKET ${coin}`));
  mark('tpsl',venueDetail(bracket,'atomic TP + SL'));

  const position=await waitFor(async()=>{
    const rows=await currentPositions(api);
    return rows.find(p=>String(p?.coin||'').toUpperCase()===coin)||null;
  },18000);
  if(!position)throw Error('Filled TESTNET position was not observed');
  mark('position',`${coin} ${position.szi}`);

  setBusy(true,'Closing test position…');
  const closeSide=Number(position.szi)>0?'SELL':'BUY';
  const closed=await api.orders.market({coin,side:closeSide,size:Math.abs(Number(position.szi)),reduceOnly:true,leverage:null,testnet:true,preferAgent:true});
  mark('close',venueDetail(closed,coin));
  try{await api.orders.cancelAll({testnet:true,preferAgent:true})}catch{}
  const flat=await waitFor(async()=>{
    const rows=await currentPositions(api);
    return !rows.some(p=>String(p?.coin||'').toUpperCase()===coin);
  },18000);
  if(!flat)throw Error('TESTNET position did not return to flat');

  setBusy(true,'Verifying venue history…');
  const fills=await api.account.fills(true);
  if(!Array.isArray(fills)||fills.length<2)throw Error('Venue trade history does not show enough fills');
  mark('history',`${fills.length} venue fills`);
  const recent=fills.slice(0,20);
  const closedPnl=recent.reduce((sum,row)=>sum+(Number(row?.closedPnl)||0),0);
  mark('pnl',`closed PnL ${money(closedPnl)} · account refreshed`);

  render();
  statusText('PASS · venue-backed TESTNET lifecycle completed. Publish the signed proof to register it.','success');
  return true;
}

async function sha256(text){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function publish(){
  const address=wallet(),state=load();
  if(!address||!passed(state))throw Error('Complete the full TESTNET verification first');
  const evidence={};for(const key of REQUIRED)evidence[key]=state[key];
  const verified_at=Date.now();
  const evidence_hash=await sha256(JSON.stringify(evidence));
  const message=`RWA TESTNET E2E PROOF\nWallet: ${address}\nVerified At: ${verified_at}\nEvidence Hash: ${evidence_hash}`;
  const provider=window.RWAProvider||window.ethereum;
  const hex='0x'+[...new TextEncoder().encode(message)].map(b=>b.toString(16).padStart(2,'0')).join('');
  let signature;
  try{signature=await provider.request({method:'personal_sign',params:[hex,address]})}
  catch{signature=await provider.request({method:'personal_sign',params:[address,hex]})}
  const pkg={schema:1,wallet:address,status:'E2E_VERIFIED',environment:'testnet',verified_at,evidence_hash,evidence,message,signature};
  const title=`[E2E-PROOF] ${address}`;
  const body=`Submit this issue to register a wallet-bound testnet proof.\n\nE2E_PROOF_JSON_START\n\`\`\`json\n${JSON.stringify(pkg,null,2)}\n\`\`\`\nE2E_PROOF_JSON_END`;
  window.open(`https://github.com/narzulalistiqlal/rwa/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`,'_blank','noopener,noreferrer');
  statusText('Signed proof prepared. Submit the pre-filled GitHub issue to register the venue-backed result.','success');
  return pkg;
}

function ensureUi(){
  const details=document.querySelector('.advanced details');
  if(!details||document.getElementById('tradeE2E'))return !!document.getElementById('tradeE2E');
  const root=document.createElement('div');
  root.id='tradeE2E';
  root.className='trade-e2e';
  root.innerHTML=`<div class="trade-e2e-head"><div><small>RELEASE VERIFICATION</small><b>Full TESTNET lifecycle</b></div><span id="tradeE2EResult" class="mode-badge">PENDING</span></div><div id="tradeE2ERows" class="trade-e2e-grid"></div><p id="tradeE2EStatus" class="trade-e2e-status">Runs only on TESTNET and keeps MAINNET locked.</p><div class="setup-actions"><button id="tradeE2ERun" class="button primary" type="button">Run full TESTNET verification</button><button id="tradeE2EPublish" class="button secondary" type="button" disabled>Publish signed proof</button><button id="tradeE2EClear" class="button ghost" type="button">Reset evidence</button></div>`;
  details.appendChild(root);
  document.getElementById('tradeE2ERun').addEventListener('click',()=>run().catch(error=>{statusText(error?.message||error,'error');setBusy(false)}).finally(()=>setBusy(false)));
  document.getElementById('tradeE2EPublish').addEventListener('click',()=>publish().catch(error=>statusText(error?.message||error,'error')));
  document.getElementById('tradeE2EClear').addEventListener('click',()=>{if(confirm('Reset local TESTNET verification evidence for this wallet?')){clear();statusText('Local verification evidence reset.')}});
  return true;
}
function render(){
  if(!ensureUi())return;
  const state=load(),ok=passed(state),rows=document.getElementById('tradeE2ERows');
  rows.innerHTML=REQUIRED.map(key=>`<div><small>${LABELS[key]}</small><b>${state?.[key]?.ts?'PASS':'PENDING'}${state?.[key]?.detail?' · '+String(state[key].detail).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])):''}</b></div>`).join('');
  const badge=document.getElementById('tradeE2EResult');
  badge.textContent=ok?'PASS':'PENDING';badge.className=`mode-badge ${ok?'ready':''}`;
  const publishButton=document.getElementById('tradeE2EPublish');if(publishButton)publishButton.disabled=!ok;
}

window.RWATradeE2E={version:'1.0.0',run,publish,status:()=>({wallet:wallet(),passed:passed(),evidence:load()}),reset:clear};
let attempts=0;const timer=setInterval(()=>{attempts++;if(ensureUi()){clearInterval(timer);render()}if(attempts>100)clearInterval(timer)},100);
})();
