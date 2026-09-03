(()=>{
'use strict';
if(window.RWAExchangeCore)return;
const SESSION='rwa_wallet_link_v1';
const ENV_KEY='rwa_exchange_env_v1';
const MAINNET_GATE='rwa_mainnet_gate_v1';
const LAUNCH_URL='launch/readiness.json';
const $=id=>document.getElementById(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const state={env:'testnet',wallet:'',account:null,positions:[],orders:[],fills:[],history:[],mids:{},launch:null,launchAt:0,loading:false,submitting:false,error:'',lastUpdated:0,poll:null};
const audit=(type,details={})=>window.RWAAudit?.log?.(type,details);
const emit=()=>window.dispatchEvent(new CustomEvent('rwa:exchange-state',{detail:snapshotLocal()}));
function session(){try{return JSON.parse(localStorage.getItem(SESSION)||'null')}catch{return null}}
function wallet(){return String(window.RWAWalletAuth?.session?.()?.wallet||session()?.wallet||'').toLowerCase()}
function api(){return window.RWAExecutionAPI}
function testnet(){return state.env==='testnet'}
function mainnetGate(){try{const g=JSON.parse(localStorage.getItem(MAINNET_GATE)||'null');return g&&typeof g==='object'?g:null}catch{return null}}
function localE2EVerified(){const g=mainnetGate(),w=wallet();return !!(w&&g?.status==='E2E_VERIFIED'&&String(g.wallet||'').toLowerCase()===w&&Number(g.verifiedAt)>0)}
function globalMainnetReady(){return !!(state.launch?.mainnet_ready===true&&state.launch?.status==='READY_FOR_MAINNET')}
function mainnetUnlocked(){return localE2EVerified()&&globalMainnetReady()}
async function refreshLaunchGate(force=false){if(!force&&state.launch&&Date.now()-state.launchAt<30000)return state.launch;try{const r=await fetch(`${LAUNCH_URL}?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw Error(`Launch gate HTTP ${r.status}`);const j=await r.json();state.launch=j;state.launchAt=Date.now();return j}catch(e){state.launch={status:'UNAVAILABLE',beta_ready:false,mainnet_ready:false,error:String(e.message||e)};state.launchAt=Date.now();return state.launch}}
function n(v,d=0){const x=Number(v);return Number.isFinite(x)?x:d}
function positionRows(ch){return (ch?.assetPositions||[]).map(x=>x.position||x).filter(p=>Math.abs(n(p?.szi))>0)}
function accountSummary(ch,positions){
 const m=ch?.marginSummary||{},cm=ch?.crossMarginSummary||{};
 const equity=n(m.accountValue);const marginUsed=n(cm.totalMarginUsed??m.totalMarginUsed);
 const unrealized=positions.reduce((s,p)=>s+n(p.unrealizedPnl),0);
 const notional=positions.reduce((s,p)=>s+Math.abs(n(p.positionValue)||n(p.szi)*n(p.entryPx)),0);
 return{equity,balance:equity-unrealized,available:n(ch?.withdrawable),marginUsed,unrealizedPnl:unrealized,totalNotional:notional,leverage:equity>0?notional/equity:0};
}
function snapshotLocal(){return{...state,positions:[...state.positions],orders:[...state.orders],fills:[...state.fills],history:[...state.history],mids:{...state.mids},launch:state.launch?{...state.launch}:null}}
async function refresh({silent=false}={}){
 await refreshLaunchGate();
 const w=wallet(),a=api();state.wallet=w;
 if(!w||!a){state.account=null;state.positions=[];state.orders=[];state.fills=[];state.history=[];state.error=w?'Execution API loading':'Connect wallet';emit();return snapshotLocal()}
 if(state.loading)return snapshotLocal();state.loading=true;if(!silent)emit();
 try{
  const t=testnet();
  const [ch,orders,fills,history,mids]=await Promise.all([
   a.account.state(t),a.orders.open(t),a.account.fills(t),a.orders.history(t),a.info('allMids',{},t)
  ]);
  const positions=positionRows(ch);
  state.account=accountSummary(ch,positions);state.positions=positions;state.orders=Array.isArray(orders)?orders:[];state.fills=Array.isArray(fills)?fills.slice(0,100):[];state.history=Array.isArray(history)?history.slice(0,100):[];state.mids=mids||{};state.error='';state.lastUpdated=Date.now();
 }catch(e){state.error=String(e?.message||e);if(!silent)console.warn('RWA exchange refresh',e)}finally{state.loading=false;emit()}
 return snapshotLocal();
}
function setEnv(env){env=env==='mainnet'?'mainnet':'testnet';if(env==='mainnet'&&!mainnetUnlocked())throw Error('Mainnet is locked until wallet E2E AND the global production Launch Gate are verified');state.env=env;localStorage.setItem(ENV_KEY,env);audit('exchange.environment',{env,wallet:wallet(),launch:state.launch?.status||'unknown'});refresh();return env}
function selectedCoin(){try{const p=typeof S!=='undefined'?S.map?.get(S.selected):null;return String(p?.base||'BTC').toUpperCase()}catch{return'BTC'}}
function normalizeCoin(v){const c=String(v||selectedCoin()).trim().toUpperCase().replace(/[-_/ ]?(USDT|USDC)$/,'');if(!c)throw Error('Coin is required');return c}
function guardSubmit(){if(state.submitting)throw Error('Another execution is still pending');if(!wallet())throw Error('Connect wallet first');if(!api())throw Error('Execution API unavailable');if(state.env==='mainnet'&&!mainnetUnlocked())throw Error('Mainnet is locked by wallet E2E + global production Launch Gate')}
async function withSubmit(fn,meta){guardSubmit();state.submitting=true;emit();audit('exchange.submit.start',meta);try{const out=await fn();audit('exchange.submit.success',meta);setTimeout(()=>refresh({silent:true}),500);return out}catch(e){audit('exchange.submit.failed',{...meta,error:String(e?.message||e)});throw e}finally{state.submitting=false;emit()}}
async function trigger({coin,side,size,triggerPx,tpsl}){
 const a=api();if(a?.orders?.trigger)return a.orders.trigger({coin,side,size,triggerPx,tpsl,testnet:testnet(),preferAgent:true});
 throw Error('TP/SL execution API unavailable');
}
async function submit(o={}){
 const coin=normalizeCoin(o.coin),side=String(o.side||'BUY').toUpperCase()==='SELL'?'SELL':'BUY',rawKind=String(o.type||'MARKET').toUpperCase(),kind=rawKind==='LIMIT'?'LIMIT':rawKind==='STOP'?'STOP':'MARKET';
 const size=n(o.size),lev=Math.max(1,Math.floor(n(o.leverage,1))),price=n(o.price),tp=n(o.tp),sl=n(o.sl);if(!(size>0))throw Error('Size must be greater than zero');if((kind==='LIMIT'||kind==='STOP')&&!(price>0))throw Error(kind==='STOP'?'Stop price is required':'Limit price is required');if(kind==='STOP'&&(tp>0||sl>0))throw Error('Attach TP/SL after the Stop entry triggers; atomic TP/SL on an unfilled Stop entry is not enabled');
 return withSubmit(async()=>{
  const a=api(),common={coin,side,size,reduceOnly:!!o.reduceOnly,leverage:lev,testnet:testnet(),preferAgent:true};
  if(kind==='STOP'){
   if(!a?.orders?.trigger)throw Error('Stop Market execution API unavailable');
   const entry=await a.orders.trigger({...common,triggerPx:price,tpsl:'sl',reduceOnly:false,isMarket:true});
   return{entry,protection:[],atomic:false,waitingForTrigger:true};
  }
  if(tp>0||sl>0){
   if(!a?.orders?.bracket||a?.bracket!=='atomic-normal-tpsl-v1')throw Error('Atomic TP/SL bracket API unavailable');
   const bracket=await a.orders.bracket({coin,side,size,type:kind,price:kind==='LIMIT'?price:null,tp:tp||null,sl:sl||null,tif:o.tif||'Gtc',leverage:lev,testnet:testnet(),preferAgent:true});
   const protection=Array.from({length:Number(bracket?.protectionCount||0)},(_,i)=>({bracket:true,index:i+1,result:bracket.result}));
   return{entry:bracket,protection,atomic:true};
  }
  const entry=kind==='MARKET'?await a.orders.market(common):await a.orders.limit({...common,price,tif:o.tif||'Gtc'});
  return{entry,protection:[],atomic:false};
 },{coin,side,kind,size,leverage:lev,env:state.env,tp:tp||null,sl:sl||null,atomic:kind!=='STOP'&&(tp>0||sl>0)});
}
async function cancel(coin,oid){return withSubmit(()=>api().orders.cancel({coin:normalizeCoin(coin),oid:Number(oid),testnet:testnet(),preferAgent:true}),{action:'cancel',coin,oid,env:state.env})}
async function cancelAll(){return withSubmit(()=>api().orders.cancelAll({testnet:testnet(),preferAgent:true}),{action:'cancelAll',env:state.env})}
async function modify(o){const coin=normalizeCoin(o.coin);return withSubmit(()=>api().orders.modify({coin,oid:Number(o.oid),side:o.side,price:n(o.price),size:n(o.size),reduceOnly:!!o.reduceOnly,testnet:testnet(),preferAgent:true}),{action:'modify',coin,oid:o.oid,env:state.env})}
async function closePosition(coin){coin=normalizeCoin(coin);const p=state.positions.find(x=>String(x.coin).toUpperCase()===coin);if(!p)throw Error('Position not found');const signed=n(p.szi);if(!signed)throw Error('Position is already flat');return withSubmit(()=>api().orders.market({coin,side:signed>0?'SELL':'BUY',size:Math.abs(signed),reduceOnly:true,testnet:testnet(),preferAgent:true}),{action:'close',coin,size:Math.abs(signed),env:state.env})}
async function preflight(){await refreshLaunchGate(true);const out={env:state.env,wallet:wallet(),checks:[],ready:false};
 const add=(name,ok,detail='')=>out.checks.push({name,ok:!!ok,detail});add('environment',state.env==='testnet',state.env==='testnet'?'TESTNET':'MAINNET');add('wallet login',!!out.wallet,out.wallet||'not connected');add('execution API',!!api(),api()?.version||'loading');add('atomic TP/SL',api()?.bracket==='atomic-normal-tpsl-v1'&&typeof api()?.orders?.bracket==='function',api()?.bracket||'missing');add('global launch gate',globalMainnetReady(),state.launch?.status||'unavailable');
 if(!out.wallet||!api())return out;
 try{const h=await api().health(testnet());add('venue API',h.api==='ok',h.api||h.error||'unknown')}catch(e){add('venue API',false,String(e.message||e))}
 try{const m=await api().info('meta',{},testnet());add('perp universe',Array.isArray(m?.universe)&&m.universe.length>0,`${m?.universe?.length||0} assets`)}catch(e){add('perp universe',false,String(e.message||e))}
 try{const ch=await api().account.state(testnet());add('account state',!!ch,'readable');add('test collateral',n(ch?.marginSummary?.accountValue)>0,`equity ${n(ch?.marginSummary?.accountValue).toFixed(2)}`)}catch(e){add('account state',false,String(e.message||e))}
 const ag=api().agent?.status?.(testnet());add('API wallet',!!ag,ag?.address||'master-sign mode');out.ready=out.checks.filter(x=>x.name!=='API wallet'&&x.name!=='global launch gate').every(x=>x.ok);return out;
}
function start(){clearInterval(state.poll);if(localStorage.getItem(ENV_KEY)==='mainnet')localStorage.setItem(ENV_KEY,'testnet');state.env='testnet';refreshLaunchGate(true).finally(()=>refresh());state.poll=setInterval(()=>{if(document.visibilityState==='visible'){refreshLaunchGate();if(wallet())refresh({silent:true})}},2500)}
window.addEventListener('rwa:wallet-login',()=>{state.wallet=wallet();if(!mainnetUnlocked()&&state.env!=='testnet')setEnv('testnet');else refresh()});window.addEventListener('rwa:wallet-logout',()=>{state.wallet='';state.env='testnet';localStorage.setItem(ENV_KEY,'testnet');refresh()});window.addEventListener('rwa:agent-changed',()=>refresh({silent:true}));document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh({silent:true})});
window.RWAExchangeCore={version:'1.2.0',safety:'wallet-and-global-launch-gate-v3',protection:'atomic-normal-tpsl-v1',state:()=>snapshotLocal(),refresh,refreshLaunchGate,setEnv,testnet,localE2EVerified,globalMainnetReady,mainnetUnlocked,selectedCoin,submit,cancel,cancelAll,modify,closePosition,preflight,start};
start();
})();