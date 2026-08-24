(()=>{
'use strict';
if(window.RWACommerceAPI)return;
const TOKEN_KEY='rwa_commerce_session_v1';
let cfgPromise=null;
const cleanBase=v=>String(v||'').trim().replace(/\/$/,'');
const token=()=>{try{return sessionStorage.getItem(TOKEN_KEY)||''}catch{return''}};
const setToken=v=>{try{v?sessionStorage.setItem(TOKEN_KEY,v):sessionStorage.removeItem(TOKEN_KEY)}catch{}};
async function config(){if(cfgPromise)return cfgPromise;cfgPromise=fetch('rwa-commerce-config.json?v=1',{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({})).then(x=>({...x,api_base:cleanBase(x.api_base)}));return cfgPromise}
async function request(path,{method='GET',body=null,auth=true,idempotencyKey=''}={}){const c=await config();if(!c.api_base){const e=Error('Commerce backend is not deployed');e.code='commerce_backend_locked';throw e}const headers={Accept:'application/json'};if(body!==null)headers['Content-Type']='application/json';if(auth&&token())headers.Authorization=`Bearer ${token()}`;if(idempotencyKey)headers['Idempotency-Key']=idempotencyKey;const r=await fetch(`${c.api_base}${path}`,{method,headers,body:body===null?undefined:JSON.stringify(body),cache:'no-store'});const data=await r.json().catch(()=>({ok:false,error:`HTTP_${r.status}`}));if(!r.ok||data?.ok===false){const e=Error(data?.error||`HTTP_${r.status}`);e.status=r.status;e.code=data?.error||'commerce_error';e.detail=data?.detail;throw e}return data}
const idem=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;
async function provider(){if(window.ethereum?.request)return window.ethereum;throw Error('Connect an EVM wallet to shop')}
async function wallet(){const p=await provider(),a=await p.request({method:'eth_accounts'});if(!a?.[0]){const b=await p.request({method:'eth_requestAccounts'});if(!b?.[0])throw Error('Wallet connection required');return b[0]}return a[0]}
async function login(){const p=await provider(),w=await wallet(),ch=await request('/v1/auth/challenge',{method:'POST',body:{wallet:w},auth:false});const message=ch?.data?.message;if(!message)throw Error('Commerce challenge unavailable');const signature=await p.request({method:'personal_sign',params:[message,w]});const v=await request('/v1/auth/verify',{method:'POST',body:{wallet:w,signature},auth:false});if(!v?.data?.token)throw Error('Commerce session failed');setToken(v.data.token);return{wallet:w.toLowerCase(),expires_at:v.data.expiresAt||v.data.expires_at}}
async function ensureLogin(){if(token())return true;await login();return true}
async function logout(){try{if(token())await request('/v1/auth/logout',{method:'POST'})}finally{setToken('')}}
const api={
  version:'1.0.0',policy:'ONE_TOKEN_ONE_PHYSICAL_STORE_V1',config,enabled:async()=>!!(await config()).api_base,session:()=>({authenticated:!!token()}),login,ensureLogin,logout,idem,
  service:()=>request('/v1/config',{auth:false}),stores:()=>request('/v1/stores',{auth:false}),products:store=>request(`/v1/products${store?`?store=${encodeURIComponent(store)}`:''}`,{auth:false}),product:id=>request(`/v1/products/${encodeURIComponent(id)}`,{auth:false}),
  quote:async payload=>{await ensureLogin();return request('/v1/quote',{method:'POST',body:payload})},
  createOrder:async payload=>{await ensureLogin();return request('/v1/orders',{method:'POST',body:payload,idempotencyKey:idem()})},
  orders:async()=>{await ensureLogin();return request('/v1/orders')},
  createPayment:async orderId=>{await ensureLogin();return request(`/v1/orders/${encodeURIComponent(orderId)}/payment`,{method:'POST',body:{},idempotencyKey:idem()})},
  paymentStatus:async orderId=>{await ensureLogin();return request(`/v1/orders/${encodeURIComponent(orderId)}/payment-status`)},
  cancelOrder:async orderId=>{await ensureLogin();return request(`/v1/orders/${encodeURIComponent(orderId)}/cancel`,{method:'POST',body:{}})},
  requestRefund:async(orderId,reason,amount_cents=null)=>{await ensureLogin();return request(`/v1/orders/${encodeURIComponent(orderId)}/refund-request`,{method:'POST',body:{reason,amount_cents}})}
};
window.RWACommerceAPI=api;
})();
