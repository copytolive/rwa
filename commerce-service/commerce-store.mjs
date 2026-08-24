import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {id} from './db.mjs';
import {CommerceError} from './commerce-core.mjs';

const HERE=dirname(fileURLToPath(import.meta.url));
const now=()=>Date.now();
const wallet=v=>String(v||'').trim().toLowerCase();

export class CommerceStore {
  constructor(db){this.db=db;this.db.db.exec(readFileSync(resolve(HERE,'schema-v2.sql'),'utf8'))}
  setPaymentReference(orderId,reference,actor='system'){
    const ref=String(reference||'').slice(0,512);this.db.db.prepare('UPDATE orders SET payment_reference=?,updated_at=? WHERE id=?').run(ref,now(),orderId);this.db.audit(actor,'payment.reference','order',orderId,{reference:ref});return this.db.order(orderId)
  }
  setOwner(storeToken,ownerWallet,{role='OWNER',actor='admin'}={}){
    const token=String(storeToken||'').trim().toUpperCase(),w=wallet(ownerWallet),r=String(role||'OWNER').toUpperCase();
    if(!this.db.store(token))throw new CommerceError('store_not_found',404);if(!/^0x[a-f0-9]{40}$/.test(w))throw new CommerceError('invalid_wallet',400);if(!['OWNER','MANAGER'].includes(r))throw new CommerceError('invalid_store_role',400);
    const t=now();this.db.db.prepare('INSERT INTO store_owners(store_token,wallet,role,active,created_at,updated_at) VALUES(?,?,?,1,?,?) ON CONFLICT(store_token,wallet) DO UPDATE SET role=excluded.role,active=1,updated_at=excluded.updated_at').run(token,w,r,t,t);this.db.audit(actor,'store.owner.set','store',token,{wallet:w,role:r});return{store_token:token,wallet:w,role:r,active:true}
  }
  canManageStore(storeToken,ownerWallet){return !!this.db.db.prepare('SELECT 1 ok FROM store_owners WHERE store_token=? AND wallet=? AND active=1').get(String(storeToken||'').toUpperCase(),wallet(ownerWallet))}
  owners(storeToken){return this.db.db.prepare('SELECT store_token,wallet,role,active,created_at,updated_at FROM store_owners WHERE store_token=? ORDER BY created_at').all(String(storeToken||'').toUpperCase())}
  sellerOrders(ownerWallet){return this.db.db.prepare(`SELECT DISTINCT o.id,o.status,o.total_cents,o.currency,o.fulfillment,o.created_at,o.updated_at FROM orders o JOIN order_items oi ON oi.order_id=o.id JOIN store_owners so ON so.store_token=oi.store_token AND so.active=1 WHERE so.wallet=? ORDER BY o.created_at DESC LIMIT 200`).all(wallet(ownerWallet))}
  sellerCanManageOrder(orderId,ownerWallet){return !!this.db.db.prepare(`SELECT 1 ok FROM order_items oi JOIN store_owners so ON so.store_token=oi.store_token AND so.active=1 WHERE oi.order_id=? AND so.wallet=? LIMIT 1`).get(orderId,wallet(ownerWallet))}
  expiredAwaiting(beforeTs){
    // Never release reserved inventory locally after a provider payment has been
    // created. The signed provider webhook is authoritative for settlement or
    // expiry; otherwise a still-payable link could settle after stock was freed.
    return this.db.db.prepare("SELECT id FROM orders WHERE status='AWAITING_PAYMENT' AND created_at<? AND COALESCE(payment_reference,'')='' ORDER BY created_at LIMIT 500").all(Number(beforeTs)).map(x=>x.id)
  }
  requestRefund(order,requester,reason,amountCents=null){
    if(!order)throw new CommerceError('order_not_found',404);if(!['PAID','FULFILLING','READY_FOR_PICKUP','SHIPPED','COMPLETED'].includes(order.status))throw new CommerceError('refund_not_allowed_for_status',409,{status:order.status});
    const total=Number(order.total_cents),amount=amountCents===null?total:Number(amountCents);if(!Number.isSafeInteger(amount)||amount<=0||amount>total)throw new CommerceError('invalid_refund_amount',400);
    // Partial returns need item-level returned-goods and restock accounting. Until
    // that ledger exists, fail closed instead of marking a whole order REFUNDED
    // after only part of its settlement was returned.
    if(amount!==total)throw new CommerceError('partial_refund_not_supported',409,{requested_cents:amount,total_cents:total});
    const existing=this.db.db.prepare("SELECT * FROM refunds WHERE order_id=? AND status IN ('REQUESTED','PROCESSING','SUCCEEDED') ORDER BY created_at DESC LIMIT 1").get(order.id);if(existing)return this.refund(existing.id);
    const reasonText=String(reason||'').trim();if(reasonText.length<5||reasonText.length>1000)throw new CommerceError('refund_reason_required',400);
    const refundId=id('ref'),t=now();this.db.db.prepare('INSERT INTO refunds(id,order_id,requester,reason,amount_cents,status,created_at,updated_at) VALUES(?,?,?,?,?,\'REQUESTED\',?,?)').run(refundId,order.id,String(requester),reasonText,amount,t,t);this.db.audit(String(requester),'refund.request','order',order.id,{refund_id:refundId,amount_cents:amount});return this.refund(refundId)
  }
  refund(refundId){const r=this.db.db.prepare('SELECT * FROM refunds WHERE id=?').get(refundId);return r?{...r,detail:JSON.parse(r.detail_json||'{}')}:null}
  refunds(status=''){return status?this.db.db.prepare('SELECT * FROM refunds WHERE status=? ORDER BY created_at DESC LIMIT 200').all(String(status).toUpperCase()):this.db.db.prepare('SELECT * FROM refunds ORDER BY created_at DESC LIMIT 200').all()}
  updateRefund(refundId,status,{provider='midtrans',providerReference='',detail={}}={}){const next=String(status).toUpperCase();if(!['PROCESSING','SUCCEEDED','REJECTED','FAILED'].includes(next))throw new CommerceError('invalid_refund_status',400);this.db.db.prepare('UPDATE refunds SET status=?,provider=?,provider_reference=?,detail_json=?,updated_at=? WHERE id=?').run(next,provider,String(providerReference||''),JSON.stringify(detail||{}),now(),refundId);return this.refund(refundId)}
  markOrderRefunded(orderId,actor='admin'){
    return this.db.transaction(()=>{const o=this.db.order(orderId);if(!o)throw new CommerceError('order_not_found',404);if(o.status==='REFUNDED')return o;if(o.status==='CANCELLED')throw new CommerceError('order_cancelled',409);
      // Before completion stock is still reserved, so a full refund releases the
      // reservation. Completed stock is not auto-restocked without returned-goods evidence.
      if(o.status!=='COMPLETED'){for(const item of o.items)this.db.db.prepare('UPDATE inventory SET reserved=MAX(0,reserved-?),updated_at=? WHERE product_id=?').run(item.qty,now(),item.product_id)}
      this.db.db.prepare("UPDATE orders SET status='REFUNDED',updated_at=? WHERE id=?").run(now(),orderId);this.db.audit(actor,'order.refunded','order',orderId,{from:o.status});return this.db.order(orderId)})
  }
}
