import http from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {privateKeyToAccount} from 'viem/accounts';
import {verifyMessage} from 'viem';
import {RWAWorkerExecutionAPI,WORKER_SINGLE_WRITE_PATH} from './execution.mjs';

const ADDRESS=/^0x[a-fA-F0-9]{40}$/;
const PK=/^0x[a-fA-F0-9]{64}$/;
const STATE_PATH=resolve(process.env.RWA_STATE_PATH||'./data/state.json');
const CONTROL_URL=process.env.RWA_CONTROL_URL||'https://narzulalistiqlal.github.io/rwa/agent-worker/control.json';
const PORT=Number(process.env.PORT||8787);
const LOOP_MS=Math.max(1000,Number(process.env.RWA_LOOP_MS||3000));
const ENC_SECRET=String(process.env.RWA_KEY_ENCRYPTION_SECRET||'');
const MAINNET_SECRET=String(process.env.RWA_MAINNET_APPROVED||'');
const DEFAULT_RISK=parseJson(process.env.RWA_RISK_JSON,{dailyLoss:250,maxLeverage:5,maxExposure:5000,perAsset:2000,kill:false});
let db={schema:1,users:{},events:[],updated_at:0};
let control={enabled:false,kill_switch:true,mainnet_enabled:false,production_ready:false};
let controlAt=0,loopBusy=false,lastError='';

function parseJson(v,d){try{return typeof v==='string'&&v.trim()?JSON.parse(v):d}catch{return d}}
function n(v,d=0){return Number.isFinite(Number(v))?Number(v):d}
function key(){if(ENC_SECRET.length<32)throw Error('RWA_KEY_ENCRYPTION_SECRET must be at least 32 characters');return createHash('sha256').update(ENC_SECRET).digest()}
function encrypt(s){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key(),iv),ct=Buffer.concat([c.update(String(s),'utf8'),c.final()]),tag=c.getAuthTag();return{iv:iv.toString('base64'),ct:ct.toString('base64'),tag:tag.toString('base64'),alg:'AES-256-GCM'}}
function decrypt(x){const d=createDecipheriv('aes-256-gcm',key(),Buffer.from(x.iv,'base64'));d.setAuthTag(Buffer.from(x.tag,'base64'));return Buffer.concat([d.update(Buffer.from(x.ct,'base64')),d.final()]).toString('utf8')}
function event(type,details={}){db.events.push({ts:Date.now(),type,...details});db.events=db.events.slice(-500)}
async function loadDb(){try{db=JSON.parse(await readFile(STATE_PATH,'utf8'));db.users||={};db.events||=[]}catch{await saveDb()}}
async function saveDb(){db.updated_at=Date.now();await mkdir(dirname(STATE_PATH),{recursive:true});await writeFile(STATE_PATH,JSON.stringify(db,null,2)+'\n',{mode:0o600})}
async function loadControl(force=false){if(!force&&Date.now()-controlAt<10000)return control;controlAt=Date.now();try{const r=await fetch(CONTROL_URL+'?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(7000)});if(r.ok){const x=await r.json();control={...control,...x}}}catch(e){lastError='control: '+String(e.message||e)}return control}
function mainnetAllowed(){return control.mainnet_enabled===true&&MAINNET_SECRET==='I_UNDERSTAND_MAINNET_RISK'}
function canonicalAuthorize(p,agent){return `RWA 24/7 COPY AUTHORIZE\nMaster: ${p.master}\nAgent: ${agent}\nTarget: ${p.target}\nCapital: ${p.capital}\nMax Loss: ${p.maxLoss}\nEnvironment: ${p.testnet?'testnet':'mainnet'}\nIssued At: ${p.issuedAt}\nNonce: ${p.nonce}`}
function canonicalStop(p){return `RWA 24/7 COPY STOP\nMaster: ${p.master}\nIssued At: ${p.issuedAt}\nNonce: ${p.nonce}`}
async function validFreshSignature({master,message,signature,issuedAt}){if(!ADDRESS.test(master)||!signature||!message)return false;const ts=Date.parse(issuedAt);if(!Number.isFinite(ts)||Math.abs(Date.now()-ts)>10*60*1000)return false;return verifyMessage({address:master,message,signature})}
function periodPnl(portfolio,key='day'){const row=(portfolio||[]).find(x=>Array.isArray(x)&&x[0]===key)?.[1],last=row?.pnlHistory?.at?.(-1);return n(Array.isArray(last)?last[1]:0)}
function copiedUsed(rec,mids){return Object.entries(rec.ledger?.positions||{}).reduce((s,[coin,qty])=>s+Math.abs(n(qty))*n(mids?.[coin]),0)}
function apiFor(master,pk,testnet,risk={}){return new RWAWorkerExecutionAPI({master,agentPrivateKey:pk,testnet,risk:{...DEFAULT_RISK,...risk,kill:!!control.kill_switch}})}

async function register(payload){
  await loadControl(true);
  const p={...payload,master:String(payload.master||'').toLowerCase(),target:String(payload.target||'').toLowerCase(),capital:n(payload.capital),maxLoss:n(payload.maxLoss),testnet:payload.testnet!==false};
  if(!ADDRESS.test(p.master)||!ADDRESS.test(p.target))throw Error('Invalid master or trader wallet');
  if(!(p.capital>0&&p.maxLoss>0&&p.maxLoss<=p.capital))throw Error('Capital/max loss configuration is invalid');
  if(!PK.test(String(payload.agentPrivateKey||'')))throw Error('Delegated agent key is invalid');
  if(!p.testnet&&!mainnetAllowed())throw Error('24/7 mainnet is hard locked');
  const agent=privateKeyToAccount(payload.agentPrivateKey).address.toLowerCase();
  const expected=canonicalAuthorize(p,agent);if(payload.message!==expected||!await validFreshSignature({master:p.master,message:payload.message,signature:payload.signature,issuedAt:p.issuedAt}))throw Error('Master wallet authorization signature is invalid or expired');
  const api=apiFor(p.master,payload.agentPrivateKey,p.testnet,{maxExposure:p.capital,perAsset:p.capital});await api.verifyAgent();
  const [source,followerPortfolio]=await Promise.all([api.info('clearinghouseState',{user:p.target}),api.portfolio()]);const sourceEquity=n(source?.marginSummary?.accountValue);if(!(sourceEquity>0))throw Error('Source trader has no measurable equity');
  const baseline=periodPnl(followerPortfolio,'day');db.users[p.master]={master:p.master,agent:{address:agent,secret:encrypt(payload.agentPrivateKey)},copy:{target:p.target,capital:p.capital,maxLoss:p.maxLoss,testnet:p.testnet,sourceEquity,scale:Math.min(1,p.capital/sourceEquity),baselinePnl:baseline,lastPnl:baseline,lastTime:Date.now(),enabled:true,startedAt:Date.now()},ledger:{positions:{},prices:{}},last_agent_verify:Date.now()};event('copy.registered',{master:p.master,agent,target:p.target,testnet:p.testnet,capital:p.capital,maxLoss:p.maxLoss});await saveDb();return{ok:true,master:p.master,agent,target:p.target,testnet:p.testnet,scale:db.users[p.master].copy.scale};
}

async function stop(payload){const master=String(payload.master||'').toLowerCase(),rec=db.users[master];if(!rec)throw Error('24/7 copy record not found');const expected=canonicalStop({...payload,master});if(payload.message!==expected||!await validFreshSignature({master,message:payload.message,signature:payload.signature,issuedAt:payload.issuedAt}))throw Error('Stop signature is invalid or expired');rec.copy.enabled=false;rec.copy.stoppedAt=Date.now();event('copy.stopped',{master});await saveDb();return{ok:true}}

async function processUser(rec){
  if(!rec?.copy?.enabled)return;const c=rec.copy;if(!c.testnet&&!mainnetAllowed()){c.enabled=false;event('copy.blocked',{master:rec.master,reason:'mainnet-lock'});return}
  const pk=decrypt(rec.agent.secret),api=apiFor(rec.master,pk,c.testnet,{maxExposure:c.capital,perAsset:c.capital});
  if(!rec.last_agent_verify||Date.now()-rec.last_agent_verify>60000){await api.verifyAgent();rec.last_agent_verify=Date.now()}
  const portfolio=await api.portfolio(),currentPnl=periodPnl(portfolio,'day');c.lastPnl=currentPnl;
  if(n(c.baselinePnl)-currentPnl>=n(c.maxLoss)){c.enabled=false;event('copy.max_loss',{master:rec.master,loss:n(c.baselinePnl)-currentPnl});return}
  const start=Math.max(n(c.lastTime,Date.now())+1,Date.now()-6*3600000),fills=await api.fillsByTime(c.target,start,Date.now(),false),fresh=(fills||[]).filter(f=>n(f.time)>n(c.lastTime)).sort((a,b)=>n(a.time)-n(b.time));if(!fresh.length)return;
  const mids=await api.info('allMids'),ledger=rec.ledger||(rec.ledger={positions:{},prices:{}});ledger.positions||={};ledger.prices||={};
  for(const f of fresh){
    const coin=String(f.coin||'').toUpperCase(),side=f.side==='B'?'BUY':'SELL',px=n(f.px),sourceSize=Math.abs(n(f.sz)),dir=String(f.dir||'').toLowerCase(),closing=dir.includes('close')||n(f.closedPnl)!==0,signed=n(ledger.positions[coin]);let size=sourceSize*n(c.scale),reduceOnly=false;
    if(!(px>0&&size>0)){event('copy.skipped',{master:rec.master,coin,reason:'bad-source-fill'});continue}
    if(closing){if(!signed){event('copy.skipped',{master:rec.master,coin,reason:'no-copied-position'});continue}if((signed>0&&side!=='SELL')||(signed<0&&side!=='BUY')){event('copy.skipped',{master:rec.master,coin,reason:'not-reducing'});continue}size=Math.min(size,Math.abs(signed));reduceOnly=true}
    else{const remaining=Math.max(0,n(c.capital)-copiedUsed(rec,mids));if(!(remaining>0)){event('copy.blocked',{master:rec.master,coin,reason:'capital-cap'});continue}size=Math.min(size,remaining/px)}
    if(!(size>0))continue;
    try{await api.market({coin,side,size,reduceOnly,leverage:1,copyRemaining:reduceOnly?null:Math.max(0,n(c.capital)-copiedUsed(rec,mids))});const delta=(side==='BUY'?1:-1)*size,next=signed+delta;ledger.positions[coin]=reduceOnly&&signed!==0&&Math.sign(next)!==Math.sign(signed)?0:next;ledger.prices[coin]=px;event('copy.executed',{master:rec.master,target:c.target,coin,side,size,sourcePx:px,reduceOnly})}catch(e){event('copy.blocked',{master:rec.master,coin,side,reason:String(e.message||e)})}
  }
  c.lastTime=Math.max(n(c.lastTime),...fresh.map(f=>n(f.time)));rec.ledger=ledger;
}

async function tick(){if(loopBusy)return;loopBusy=true;try{await loadControl();if(!control.enabled||control.kill_switch)return;for(const rec of Object.values(db.users)){try{await processUser(rec)}catch(e){event('worker.error',{master:rec.master,error:String(e.message||e)});lastError=String(e.message||e)}}await saveDb()}finally{loopBusy=false}}
function redacted(){return{service:'rwa-agent-worker',version:'1.0.0',single_write_path:WORKER_SINGLE_WRITE_PATH,environment_lock:mainnetAllowed()?'mainnet-allowed':'testnet-only',control,users:Object.values(db.users).map(r=>({master:r.master.slice(0,6)+'…'+r.master.slice(-4),agent:r.agent?.address?.slice(0,6)+'…'+r.agent?.address?.slice(-4),copy:{target:r.copy?.target?.slice(0,6)+'…'+r.copy?.target?.slice(-4),capital:r.copy?.capital,maxLoss:r.copy?.maxLoss,testnet:r.copy?.testnet,enabled:r.copy?.enabled,startedAt:r.copy?.startedAt,lastTime:r.copy?.lastTime,lastPnl:r.copy?.lastPnl}})),updated_at:db.updated_at,last_error:lastError||null}}
async function body(req){let raw='';for await(const c of req){raw+=c;if(raw.length>100000)throw Error('Payload too large')}return raw?JSON.parse(raw):{}}
function send(res,code,data){res.writeHead(code,{'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST,OPTIONS'});res.end(JSON.stringify(data))}

await loadDb();await loadControl(true);
const server=http.createServer(async(req,res)=>{try{if(req.method==='OPTIONS')return send(res,204,{});const u=new URL(req.url,'http://worker');if(req.method==='GET'&&u.pathname==='/healthz')return send(res,200,{ok:true,service:'rwa-agent-worker',version:'1.0.0',control_enabled:!!control.enabled,kill_switch:!!control.kill_switch,mainnet_allowed:mainnetAllowed(),users:Object.values(db.users).filter(x=>x.copy?.enabled).length,updated_at:db.updated_at});if(req.method==='GET'&&u.pathname==='/status')return send(res,200,redacted());if(req.method==='POST'&&u.pathname==='/v1/register')return send(res,200,await register(await body(req)));if(req.method==='POST'&&u.pathname==='/v1/stop')return send(res,200,await stop(await body(req)));return send(res,404,{error:'not found'})}catch(e){send(res,400,{error:String(e.message||e)})}});
server.listen(PORT,'0.0.0.0',()=>console.log(`RWA agent worker listening on :${PORT} · ${control.kill_switch?'KILL SWITCH ON':'ACTIVE'}`));
setInterval(()=>tick().catch(e=>{lastError=String(e.message||e)}),LOOP_MS);tick().catch(e=>{lastError=String(e.message||e)});
