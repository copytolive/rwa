import {createHash,timingSafeEqual} from 'node:crypto';
import {CommerceError,midtransExpectedGrossAmountCents,normCurrency} from './commerce-core.mjs';

const safeEqual=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&timingSafeEqual(x,y)};

export class MidtransPayment {
  constructor({serverKey=process.env.MIDTRANS_SERVER_KEY||'',clientKey=process.env.MIDTRANS_CLIENT_KEY||'',production=process.env.MIDTRANS_IS_PRODUCTION==='true',frontendUrl=process.env.RWA_COMMERCE_FRONTEND_URL||'',fetchImpl=globalThis.fetch}={}){
    this.serverKey=String(serverKey).trim();this.clientKey=String(clientKey).trim();this.production=!!production;this.frontendUrl=String(frontendUrl).replace(/\/$/,'');this.fetch=fetchImpl;
    this.snapBase=this.production?'https://app.midtrans.com/snap/v1':'https://app.sandbox.midtrans.com/snap/v1';
    this.coreBase=this.production?'https://api.midtrans.com/v2':'https://api.sandbox.midtrans.com/v2';
  }
  isConfigured(){return !!this.serverKey&&!this.serverKey.includes('REPLACE')}
  config(){return{provider:'midtrans',configured:this.isConfigured(),client_key:this.clientKey||'',production:this.production,supported_currency:'IDR'}}
  authHeader(){if(!this.isConfigured())throw new CommerceError('payment_not_configured',503);return`Basic ${Buffer.from(`${this.serverKey}:`).toString('base64')}`}
  async request(url,options={}){const res=await this.fetch(url,{...options,headers:{Accept:'application/json',Authorization:this.authHeader(),...(options.headers||{})}});const data=await res.json().catch(()=>({}));if(!res.ok)throw new CommerceError('payment_provider_error',502,{status:res.status,provider:data});return data}
  async createForOrder(order){
    midtransExpectedGrossAmountCents(order);const grossAmount=Number(order.total_cents)/100;
    const payload={transaction_details:{order_id:order.id,gross_amount:grossAmount},item_details:[{id:order.id,price:grossAmount,quantity:1,name:`RWA order ${order.id}`.slice(0,50)}]};
    const contact=order.contact||{};payload.customer_details={first_name:String(contact.name||contact.recipient_name||'Customer').slice(0,50),email:String(contact.email||''),phone:String(contact.phone||'')};
    if(this.frontendUrl)payload.callbacks={finish:`${this.frontendUrl}/#shop`};
    const data=await this.request(`${this.snapBase}/transactions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(!data.token&&!data.redirect_url)throw new CommerceError('payment_provider_invalid_response',502);
    return{provider:'midtrans',order_id:order.id,token:data.token||'',redirect_url:data.redirect_url||'',gross_amount:(String(grossAmount)),currency:'IDR'};
  }
  async status(orderId){const data=await this.request(`${this.coreBase}/${encodeURIComponent(orderId)}/status`);return data}
  async refund(order,{amountCents=null,reason='Customer refund',refundKey=''}={}){
    midtransExpectedGrossAmountCents(order);const total=Number(order.total_cents),amount=amountCents===null?total:Number(amountCents);
    if(!Number.isSafeInteger(amount)||amount<=0||amount>total||amount%100!==0)throw new CommerceError('invalid_refund_amount',400);
    if(amount!==total)throw new CommerceError('partial_refund_not_supported',409,{requested_cents:amount,total_cents:total});
    // Only full-order refunds exist in this release, so one deterministic provider
    // key per order makes a retry after a network/process interruption idempotent.
    const stableKey=String(refundKey||`refund-${order.id}`).replace(/[^A-Za-z0-9._-]/g,'-').slice(0,128);
    const payload={refund_key:stableKey,reason:String(reason||'Customer refund').slice(0,255),amount:amount/100};
    return this.request(`${this.coreBase}/${encodeURIComponent(order.id)}/refund`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  }
  verifyNotification(body={}){
    if(!this.isConfigured())throw new CommerceError('payment_not_configured',503);
    const orderId=String(body.order_id||''),statusCode=String(body.status_code||''),grossAmount=String(body.gross_amount||''),signature=String(body.signature_key||'');
    if(!orderId||!statusCode||!grossAmount||!signature)return false;
    const expected=createHash('sha512').update(`${orderId}${statusCode}${grossAmount}${this.serverKey}`).digest('hex');
    return safeEqual(expected,signature);
  }
  assertAmountMatches(order,body={}){
    midtransExpectedGrossAmountCents(order);const expected=Number(order.total_cents)/100,actual=Number(body.gross_amount);
    if(!Number.isFinite(actual)||actual!==expected)throw new CommerceError('payment_amount_mismatch',409,{expected_idr:expected,actual_idr:actual,currency:normCurrency(order.currency)});
    return true;
  }
}

export const payment=new MidtransPayment();
