import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createServer as createNetServer} from 'node:net';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {privateKeyToAccount} from 'viem/accounts';

const HERE=dirname(fileURLToPath(import.meta.url)),SERVICE=resolve(HERE,'..');
const STORE={token:'STORE1',status:'VERIFIED',category:'Retail',trade_enabled:false,physical_store:{store_name:'Verified Store 1',full_address:'1 Integration Road, Jakarta',geo:{lat:-6.2,lng:106.8},storefront_photo_url:'https://evidence.example/store.jpg',business_registration_url:'https://evidence.example/business.pdf',merchant_identity_url:'https://evidence.example/merchant.pdf'}};
const sha=v=>createHash('sha256').update(v).digest('hex');

async function freePort(){return new Promise((resolvePort,reject)=>{const s=createNetServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(e=>e?reject(e):resolvePort(p))})})}
async function waitReady(base,child,logs){for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(`commerce server exited early: ${logs.join('')}`);try{const r=await fetch(`${base}/healthz`);if(r.ok)return}catch{}await new Promise(r=>setTimeout(r,50))}throw Error(`commerce server did not start: ${logs.join('')}`)}
async function api(base,path,{method='GET',body,token,admin,idem}={}){const headers={Accept:'application/json'};if(body!==undefined)headers['Content-Type']='application/json';if(token)headers.Authorization=`Bearer ${token}`;if(admin)headers.Authorization=`Bearer ${admin}`;if(idem)headers['Idempotency-Key']=idem;const r=await fetch(`${base}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();return{status:r.status,data}}
async function login(base,account){const ch=await api(base,'/v1/auth/challenge',{method:'POST',body:{wallet:account.address}});assert.equal(ch.status,200);const signature=await account.signMessage({message:ch.data.data.message});const v=await api(base,'/v1/auth/verify',{method:'POST',body:{wallet:account.address,signature}});assert.equal(v.status,200);return v.data.data.token}

test('HTTP commerce lifecycle is authoritative, idempotent, signature-verified and seller-scoped',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'rwa-commerce-http-')),registryPath=join(dir,'registry.json'),assetsPath=join(dir,'assets.json'),dbPath=join(dir,'commerce.sqlite');
  const writeRegistry=(assets=[{token:'STORE1',status:'VERIFIED'}])=>{writeFileSync(registryPath,JSON.stringify({schema:1,policy:'ONE_TOKEN_ONE_PHYSICAL_STORE_V1',stores:[STORE]}));writeFileSync(assetsPath,JSON.stringify({verified:assets}))};
  writeRegistry();
  const port=await freePort(),base=`http://127.0.0.1:${port}`,adminSecret='integration-admin',midtransSecret='integration-midtrans-secret',logs=[];
  const child=spawn(process.execPath,['server.mjs'],{cwd:SERVICE,env:{...process.env,PORT:String(port),RWA_COMMERCE_HOST:'127.0.0.1',RWA_COMMERCE_DB:dbPath,RWA_COMMERCE_REGISTRY_PATH:registryPath,RWA_COMMERCE_ASSETS_PATH:assetsPath,RWA_COMMERCE_PUBLIC_ORIGIN:'https://narzulalistiqlal.github.io',RWA_COMMERCE_ALLOWED_ORIGINS:'https://narzulalistiqlal.github.io',RWA_COMMERCE_ADMIN_TOKEN_SHA256:sha(adminSecret),MIDTRANS_SERVER_KEY:midtransSecret,MIDTRANS_CLIENT_KEY:'integration-client',MIDTRANS_IS_PRODUCTION:'false',RWA_COMMERCE_TAX_BPS:'0'}});
  child.stdout.on('data',x=>logs.push(String(x)));child.stderr.on('data',x=>logs.push(String(x)));
  try{
    await waitReady(base,child,logs);
    const ready=await api(base,'/readyz');assert.equal(ready.status,200);assert.equal(ready.data.checkout_ready,true);assert.equal(ready.data.live_verified_stores,1);

    const productBody={id:'p1',storeToken:'STORE1',sku:'SKU1',name:'Integration Product',description:'Server authoritative product',priceCents:1250000,currency:'IDR',onHand:3,pickup:true,shipping:true};
    const putProduct=await api(base,'/v1/admin/products',{method:'POST',body:productBody,admin:adminSecret});assert.equal(putProduct.status,200);assert.equal(putProduct.data.data.available,3);
    const publicProducts=await api(base,'/v1/products?store=STORE1');assert.equal(publicProducts.status,200);assert.equal(publicProducts.data.data.length,1);assert.equal(publicProducts.data.data[0].price_cents,1250000);

    const buyer=privateKeyToAccount('0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),buyerToken=await login(base,buyer);
    const quote=await api(base,'/v1/quote',{method:'POST',token:buyerToken,body:{items:[{product_id:'p1',qty:2}],fulfillment:'pickup'}});assert.equal(quote.status,201);assert.equal(quote.data.data.totalCents,2500000);
    const orderBody={quote_id:quote.data.data.id,contact:{name:'Buyer',email:'buyer@example.test',phone:'+6200000000'},payment_mode:'MIDTRANS'},idem='order-key-0001';
    const first=await api(base,'/v1/orders',{method:'POST',token:buyerToken,idem,body:orderBody});assert.equal(first.status,201);const orderId=first.data.data.id;
    const repeat=await api(base,'/v1/orders',{method:'POST',token:buyerToken,idem,body:orderBody});assert.equal(repeat.status,201);assert.equal(repeat.data.data.id,orderId);
    const reused=await api(base,'/v1/orders',{method:'POST',token:buyerToken,idem,body:{...orderBody,notes:'changed request'}});assert.equal(reused.status,409);assert.equal(reused.data.error,'idempotency_key_reused');
    const afterReserve=await api(base,'/v1/products?store=STORE1');assert.equal(afterReserve.data.data[0].available,1);

    const gross='25000.00',settled={order_id:orderId,status_code:'200',gross_amount:gross,transaction_id:'tx-integration-1',transaction_status:'settlement',fraud_status:'accept'};settled.signature_key=createHash('sha512').update(`${orderId}200${gross}${midtransSecret}`).digest('hex');
    const hook=await api(base,'/v1/webhooks/midtrans',{method:'POST',body:settled});assert.equal(hook.status,200);assert.equal(hook.data.transition,'PAID');
    const duplicate=await api(base,'/v1/webhooks/midtrans',{method:'POST',body:settled});assert.equal(duplicate.status,200);assert.deepEqual(duplicate.data,hook.data);
    const order=await api(base,`/v1/orders/${orderId}`,{token:buyerToken});assert.equal(order.data.data.status,'PAID');
    const badHook=await api(base,'/v1/webhooks/midtrans',{method:'POST',body:{...settled,transaction_status:'expire',signature_key:'0'.repeat(128)}});assert.equal(badHook.status,403);assert.equal((await api(base,`/v1/orders/${orderId}`,{token:buyerToken})).data.data.status,'PAID');
    const cancelPaid=await api(base,`/v1/orders/${orderId}/cancel`,{method:'POST',token:buyerToken,body:{}});assert.equal(cancelPaid.status,409);assert.equal(cancelPaid.data.error,'cancel_not_allowed');

    const owner=await api(base,'/v1/admin/stores/STORE1/owners',{method:'POST',admin:adminSecret,body:{wallet:buyer.address,role:'OWNER'}});assert.equal(owner.status,200);assert.equal(owner.data.data.wallet,buyer.address.toLowerCase());
    const sellerOrders=await api(base,'/v1/seller/orders',{token:buyerToken});assert.equal(sellerOrders.status,200);assert.equal(sellerOrders.data.data.some(x=>x.id===orderId),true);
    const outsider=privateKeyToAccount('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),outsiderToken=await login(base,outsider);
    const forbiddenInventory=await api(base,'/v1/seller/inventory/p1',{method:'PUT',token:outsiderToken,body:{on_hand:5}});assert.equal(forbiddenInventory.status,403);assert.equal(forbiddenInventory.data.error,'forbidden');

    const refund=await api(base,`/v1/orders/${orderId}/refund-request`,{method:'POST',token:buyerToken,body:{reason:'Customer requested refund',amount_cents:1250000}});assert.equal(refund.status,201);assert.equal(refund.data.data.status,'REQUESTED');
    const refunds=await api(base,'/v1/admin/refunds',{admin:adminSecret});assert.equal(refunds.status,200);assert.equal(refunds.data.data.some(x=>x.id===refund.data.data.id),true);

    writeRegistry([]);
    const failedSync=await api(base,'/v1/admin/registry/sync',{method:'POST',admin:adminSecret,body:{}});assert.equal(failedSync.status,409);assert.match(failedSync.data.error,/registry_asset_not_verified/);
    const hidden=await api(base,'/v1/products?store=STORE1');assert.equal(hidden.status,200);assert.equal(hidden.data.data.length,0);
    const blockedReady=await api(base,'/readyz');assert.equal(blockedReady.data.checkout_ready,false);assert.equal(blockedReady.data.live_verified_stores,0);assert.equal(blockedReady.data.blockers.includes('no_verified_store'),true);
  }finally{
    child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(r,2000))]);if(child.exitCode===null)child.kill('SIGKILL');rmSync(dir,{recursive:true,force:true});
  }
});
