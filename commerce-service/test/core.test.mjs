import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAuthoritativeQuote,CommerceError,mapMidtransNotification,transitionForPaymentEvent} from '../commerce-core.mjs';

const product=(id,store='RWA1',available=5)=>({id,active:1,store_status:'VERIFIED',store_verified:1,asset_verified:1,pickup:1,shipping:1,available,price_cents:12500,currency:'USD',store_token:store,sku:`SKU-${id}`,name:`Product ${id}`});
const fakeDb=rows=>({product:id=>rows[id]||null});

test('quote uses backend product price and stock',()=>{
  const q=buildAuthoritativeQuote(fakeDb({p1:product('p1')}),{wallet:'0xabc',items:[{productId:'p1',qty:2}],fulfillment:'pickup'},{taxBps:1000,shippingCents:null,quoteTtlMs:600000});
  assert.equal(q.subtotalCents,25000);assert.equal(q.taxCents,2500);assert.equal(q.totalCents,27500);assert.equal(q.items[0].unitPriceCents,12500);
});

test('quote rejects multi-store checkout',()=>{
  assert.throws(()=>buildAuthoritativeQuote(fakeDb({a:product('a','A'),b:product('b','B')}),{items:[{productId:'a',qty:1},{productId:'b',qty:1}]},{taxBps:0,shippingCents:null,quoteTtlMs:600000}),e=>e instanceof CommerceError&&e.code==='multi_store_quote_not_supported');
});

test('shipping is fail-closed without authoritative rate',()=>{
  assert.throws(()=>buildAuthoritativeQuote(fakeDb({a:product('a')}),{items:[{productId:'a',qty:1}],fulfillment:'shipping',destination:{address:'x',city:'y'}},{taxBps:0,shippingCents:null,quoteTtlMs:600000}),e=>e.code==='shipping_rate_unavailable');
});

test('payment notification mapping never regresses paid order',()=>{
  assert.equal(mapMidtransNotification({transaction_status:'settlement'}),'PAID');
  assert.equal(mapMidtransNotification({transaction_status:'expire'}),'CANCELLED');
  assert.equal(transitionForPaymentEvent('AWAITING_PAYMENT','PAID'),'PAID');
  assert.equal(transitionForPaymentEvent('PAID','CANCELLED'),null);
});
