(()=>{
'use strict';
if(window.RWATerminalService)return;
const CONFIG_URL='agent-worker/public-config.json';
const SESSION_KEY='rwa_terminal_service_session_v1';
let cfg=null,readyCache={ts:0,value:null};
const safeJson=async r=>{const t=await r.text();try{return JSON.parse(t)}catch{throw Error(t||('HTTP '+r.status))}};
const wallet=()=>{try{return String(JSON.parse(localStorage.getItem('rwa_wallet_link_v1')||'null')?.wallet||'').toLowerCase()}catch{return''}};
const provider=()=>window.RWAProvider||window.ethereum;
const cleanBase=v=>String(v||'').trim().replace(/\/+$/,'');
async function config(force=false){
 if(cfg&&!force)return cfg;
 try{const r=await fetch(CONFIG_URL+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('config_http_'+r.status);cfg=await r.json()}catch(e){cfg={enabled:false,base_url:'',error:String(e?.message||e)}}
 return cfg
}
async function base(){
 const c=await config();const u=cleanBase(c?.base_url);
 if(c?.enabled!==true||!/^https:\/\//i.test(u))throw Error('terminal_service_not_enabled');
 return u
}
function sessionRow(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
function saveSession(row){try{localStorage.setItem(SESSION_KEY,JSON.stringify(row))}catch{}}
function clearSession(){try{localStorage.removeItem(SESSION_KEY)}catch{}}
function nonce(){const a=crypto.getRandomValues(new Uint8Array(12));return Array.from(a,x=>x.toString(16).padStart(2,'0')).join('')}
async function signSession(){
 const w=wallet(),p=provider();if(!/^0x[a-f0-9]{40}$/.test(w))throw Error('Connect wallet first');if(!p?.request)throw Error('Wallet provider unavailable');
 const issuedAt=new Date().toISOString(),n=nonce(),message=`RWA TERMINAL SESSION V1\nWallet: ${w}\nIssued At: ${issuedAt}\nNonce: ${n}`;
 let signature;try{signature=await p.request({method:'personal_sign',params:[message,w]})}catch(e){signature=await p.request({method:'personal_sign',params:[w,message]})}
 const u=await base(),r=await fetch(u+'/v1/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({wallet:w,issuedAt,nonce:n,message,signature})}),j=await safeJson(r);if(!r.ok||!j?.token)throw Error(j?.error||'terminal_session_failed');
 const row={base:u,wallet:w,token:j.token,expiresAt:Number(j.expiresAt||0)};saveSession(row);return row
}
async function ensureSession(){
 const u=await base(),w=wallet(),s=sessionRow();if(s&&s.base===u&&s.wallet===w&&Number(s.expiresAt)>Date.now()+60_000&&s.token)return s;
 clearSession();return signSession()
}
async function req(path,{method='GET',body=null,auth=false}={}){
 const u=await base();const headers={'accept':'application/json'};if(body!=null)headers['content-type']='application/json';if(auth){const s=await ensureSession();headers.authorization='Bearer '+s.token}
 const r=await fetch(u+path,{method,headers,body:body==null?undefined:JSON.stringify(body),cache:'no-store'}),j=await safeJson(r);
 if(r.status===401&&auth){clearSession();const s=await ensureSession();headers.authorization='Bearer '+s.token;const r2=await fetch(u+path,{method,headers,body:body==null?undefined:JSON.stringify(body),cache:'no-store'}),j2=await safeJson(r2);if(!r2.ok)throw Error(j2?.error||('HTTP '+r2.status));return j2}
 if(!r.ok)throw Error(j?.error||('HTTP '+r.status));return j
}
async function ready(force=false){if(!force&&readyCache.value&&Date.now()-readyCache.ts<15_000)return readyCache.value;try{const v=await req('/terminal/readyz');readyCache={ts:Date.now(),value:v};return v}catch(e){const v={ok:false,error:String(e?.message||e)};readyCache={ts:Date.now(),value:v};return v}}
async function status(){const c=await config(),u=cleanBase(c?.base_url);return{enabled:c?.enabled===true&&/^https:\/\//i.test(u),base_url:u,ready:await ready()}}
window.RWATerminalService={
 version:'1.0.0',config,status,ready,session:{ensure:ensureSession,clear:clearSession},
 alerts:{list:()=>req('/v1/alerts/list',{method:'POST',body:{},auth:true}),create:o=>req('/v1/alerts/create',{method:'POST',body:o,auth:true}),delete:id=>req('/v1/alerts/delete',{method:'POST',body:{id},auth:true})},
 social:{feed:(limit=50)=>req('/v1/social/feed?limit='+encodeURIComponent(limit)),post:o=>req('/v1/social/post',{method:'POST',body:o,auth:true}),delete:id=>req('/v1/social/delete',{method:'POST',body:{id},auth:true}),comment:(postId,text)=>req('/v1/social/comment',{method:'POST',body:{postId,text},auth:true}),react:(postId,reaction='fire')=>req('/v1/social/react',{method:'POST',body:{postId,reaction},auth:true}),follow:wallet=>req('/v1/social/follow',{method:'POST',body:{wallet},auth:true})},
 rewards:{summary:()=>req('/v1/rewards/summary',{method:'POST',body:{},auth:true})},
 holders:{get:symbol=>req('/v1/holders?symbol='+encodeURIComponent(symbol))}
};
window.dispatchEvent(new CustomEvent('rwa:terminal-service-ready'));
})();