import http from 'node:http';
import {URL} from 'node:url';
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {BusinessStore,sha256} from './store.mjs';
import {CommerceReader} from './commerce-reader.mjs';
import {reconcileBusiness,validateBusiness,distributionPreview} from './validation.mjs';

const env=process.env,PORT=Number(env.PORT||env.RWA_BUSINESS_PORT||8790),HOST=env.RWA_BUSINESS_HOST||'0.0.0.0';
const allowedOrigins=new Set(String(env.RWA_BUSINESS_ALLOWED_ORIGINS||'https://copytolive.github.io,https://seablueprint.com').split(',').map(x=>x.trim()).filter(Boolean));
const adminHash=String(env.RWA_BUSINESS_ADMIN_TOKEN_SHA256||'').trim().toLowerCase();
const terminalSecrets=(()=>{try{return JSON.parse(env.RWA_BUSINESS_TERMINAL_SECRETS||'{}')}catch{return{}}})();
const store=new BusinessStore(),reader=new CommerceReader();
const now=()=>Date.now();
const safeEqual=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&timingSafeEqual(x,y)};
const json=(res,status,data,extra={})=>{const s=JSON.stringify(data);res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(s),'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',...extra});res.end(s)};
const cors=req=>{const origin=String(req.headers.origin||'');if(!origin)return{};if(!allowedOrigins.has(origin))throw Object.assign(Error('origin_not_allowed'),{status:403});return{'access-control-allow-origin':origin,'vary':'Origin','access-control-allow-headers':'authorization,content-type,x-rwa-terminal-id,x-rwa-timestamp,x-rwa-signature','access-control-allow-methods':'GET,POST,PUT,OPTIONS','access-control-max-age':'600'}};
const body=async req=>{let n=0,chunks=[];for await(const c of req){n+=c.length;if(n>1_048_576)throw Object.assign(Error('request_too_large'),{status:413});chunks.push(c)}if(!n)return{};try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw Object.assign(Error('invalid_json'),{status:400})}};
const requireAdmin=req=>{if(!adminHash)throw Object.assign(Error('admin_not_configured'),{status:503});const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');if(!token||sha256(token)!==adminHash)throw Object.assign(Error('unauthorized'),{status:401});return`admin:${sha256(token).slice(0,12)}`};
const verifyTerminal=(req,raw)=>{const terminal=String(req.headers['x-rwa-terminal-id']||''),ts=Number(req.headers['x-rwa-timestamp']||0),sig=String(req.headers['x-rwa-signature']||''),secret=String(terminalSecrets[terminal]||'');if(!terminal||!secret||!Number.isFinite(ts)||Math.abs(now()-ts)>300000)throw Object.assign(Error('terminal_auth_failed'),{status:401});const expected=createHmac('sha256',secret).update(`${ts}.${JSON.stringify(raw)}`).digest('hex');if(!safeEqual(expected,sig))throw Object.assign(Error('terminal_signature_invalid'),{status:401});return`terminal:${terminal}`};
const match=(p,r)=>p.match(r);
const fail=(res,e)=>json(res,Number(e?.status||500),{ok:false,error:String(e?.message||e)});

async function route(req,res){
  const u=new URL(req.url,`http://${req.headers.host||'localhost'}`),path=u.pathname,method=req.method||'GET',ch=cors(req),out=(s,d)=>json(res,s,d,ch);
  if(method==='OPTIONS')return out(204,{});
  if(method==='GET'&&path==='/healthz')return out(200,{ok:true,service:'rwa-business',ts:now()});
  if(method==='GET'&&path==='/readyz'){const businesses=store.businesses(),commerce=reader.available(),admin=!!adminHash,terminals=Object.keys(terminalSecrets).length;const productionReady=commerce&&admin&&businesses.some(b=>b.status==='ACTIVE'&&b.kyb_verified);return out(200,{ok:true,service_ready:true,production_ready:productionReady,commerce_source_available:commerce,admin_configured:admin,terminal_count:terminals,business_count:businesses.length,transaction_validated:businesses.filter(b=>b.validation?.state==='TRANSACTION_VALIDATED').length,blockers:[...(commerce?[]:['commerce_source_unavailable']),...(admin?[]:['admin_not_configured']),...(businesses.some(b=>b.status==='ACTIVE'&&b.kyb_verified)?[]:['no_active_kyb_business'])]})}
  if(method==='GET'&&path==='/metrics'){const bs=store.businesses(),validated=bs.filter(b=>b.validation?.state==='TRANSACTION_VALIDATED').length,suspended=bs.filter(b=>b.validation?.state==='VALIDATION_SUSPENDED').length;const text=[`rwa_business_total ${bs.length}`,`rwa_business_transaction_validated ${validated}`,`rwa_business_validation_suspended ${suspended}`,`rwa_business_commerce_source_available ${reader.available()?1:0}`].join('\n')+'\n';res.writeHead(200,{'content-type':'text/plain; version=0.0.4','cache-control':'no-store',...ch});return res.end(text)}
  if(method==='GET'&&path==='/v1/businesses')return out(200,{ok:true,data:store.businesses()});
  let m=match(path,/^\/v1\/businesses\/([^/]+)$/);if(method==='GET'&&m){const b=store.business(decodeURIComponent(m[1]));if(!b)return out(404,{ok:false,error:'business_not_found'});return out(200,{ok:true,data:b})}
  m=match(path,/^\/v1\/businesses\/([^/]+)\/revenue$/);if(method==='GET'&&m){const id=decodeURIComponent(m[1]);return out(200,{ok:true,data:{summary:store.ledgerSummary(id),settlements:store.settlements(id,Number(u.searchParams.get('limit')||100)),reconciliation:store.latestReconciliation(id),validation:store.latestValidation(id)}})}
  if(method==='POST'&&path==='/v1/admin/businesses'){const actor=requireAdmin(req),b=await body(req);return out(201,{ok:true,data:store.upsertBusiness(b,{actor})})}
  m=match(path,/^\/v1\/admin\/businesses\/([^/]+)\/status$/);if(method==='PUT'&&m){const actor=requireAdmin(req),b=await body(req);return out(200,{ok:true,data:store.setBusinessStatus(decodeURIComponent(m[1]),b.status,{actor})})}
  m=match(path,/^\/v1\/admin\/businesses\/([^/]+)\/wallets$/);if(method==='POST'&&m){const actor=requireAdmin(req),b=await body(req);return out(200,{ok:true,data:store.bindWallet(decodeURIComponent(m[1]),b.wallet,{role:b.role,identityVerified:!!b.identity_verified,actor})})}
  m=match(path,/^\/v1\/admin\/businesses\/([^/]+)\/wallets\/verify$/);if(method==='POST'&&m){const actor=requireAdmin(req),b=await body(req);return out(200,{ok:true,data:store.verifyWallet(decodeURIComponent(m[1]),b.wallet,{actor})})}
  m=match(path,/^\/v1\/admin\/businesses\/([^/]+)\/stores$/);if(method==='POST'&&m){const actor=requireAdmin(req),b=await body(req);return out(200,{ok:true,data:store.bindStore(decodeURIComponent(m[1]),b.store_token,{locationId:b.location_id,terminalPolicy:b.terminal_policy,actor})})}
  m=match(path,/^\/v1\/admin\/businesses\/([^/]+)\/policy$/);if(method==='PUT'&&m){const actor=requireAdmin(req),b=await body(req);return out(200,{ok:true,data:store.setPolicy(decodeURIComponent(m[1]),b,{actor})})}
  m=match(path,/^\/v1\/admin\/businesses\/([^/]+)\/reconcile$/);if(method==='POST'&&m){const actor=requireAdmin(req),id=decodeURIComponent(m[1]),rec=reconcileBusiness(store,reader,id,{actor}),val=validateBusiness(store,id,{actor});return out(200,{ok:true,data:{reconciliation:rec,validation:val}})}
  m=match(path,/^\/v1\/admin\/businesses\/([^/]+)\/validate$/);if(method==='POST'&&m){const actor=requireAdmin(req);return out(200,{ok:true,data:validateBusiness(store,decodeURIComponent(m[1]),{actor})})}
  m=match(path,/^\/v1\/admin\/businesses\/([^/]+)\/distribution-preview$/);if(method==='POST'&&m){requireAdmin(req);const b=await body(req);return out(200,{ok:true,data:distributionPreview(store,decodeURIComponent(m[1]),b)})}
  if(method==='POST'&&path==='/v1/transactions/ingest'){const b=await body(req),actor=verifyTerminal(req,b);b.terminalId=String(req.headers['x-rwa-terminal-id']);return out(201,{ok:true,data:store.ingestExternal(b,{actor})})}
  m=match(path,/^\/v1\/admin\/transactions\/([^/]+)\/settle$/);if(method==='POST'&&m){const actor=requireAdmin(req),b=await body(req);return out(200,{ok:true,data:store.settleExternal(decodeURIComponent(m[1]),{settlementReference:b.settlement_reference,evidenceUrl:b.evidence_url,actor})})}
  if(method==='GET'&&path==='/v1/admin/audit'){requireAdmin(req);return out(200,{ok:true,data:store.auditRecent(Number(u.searchParams.get('limit')||100))})}
  return out(404,{ok:false,error:'not_found'});
}

const server=http.createServer((req,res)=>route(req,res).catch(e=>fail(res,e)));
server.listen(PORT,HOST,()=>console.log(`[rwa-business] http://${HOST}:${PORT}`));
const sweep=setInterval(()=>{try{for(const b of store.businesses()){if(b.status==='ACTIVE'){try{if(reader.available())reconcileBusiness(store,reader,b.id,{actor:'system:monitor'});validateBusiness(store,b.id,{actor:'system:monitor'})}catch(e){store.audit('system:monitor','monitor.error','business',b.id,{error:e.message})}}}}catch(e){console.error('[rwa-business monitor]',e)}},Number(env.RWA_BUSINESS_RECONCILE_MS||300000));
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{clearInterval(sweep);reader.close();store.close();server.close(()=>process.exit(0))});
