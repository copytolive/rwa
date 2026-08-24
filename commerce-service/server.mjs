import http from 'node:http';
import {URL} from 'node:url';
import {CommerceDB} from './db.mjs';
import {AuthService,normWallet} from './auth.mjs';
import {RegistryService} from './registry.mjs';
import {MidtransPayment} from './payment.mjs';
import {CommerceStore} from './commerce-store.mjs';
import {CommerceError,buildAuthoritativeQuote,mapMidtransNotification,midtransExpectedGrossAmountCents,pricingConfig,requireIdempotencyKey,transitionForPaymentEvent,jsonHash} from './commerce-core.mjs';

const env=process.env,PORT=Number(env.PORT||env.RWA_COMMERCE_PORT||8788),HOST=env.RWA_COMMERCE_HOST||'0.0.0.0';
const publicOrigin=env.RWA_COMMERCE_PUBLIC_ORIGIN||'https://narzulalistiqlal.github.io';
const allowedOrigins=new Set(String(env.RWA_COMMERCE_ALLOWED_ORIGINS||publicOrigin).split(',').map(x=>x.trim()).filter(Boolean));
const db=new CommerceDB(),store=new CommerceStore(db),auth=new AuthService(db,{origin:publicOrigin}),registry=new RegistryService(db),payment=new MidtransPayment(),priceConfig=pricingConfig(env);
try{registry.sync({actor:'startup'})}catch(e){console.warn('[commerce] registry sync locked:',e.message)}

const json=(res,status,data,extra={})=>{const body=JSON.stringify(data);res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body),'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',...extra});res.end(body)};
const errorStatus=e=>{if(Number(e?.statusCode)||Number(e?.status))return Number(e?.statusCode)||Number(e?.status);const m=String(e?.message||'');if(m==='order_not_found'||m==='product_not_found'||m==='quote_not_found'||m==='refund_not_found')return 404;if(m==='quote_expired')return 410;if(m==='quote_consumed'||m.startsWith('insufficient_stock')||m.startsWith('invalid_transition')||m==='inventory_below_reserved')return 409;if(m.startsWith('registry_'))return 409;return 500};
const sendError=(res,e)=>{const status=errorStatus(e),code=e?.code||e?.message||'internal_error';if(status>=500)console.error('[commerce]',e);json(res,status,{ok:false,error:String(code),detail:e?.detail||undefined})};
const body=async req=>{let n=0,chunks=[];for await(const c of req){n+=c.length;if(n>1_048_576)throw new CommerceError('request_too_large',413);chunks.push(c)}if(!n)return{};try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw new CommerceError('invalid_json',400)}};
const cors=req=>{const origin=String(req.headers.origin||'');if(!origin)return{};if(!allowedOrigins.has(origin))throw new CommerceError('origin_not_allowed',403);return{'access-control-allow-origin':origin,'vary':'Origin','access-control-allow-headers':'authorization,content-type,idempotency-key','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS','access-control-max-age':'600'}};
const match=(path,re)=>path.match(re);
const idemRead=(scope,key,request)=>{const r=db.idemGet(scope,key);if(!r)return null;if(String(r.request_hash)!==jsonHash(request||{}))throw new CommerceError('idempotency_key_reused',409);try{return{status:Number(r.status_code),body:JSON.parse(r.response_json)}}catch{return null}};
const idemWrite=(scope,key,request,status,response)=>db.idemPut(scope,key,jsonHash(request||{}),status,response);
const ensureOwner=(order,wallet)=>{if(!order)throw new CommerceError('order_not_found',404);if(String(order.wallet).toLowerCase()!==String(wallet).toLowerCase())throw new CommerceError('forbidden',403);return order};

async function route(req,res){
  const u=new URL(req.url,`http://${req.headers.host||'localhost'}`),path=u.pathname,method=req.method||'GET',corsHeaders=cors(req);
  if(method==='OPTIONS')return json(res,204,{},corsHeaders);
  const out=(status,data)=>json(res,status,data,corsHeaders);
  if(method==='GET'&&path==='/healthz')return out(200,{ok:true,service:'rwa-commerce',ts:Date.now()});
  if(method==='GET'&&path==='/readyz'){
    db.cleanup();const liveStores=db.stores().length,configured=payment.isConfigured();return out(200,{ok:true,service_ready:true,checkout_ready:liveStores>0&&configured,live_verified_stores:liveStores,payment_configured:configured,payment_currency:'IDR',blockers:[...(liveStores?[]:['no_verified_store']),...(configured?[]:['payment_not_configured'])]});
  }
  if(method==='GET'&&path==='/v1/config')return out(200,{ok:true,policy:'ONE_TOKEN_ONE_PHYSICAL_STORE_V1',payment:payment.config(),checkout_ready:db.stores().length>0&&payment.isConfigured(),single_store_checkout:true});
  if(method==='POST'&&path==='/v1/auth/challenge'){const b=await body(req);return out(200,{ok:true,data:auth.challenge(b.wallet)})}
  if(method==='POST'&&path==='/v1/auth/verify'){const b=await body(req);return out(200,{ok:true,data:await auth.verify(b)})}
  if(method==='POST'&&path==='/v1/auth/logout'){return out(200,{ok:true,data:auth.logout(req)})}
  if(method==='GET'&&path==='/v1/stores')return out(200,{ok:true,data:db.stores().map(s=>({...s,asset_verified:!!s.asset_verified,store_verified:!!s.store_verified,trade_enabled:!!s.trade_enabled}))});
  if(method==='GET'&&path==='/v1/products')return out(200,{ok:true,data:db.products(u.searchParams.get('store')||null)});
  let m=match(path,/^\/v1\/products\/([^/]+)$/);if(method==='GET'&&m){const p=db.product(decodeURIComponent(m[1]));if(!p||p.store_status!=='VERIFIED'||!p.store_verified||!p.asset_verified)return out(404,{ok:false,error:'product_not_found'});return out(200,{ok:true,data:p})}
  if(method==='POST'&&path==='/v1/quote'){
    const s=auth.requireSession(req),b=await body(req),q=buildAuthoritativeQuote(db,{wallet:s.wallet,items:b.items,fulfillment:b.fulfillment,destination:b.destination||{}},priceConfig);q.id=`quo_${jsonHash({h:q.quoteHash,t:Date.now(),w:s.wallet}).slice(0,32)}`;db.quotePut({id:q.id,wallet:s.wallet,currency:q.currency,subtotalCents:q.subtotalCents,taxCents:q.taxCents,shippingCents:q.shippingCents,totalCents:q.totalCents,fulfillment:q.fulfillment,destination:q.destination,items:q.items,quoteHash:q.quoteHash,expiresAt:q.expiresAt});return out(201,{ok:true,data:q})
  }
  if(method==='POST'&&path==='/v1/orders'){
    const s=auth.requireSession(req),b=await body(req),key=requireIdempotencyKey(req.headers),scope=`order:create:${s.wallet}`,cached=idemRead(scope,key,b);if(cached)return out(cached.status,cached.body);
    const q=db.quote(String(b.quote_id||''));if(!q)throw new CommerceError('quote_not_found',404);if(String(q.wallet||'').toLowerCase()!==s.wallet)throw new CommerceError('forbidden',403);
    const paymentMode=String(b.payment_mode||'MIDTRANS').toUpperCase();if(paymentMode!=='MIDTRANS')throw new CommerceError('payment_mode_not_supported',409,{payment_mode:paymentMode});if(!payment.isConfigured())throw new CommerceError('payment_not_configured',503);midtransExpectedGrossAmountCents(q);
    const order=db.createOrder({quote:q,wallet:s.wallet,contact:b.contact||{},notes:b.notes||'',paymentMode,paymentReference:''});const response={ok:true,data:order};idemWrite(scope,key,b,201,response);return out(201,response)
  }
  if(method==='GET'&&path==='/v1/orders'){const s=auth.requireSession(req);return out(200,{ok:true,data:db.ordersByWallet(s.wallet)})}
  m=match(path,/^\/v1\/orders\/([^/]+)$/);if(method==='GET'&&m){const s=auth.requireSession(req),o=ensureOwner(db.order(decodeURIComponent(m[1])),s.wallet);return out(200,{ok:true,data:o})}
  m=match(path,/^\/v1\/orders\/([^/]+)\/cancel$/);if(method==='POST'&&m){const s=auth.requireSession(req),id=decodeURIComponent(m[1]),o=ensureOwner(db.order(id),s.wallet);if(o.status!=='AWAITING_PAYMENT')throw new CommerceError('cancel_not_allowed',409,{status:o.status});if(String(o.payment_reference||''))throw new CommerceError('provider_payment_active',409);return out(200,{ok:true,data:db.transitionOrder(id,'CANCELLED',{actor:s.wallet})})}
  m=match(path,/^\/v1\/orders\/([^/]+)\/payment$/);if(method==='POST'&&m){
    const s=auth.requireSession(req),id=decodeURIComponent(m[1]),o=ensureOwner(db.order(id),s.wallet);if(o.status!=='AWAITING_PAYMENT')throw new CommerceError('payment_not_allowed',409,{status:o.status});const key=requireIdempotencyKey(req.headers),scope=`payment:create:${id}`,idemRequest={order_id:id},cached=idemRead(scope,key,idemRequest);if(cached)return out(cached.status,cached.body);
    if(String(o.payment_reference||''))throw new CommerceError('payment_already_created',409);const p=await payment.createForOrder(o);store.setPaymentReference(id,p.token||p.order_id,s.wallet);const response={ok:true,data:p};idemWrite(scope,key,idemRequest,201,response);return out(201,response)
  }
  m=match(path,/^\/v1\/orders\/([^/]+)\/payment-status$/);if(method==='GET'&&m){const s=auth.requireSession(req),id=decodeURIComponent(m[1]),o=ensureOwner(db.order(id),s.wallet);return out(200,{ok:true,data:await payment.status(o.id)})}
  m=match(path,/^\/v1\/orders\/([^/]+)\/refund-request$/);if(method==='POST'&&m){const s=auth.requireSession(req),id=decodeURIComponent(m[1]),o=ensureOwner(db.order(id),s.wallet),b=await body(req);return out(201,{ok:true,data:store.requestRefund(o,s.wallet,b.reason,b.amount_cents??null)})}
  if(method==='POST'&&path==='/v1/webhooks/midtrans'){
    const b=await body(req);if(!payment.verifyNotification(b))throw new CommerceError('invalid_payment_signature',403);const id=String(b.order_id||''),o=db.order(id);if(!o)return out(200,{ok:true,received:true,ignored:'unknown_order'});payment.assertAmountMatches(o,b);
    const key=jsonHash({transaction_id:b.transaction_id||'',transaction_status:b.transaction_status||'',signature_key:b.signature_key||''}),scope='webhook:midtrans',cached=idemRead(scope,key,b);if(cached)return out(200,cached.body);
    const mapped=mapMidtransNotification(b),next=transitionForPaymentEvent(o.status,mapped);if(next)db.transitionOrder(id,next,{actor:'midtrans',paymentReference:String(b.transaction_id||b.order_id||'')});
    const response={ok:true,received:true,order_id:id,event:mapped,transition:next||'NOOP'};idemWrite(scope,key,b,200,response);return out(200,response)
  }
  if(method==='POST'&&path==='/v1/admin/registry/sync'){const a=auth.requireAdmin(req);return out(200,{ok:true,data:registry.sync({actor:a.actor})})}
  if(method==='POST'&&path==='/v1/admin/products'){const a=auth.requireAdmin(req),b=await body(req);const s=db.store(b.storeToken);if(!s||s.status!=='VERIFIED'||!s.store_verified||!s.asset_verified)throw new CommerceError('verified_store_required',409);db.upsertProduct(b);db.audit(a.actor,'product.upsert','product',String(b.id),{store_token:b.storeToken});return out(200,{ok:true,data:db.product(b.id)})}
  m=match(path,/^\/v1\/admin\/inventory\/([^/]+)$/);if(method==='PUT'&&m){const a=auth.requireAdmin(req),b=await body(req),id=decodeURIComponent(m[1]),p=db.inventorySet(id,b.on_hand);db.audit(a.actor,'inventory.set','product',id,{on_hand:b.on_hand});return out(200,{ok:true,data:p})}
  m=match(path,/^\/v1\/admin\/stores\/([^/]+)\/owners$/);if(method==='POST'&&m){const a=auth.requireAdmin(req),b=await body(req);normWallet(b.wallet);return out(200,{ok:true,data:store.setOwner(decodeURIComponent(m[1]),b.wallet,{role:b.role,actor:a.actor})})}
  if(method==='GET'&&path==='/v1/admin/audit'){auth.requireAdmin(req);return out(200,{ok:true,data:db.auditRecent(Number(u.searchParams.get('limit')||100))})}
  if(method==='GET'&&path==='/v1/admin/refunds'){auth.requireAdmin(req);return out(200,{ok:true,data:store.refunds(u.searchParams.get('status')||'')})}
  m=match(path,/^\/v1\/admin\/refunds\/([^/]+)\/process$/);if(method==='POST'&&m){
    const a=auth.requireAdmin(req),rid=decodeURIComponent(m[1]),r=store.refund(rid);if(!r)throw new CommerceError('refund_not_found',404);const o=db.order(r.order_id);if(r.status==='SUCCEEDED')return out(200,{ok:true,data:r,order:o});if(!['REQUESTED','FAILED','PROCESSING'].includes(r.status))throw new CommerceError('refund_not_processable',409,{status:r.status});
    const key=requireIdempotencyKey(req.headers),scope=`refund:process:${rid}`,idemRequest={refund_id:rid},cached=idemRead(scope,key,idemRequest);if(cached)return out(cached.status,cached.body);if(r.status!=='PROCESSING')store.updateRefund(rid,'PROCESSING');
    try{const result=await payment.refund(o,{amountCents:r.amount_cents,reason:r.reason,refundKey:`refund-${o.id}`});store.updateRefund(rid,'SUCCEEDED',{providerReference:String(result.refund_key||result.transaction_id||`refund-${o.id}`),detail:result});store.markOrderRefunded(o.id,a.actor);const response={ok:true,data:store.refund(rid),order:db.order(o.id)};idemWrite(scope,key,idemRequest,200,response);return out(200,response)}catch(e){store.updateRefund(rid,'FAILED',{detail:{error:e.message}});throw e}
  }
  if(method==='POST'&&path==='/v1/seller/products'){const s=auth.requireSession(req),b=await body(req);if(!store.canManageStore(b.storeToken,s.wallet))throw new CommerceError('forbidden',403);const st=db.store(b.storeToken);if(!st||st.status!=='VERIFIED'||!st.store_verified||!st.asset_verified)throw new CommerceError('verified_store_required',409);db.upsertProduct(b);db.audit(s.wallet,'seller.product.upsert','product',String(b.id),{store_token:b.storeToken});return out(200,{ok:true,data:db.product(b.id)})}
  m=match(path,/^\/v1\/seller\/inventory\/([^/]+)$/);if(method==='PUT'&&m){const s=auth.requireSession(req),id=decodeURIComponent(m[1]),p=db.product(id);if(!p||!store.canManageStore(p.store_token,s.wallet))throw new CommerceError('forbidden',403);const b=await body(req),updated=db.inventorySet(id,b.on_hand);db.audit(s.wallet,'seller.inventory.set','product',id,{on_hand:b.on_hand});return out(200,{ok:true,data:updated})}
  if(method==='GET'&&path==='/v1/seller/orders'){const s=auth.requireSession(req);return out(200,{ok:true,data:store.sellerOrders(s.wallet)})}
  m=match(path,/^\/v1\/seller\/orders\/([^/]+)\/status$/);if(method==='PUT'&&m){const s=auth.requireSession(req),id=decodeURIComponent(m[1]);if(!store.sellerCanManageOrder(id,s.wallet))throw new CommerceError('forbidden',403);const b=await body(req),next=String(b.status||'').toUpperCase();if(!['FULFILLING','READY_FOR_PICKUP','SHIPPED','COMPLETED'].includes(next))throw new CommerceError('seller_status_not_allowed',400);return out(200,{ok:true,data:db.transitionOrder(id,next,{actor:s.wallet})})}
  return out(404,{ok:false,error:'not_found'});
}

const server=http.createServer((req,res)=>route(req,res).catch(e=>sendError(res,e)));
const expiry=setInterval(()=>{try{for(const id of store.expiredAwaiting(Date.now()-priceConfig.paymentTtlMs)){try{db.transitionOrder(id,'CANCELLED',{actor:'system:uninitiated-payment-expiry'})}catch(e){console.warn('[commerce] expiry',id,e.message)}}}catch(e){console.warn('[commerce] expiry scan',e.message)}},60_000);expiry.unref();
server.listen(PORT,HOST,()=>console.log(`[commerce] listening http://${HOST}:${PORT}`));
const shutdown=()=>server.close(()=>{db.close();process.exit(0)});process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
