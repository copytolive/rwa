import {verifyMessage} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {RWAWorkerExecutionAPI,WORKER_SINGLE_WRITE_PATH,WORKER_IDEMPOTENCY} from '../../execution.mjs';
import {sourceFillId,cloidFor,isProcessed,markProcessed,planCopyFill,applyLedgerPosition,sessionLoss} from '../../copy-engine.mjs';

const ADDRESS=/^0x[a-fA-F0-9]{40}$/;
const PK=/^0x[a-fA-F0-9]{64}$/;
const DEFAULT_CONTROL={enabled:false,kill_switch:true,mainnet_enabled:false,production_ready:false};
const DEFAULT_RISK={dailyLoss:250,maxLeverage:5,maxExposure:5000,perAsset:2000,kill:false};
const LOOP_MS=10_000;
const CONTROL_TTL=10_000;
const MAX_USERS_PER_TICK=8;
const encoder=new TextEncoder();
const decoder=new TextDecoder();

const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const now=()=>Date.now();
const json=(value,status=200,extra={})=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff',...extra}});
const parseRisk=env=>{try{return{...DEFAULT_RISK,...JSON.parse(String(env.RWA_RISK_JSON||'{}'))}}catch{return{...DEFAULT_RISK}}};

async function aesKey(secret){
  if(String(secret||'').length<32)throw Error('RWA_KEY_ENCRYPTION_SECRET must be at least 32 characters');
  const hash=await crypto.subtle.digest('SHA-256',encoder.encode(String(secret)));
  return crypto.subtle.importKey('raw',hash,{name:'AES-GCM'},false,['encrypt','decrypt']);
}
async function encryptSecret(secret,value){
  const key=await aesKey(secret),iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(String(value)));
  return{alg:'AES-256-GCM',iv:btoa(String.fromCharCode(...iv)),ct:btoa(String.fromCharCode(...new Uint8Array(ct)))};
}
async function decryptSecret(secret,row){
  const key=await aesKey(secret),iv=Uint8Array.from(atob(row.iv),c=>c.charCodeAt(0)),ct=Uint8Array.from(atob(row.ct),c=>c.charCodeAt(0));
  return decoder.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv},key,ct));
}

function canonicalAuthorize(p,agent){return `RWA 24/7 COPY AUTHORIZE V2\nMaster: ${p.master}\nAgent: ${agent}\nTarget: ${p.target}\nCapital: ${p.capital}\nMax Loss: ${p.maxLoss}\nFollower Environment: ${p.testnet?'testnet':'mainnet'}\nSource Environment: ${p.sourceTestnet?'testnet':'mainnet'}\nWorker: ${p.worker}\nIssued At: ${p.issuedAt}\nNonce: ${p.nonce}`}
function canonicalStop(p){return `RWA 24/7 COPY STOP V2\nMaster: ${p.master}\nWorker: ${p.worker}\nIssued At: ${p.issuedAt}\nNonce: ${p.nonce}`}
async function validFreshSignature({master,message,signature,issuedAt}){
  if(!ADDRESS.test(master)||!signature||!message)return false;
  const ts=Date.parse(issuedAt);if(!Number.isFinite(ts)||Math.abs(now()-ts)>10*60_000)return false;
  return verifyMessage({address:master,message,signature});
}
function periodPnl(portfolio,key='day'){const row=(portfolio||[]).find(x=>Array.isArray(x)&&x[0]===key)?.[1],last=row?.pnlHistory?.at?.(-1);return n(Array.isArray(last)?last[1]:0)}
function accountEquity(ch){return n(ch?.marginSummary?.accountValue)}
function copiedUsed(rec,mids){return Object.entries(rec.ledger?.positions||{}).reduce((s,[coin,qty])=>s+Math.abs(n(qty))*n(mids?.[coin]),0)}

export class RWAState {
  constructor(ctx,env){
    this.ctx=ctx;this.env=env;this.db={schema:3,users:{},events:[],nonces:{},metrics:{since:now(),events:{}},updated_at:0};this.control={...DEFAULT_CONTROL};this.controlAt=0;this.lastError='';this.cursor=0;
    ctx.blockConcurrencyWhile(async()=>{
      this.db=await ctx.storage.get('db')||this.db;
      this.control=await ctx.storage.get('control')||this.control;
      this.controlAt=Number(await ctx.storage.get('controlAt')||0);
      this.lastError=String(await ctx.storage.get('lastError')||'');
      if(await ctx.storage.getAlarm()==null)await ctx.storage.setAlarm(now()+1000);
    });
  }
  bump(type){const e=this.db.metrics?.events||(this.db.metrics={since:now(),events:{}}).events;e[type]=n(e[type])+1}
  event(type,details={}){this.bump(type);this.db.events.push({ts:now(),type,...details});this.db.events=this.db.events.slice(-1000)}
  async save(){this.db.updated_at=now();await this.ctx.storage.put('db',this.db)}
  async setLastError(error){this.lastError=String(error?.message||error||'');await this.ctx.storage.put('lastError',this.lastError)}
  async loadControl(force=false){
    if(!force&&now()-this.controlAt<CONTROL_TTL)return this.control;
    this.controlAt=now();
    try{
      const url=String(this.env.RWA_CONTROL_URL||'https://narzulalistiqlal.github.io/rwa/agent-worker/control.json');
      const r=await fetch(url+'?t='+now(),{headers:{'cache-control':'no-cache'}});if(r.ok)this.control={...this.control,...await r.json()};
      await this.ctx.storage.put({control:this.control,controlAt:this.controlAt});
    }catch(e){await this.setLastError('control: '+String(e?.message||e))}
    return this.control;
  }
  mainnetAllowed(){return this.control.mainnet_enabled===true&&String(this.env.RWA_MAINNET_APPROVED||'')==='I_UNDERSTAND_MAINNET_RISK'}
  apiFor(master,pk,testnet,risk={}){return new RWAWorkerExecutionAPI({master,agentPrivateKey:pk,testnet,risk:{...parseRisk(this.env),...risk,kill:!!this.control.kill_switch}})}
  consumeNonce(master,nonce){const x=String(nonce||'');if(x.length<8||x.length>160)throw Error('Authorization nonce is invalid');const list=Array.isArray(this.db.nonces[master])?this.db.nonces[master]:[];if(list.includes(x))throw Error('Authorization nonce was already used');list.push(x);this.db.nonces[master]=list.slice(-500)}
  originHeaders(request){const origin=String(request.headers.get('origin')||'').replace(/\/$/,'');const allow=String(this.env.RWA_ALLOWED_ORIGINS||'https://narzulalistiqlal.github.io').split(',').map(x=>x.trim().replace(/\/$/,'')).filter(Boolean);return origin&&allow.includes(origin)?{'access-control-allow-origin':origin,'access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST,OPTIONS','vary':'Origin'}:{}}
  originAllowed(request){const origin=String(request.headers.get('origin')||'').replace(/\/$/,'');if(!origin)return true;return String(this.env.RWA_ALLOWED_ORIGINS||'https://narzulalistiqlal.github.io').split(',').map(x=>x.trim().replace(/\/$/,'')).includes(origin)}
  requireWorkerBinding(payload,request){const actual=new URL(request.url).origin;const claimed=String(payload.worker||'').replace(/\/$/,'');if(claimed!==actual)throw Error('Authorization is bound to a different worker origin');return actual}
  metrics(){const e=this.db.metrics?.events||{},active=Object.values(this.db.users||{}).filter(x=>x.copy?.enabled);return{since:this.db.metrics?.since||0,active_users:active.length,total_users:Object.keys(this.db.users||{}).length,executed:n(e['copy.executed']),replay_confirmed:n(e['copy.replay_confirmed']),retry_pending:n(e['copy.retry_pending']),blocked:n(e['copy.blocked']),errors:n(e['worker.error']),max_loss_stops:n(e['copy.max_loss'])}}
  health(){return{ok:true,service:'rwa-agent-worker',runtime:'cloudflare-durable-object-free',version:'3.0.0',single_write_path:WORKER_SINGLE_WRITE_PATH,idempotency:WORKER_IDEMPOTENCY,control_enabled:!!this.control.enabled,kill_switch:!!this.control.kill_switch,production_ready:!!this.control.production_ready,mainnet_allowed:this.mainnetAllowed(),origin_bound:true,users:Object.values(this.db.users||{}).filter(x=>x.copy?.enabled).length,uptime_ms:now()-n(this.db.metrics?.since,now()),updated_at:this.db.updated_at}}
  ready(){const encrypted=String(this.env.RWA_KEY_ENCRYPTION_SECRET||'').length>=32,ok=encrypted&&this.control.enabled===true&&this.control.kill_switch===false&&this.control.production_ready===true;return{ok,encrypted_state:encrypted,origin_bound:true,control_enabled:!!this.control.enabled,kill_switch:!!this.control.kill_switch,production_ready:!!this.control.production_ready}}
  redacted(){return{...this.health(),control:this.control,metrics:this.metrics(),users:Object.values(this.db.users||{}).map(r=>({master:r.master.slice(0,6)+'…'+r.master.slice(-4),agent:r.agent?.address?.slice(0,6)+'…'+r.agent?.address?.slice(-4),copy:{target:r.copy?.target?.slice(0,6)+'…'+r.copy?.target?.slice(-4),capital:r.copy?.capital,maxLoss:r.copy?.maxLoss,testnet:r.copy?.testnet,sourceTestnet:r.copy?.sourceTestnet,enabled:r.copy?.enabled,startedAt:r.copy?.startedAt,lastTime:r.copy?.lastTime,lastPnl:r.copy?.lastPnl,lastEquity:r.copy?.lastEquity,processed:r.copy?.processed?.length||0}})),last_error:this.lastError||null}}
  async register(payload,request){
    await this.loadControl(true);
    const p={...payload,master:String(payload.master||'').toLowerCase(),target:String(payload.target||'').toLowerCase(),capital:n(payload.capital),maxLoss:n(payload.maxLoss),testnet:payload.testnet!==false,sourceTestnet:payload.sourceTestnet===true,worker:String(payload.worker||'').replace(/\/$/,'')};
    if(!ADDRESS.test(p.master)||!ADDRESS.test(p.target))throw Error('Invalid master or trader wallet');if(p.master===p.target)throw Error('Cannot copy the same wallet');if(!(p.capital>0&&p.maxLoss>0&&p.maxLoss<=p.capital))throw Error('Capital/max loss configuration is invalid');if(!PK.test(String(payload.agentPrivateKey||'')))throw Error('Delegated agent key is invalid');if(!p.testnet&&!this.mainnetAllowed())throw Error('24/7 mainnet is hard locked');
    this.requireWorkerBinding(p,request);const agent=privateKeyToAccount(payload.agentPrivateKey).address.toLowerCase();const expected=canonicalAuthorize(p,agent);if(payload.message!==expected||!await validFreshSignature({master:p.master,message:payload.message,signature:payload.signature,issuedAt:p.issuedAt}))throw Error('Master wallet authorization signature is invalid or expired');
    this.consumeNonce(p.master,p.nonce);const api=this.apiFor(p.master,payload.agentPrivateKey,p.testnet,{maxExposure:p.capital,perAsset:p.capital});await api.verifyAgent();const [source,followerPortfolio,followerState]=await Promise.all([api.sourceState(p.target,p.sourceTestnet),api.portfolio(),api.accountState()]);const sourceEquity=accountEquity(source);if(!(sourceEquity>0))throw Error('Source trader has no measurable equity');
    const baseline=periodPnl(followerPortfolio,'day'),baselineEquity=accountEquity(followerState);this.db.users[p.master]={master:p.master,agent:{address:agent,secret:await encryptSecret(this.env.RWA_KEY_ENCRYPTION_SECRET,payload.agentPrivateKey)},copy:{target:p.target,capital:p.capital,maxLoss:p.maxLoss,testnet:p.testnet,sourceTestnet:p.sourceTestnet,sourceEquity,scale:Math.min(1,p.capital/sourceEquity),baselinePnl:baseline,lastPnl:baseline,baselineEquity,lastEquity:baselineEquity,lastTime:now(),processed:[],enabled:true,startedAt:now()},ledger:{positions:{},prices:{}},last_agent_verify:now()};this.event('copy.registered',{master:p.master,agent,target:p.target,testnet:p.testnet,sourceTestnet:p.sourceTestnet,capital:p.capital,maxLoss:p.maxLoss});await this.save();return{ok:true,master:p.master,agent,target:p.target,testnet:p.testnet,sourceTestnet:p.sourceTestnet,scale:this.db.users[p.master].copy.scale};
  }
  async stop(payload,request){const master=String(payload.master||'').toLowerCase(),rec=this.db.users[master];if(!rec)throw Error('24/7 copy record not found');const p={...payload,master,worker:String(payload.worker||'').replace(/\/$/,'')};this.requireWorkerBinding(p,request);const expected=canonicalStop(p);if(payload.message!==expected||!await validFreshSignature({master,message:payload.message,signature:payload.signature,issuedAt:payload.issuedAt}))throw Error('Stop signature is invalid or expired');this.consumeNonce(master,payload.nonce);rec.copy.enabled=false;rec.copy.stoppedAt=now();delete rec.agent.secret;this.event('copy.stopped',{master});await this.save();return{ok:true}}
  disable(rec,type,details={}){if(rec?.copy)rec.copy.enabled=false;if(rec?.agent)delete rec.agent.secret;this.event(type,{master:rec?.master,...details})}
  async processUser(rec){
    const c=rec?.copy;if(!c?.enabled)return;if(!c.testnet&&!this.mainnetAllowed()){this.disable(rec,'copy.blocked',{reason:'mainnet-lock'});return}if(!rec.agent?.secret){this.disable(rec,'copy.blocked',{reason:'agent-secret-missing'});return}
    const pk=await decryptSecret(this.env.RWA_KEY_ENCRYPTION_SECRET,rec.agent.secret),api=this.apiFor(rec.master,pk,c.testnet,{maxExposure:c.capital,perAsset:c.capital});if(!rec.last_agent_verify||now()-rec.last_agent_verify>60_000){try{await api.verifyAgent();rec.last_agent_verify=now()}catch(e){this.disable(rec,'copy.blocked',{reason:'agent-not-authorized'});throw e}}
    const [portfolio,followerState]=await Promise.all([api.portfolio(),api.accountState()]),currentPnl=periodPnl(portfolio,'day'),currentEquity=accountEquity(followerState);c.lastPnl=currentPnl;c.lastEquity=currentEquity;const loss=sessionLoss({baselineEquity:c.baselineEquity,currentEquity,baselinePnl:c.baselinePnl,currentPnl});if(loss>=n(c.maxLoss)){this.disable(rec,'copy.max_loss',{loss});return}
    const start=Math.max(n(c.startedAt,now()-6*3600000),n(c.lastTime,now())-60_000,now()-6*3600000),fills=await api.fillsByTime(c.target,start,now(),!!c.sourceTestnet),fresh=(fills||[]).filter(f=>!isProcessed(c,sourceFillId(c.target,f))).sort((a,b)=>n(a.time)-n(b.time));if(!fresh.length)return;const mids=await api.info('allMids'),ledger=rec.ledger||(rec.ledger={positions:{},prices:{}});ledger.positions||={};ledger.prices||={};
    for(const f of fresh.slice(0,20)){const id=sourceFillId(c.target,f);if(isProcessed(c,id))continue;c.lastTime=Math.max(n(c.lastTime),n(f.time));const coin=String(f.coin||'').toUpperCase(),signed=n(ledger.positions[coin]),used=copiedUsed(rec,mids),plan=planCopyFill({fill:f,scale:c.scale,capital:c.capital,used,signed});if(plan.kind!=='execute'){markProcessed(c,id);this.event(plan.kind==='block'?'copy.blocked':'copy.skipped',{master:rec.master,coin:plan.coin,side:plan.side,sourceFill:id,reason:plan.reason});continue}const cloid=cloidFor(rec.master,c.target,f);try{const out=await api.market({coin:plan.coin,side:plan.side,size:plan.size,reduceOnly:plan.reduceOnly,leverage:1,copyRemaining:plan.reduceOnly?null:Math.max(0,n(c.capital)-used),cloid});ledger.positions[plan.coin]=applyLedgerPosition(signed,plan.side,plan.size,plan.reduceOnly);ledger.prices[plan.coin]=plan.px;rec.ledger=ledger;markProcessed(c,id);this.event(out.replay?'copy.replay_confirmed':'copy.executed',{master:rec.master,target:c.target,coin:plan.coin,side:plan.side,size:plan.size,sourcePx:plan.px,reduceOnly:plan.reduceOnly,sourceFill:id,cloid})}catch(e){if(e?.code==='CLOID_TERMINAL'||String(e?.message||e).startsWith('CLOID_TERMINAL:')){markProcessed(c,id);this.event('copy.blocked',{master:rec.master,coin:plan.coin,side:plan.side,sourceFill:id,cloid,reason:String(e?.message||e)});continue}this.event('copy.retry_pending',{master:rec.master,coin:plan.coin,side:plan.side,sourceFill:id,cloid,reason:String(e?.message||e)});throw e}}
  }
  async tick(){await this.loadControl();if(!this.control.enabled||this.control.kill_switch)return;const active=Object.values(this.db.users||{}).filter(x=>x.copy?.enabled);if(!active.length)return;const batch=[];for(let i=0;i<Math.min(MAX_USERS_PER_TICK,active.length);i++)batch.push(active[(this.cursor+i)%active.length]);this.cursor=(this.cursor+batch.length)%active.length;for(const rec of batch){try{await this.processUser(rec)}catch(e){this.event('worker.error',{master:rec.master,error:String(e?.message||e)});await this.setLastError(e)}}await this.save()}
  async alarm(){try{await this.tick()}finally{await this.ctx.storage.setAlarm(now()+LOOP_MS)}}
  async fetch(request){
    const headers=this.originHeaders(request);if(request.method==='OPTIONS'){if(!this.originAllowed(request))return json({error:'origin not allowed'},403,headers);return new Response(null,{status:204,headers})}
    const u=new URL(request.url);try{await this.loadControl();if(request.method==='GET'&&u.pathname==='/healthz')return json(this.health(),200,headers);if(request.method==='GET'&&u.pathname==='/readyz'){const r=this.ready();return json(r,r.ok?200:503,headers)}if(request.method==='GET'&&u.pathname==='/status')return json(this.redacted(),200,headers);if(request.method==='GET'&&u.pathname==='/metrics')return json(this.metrics(),200,headers);if(request.method==='POST'){if(!this.originAllowed(request))return json({error:'origin not allowed'},403,headers);const payload=await request.json();if(u.pathname==='/v1/register')return json(await this.register(payload,request),200,headers);if(u.pathname==='/v1/stop')return json(await this.stop(payload,request),200,headers)}return json({error:'not found'},404,headers)}catch(e){await this.setLastError(e);return json({error:String(e?.message||e)},400,headers)}
  }
}

function stub(env){return env.RWA_STATE.get(env.RWA_STATE.idFromName('global'))}
export default{
  fetch(request,env){return stub(env).fetch(request)},
  async scheduled(_event,env){await stub(env).fetch('https://internal.rwa/healthz')}
};
