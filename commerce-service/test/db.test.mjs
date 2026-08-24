import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CommerceDB} from '../db.mjs';
import {buildAuthoritativeQuote} from '../commerce-core.mjs';

function fixture(){
  const dir=mkdtempSync(join(tmpdir(),'rwa-commerce-')),db=new CommerceDB(join(dir,'db.sqlite'));
  db.upsertStore({token:'STORE1',name:'Store 1',category:'Retail',fullAddress:'1 Test Road',lat:-6.2,lng:106.8,contact:'',openingHours:'',photo:'https://example.test/store.jpg',business:'https://example.test/business',merchant:'https://example.test/merchant',catalog:'',assetVerified:true,storeVerified:true,tradeEnabled:false,status:'VERIFIED',registryHash:'hash'});
  db.upsertProduct({id:'p1',storeToken:'STORE1',sku:'SKU1',name:'Product 1',priceCents:10000,currency:'USD',onHand:3,pickup:true,shipping:true});
  return{db,dir,close(){db.close();rmSync(dir,{recursive:true,force:true})}};
}
function putQuote(db,qty){const q=buildAuthoritativeQuote(db,{wallet:'0x1111111111111111111111111111111111111111',items:[{productId:'p1',qty}],fulfillment:'pickup'},{taxBps:0,shippingCents:null,quoteTtlMs:600000});q.id=`q-${Math.random()}`;db.quotePut(q);return db.quote(q.id)}

test('inventory reservation is transactional and cancellation releases stock',()=>{const f=fixture();try{const q=putQuote(f.db,2),o=f.db.createOrder({quote:q,wallet:q.wallet,contact:{},notes:'',paymentMode:'MANUAL',paymentReference:''});assert.equal(f.db.product('p1').reserved,2);assert.equal(f.db.product('p1').available,1);f.db.transitionOrder(o.id,'CANCELLED');assert.equal(f.db.product('p1').reserved,0);assert.equal(f.db.product('p1').available,3)}finally{f.close()}});

test('competing order cannot oversell reserved inventory',()=>{const f=fixture();try{const q1=putQuote(f.db,2),q2=putQuote(f.db,2);f.db.createOrder({quote:q1,wallet:q1.wallet,contact:{},notes:'',paymentMode:'MANUAL',paymentReference:''});assert.throws(()=>f.db.createOrder({quote:q2,wallet:q2.wallet,contact:{},notes:'',paymentMode:'MANUAL',paymentReference:''}),/insufficient_stock/)}finally{f.close()}});
