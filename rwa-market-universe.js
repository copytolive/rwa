(()=>{
'use strict';
if(window.RWAMarketUniverse?.version==='1.0.0')return;
const VERSION='1.0.0';
const LIFI='https://li.quest/v1';
const REGISTRY_URL='rwa-multichain-registry.json?v=2';
const CACHE_MS=5*60*1000;
const state={registry:null,loadedAt:0,byNetwork:new Map(),flat:[],loading:null};
const text=v=>String(v??'').trim();
const lc=v=>text(v).toLowerCase();
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const native='0x0000000000000000000000000000000000000000';
const stableKeys=new Set(['USDC','USDT','DAI','USDE','FDUSD','USDS','PYUSD','USDC.E']);
const majorKeys=new Set(['ETH','WETH','BTC','WBTC','SOL','WSOL','BNB','WBNB','AVAX','WAVAX','POL','MATIC','HYPE','MON']);
async function getJson(url){const c=new AbortController(),t=setTimeout(()=>c.abort(),15000);try{const r=await fetch(url,{cache:'no-store',signal:c.signal,headers:{accept:'application/json'}});const j=await r.json().catch(()=>null);if(!r.ok)throw Error(j?.message||j?.error||`HTTP ${r.status}`);return j}finally{clearTimeout(t)}}
async function loadRegistry(){if(state.registry)return state.registry;const r=await getJson(REGISTRY_URL);if(!Array.isArray(r?.networks))throw Error('Invalid MULTI CHAIN registry');state.registry=r;return r}
function lifiId(n){if(n.id==='solana')return 1151111081099710;if(n.lifi_chain_id)return Number(n.lifi_chain_id);if(n.chain_id)return parseInt(String(n.chain_id),16);return null}
function routeNetworks(reg){return(reg?.networks||[]).filter(n=>n.capabilities?.route_quote===true&&lifiId(n)!=null)}
function tokenId(t){return`${t.network}:${lc(t.address)}`}
function normalize(t,n){const tags=Array.isArray(t?.tags)?t.tags.map(String):[];const coinKey=text(t?.coinKey||t?.symbol).toUpperCase();const symbol=text(t?.symbol).toUpperCase();const priceUSD=num(t?.priceUSD);const providerListed=!!t?.address&&Number.isFinite(Number(t?.decimals));const isStable=tags.some(x=>/stable/i.test(x))||stableKeys.has(coinKey)||stableKeys.has(symbol);const isMajor=majorKeys.has(coinKey)||majorKeys.has(symbol);const address=text(t?.address);return{
  id:`${n.id}:${lc(address)}`,
  network:n.id,
  networkName:n.name,
  family:n.family,
  chainId:lifiId(n),
  address,
  symbol,
  name:text(t?.name||symbol),
  coinKey,
  decimals:Number(t?.decimals||0),
  priceUSD,
  logoURI:text(t?.logoURI),
  tags,
  providerListed,
  isStable,
  isMajor,
  isNative:lc(address)===native,
  safety:{
    providerListed,
    verifiedByCopyToLive:false,
    liquidityKnown:false,
    routeMustBeQuoted:true,
    label:providerListed?'PROVIDER LISTED · ROUTE CHECK REQUIRED':'UNVERIFIED'
  }
}}
function parseTokens(payload,ns){const root=payload?.tokens&&typeof payload.tokens==='object'?payload.tokens:payload||{};const rows=[];for(const n of ns){const id=String(lifiId(n));const arr=Array.isArray(root?.[id])?root[id]:Array.isArray(root?.[n.id])?root[n.id]:[];const normalized=arr.map(t=>normalize(t,n)).filter(t=>t.providerListed);state.byNetwork.set(n.id,normalized);rows.push(...normalized)}return rows}
async function load({force=false}={}){if(!force&&state.flat.length&&Date.now()-state.loadedAt<CACHE_MS)return snapshot();if(state.loading)return state.loading;state.loading=(async()=>{const reg=await loadRegistry(),ns=routeNetworks(reg),ids=ns.map(lifiId).filter(Boolean);if(!ids.length)throw Error('No route-capable networks');const p=await getJson(`${LIFI}/tokens?chains=${encodeURIComponent(ids.join(','))}`);state.flat=parseTokens(p,ns);state.loadedAt=Date.now();return snapshot()})().finally(()=>{state.loading=null});return state.loading}
function networkTokens(network){return(state.byNetwork.get(String(network))||[]).slice()}
function score(t,q){if(!q)return(t.isStable?40:0)+(t.isMajor?30:0)+Math.min(20,Math.log10(Math.max(t.priceUSD,0.000001))+10);let s=0,needle=lc(q);if(lc(t.symbol)===needle)s+=100;if(lc(t.coinKey)===needle)s+=90;if(lc(t.address)===needle)s+=95;if(lc(t.symbol).startsWith(needle))s+=70;if(lc(t.name).startsWith(needle))s+=55;if(lc(t.name).includes(needle))s+=35;if(lc(t.address).includes(needle))s+=25;if(t.isStable)s+=6;if(t.isMajor)s+=5;return s}
function search(query,{network=null,limit=80,includeZeroPrice=true}={}){const q=text(query),base=network?networkTokens(network):state.flat.slice();return base.filter(t=>includeZeroPrice||t.priceUSD>0).map(t=>({t,s:score(t,q)})).filter(x=>!q||x.s>0).sort((a,b)=>b.s-a.s||b.t.priceUSD-a.t.priceUSD||a.t.symbol.localeCompare(b.t.symbol)).slice(0,Math.max(1,Number(limit)||80)).map(x=>x.t)}
function getToken(network,query){const q=lc(query),rows=networkTokens(network);return rows.find(t=>lc(t.address)===q)||rows.find(t=>lc(t.symbol)===q)||rows.find(t=>lc(t.coinKey)===q)||null}
function canonicalAssets({network=null,limit=500}={}){const rows=network?networkTokens(network):state.flat;const map=new Map();for(const t of rows){const k=t.coinKey||t.symbol;if(!k)continue;const v=map.get(k)||{coinKey:k,symbol:t.symbol,name:t.name,networks:[],tokens:[],isStable:t.isStable,isMajor:t.isMajor};v.networks.push(t.network);v.tokens.push(t);v.isStable=v.isStable||t.isStable;v.isMajor=v.isMajor||t.isMajor;map.set(k,v)}return[...map.values()].sort((a,b)=>(b.isStable-a.isStable)||(b.isMajor-a.isMajor)||b.networks.length-a.networks.length||a.symbol.localeCompare(b.symbol)).slice(0,limit)}
function pair(fromNetwork,fromToken,toNetwork,toToken){const from=getToken(fromNetwork,fromToken),to=getToken(toNetwork,toToken);if(!from)throw Error(`Source token ${fromToken} is not provider-listed on ${fromNetwork}`);if(!to)throw Error(`Destination token ${toToken} is not provider-listed on ${toNetwork}`);return{from,to,routeStatus:'QUOTE_REQUIRED',pairKey:`${from.network}:${from.address}->${to.network}:${to.address}`,note:'Pair availability is resolved on demand by a real provider quote; the UI never fabricates an N×N pair list.'}}
function sameAssetRoutes(query){const q=lc(query);return canonicalAssets({limit:5000}).filter(a=>lc(a.coinKey)===q||lc(a.symbol)===q).flatMap(a=>a.tokens.map(from=>a.tokens.filter(to=>to.id!==from.id).map(to=>({from,to})))).flat()}
function snapshot(){const networks={};for(const[n,rows]of state.byNetwork)networks[n]=rows.length;return{version:VERSION,provider:'LI.FI',loadedAt:state.loadedAt,totalTokens:state.flat.length,networks,routeModel:'ON_DEMAND_QUOTE_NOT_PRECOMPUTED_PAIRS'}}
function clear(){state.loadedAt=0;state.flat=[];state.byNetwork.clear()}
window.RWAMarketUniverse={version:VERSION,provider:'LI.FI',load,loadRegistry,search,getToken,networkTokens,canonicalAssets,pair,sameAssetRoutes,snapshot,clear,state:()=>({loadedAt:state.loadedAt,totalTokens:state.flat.length,networks:[...state.byNetwork.keys()]})};
})();
