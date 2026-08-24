import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {privateKeyToAccount} from 'viem/accounts';
import {CommerceDB} from '../db.mjs';
import {AuthService} from '../auth.mjs';
import {RegistryService} from '../registry.mjs';

const STORE={
  token:'STORE1',status:'VERIFIED',category:'Retail',trade_enabled:false,
  physical_store:{
    store_name:'Verified Store 1',full_address:'1 Verification Road, Jakarta',
    geo:{lat:-6.2,lng:106.8},storefront_photo_url:'https://evidence.example/store.jpg',
    business_registration_url:'https://evidence.example/business.pdf',
    merchant_identity_url:'https://evidence.example/merchant.pdf'
  }
};

function fixture(){
  const dir=mkdtempSync(join(tmpdir(),'rwa-commerce-auth-registry-'));
  const db=new CommerceDB(join(dir,'db.sqlite'));
  const registryPath=join(dir,'registry.json'),assetsPath=join(dir,'assets.json');
  const write=(stores=[STORE],verified=[{token:'STORE1',status:'VERIFIED'}])=>{
    writeFileSync(registryPath,JSON.stringify({schema:1,policy:'ONE_TOKEN_ONE_PHYSICAL_STORE_V1',stores}));
    writeFileSync(assetsPath,JSON.stringify({verified}));
  };
  write();
  return{dir,db,registryPath,assetsPath,write,close(){db.close();rmSync(dir,{recursive:true,force:true})}};
}

test('wallet challenge creates one-use commerce session and logout revokes it',async()=>{
  const f=fixture();
  try{
    const account=privateKeyToAccount('0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
    const auth=new AuthService(f.db,{origin:'https://shop.example',sessionTtlMs:60_000,challengeTtlMs:60_000});
    const challenge=auth.challenge(account.address);
    assert.match(challenge.message,/RWA COMMERCE LOGIN V1/);
    assert.match(challenge.message,/Origin: https:\/\/shop\.example/);
    const signature=await account.signMessage({message:challenge.message});
    const session=await auth.verify({wallet:account.address,signature});
    const req={headers:{authorization:`Bearer ${session.token}`}};
    assert.equal(auth.requireSession(req).wallet,account.address.toLowerCase());
    assert.deepEqual(auth.logout(req),{ok:true});
    assert.equal(auth.session(req),null);
    await assert.rejects(()=>auth.verify({wallet:account.address,signature}),/challenge_expired/);
  }finally{f.close()}
});

test('admin bearer token is hash-gated and fail-closed when unconfigured',()=>{
  const f=fixture(),before=process.env.RWA_COMMERCE_ADMIN_TOKEN_SHA256;
  try{
    const auth=new AuthService(f.db);
    delete process.env.RWA_COMMERCE_ADMIN_TOKEN_SHA256;
    assert.throws(()=>auth.requireAdmin({headers:{authorization:'Bearer admin-secret'}}),e=>e.statusCode===503&&e.message==='admin_not_configured');
    process.env.RWA_COMMERCE_ADMIN_TOKEN_SHA256=createHash('sha256').update('admin-secret').digest('hex');
    assert.deepEqual(auth.requireAdmin({headers:{authorization:'Bearer admin-secret'}}),{actor:'admin'});
    assert.throws(()=>auth.requireAdmin({headers:{authorization:'Bearer wrong'}}),e=>e.statusCode===401&&e.message==='unauthorized');
  }finally{
    if(before===undefined)delete process.env.RWA_COMMERCE_ADMIN_TOKEN_SHA256;else process.env.RWA_COMMERCE_ADMIN_TOKEN_SHA256=before;
    f.close();
  }
});

test('registry removal or verification failure revokes persisted store and hides catalog',()=>{
  const f=fixture();
  try{
    const registry=new RegistryService(f.db,{registryPath:f.registryPath,assetsPath:f.assetsPath});
    assert.equal(registry.sync({actor:'test'}).stores,1);
    f.db.upsertProduct({id:'p1',storeToken:'STORE1',sku:'SKU1',name:'Product 1',priceCents:1250000,currency:'IDR',onHand:3,pickup:true,shipping:true});
    assert.equal(f.db.products('STORE1').length,1);

    f.write([],[]);
    const removed=registry.sync({actor:'test'});
    assert.deepEqual(removed.revoked,['STORE1']);
    assert.equal(f.db.stores().length,0);
    assert.equal(f.db.products('STORE1').length,0);
    assert.equal(f.db.store('STORE1').status,'REVOKED');

    f.write([STORE],[]);
    assert.throws(()=>registry.sync({actor:'test'}),/registry_asset_not_verified:STORE1/);
    assert.equal(f.db.stores().length,0);
    assert.equal(f.db.products('STORE1').length,0);
    assert.equal(f.db.store('STORE1').status,'REVOKED');
    assert.equal(f.db.auditRecent(20).some(x=>x.action==='registry.sync_failed'),true);
  }finally{f.close()}
});

test('product update persists shipping flag instead of leaving stale value',()=>{
  const f=fixture();
  try{
    const registry=new RegistryService(f.db,{registryPath:f.registryPath,assetsPath:f.assetsPath});registry.sync();
    const base={id:'p1',storeToken:'STORE1',sku:'SKU1',name:'Product 1',priceCents:10000,currency:'IDR',onHand:2,pickup:true,shipping:true};
    f.db.upsertProduct(base);assert.equal(f.db.product('p1').shipping,1);
    f.db.upsertProduct({...base,shipping:false});assert.equal(f.db.product('p1').shipping,0);
  }finally{f.close()}
});
