import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {privateKeyToAccount} from 'viem/accounts';

const HERE=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function waitFor(url,proc){
  for(let i=0;i<80;i++){
    if(proc.exitCode!==null)throw Error(`server_exited:${proc.exitCode}`);
    try{const r=await fetch(url);if(r.ok)return}catch{}
    await sleep(50);
  }
  throw Error('server_start_timeout');
}
async function api(base,path,{method='GET',body=null,token='',idem='',headers={}}={}){
  const h={Accept:'application/json',...headers};if(body!==null)h['Content-Type']='application/json';if(token)h.Authorization=`Bearer ${token}`;if(idem)h['Idempotency-Key']=idem;
  const r=await fetch(`${base}${path}`,{method,headers:h,body:body===null?undefined:JSON.stringify(body)});const data=await r.json().catch(()=>({}));return{status:r.status,data};
}

test('HTTP commerce lifecycle: auth, authoritative order idempotency, webhook, seller auth and refunds',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'rwa-http-commerce-')),port=22000+Math.floor(Math.random()*15000),base=`http://127.0.0.1:${port}`;
  const registryPath=join(dir,'registry.json'),assetsPath=join(dir,'assets.json'),dbPath=join(dir,'commerce.sqlite'),admin='admin-test-token';
  const account=privateKeyToAccount('0x1111111111111111111111111111111111111111111111111111111111111111');
  writeFileSync(assetsPath,JSON.stringify({verified:[{token:'STORE1',status:'VERIFIED'}]}));
  writeFileSync(registryPath,JSON.stringify({policy:'ONE_TOKEN_ONE_PHYSICAL_STORE_V1',stores:[{token:'STORE1',status:'VERIFIED',physical_store:{store_name:'Verified Store',full_address:'1 Verified Road',geo:{lat:-6.2,lng:106.8},storefront_photo_url:'https://example.test/store.jpg',business_registration_url:'https://example.test/business',merchant_identity_url:'https://example.test/merchant'}}]}));
  const proc=spawn(process.execPath,['server.mjs'],{cwd:HERE,stdio:['ignore','pipe','pipe'],env:{...process.env,RWA_COMMERCE_PORT:String(port),RWA_COMMERCE_HOST:'127.0.0.1',RWA_COMMERCE_DB:dbPath,RWA_COMMERCE_REGISTRY_PATH:registryPath,RWA_COMMERCE_ASSETS_PATH:assetsPath,RWA_COMMERCE_PUBLIC_ORIGIN:'https://narzulalistiqlal.github.io',RWA_COMMERCE_ADMIN_TOKEN_SHA256:createHash('sha256').update(admin).digest('hex'),MIDTRANS_SERVER_KEY:'server-secret',MIDTRANS_CLIENT_KEY:'client-key',MIDTRANS_IS_PRODUCTION:'false'}});
  // Drain child output so CI cannot block on a full pipe. Node's experimental
  // sqlite warning may legitimately appear on stderr and is not a test failure.
  proc.stdout.resume();proc.stderr.resume();
  try{
    await waitFor(`${base}/healthz`,proc);
    const ready=await api(base,'/readyz');assert.equal(ready.status,200);assert.equal(ready.data.checkout_ready,true);

    const adminHeaders={Authorization:`Bearer ${admin}`};
    const product=await api(base,'/v1/admin/products',{method:'POST',headers:adminHeaders,body:{id:'p1',storeToken:'STORE1',sku:'SKU1',name:'Product 1',priceCents:10000,currency:'IDR',onHand:3,pickup:true,shipping:true}});assert.equal(product.status,200);
    const owner=await api(base,'/v1/admin/stores/STORE1/owners',{method:'POST',headers:adminHeaders,body:{wallet:account.address,role:'OWNER'}});assert.equal(owner.status,200);

    const challenge=await api(base,'/v1/auth/challenge',{method:'POST',body:{wallet:account.address}});assert.equal(challenge.status,200);
    const signature=await account.signMessage({message:challenge.data.data.message});
    const login=await api(base,'/v1/auth/verify',{method:'POST',body:{wallet:account.address,signature}});assert.equal(login.status,200);const session=login.data.data.token;assert.ok(session);

    const quote=await api(base,'/v1/quote',{method:'POST',token:session,body:{items:[{product_id:'p1',qty:1}],fulfillment:'pickup'}});assert.equal(quote.status,201);assert.equal(quote.data.data.totalCents,10000);const quoteId=quote.data.data.id;
    const request={quote_id:quoteId,contact:{name:'Buyer',email:'buyer@example.test'},payment_mode:'MIDTRANS'};
    const first=await api(base,'/v1/orders',{method:'POST',token:session,idem:'order-idem-0001',body:request});assert.equal(first.status,201);const orderId=first.data.data.id;
    const replay=await api(base,'/v1/orders',{method:'POST',token:session,idem:'order-idem-0001',body:request});assert.equal(replay.status,201);assert.equal(replay.data.data.id,orderId);
    const freshKey=await api(base,'/v1/orders',{method:'POST',token:session,idem:'order-idem-0002',body:request});assert.equal(freshKey.status,409);assert.equal(freshKey.data.error,'quote_consumed');

    const gross='100.00',statusCode='200',transactionId='tx-test-1';
    const webhookBody={order_id:orderId,status_code:statusCode,gross_amount:gross,transaction_status:'settlement',transaction_id:transactionId};
    webhookBody.signature_key=createHash('sha512').update(`${orderId}${statusCode}${gross}server-secret`).digest('hex');
    const hook1=await api(base,'/v1/webhooks/midtrans',{method:'POST',body:webhookBody});assert.equal(hook1.status,200);assert.equal(hook1.data.transition,'PAID');
    const hook2=await api(base,'/v1/webhooks/midtrans',{method:'POST',body:webhookBody});assert.equal(hook2.status,200);assert.deepEqual(hook2.data,hook1.data);

    const seller=await api(base,`/v1/seller/orders/${orderId}/status`,{method:'PUT',token:session,body:{status:'FULFILLING'}});assert.equal(seller.status,200);assert.equal(seller.data.data.status,'FULFILLING');
    const outsider=privateKeyToAccount('0x2222222222222222222222222222222222222222222222222222222222222222');
    const c2=await api(base,'/v1/auth/challenge',{method:'POST',body:{wallet:outsider.address}}),sig2=await outsider.signMessage({message:c2.data.data.message}),l2=await api(base,'/v1/auth/verify',{method:'POST',body:{wallet:outsider.address,signature:sig2}});
    const denied=await api(base,`/v1/seller/orders/${orderId}/status`,{method:'PUT',token:l2.data.data.token,body:{status:'SHIPPED'}});assert.equal(denied.status,403);assert.equal(denied.data.error,'forbidden');

    const partial=await api(base,`/v1/orders/${orderId}/refund-request`,{method:'POST',token:session,body:{reason:'Partial return requested',amount_cents:5000}});assert.equal(partial.status,409);assert.equal(partial.data.error,'partial_refund_not_supported');
    const refund=await api(base,`/v1/orders/${orderId}/refund-request`,{method:'POST',token:session,body:{reason:'Full order refund requested'}});assert.equal(refund.status,201);assert.equal(refund.data.data.status,'REQUESTED');
    const refunds=await api(base,'/v1/admin/refunds',{headers:adminHeaders});assert.equal(refunds.status,200);assert.equal(refunds.data.data.length,1);
  }finally{
    proc.kill('SIGTERM');await new Promise(r=>{if(proc.exitCode!==null)return r();proc.once('exit',r);setTimeout(()=>{proc.kill('SIGKILL');r()},2000)});rmSync(dir,{recursive:true,force:true});
  }
});
