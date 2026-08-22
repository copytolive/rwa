(()=>{
'use strict';
if(window.RWAExecutionAPI)return;

const CONFIG_URL='rwa-execution-config.json';
const SESSION='rwa_wallet_link_v1';
const AGENT_PREFIX='rwa_agent_wallet_v2';
const DB_NAME='rwa-secure-v1';
const STORE='keys';
const AES_ID='agent-aes-v1';
let cfg=null;
let mods=null;
const metaCache=new Map();

const audit=(type,details={})=>window.RWAAudit?.log?.(type,details);
const provider=()=>window.RWAProvider||window.ethereum;
const session=()=>{try{return JSON.parse(localStorage.getItem(SESSION)||'null')}catch{return null}};
const master=()=>{const w=String(session()?.wallet||'').toLowerCase();return /^0x[a-f0-9]{40}$/.test(w)?w:''};
const env=testnet=>testnet?'testnet':'mainnet';
const recordKey=testnet=>`${AGENT_PREFIX}:${master()}:${env(testnet)}`;
const b64=u=>btoa(String.fromCharCode(...new Uint8Array(u)));
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));

async function config(){
  if(cfg)return cfg;
  const r=await fetch(CONFIG_URL,{cache:'no-store'});
  if(!r.ok)throw Error('Execution config unavailable');
  cfg=await r.json();
  return cfg;
}

async function modules(){
  if(mods)return mods;
  const [hl,viem,accounts,chains]=await Promise.all([
    import('https://esm.sh/jsr/@nktkas/hyperliquid'),
    import('https://esm.sh/viem@2.37.3'),
    import('https://esm.sh/viem@2.37.3/accounts'),
    import('https://esm.sh/viem@2.37.3/chains')
  ]);
  mods={...hl,...viem,...accounts,...chains};
  return mods;
}

function openDb(){
  return new Promise((resolve,reject)=>{
    const q=indexedDB.open(DB_NAME,1);
    q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains(STORE))q.result.createObjectStore(STORE)};
    q.onsuccess=()=>resolve(q.result);
    q.onerror=()=>reject(q.error);
  });
}
async function dbGet(k){
  const d=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=d.transaction(STORE,'readonly');
    const q=tx.objectStore(STORE).get(k);
    q.onsuccess=()=>resolve(q.result);
    q.onerror=()=>reject(q.error);
    tx.oncomplete=()=>d.close();
  });
}
async function dbPut(k,v){
  const d=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=d.transaction(STORE,'readwrite');
    tx.objectStore(STORE).put(v,k);
    tx.oncomplete=()=>{d.close();resolve()};
    tx.onerror=()=>reject(tx.error);
  });
}
async function aesKey(){
  let k=await dbGet(AES_ID);
  if(k)return k;
  k=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  await dbPut(AES_ID,k);
  return k;
}
async function encryptSecret(secret){
  const key=await aesKey();
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(secret));
  return{iv:b64(iv),ct:b64(ct)};
}
async function decryptSecret(row){
  const key=await aesKey();
  const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(row.iv)},key,unb64(row.ct));
  return new TextDecoder().decode(pt);
}

function readAgent(testnet=false){
  try{return JSON.parse(localStorage.getItem(recordKey(testnet))||'null')}catch{return null}
}
async function saveAgent(testnet,privateKey,address,name,expiresAt){
  const enc=await encryptSecret(privateKey);
  const row={
    ...enc,
    address:address.toLowerCase(),
    name,
    master:master(),
    env:env(testnet),
    authorizedAt:Date.now(),
    expiresAt:Number(expiresAt||0),
    storage:'AES-GCM + non-extractable WebCrypto key'
  };
  localStorage.setItem(recordKey(testnet),JSON.stringify(row));
  return row;
}

async function masterWallet(){
  const p=provider();
  const m=master();
  if(!m)throw Error('Login with wallet first');
  if(!p)throw Error('Wallet provider unavailable');
  const {createWalletClient,custom,arbitrum}=await modules();
  const accts=await p.request({method:'eth_requestAccounts'});
  const a=String(accts?.[0]||'').toLowerCase();
  if(a!==m)throw Error('Connected wallet does not match logged-in wallet');
  return createWalletClient({account:a,chain:arbitrum,transport:custom(p)});
}
async function transport(testnet=false){
  const {HttpTransport}=await modules();
  return new HttpTransport({isTestnet:testnet,timeout:15000});
}
async function mainExchange(testnet=false){
  const {ExchangeClient}=await modules();
  return new ExchangeClient({
    transport:await transport(testnet),
    wallet:await masterWallet(),
    defaultExpiresAfter:()=>Date.now()+15000
  });
}

async function authorizeAgent(testnet=false){
  if(!master())throw Error('Login with wallet first');
  const c=await config();
  const {generatePrivateKey,privateKeyToAccount}=await modules();
  const pk=generatePrivateKey();
  const agent=privateKeyToAccount(pk);
  const hours=Math.max(1,Number(c.agentExpiryHours||168));
  const expiresAt=Date.now()+hours*60*60*1000;
  const base=String(c.agentName||'RWA-EXECUTION').slice(0,16);
  const agentName=`${base} valid_until ${expiresAt}`;
  const ex=await mainExchange(testnet);
  audit('execution.agent.approval.request',{testnet,agent:agent.address,expiresAt});
  const result=await ex.approveAgent({agentAddress:agent.address,agentName});
  if(result?.status&&result.status!=='ok')throw Error('Agent approval failed');
  await saveAgent(testnet,pk,agent.address,agentName,expiresAt);
  audit('execution.agent.approved',{testnet,agent:agent.address,expiresAt});
  window.dispatchEvent(new CustomEvent('rwa:agent-changed'));
  return{address:agent.address,result,expiresAt};
}
async function agentAccount(testnet=false){
  const row=readAgent(testnet);
  if(!row)return null;
  if(row.expiresAt&&Date.now()>Number(row.expiresAt))return null;
  try{
    const pk=await decryptSecret(row);
    const {privateKeyToAccount}=await modules();
    const a=privateKeyToAccount(pk);
    if(a.address.toLowerCase()!==row.address)throw Error('Agent key mismatch');
    return a;
  }catch(e){
    console.warn('RWA agent unlock failed',e);
    return null;
  }
}
async function revokeAgent(testnet=false){
  const row=readAgent(testnet);
  if(!row){localStorage.removeItem(recordKey(testnet));return{revoked:true,remote:false}}
  const {generatePrivateKey,privateKeyToAccount}=await modules();
  const throwaway=privateKeyToAccount(generatePrivateKey());
  const ex=await mainExchange(testnet);
  await ex.approveAgent({agentAddress:throwaway.address,agentName:row.name});
  localStorage.removeItem(recordKey(testnet));
  audit('execution.agent.revoked',{testnet,oldAgent:row.address,replacedByDiscardedAgent:throwaway.address});
  window.dispatchEvent(new CustomEvent('rwa:agent-changed'));
  return{revoked:true,remote:true};
}
async function exchange(testnet=false,{preferAgent=true}={}){
  const {ExchangeClient}=await modules();
  let wallet=null;
  let mode='master';
  if(preferAgent){wallet=await agentAccount(testnet);if(wallet)mode='agent'}
  if(!wallet)wallet=await masterWallet();
  const client=new ExchangeClient({transport:await transport(testnet),wallet,defaultExpiresAfter:()=>Date.now()+15000});
  return{client,mode};
}

async function info(type,data={},testnet=false){
  const c=await config();
  const url=testnet?c.testnetApi:c.mainnetApi;
  const r=await fetch(url+'/info',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({type,...data}),
    cache:'no-store'
  });
  if(!r.ok)throw Error(`Execution info HTTP ${r.status}`);
  return r.json();
}
async function meta(testnet=false){
  const k=env(testnet);
  const hit=metaCache.get(k);
  if(hit&&Date.now()-hit.ts<30000)return hit.data;
  const data=await info('meta',{},testnet);
  metaCache.set(k,{ts:Date.now(),data});
  return data;
}
async function asset(coin,testnet=false){
  const m=await meta(testnet);
  const idx=(m.universe||[]).findIndex(x=>x.name===String(coin).toUpperCase());
  if(idx<0)throw Error(`${coin} is not listed in Hyperliquid perps`);
  return{idx,u:m.universe[idx]};
}
function fmtPx(v,d){
  const n=Number(v);
  if(!Number.isFinite(n)||n<=0)throw Error('Invalid price');
  const sig=Number(n.toPrecision(5));
  const max=Math.max(0,6-Number(d||0));
  const dec=(String(sig).split('.')[1]||'').length;
  return sig.toFixed(Math.min(max,dec)).replace(/\.?0+$/,'');
}
function fmtSz(v,d){
  const n=Number(v);
  if(!Number.isFinite(n)||n<=0)throw Error('Invalid size');
  const out=n.toFixed(Number(d||0)).replace(/\.?0+$/,'');
  if(!Number(out))throw Error('Size rounds to zero');
  return out;
}
async function riskCheck(order){
  if(window.RWARisk?.check)await window.RWARisk.check(order);
}

async function builderParam(){
  const c=await config();
  const b=c.builder||{};
  if(!b.enabled||!/^0x[a-fA-F0-9]{40}$/.test(b.address||'')||Number(b.feeTenthsBp||0)<=0)return null;
  return{b:b.address,f:Number(b.feeTenthsBp)};
}
async function approveBuilderFee(testnet=false){
  const c=await config();
  const b=c.builder||{};
  if(!b.enabled)throw Error('RWA builder fee is disabled');
  if(!/^0x[a-fA-F0-9]{40}$/.test(b.address||''))throw Error('Builder address is not configured');
  const ex=await mainExchange(testnet);
  const result=await ex.approveBuilderFee({builder:b.address,maxFeeRate:String(b.maxFeeRate)});
  audit('execution.builder.approved',{testnet,builder:b.address,maxFeeRate:b.maxFeeRate});
  return result;
}
async function builderStatus(testnet=false){
  const c=await config();
  const b=c.builder||{};
  if(!b.enabled||!b.address)return{enabled:false};
  try{
    return{enabled:true,builder:b.address,feeTenthsBp:b.feeTenthsBp,maxFeeRate:b.maxFeeRate,current:await info('maxBuilderFee',{user:master(),builder:b.address},testnet)};
  }catch(e){
    return{enabled:true,builder:b.address,error:e.message};
  }
}

async function setLeverage({coin,leverage,isCross=true,testnet=false,preferAgent=true}){
  coin=String(coin).toUpperCase();
  const {idx}=await asset(coin,testnet);
  const value=Math.max(1,Math.floor(Number(leverage)||1));
  await riskCheck({coin,price:0,size:0,leverage:value,reduceOnly:false,kind:'leverage'});
  const {client,mode}=await exchange(testnet,{preferAgent});
  const result=await client.updateLeverage({asset:idx,isCross:!!isCross,leverage:value});
  audit('execution.leverage',{coin,leverage:value,testnet,mode});
  return result;
}
async function limit({coin,side='BUY',price,size,reduceOnly=false,tif='Gtc',leverage=null,testnet=false,preferAgent=true}){
  coin=String(coin).toUpperCase();
  const {idx,u}=await asset(coin,testnet);
  const p=fmtPx(price,u.szDecimals);
  const s=fmtSz(size,u.szDecimals);
  await riskCheck({coin,price:Number(p),size:Number(s),leverage:Number(leverage||1),reduceOnly:!!reduceOnly,kind:'limit'});
  const {client,mode}=await exchange(testnet,{preferAgent});
  if(leverage!=null)await client.updateLeverage({asset:idx,isCross:true,leverage:Math.max(1,Math.floor(Number(leverage)||1))});
  const builder=await builderParam();
  const args={orders:[{a:idx,b:String(side).toUpperCase()==='BUY',p,s,r:!!reduceOnly,t:{limit:{tif}}}],grouping:'na',...(builder?{builder}:{})};
  const result=await client.order(args);
  audit('execution.order',{kind:'limit',coin,side,price:p,size:s,reduceOnly:!!reduceOnly,testnet,mode,builder:!!builder});
  return{result,mode,price:p,size:s};
}
async function market({coin,side='BUY',size,reduceOnly=false,slippageBps=null,leverage=null,testnet=false,preferAgent=true}){
  coin=String(coin).toUpperCase();
  const mids=await info('allMids',{},testnet);
  const mid=Number(mids?.[coin]);
  if(!Number.isFinite(mid)||mid<=0)throw Error('Market price unavailable');
  const c=await config();
  const bps=Number(slippageBps??c.defaults?.marketSlippageBps??30);
  const buy=String(side).toUpperCase()==='BUY';
  const px=mid*(1+(buy?1:-1)*bps/10000);
  return limit({coin,side,price:px,size,reduceOnly,tif:'Ioc',leverage,testnet,preferAgent});
}
async function trigger({coin,side,size,triggerPx,tpsl='sl',testnet=false,preferAgent=true}){
  coin=String(coin).toUpperCase();
  const {idx,u}=await asset(coin,testnet);
  const p=fmtPx(triggerPx,u.szDecimals);
  const s=fmtSz(Math.abs(Number(size)),u.szDecimals);
  const kind=String(tpsl).toLowerCase()==='tp'?'tp':'sl';
  await riskCheck({coin,price:Number(p),size:Number(s),leverage:1,reduceOnly:true,kind:'trigger'});
  const {client,mode}=await exchange(testnet,{preferAgent});
  const builder=await builderParam();
  const args={orders:[{a:idx,b:String(side).toUpperCase()==='BUY',p,s,r:true,t:{trigger:{isMarket:true,triggerPx:p,tpsl:kind}}}],grouping:'positionTpsl',...(builder?{builder}:{})};
  const result=await client.order(args);
  audit('execution.trigger',{coin,side,size:s,triggerPx:p,tpsl:kind,testnet,mode,builder:!!builder});
  return{result,mode,price:p,size:s};
}
async function cancel({coin,oid,testnet=false,preferAgent=true}){
  const {idx}=await asset(coin,testnet);
  const {client,mode}=await exchange(testnet,{preferAgent});
  const result=await client.cancel({cancels:[{a:idx,o:Number(oid)}]});
  audit('execution.cancel',{coin,oid,testnet,mode});
  return{result,mode};
}
async function modify({coin,oid,side,price,size,reduceOnly=false,testnet=false,preferAgent=true}){
  coin=String(coin).toUpperCase();
  const {idx,u}=await asset(coin,testnet);
  const p=fmtPx(price,u.szDecimals);
  const s=fmtSz(size,u.szDecimals);
  await riskCheck({coin,price:Number(p),size:Number(s),leverage:1,reduceOnly:!!reduceOnly,kind:'modify'});
  const {client,mode}=await exchange(testnet,{preferAgent});
  const result=await client.modify({oid:Number(oid),order:{a:idx,b:String(side).toUpperCase()==='BUY'||side==='B',p,s,r:!!reduceOnly,t:{limit:{tif:'Gtc'}}}});
  audit('execution.modify',{coin,oid,price:p,size:s,reduceOnly:!!reduceOnly,testnet,mode});
  return{result,mode};
}
async function cancelAll({testnet=false,preferAgent=true}={}){
  const orders=await info('frontendOpenOrders',{user:master()},testnet);
  const out=[];
  for(const o of orders||[])out.push(await cancel({coin:o.coin,oid:o.oid,testnet,preferAgent}));
  return out;
}
async function health(testnet=false){
  const c=await config();
  const a=readAgent(testnet);
  const out={venue:c.venue,master:master(),walletProvider:!!provider(),agent:!!a,agentAddress:a?.address||'',agentExpiresAt:a?.expiresAt||0,environment:env(testnet),builder:await builderStatus(testnet)};
  try{await info('allMids',{},testnet);out.api='ok'}catch(e){out.api='error';out.error=e.message}
  return out;
}

window.RWAExecutionAPI={
  version:'2.0.0',
  hardening:'single-write-path-v1',
  config,
  auth:{master,provider},
  agent:{authorize:authorizeAgent,revoke:revokeAgent,status:(t=false)=>readAgent(t),account:agentAccount},
  builder:{status:builderStatus,approve:approveBuilderFee},
  orders:{
    limit,
    market,
    trigger,
    cancel,
    modify,
    cancelAll,
    open:(t=false)=>info('frontendOpenOrders',{user:master()},t),
    history:(t=false)=>info('historicalOrders',{user:master()},t)
  },
  account:{
    state:(t=false)=>info('clearinghouseState',{user:master()},t),
    fills:(t=false)=>info('userFills',{user:master()},t)
  },
  risk:{setLeverage},
  info,
  health
};
window.dispatchEvent(new CustomEvent('rwa:execution-api-ready'));
})();
