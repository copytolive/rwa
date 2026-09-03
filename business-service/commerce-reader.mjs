import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';

const PAID_STATES=new Set(['PAID','FULFILLING','READY_FOR_PICKUP','SHIPPED','COMPLETED']);

export class CommerceReader{
  constructor(path=process.env.RWA_COMMERCE_DB||''){
    this.path=String(path||'').trim();this.db=null;
    if(this.path&&existsSync(this.path))this.db=new DatabaseSync(this.path,{readOnly:true});
  }
  close(){try{this.db?.close()}catch{}}
  available(){return !!this.db}
  qualifyingOrders(storeTokens=[]){if(!this.db)return[];const tokens=[...new Set(storeTokens.map(x=>String(x||'').toUpperCase()).filter(Boolean))];if(!tokens.length)return[];const marks=tokens.map(()=>'?').join(',');const orders=this.db.prepare(`SELECT DISTINCT o.id,o.wallet,o.currency,o.total_cents,o.status,o.payment_reference,o.paid_at,o.completed_at,o.updated_at,oi.store_token FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE oi.store_token IN (${marks}) ORDER BY o.created_at`).all(...tokens);const refunds=this.db.prepare("SELECT order_id,COALESCE(SUM(amount_cents),0) refund_cents FROM refunds WHERE status='SUCCEEDED' GROUP BY order_id").all();const refundMap=new Map(refunds.map(r=>[r.order_id,Number(r.refund_cents||0)]));return orders.filter(o=>PAID_STATES.has(String(o.status))&&String(o.payment_reference||'').trim()&&Number(o.paid_at)>0).map(o=>({...o,refund_cents:refundMap.get(o.id)||0,net_cents:Math.max(0,Number(o.total_cents)-Number(refundMap.get(o.id)||0))}))}
  expectedNet(storeTokens=[]){const rows=this.qualifyingOrders(storeTokens);return{rows,expectedNetCents:rows.reduce((n,x)=>n+Number(x.net_cents||0),0),refundCents:rows.reduce((n,x)=>n+Number(x.refund_cents||0),0)}}
}
