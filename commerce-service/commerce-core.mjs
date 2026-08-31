import {createHash} from 'node:crypto';

export class CommerceError extends Error {
  constructor(code,statusCode=400,detail=null){super(code);this.name='CommerceError';this.code=code;this.statusCode=statusCode;this.detail=detail}
}

const canonical=value=>Array.isArray(value)?value.map(canonical):(value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value);
export const jsonHash=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export const normCurrency=v=>String(v||'').trim().toUpperCase();
export const normFulfillment=v=>String(v||'pickup').trim().toLowerCase();

export function requireIdempotencyKey(headers={}){
  const key=String(headers['idempotency-key']||headers['Idempotency-Key']||'').trim();
  if(!/^[A-Za-z0-9._:-]{8,128}$/.test(key))throw new CommerceError('idempotency_key_required',400);
  return key;
}

export function parseItems(raw){
  if(!Array.isArray(raw)||raw.length===0)throw new CommerceError('items_required',400);
  if(raw.length>50)throw new CommerceError('too_many_items',400);
  const merged=new Map();
  for(const x of raw){
    const productId=String(x?.product_id||x?.productId||'').trim();
    const qty=Number(x?.qty??x?.quantity??1);
    if(!productId||productId.length>128)throw new CommerceError('invalid_product_id',400);
    if(!Number.isSafeInteger(qty)||qty<1||qty>100)throw new CommerceError('invalid_quantity',400,{product_id:productId});
    merged.set(productId,(merged.get(productId)||0)+qty);
    if(merged.get(productId)>100)throw new CommerceError('invalid_quantity',400,{product_id:productId});
  }
  return [...merged].map(([productId,qty])=>({productId,qty}));
}

export function pricingConfig(env=process.env){
  const taxRaw=String(env.RWA_COMMERCE_TAX_BPS??'0').trim();
  const taxBps=Number(taxRaw);
  if(!Number.isInteger(taxBps)||taxBps<0||taxBps>10000)throw new CommerceError('invalid_tax_config',500);
  const shippingRaw=String(env.RWA_COMMERCE_SHIPPING_FLAT_CENTS??'').trim();
  const shippingCents=shippingRaw===''?null:Number(shippingRaw);
  if(shippingCents!==null&&(!Number.isSafeInteger(shippingCents)||shippingCents<0))throw new CommerceError('invalid_shipping_config',500);
  const quoteTtlMs=Math.max(60_000,Math.min(60*60_000,Number(env.RWA_COMMERCE_QUOTE_TTL_MS||600_000)));
  const paymentTtlMs=Math.max(5*60_000,Math.min(24*60*60_000,Number(env.RWA_COMMERCE_PAYMENT_TTL_MS||30*60_000)));
  return{taxBps,shippingCents,quoteTtlMs,paymentTtlMs};
}

export function buildAuthoritativeQuote(db,{wallet='',items,fulfillment='pickup',destination={}},config=pricingConfig()){
  const wanted=parseItems(items),mode=normFulfillment(fulfillment);
  if(!['pickup','shipping'].includes(mode))throw new CommerceError('invalid_fulfillment',400);
  const rows=[];let currency='',storeToken='';
  for(const item of wanted){
    const p=db.product(item.productId);
    if(!p||!p.active)throw new CommerceError('product_unavailable',404,{product_id:item.productId});
    if(String(p.store_status||'').toUpperCase()!=='VERIFIED'||Number(p.store_verified)!==1||Number(p.asset_verified)!==1)throw new CommerceError('store_not_verified',409,{product_id:item.productId});
    if(mode==='pickup'&&Number(p.pickup)!==1)throw new CommerceError('pickup_not_supported',409,{product_id:item.productId});
    if(mode==='shipping'&&Number(p.shipping)!==1)throw new CommerceError('shipping_not_supported',409,{product_id:item.productId});
    if(Number(p.available)<item.qty)throw new CommerceError('insufficient_stock',409,{product_id:item.productId,available:Number(p.available),requested:item.qty});
    const c=normCurrency(p.currency);
    if(!currency)currency=c; else if(currency!==c)throw new CommerceError('mixed_currency_not_supported',409);
    if(!storeToken)storeToken=String(p.store_token); else if(storeToken!==String(p.store_token))throw new CommerceError('multi_store_quote_not_supported',409);
    rows.push({productId:p.id,storeToken:p.store_token,sku:p.sku,name:p.name,unitPriceCents:Number(p.price_cents),qty:item.qty,lineTotalCents:Number(p.price_cents)*item.qty});
  }
  if(mode==='shipping'&&config.shippingCents===null)throw new CommerceError('shipping_rate_unavailable',503);
  if(mode==='shipping'){
    const d=destination&&typeof destination==='object'?destination:{};
    if(!String(d.address||d.street||'').trim()||!String(d.city||'').trim())throw new CommerceError('shipping_destination_required',400);
  }
  const subtotalCents=rows.reduce((n,x)=>n+x.lineTotalCents,0);
  const shippingCents=mode==='shipping'?config.shippingCents:0;
  const taxCents=Math.round(subtotalCents*config.taxBps/10000);
  const totalCents=subtotalCents+shippingCents+taxCents;
  const expiresAt=Date.now()+config.quoteTtlMs;
  const canonical={wallet:String(wallet||'').toLowerCase(),currency,storeToken,subtotalCents,taxCents,shippingCents,totalCents,fulfillment:mode,destination:mode==='shipping'?destination:{},items:rows.map(({lineTotalCents,...x})=>x),expiresAt};
  return{...canonical,quoteHash:jsonHash(canonical)};
}

export function midtransExpectedGrossAmountCents(order){
  const currency=normCurrency(order?.currency);
  const total=Number(order?.total_cents);
  if(currency!=='IDR')throw new CommerceError('midtrans_requires_idr',409,{currency});
  if(!Number.isSafeInteger(total)||total<=0||total%100!==0)throw new CommerceError('midtrans_amount_requires_whole_idr',409,{total_cents:total});
  return total;
}

export function mapMidtransNotification(body={}){
  const status=String(body.transaction_status||'').toLowerCase();
  const fraud=String(body.fraud_status||'').toLowerCase();
  if((status==='capture'&&(fraud===''||fraud==='accept'))||status==='settlement')return'PAID';
  if(['deny','cancel','expire'].includes(status))return'CANCELLED';
  if(['refund','partial_refund'].includes(status))return'REFUND_SIGNAL';
  return'NOOP';
}

export function transitionForPaymentEvent(current,next){
  const c=String(current||'').toUpperCase();
  if(next==='PAID')return c==='AWAITING_PAYMENT'?'PAID':null;
  if(next==='CANCELLED')return c==='AWAITING_PAYMENT'?'CANCELLED':null;
  return null;
}
