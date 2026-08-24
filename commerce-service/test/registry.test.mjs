import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CommerceDB} from '../db.mjs';
import {RegistryService} from '../registry.mjs';

const store={
  token:'STORE1',status:'VERIFIED',category:'Retail',
  physical_store:{
    store_name:'Store One',full_address:'1 Verified Road',geo:{lat:-6.2,lng:106.8},
    storefront_photo_url:'https://example.test/store.jpg',
    business_registration_url:'https://example.test/business',
    merchant_identity_url:'https://example.test/merchant'
  }
};

test('registry sync revokes a store removed from authoritative verification source',()=>{
  const dir=mkdtempSync(join(tmpdir(),'rwa-registry-')),db=new CommerceDB(join(dir,'db.sqlite'));
  const registryPath=join(dir,'registry.json'),assetsPath=join(dir,'assets.json');
  try{
    writeFileSync(assetsPath,JSON.stringify({verified:[{token:'STORE1',status:'VERIFIED'}]}));
    writeFileSync(registryPath,JSON.stringify({policy:'ONE_TOKEN_ONE_PHYSICAL_STORE_V1',stores:[store]}));
    const registry=new RegistryService(db,{registryPath,assetsPath});
    const first=registry.sync({actor:'test'});
    assert.equal(first.stores,1);
    assert.equal(db.stores().length,1);
    assert.equal(db.store('STORE1').status,'VERIFIED');

    writeFileSync(registryPath,JSON.stringify({policy:'ONE_TOKEN_ONE_PHYSICAL_STORE_V1',stores:[]}));
    const second=registry.sync({actor:'test'});
    assert.deepEqual(second.revoked,['STORE1']);
    assert.equal(db.stores().length,0);
    const revoked=db.store('STORE1');
    assert.equal(revoked.status,'REVOKED');
    assert.equal(revoked.store_verified,0);
    assert.equal(revoked.asset_verified,0);
    assert.equal(revoked.trade_enabled,0);
  }finally{db.close();rmSync(dir,{recursive:true,force:true})}
});
