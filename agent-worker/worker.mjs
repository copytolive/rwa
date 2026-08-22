import http from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {privateKeyToAccount} from 'viem/accounts';
import {verifyMessage} from 'viem';
import {RWAWorkerExecutionAPI,WORKER_SINGLE_WRITE_PATH,WORKER_IDEMPOTENCY} from './execution.mjs';
import {sourceFillId,cloidFor,isProcessed,markProcessed,planCopyFill,applyLedgerPosition,sessionLoss} from './copy-engine.mjs';

const ADDRESS=/^0x[a-fA-F0-9]{40}$/;
const PK=/^0x[a-fA-F0-9]{64}$/;
const STATE_PATH=resolve(process.env.RWA_STATE_PATH||'./data/state.json');
const CONTROL_URL=process.env.RWA_CONTROL_URL||'https://narzulalistiqlal.github.io/rwa/agent-worker/control.json';
const PORT=Number(process.env.PORT||8787);
const LOOP_MS=Math.max(1000,Number(process.env.RWA_LOOP_MS||3000));
const ENC_SECRET=String(process.env.RWA_KEY_ENCRYPTION_SECRET||'');
const MAINNET_SECRET=String(process.env.RWA_MAINNET_APPROVED||'');
const PUBLIC_ORIGIN=String(process.env.RWA_PUBLIC_ORIGIN||'').replace(/\/$/,'');
const ALLOWED_ORIGINS=new Set(String(process.env.RWA_ALLOWED_ORIGINS||'https://narzulalistiqlal.github.io').split(',').map(x=>x.trim().replace(/\/$/,'')).filter(Boolean));
const DEFAULT_RISK=parseJson(process.env.RWA_RISK_JSON,{dailyLoss:250,maxLeverage:5,maxExposure:5000,perAsset:2000,kill:false});
const BOOT_AT=Date.now();
let db={schema:2,users:{},events:[],nonces:{},metrics:{since:BOOT_AT,events:{}},updated_at:0};
let control={enabled:false,kill_switch:true,mainnet_enabled:false,production_ready:false};
let controlAt=0,loopBusy=false,lastError='';
const rate=new Map();

function parseJson(v,d){try{return typeof v==='string'&&v.trim()?JSON.parse(v):d}catch{return d}}
function n(v,d=0){return Number.isFinite(Number(v))?Number(v):d}
function key(){if(ENC_SECRET.length<32)throw Error('RWA_KEY_ENCRYPTION_SECRET must be at least 32 characters');return createHash('sha256').update(ENC_SECRET).digest()}
function encrypt(s){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key(),iv),ct=Buffer.concat([c.update(String(s),'utf8'),c.final()]),tag=c.getAuthTag();return{iv:iv.toString('base64'),ct:ct.toString('base64'),tag:tag.toString('base64'),alg:'AES-256-GCM'}}
function decrypt(x){const d=createDecipheriv('aes-256-gcm',key(),Buffer.from(x.iv,'base64'));d.setAuthTag(Buffer.from(x.tag,'base64'));return Buffer.concat([d.update(Buffer.from(x.ct,'base64')),d.final()]).toString('utf8')}
function bump(type){db.metrics=db.metrics||{since:Date.now(),events:{}};db.metrics.events=db.metrics.events||{};db.metrics.events[type]=n(db.metrics.events[type])+1}
function event(type,details={}){bump(type);db.events.push({ts:Date.now(),type,...details});db.events=db.events.slice(-1000)}
async function loadDb(){try{db=JSON.parse(await readFile(STATE_PATH,'utf8'))}catch{}db.schema=2;db.users=db.users||{};db.events=db.events||[];db.nonces=db.nonces||{};db.metrics=db.metrics||{since:Date.now(),events:{}};db.metrics.events=db.metrics.events||{};await saveDb()}
async function saveDb(){db.updated_at=Date.now();await mkdir(dirname(STATE_PATH),{recursive:true});await writeFile(STATE_PATH,JSON.stringify(db,null,2)+'\n',{mode:0o600})}
async function loadControl(force=false){if(!force&&Date.now()-controlAt<10000)return control;controlAt=Date.now();try{const r=await fetch(CONTROL_URL+'?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(7000)});if(r.ok){const x=await r.json();control={...control,...x}}}catch(e){lastError='control: '+String(e.message||e)}return control}
function mainnetAllowed(){return control.mainnet_enabled===true&&MAINNET_SECRET==='I_UNDERSTAND_MAINNET_RISK'}
function requireWorkerBinding(worker){if(!/^https:\/\//i.test(String(worker||'')))throw Error('Worker authorization must be bound to an HTTPS origin');if(process.env.NODE_ENV==='production'&&!/^https:\/\//i.test(PUBLIC_ORIGIN))throw Error('RWA_PUBLIC_ORIGIN is required in production');if(PUBLIC_ORIGIN&&String(worker).replace(/\/$/,'')!==PUBLIC_ORIGIN)throw Error('Authorization is bound to a different worker origin')}
function canonicalAuthorize(p,agent){return `RWA 24/7 COPY AUTHORIZE V2\nMaster: ${p.master}\nAgent: ${agent}\nTarget: ${p.target}\nCapital: ${p.capital}\nMax Loss: ${p.maxLoss}\nFollower Environment: ${p.testnet?'testnet':'mainnet'}\nSource Environment: ${p.sourceTestnet?'testnet':'mainnet'}\nWorker: ${p.worker}\nIssued At: ${p.issuedAt}\nNonce: ${p.nonce}`}
function canonicalStop(p){return `RWA 24/7 COPY STOP V2\nMaster: ${p.master}\nWorker: ${p.worker}\nIssued At: ${p.issuedAt}\nNonce: ${p.nonce}`}
async function validFreshSignature({master,message,signature,issuedAt}){if(!ADDRESS.test(master)||!signature||!message)return false;const ts=Date.parse(issuedAt);if(!Number.isFinite(ts)||Math.abs(Date.now()-ts)>10*60*1000)return false;return verifyMessage({address:master,message,signature})}
function consumeNonce(master,nonce){const x=String(nonce||'');if(x.length<8||x.length>160)throw Error('Authorization nonce is invalid');const list=Array.isArray(db.nonces[master])?db.nonces[master]:[];if(list.includes(x))throw Error('Authorization nonce was already used');list.push(x);db.nonces[master]=list.slice(-500)}
function periodPnl(portfolio,key='day'){const row=(portfolio||[]).find(x=>Array.isArray(x)&&x[0]===key)?.[1],last=row?.pnlHistory?.at?.(-1);return n(Array.isArray(last)?last[1]:0)}
function accountEquity(ch){return n(ch?.marginSummary?.accountValue)}
function copiedUsed(rec,mids){return Object.entries(rec.ledger?.positions||{}).reduce((s,[coin,qty])=>s+Math.abs(n(qty))*n(mids?.[coin]),0)}
function apiFor(master,pk,testnet,risk={}){return new RWAWorkerExecutionAPI({master,agentPrivateKey:pk,testnet,risk:{...DEFAULT_RISK,...risk,kill:!!control.kill_switch}})}
function disableRecord(rec,type,details={}){if(rec?.copy)rec.copy.enabled=false;if(rec?.agent)delete rec.agent.secret;event(type,{master:rec?.master,...details})}

async function register(payload){
  await loadControl(true);
  const p={...payload,master:String(payload.master||'').toLowerCase(),target:String(payload.target||'').toLowerCase(),capital:n(payload.capital),maxLoss:n(payload.maxLoss),testnet:payload.testnet!==false,sourceTestnet:payload.sourceTestnet===true,worker:String(payload.worker||'').replace(/\/$/,'')};
  if(!ADDRESS.test(p.master)||!ADDRESS.test(p.target))throw Error('Invalid master or trader wallet');
  if(p.master===p.target)throw Error('Cannot copy the same wallet');
  if(!(p.capital>0&&p.maxLoss>0&&p.maxLoss<=p.capital))throw Error('Capital/max loss configuration is invalid');
  if(!PK.test(String(payload.agentPrivateKey||'')))throw Error('Delegated agent key is invalid');
  if(!p.testnet&&!mainnetAllowed())throw Error('24/7 mainnet is hard locked');
  requireWorkerBinding(p.worker);
  const agent=privateKeyToAccount(payload.agentPrivateKey).address.toLowerCase();
  const expected=canonicalAuthorize(p,agent);if(payload.message!==expected||!await validFreshSignature({master:p.master,message:payload.message,signature:payload.signature,issuedAt:p.issuedAt}))throw Error('Master wallet authorization signature is invalid or expired');
  consumeNonce(p.master,p.nonce);await saveDb();
  const api=apiFor(p.master,payload.agentPrivateKey,p.testnet,{maxExposure:p.capital,perAsset:p.capital});await api.verifyAgent();
  const [source,followerPortfolio,followerState]=await Promise.all([api.sourceState(p.target,p.sourceTestnet),api.portfolio(),api.accountState()]);const sourceEquity=accountEquity(source);if(!(sourceEquity>0))throw Error('Source trader has no measurable equity');
  const baseline=periodPnl(followerPortfolio,'day'),baselineEquity=accountEquity(followerState);db.users[p.master]={master:p.master,agent:{address:agent,secret:encrypt(payload.agentPrivateKey)},copy:{target:p.target,capital:p.capital,maxLoss:p.maxLoss,testnet:p.testnet,sourceTestnet:p.sourceTestnet,sourceEquity,scale:Math.min(1,p.capital/sourceEquity),baselinePnl:baseline,lastPnl:baseline,baselineEquity,lastEquity:baselineEquity,lastTime:Date.now(),processed:[],enabled:true,startedAt:Date.now()},ledger:{positions:{},prices:{}},last_agent_verify:Date.now()};event('copy.registered',{master:p.master,agent,target:p.target,testnet:p.testnet,sourceTestnet:p.sourceTestnet,capital:p.capital,maxLoss:p.maxLoss});await saveDb();return{ok:true,master:p.master,agent,target:p.target,testnet:p.testnet,sourceTestnet:p.sourceTestnet,scale:db.users[p.master].copy.scale};
}

async function stop(payload){const master=String(payload.master||'').toLowerCase(),rec=db.users[master];if(!rec)throw Error('24/7 copy record not found');const p={...payload,master,worker:String(payload.worker||'').replace(/\/$/,'')};requireWorkerBinding(p.worker);const expected=canonicalStop(p);if(payload.message!==expected||!await validFreshSignature({master,message:payload.message,signature:payload.signature,issuedAt:payload.issuedAt}))throw Error('Stop signature is invalid or expired');consumeNonce(master,payload.nonce);rec.copy.enabled=false;rec.copy.stoppedAt=Date.now();delete rec.agent.secret;event('copy.stopped',{master});await saveDb();return{ok:true}}

async function processUser(rec){
  if(!rec?.copy?.enabled)return;const c=rec.copy;if(!c.testnet&&!mainnetAllowed()){disableRecord(rec,'copy.blocked',{reason:'mainnet-lock'});await saveDb();return}
  if(!rec.agent?.secret){disableRecord(rec,'copy.blocked',{reason:'agent-secret-missing'});await saveDb();return}
  const pk=decrypt(rec.agent.secret),api=apiFor(rec.master,pk,c.testnet,{maxExposure:c.capital,perAsset:c.capital});
  if(!rec.last_agent_verify||Date.now()-rec.last_agent_verify>60000){try{await api.verifyAgent();rec.last_agent_verify=Date.now()}catch(e){disableRecord(rec,'copy.blocked',{reason:'agent-not-authorized'});lastError=String(e.message||e);await saveDb();return}}
  const [portfolio,followerState]=await Promise.all([api.portfolio(),api.accountState()]),currentPnl=periodPnl(portfolio,'day'),currentEquity=accountEquity(followerState);c.lastPnl=currentPnl;c.lastEquity=currentEquity;
  const loss=sessionLoss({baselineEquity:c.baselineEquity,currentEquity,baselinePnl:c.baselinePnl,currentPnl});if(loss>=n(c.maxLoss)){disableRecord(rec,'copy.max_loss',{loss});await saveDb();return}
  const start=Math.max(n(c.startedAt,Date.now()-6*3600000),n(c.lastTime,Date.now())-60000,Date.now()-6*3600000),fills=await api.fillsByTime(c.target,start,Date.now(),!!c.sourceTestnet),fresh=(fills||[]).filter(f=>!isProcessed(c,sourceFillId(c.target,f))).sort((a,b)=>n(a.time)-n(b.time));if(!fresh.length)return;
  const mids=await api.info('allMids'),ledger=rec.ledger||(rec.ledger={positions:{},prices:{}});ledger.positions||={};ledger.prices||={};
  for(const f of fresh){
    const id=sourceFillId(c.target,f);if(isProcessed(c,id))continue;c.lastTime=Math.max(n(c.lastTime),n(f.time));const coin=String(f.coin||'').toUpperCase(),signed=n(ledger.positions[coin]),used=copiedUsed(rec,mids),plan=planCopyFill({fill:f,scale:c.scale,capital:c.capital,used,signed});
    if(plan.kind!=='execute'){markProcessed(c,id);event(plan.kind==='block'?'copy.blocked':'copy.skipped',{master:rec.master,coin:plan.coin,side:plan.side,sourceFill:id,reason:plan.reason});await saveDb();continue}
    const cloid=cloidFor(rec.master,c.target,f);
    try{const out=await api.market({coin:plan.coin,side:plan.side,size:plan.size,reduceOnly:plan.reduceOnly,leverage:1,copyRemaining:plan.reduceOnly?null:Math.max(0,n(c.capital)-used),cloid});ledger.positions[plan.coin]=applyLedgerPosition(signed,plan.side,plan.size,plan.reduceOnly);ledger.prices[plan.coin]=plan.px;rec.ledger=ledger;markProcessed(c,id);event(out.replay?'copy.replay_confirmed':'copy.executed',{master:rec.master,target:c.target,coin:plan.coin,side:plan.side,size:plan.size,sourcePx:plan.px,reduceOnly:plan.reduceOnly,sourceFill:id,cloid});await saveDb()}catch(e){if(e?.code==='CLOID_TERMINAL'||String(e.message||e).startsWith('CLOID_TERMINAL:')){markProcessed(c,id);event('copy.blocked',{master:rec.master,coin:plan.coin,side:plan.side,sourceFill:id,cloid,reason:String(e.message||e)});await saveDb();continue}event('copy.retry_pending',{master:rec.master,coin:plan.coin,side:plan.side,sourceFill:id,cloid,reason:String(e.message||e)});lastError=String(e.message||e);await saveDb();break}
  }
}

async function tick(){if(loopBusy)return;loopBusy=true;try{await loadControl();if(!control.enabled||control.kill_switch)return;for(const rec of Object.values(db.users)){try{await processUser(rec)}catch(e){event('worker.error',{master:rec.master,error:String(e.message||e)});lastError=String(e.message||e);await saveDb()}}}finally{loopBusy=false}}
function metrics(){const events=db.metrics?.events||{},active=Object.values(db.users).filter(x=>x.copy?.enabled);return{since:db.metrics?.since||0,active_users:active.length,total_users:Object.keys(db.users).length,executed:n(events['copy.executed']),replay_confirmed:n(events['copy.replay_confirmed']),retry_pending:n(events['copy.retry_pending']),blocked:n(events['copy.blocked']),errors:n(events['worker.error']),max_loss_stops:n(events['copy.max_loss'])}}
function redacted(){return{service:'rwa-agent-worker',version:'2.0.0',single_write_path:WORKER_SINGLE_WRITE_PATH,idempotency:WORKER_IDEMPOTENCY,environment_lock:mainnetAllowed()?'mainnet-allowed':'testnet-only',origin_bound:process.env.NODE_ENV!=='production'||/^https:\/\//i.test(PUBLIC_ORIGIN),control,metrics:metrics(),users:Object.values(db.users).map(r=>({master:r.master.slice(0,6)+'…'+r.master.slice(-4),agent:r.agent?.address?.slice(0,6)+'…'+r.agent?.address?.slice(-4),copy:{target:r.copy?.target?.slice(0,6)+'…'+r.copy?.target?.slice(-4),capital:r.copy?.capital,maxLoss:r.copy?.maxLoss,testnet:r.copy?.testnet,sourceTestnet:r.copy?.sourceTestnet,enabled:r.copy?.enabled,startedAt:r.copy?.startedAt,lastTime:r.copy?.lastTime,lastPnl:r.copy?.lastPnl,lastEquity:r.copy?.lastEquity,processed:r.copy?.processed?.length||0}})),updated_at:db.updated_at,last_error:lastError||null}}
async function body(req){let raw='';for await(const c of req){raw+=c;if(raw.length>65536)throw Error('Payload too large')}return raw?JSON.parse(raw):{}}
function originAllowed(req){const o=String(req.headers.origin||'').replace(/\/$/,'');return !o||ALLOWED_ORIGINS.has(o)}
function rateAllowed(req){const ip=String(req.socket.remoteAddress||'unknown'),now=Date.now(),row=rate.get(ip)||{start:now,count:0};if(now-row.start>60000){row.start=now;row.count=0}row.count++;rate.set(ip,row);return row.count<=30}
function send(req,res,code,data){const h={'content-type':'application/json','cache-control':'no-store','vary':'Origin','x-content-type-options':'nosniff'};const o=String(req.headers.origin||'').replace(/\/$/,'');if(o&&ALLOWED_ORIGINS.has(o))h['access-control-allow-origin']=o;h['access-control-allow-headers']='content-type';h['access-control-allow-methods']='GET,POST,OPTIONS';res.writeHead(code,h);res.end(JSON.stringify(data))}

await loadDb();await loadControl(true);
const server=http.createServer(async(req,res)=>{try{if(req.method==='OPTIONS'){if(!originAllowed(req))return send(req,res,403,{error:'origin not allowed'});return send(req,res,204,{})}const u=new URL(req.url,'http://worker');if(req.method==='GET'&&u.pathname==='/healthz')return send(req,res,200,{ok:true,service:'rwa-agent-worker',version:'2.0.0',single_write_path:WORKER_SINGLE_WRITE_PATH,idempotency:WORKER_IDEMPOTENCY,control_enabled:!!control.enabled,kill_switch:!!control.kill_switch,production_ready:!!control.production_ready,mainnet_allowed:mainnetAllowed(),origin_bound:process.env.NODE_ENV!=='production'||/^https:\/\//i.test(PUBLIC_ORIGIN),users:Object.values(db.users).filter(x=>x.copy?.enabled).length,uptime_ms:Date.now()-BOOT_AT,updated_at:db.updated_at});if(req.method==='GET'&&u.pathname==='/readyz'){const ok=ENC_SECRET.length>=32&&(!process.env.NODE_ENV||process.env.NODE_ENV!=='production'||/^https:\/\//i.test(PUBLIC_ORIGIN))&&control.enabled===true&&control.kill_switch===false&&control.production_ready===true;return send(req,res,ok?200:503,{ok,encrypted_state:ENC_SECRET.length>=32,origin_bound:process.env.NODE_ENV!=='production'||/^https:\/\//i.test(PUBLIC_ORIGIN),control_enabled:!!control.enabled,kill_switch:!!control.kill_switch,production_ready:!!control.production_ready})}if(req.method==='GET'&&u.pathname==='/status')return send(req,res,200,redacted());if(req.method==='POST'){if(!originAllowed(req))return send(req,res,403,{error:'origin not allowed'});if(!rateAllowed(req))return send(req,res,429,{error:'rate limit exceeded'});if(u.pathname==='/v1/register')return send(req,res,200,await register(await body(req)));if(u.pathname==='/v1/stop')return send(req,res,200,await stop(await body(req)))}return send(req,res,404,{error:'not found'})}catch(e){send(req,res,400,{error:String(e.message||e)})}});
server.listen(PORT,'0.0.0.0',()=>console.log(`RWA agent worker v2 listening on :${PORT} · ${control.kill_switch?'KILL SWITCH ON':'ACTIVE'}`));
setInterval(()=>tick().catch(e=>{lastError=String(e.message||e)}),LOOP_MS);tick().catch(e=>{lastError=String(e.message||e)});
