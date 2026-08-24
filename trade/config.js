import './provider-runtime.js?v=1';
import './ui-polish.js?v=1';

const GATE={readiness:null,e2e:null,checkedAt:0,error:''};
const wallet=()=>{try{const w=String(JSON.parse(localStorage.getItem('rwa_wallet_link_v1')||'{}')?.wallet||'').toLowerCase();return /^0x[a-f0-9]{40}$/.test(w)?w:''}catch{return''}};
function fresh(){const t=Date.parse(GATE.readiness?.generated_at||'');return Number.isFinite(t)&&Date.now()-t<60*60*1000}
function walletE2E(){const w=wallet();return !!(w&&(GATE.e2e?.wallets||[]).some(x=>String(x?.wallet||'').toLowerCase()===w&&x?.status==='E2E_VERIFIED'&&Number(x?.verified_at)>0))}
function canMainnet(){return !!(fresh()&&GATE.readiness?.status==='READY_FOR_MAINNET'&&GATE.readiness?.mainnet_ready===true&&walletE2E())}
function gateReason(){if(GATE.error)return`Launch gate unavailable: ${GATE.error}`;if(!fresh())return'Launch gate is not fresh';if(GATE.readiness?.status!=='READY_FOR_MAINNET'||GATE.readiness?.mainnet_ready!==true)return`Global launch gate: ${GATE.readiness?.status||'checking'}`;if(!walletE2E())return'This wallet is not in the verified E2E registry';return'Wallet E2E + global launch gate verified'}
function syncGateUi(){const ok=canMainnet(),toggle=document.getElementById('testnetToggle'),diag=document.getElementById('diagMainnet'),note=document.getElementById('mainnetLockText');if(toggle){const wasMainnet=toggle.checked===false;toggle.disabled=!ok;if(!ok){toggle.checked=true;if(wasMainnet)toggle.dispatchEvent(new Event('change',{bubbles:true}))}}if(diag)diag.textContent=ok?'GATE READY':'LOCKED';if(note)note.textContent=ok?'Production gate is READY. Mainnet remains opt-in and requires switching environment explicitly.':`Mainnet locked · ${gateReason()}`;window.dispatchEvent(new CustomEvent('rwa:trade-launch-gate',{detail:{ready:ok,reason:gateReason()}}))}
async function refreshGate(){try{const q=`?t=${Date.now()}`,[rr,er]=await Promise.all([fetch(`../launch/readiness.json${q}`,{cache:'no-store'}),fetch(`../launch/e2e-registry.json${q}`,{cache:'no-store'})]);if(!rr.ok||!er.ok)throw Error(`HTTP ${rr.status}/${er.status}`);GATE.readiness=await rr.json();GATE.e2e=await er.json();GATE.checkedAt=Date.now();GATE.error=''}catch(e){GATE.error=String(e?.message||e)}syncGateUi();return{ready:canMainnet(),reason:gateReason(),readiness:GATE.readiness,checkedAt:GATE.checkedAt}}
if(typeof window!=='undefined'){
  window.RWATradeLaunchGate={version:'1.0.2',refresh:refreshGate,canMainnet,reason:gateReason,state:()=>({...GATE,wallet:wallet(),walletE2E:walletE2E()})};
  setTimeout(refreshGate,0);setInterval(refreshGate,60000);window.addEventListener('focus',()=>refreshGate());
  import('./release-runtime.js?v=1').catch(e=>console.warn('RWA release runtime unavailable',e));
  import('./margin-runtime.js?v=1').catch(e=>console.warn('RWA margin runtime unavailable',e));
  import('./chart-overlays.js?v=1').catch(e=>console.warn('RWA chart overlay unavailable',e));
}

const BASE={
  version:'1.5.0',
  build:'github-pages-rwa-trade-commerce-polish-2026-08-24',
  releaseChannel:'PUBLIC_TESTNET_BETA',
  uiRelease:'terminal-pro-commerce-v2',
  publicBetaEnabled:true,
  sdkUrl:'https://esm.sh/@nktkas/hyperliquid@0.33.3?target=es2022',
  viemUrl:'https://esm.sh/viem@2.37.3?target=es2022',
  viemAccountsUrl:'https://esm.sh/viem@2.37.3/accounts?target=es2022',
  viemChainsUrl:'https://esm.sh/viem@2.37.3/chains?target=es2022',
  defaultTestnet:true,
  agentName:'RWA-TRADE',
  agentTtlDays:30,
  maxLeverage:5,
  maxOrderUsd:1000,
  maxExposureUsd:5000,
  maxPerAssetUsd:2000,
  dailyLossUsd:250,
  marketSlippageBps:35,
  exchangeTimeoutMs:15000,
  reconnectMaxRetries:12,
  reconnectDelayMs:750,
  keepAliveIntervalMs:30000,
  keepAliveTimeoutMs:10000,
  mainnetUnlockPhrase:'I UNDERSTAND MAINNET RISK',
  zeroAddress:'0x0000000000000000000000000000000000000000',
};
Object.defineProperty(BASE,'mainnetEnabled',{enumerable:true,get:()=>canMainnet()});
export const CONFIG=Object.freeze(BASE);
