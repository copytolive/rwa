import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {MidtransPayment} from '../payment.mjs';

const order={id:'ord_test',currency:'IDR',total_cents:1250000,contact:{name:'Buyer',email:'buyer@example.test'}};

test('Midtrans create is tied to existing DB order id',async()=>{
  let seen=null;
  const p=new MidtransPayment({serverKey:'server-secret',clientKey:'client-key',fetchImpl:async(_url,opts)=>{seen=JSON.parse(opts.body);return{ok:true,status:201,json:async()=>({token:'snap-token',redirect_url:'https://example.test/pay'})}}});
  const out=await p.createForOrder(order);
  assert.equal(seen.transaction_details.order_id,'ord_test');
  assert.equal(seen.transaction_details.gross_amount,12500);
  assert.equal(out.order_id,'ord_test');
});

test('Midtrans webhook signature is verified',()=>{
  const p=new MidtransPayment({serverKey:'server-secret'}),body={order_id:'ord_test',status_code:'200',gross_amount:'12500.00'};
  body.signature_key=createHash('sha512').update(`${body.order_id}${body.status_code}${body.gross_amount}server-secret`).digest('hex');
  assert.equal(p.verifyNotification(body),true);body.signature_key='0'.repeat(128);assert.equal(p.verifyNotification(body),false);
});

test('Midtrans payment fails closed for non-IDR order',async()=>{
  const p=new MidtransPayment({serverKey:'server-secret',fetchImpl:async()=>{throw new Error('should not call')}});
  await assert.rejects(()=>p.createForOrder({...order,currency:'USD'}),e=>e.code==='midtrans_requires_idr');
});
