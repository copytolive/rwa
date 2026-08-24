import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CommerceDB} from '../db.mjs';
import {CommerceStore} from '../commerce-store.mjs';
import {buildAuthoritativeQuote} from '../commerce-core.mjs';

function fixture(){
  const dir=mkdtempSync(join(tmpdir(),'rwa-commerce-life-')),db=new CommerceDB(join(dir,'db.sqlite')),store=new CommerceStore(db);
  db.upsertStore({token:'STORE1',name:'Store 1',category:'Retail',fullAddress:'1 Test Road',lat:-6.2,lng:106.8,contact:'',openingHours:'',photo:'https://example.test/store.jpg',business:'https://example.test/business',merchant:'https://example.test/merchant',catalog:'',assetVerified:true,storeVerified:true,tradeEnabled:false,status:'VERIFIED',registryHash:'hash'});
  db.upsertProduct({id:'p1',storeToken:'STORE1',sku:'SKU1',name:'Product 1',priceCents:10000,currency:'IDR',onHand:3,pickup:true,shipping:true});
  return{db,store,close(){db.close();rmSync(dir,{recursive:true,force:true})}};
}
function order(f){
  const q=buildAuthoritativeQuote(f.db,{wallet:'0x1111111111111111111111111111111111111111',items:[{productId:'p1',qty:1}],fulfillment:'pickup'},{taxBps:0,shippingCents:null,quoteTtlMs:600000});
  q.id=`q-${Math.random()}`;f.db.quotePut(q);return f.db.createOrder({quote:f.db.quote(q.id),wallet:q.wallet,contact:{},notes:'',paymentMode:'MIDTRANS',paymentReference:''});
}

test('local expiry never releases an order with an active provider payment reference',()=>{
  const f=fixture();try{
    const o1=order(f),o2=order(f);f.store.setPaymentReference(o2.id,'snap-token','test');
    const ids=f.store.expiredAwaiting(Date.now()+1);
    assert.ok(ids.includes(o1.id));
    assert.ok(!ids.includes(o2.id));
  }finally{f.close()}
});

test('refund requests fail closed on partial amount and deduplicate an active full refund',()=>{
  const f=fixture();try{
    const o=order(f);f.db.transitionOrder(o.id,'PAID',{actor:'test'});const paid=f.db.order(o.id);
    assert.throws(()=>f.store.requestRefund(paid,paid.wallet,'Partial return',5000),e=>e.code==='partial_refund_not_supported');
    const a=f.store.requestRefund(paid,paid.wallet,'Full order refund');
    const b=f.store.requestRefund(paid,paid.wallet,'Duplicate full refund request');
    assert.equal(a.id,b.id);
    assert.equal(f.store.refunds().length,1);
  }finally{f.close()}
});
