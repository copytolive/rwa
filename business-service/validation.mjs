import {createHash} from 'node:crypto';

const sha=v=>createHash('sha256').update(String(v)).digest('hex');
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const verifiedWallets=b=>(b?.wallets||[]).filter(x=>x.active&&x.identity_verified);

export function reconcileBusiness(store,reader,businessId,{actor='reconciler'}={}){
  const b=store.business(businessId);if(!b)throw Error('business_not_found');
  const tokens=(b.stores||[]).filter(x=>x.active).map(x=>x.store_token);
  if(!reader?.available())throw Error('commerce_source_unavailable');
  const expected=reader.expectedNet(tokens);
  for(const o of expected.rows){
    store.upsertSettlement({businessId,orderId:o.id,source:'SEABLUEPRINT_COMMERCE',storeToken:o.store_token,wallet:o.wallet,grossCents:Number(o.total_cents),refundCents:Number(o.refund_cents||0),currency:o.currency,paymentReference:o.payment_reference,settlementReference:o.payment_reference,settlementAt:Number(o.paid_at||o.updated_at),status:Number(o.net_cents)>0?'SETTLED':'REFUNDED'},{actor});
  }
  const summary=store.ledgerSummary(businessId),ledgerNet=Number(summary.net_cents||0),diff=ledgerNet-expected.expectedNetCents,den=Math.max(1,Math.abs(expected.expectedNetCents)),bps=clamp(Math.round((1-Math.abs(diff)/den)*10000),0,10000),status=diff===0?'PASS':'FAIL';
  return store.reconciliationPut({businessId,expectedNetCents:expected.expectedNetCents,ledgerNetCents:ledgerNet,differenceCents:diff,reconciliationBps:bps,qualifyingCount:expected.rows.length,refundCents:expected.refundCents,status,detail:{store_tokens:tokens,source_available:true}},{actor});
}

export function validateBusiness(store,businessId,{now=Date.now(),actor='validator'}={}){
  const b=store.business(businessId);if(!b)throw Error('business_not_found');const p=b.policy||{},s=store.ledgerSummary(businessId),rec=store.latestReconciliation(businessId),wallets=verifiedWallets(b);
  const count=Number(s.settled_count||0),net=Number(s.net_cents||0),gross=Number(s.gross_cents||0),refund=Number(s.refund_cents||0),latest=Number(s.latest_settlement_at||0),recBps=Number(rec?.reconciliation_bps||0),refundBps=gross>0?Math.round(refund/gross*10000):0,reasons=[];
  let state='CONNECTED';
  if(!b.kyb_verified||wallets.length===0){state='CONNECTED';reasons.push('identity_or_kyb_not_verified')}
  else if(b.status==='SUSPENDED'){state='VALIDATION_SUSPENDED';reasons.push('business_suspended')}
  else if(rec&&rec.status==='FAIL'){state='VALIDATION_SUSPENDED';reasons.push('reconciliation_failed')}
  else if(count===0){state='TRANSACTION_PENDING';reasons.push('no_settled_transactions')}
  else if(latest&&now-latest>Number(p.max_settlement_age_ms||2592000000)){state='VALIDATION_STALE';reasons.push('settlement_evidence_stale')}
  else if(count<Number(p.min_settled_count||1)||net<Number(p.min_settled_cents||0)){state='TRANSACTION_PENDING';reasons.push('minimum_settlement_evidence_not_met')}
  else if(recBps<Number(p.min_reconciliation_bps||10000)){state='VALIDATION_SUSPENDED';reasons.push('reconciliation_threshold_not_met')}
  else if(refundBps>Number(p.max_refund_bps||5000)){state='VALIDATION_SUSPENDED';reasons.push('refund_ratio_above_policy')}
  else state='TRANSACTION_VALIDATED';
  if(b.kyb_verified&&wallets.length>0&&state==='CONNECTED')state='IDENTITY_VERIFIED';
  const identityScore=b.kyb_verified&&wallets.length?25:0,settlementScore=count?25:0,reconciliationScore=Math.round(recBps/10000*25),recencyScore=latest?clamp(Math.round((1-(now-latest)/Math.max(1,Number(p.max_settlement_age_ms||2592000000)))*25),0,25):0,score=clamp(identityScore+settlementScore+reconciliationScore+recencyScore,0,100);
  return store.validationPut({businessId,state,score,reasons,settledCount:count,netSettledCents:net,latestSettlementAt:latest||null,reconciliationBps:recBps,refundBps},{actor});
}

export function distributionPreview(store,businessId,{investorAllocationBps,reserveBps=0,basis='NET_SETTLED_REVENUE',holders=[]}={}){
  const b=store.business(businessId);if(!b)throw Error('business_not_found');const v=store.latestValidation(businessId);if(v?.state!=='TRANSACTION_VALIDATED')throw Error('business_not_transaction_validated');const allocation=Number(investorAllocationBps),reserve=Number(reserveBps);if(!Number.isInteger(allocation)||allocation<0||allocation>10000||!Number.isInteger(reserve)||reserve<0||reserve>10000)throw Error('invalid_distribution_bps');const s=store.ledgerSummary(businessId),eligible=Math.max(0,Number(s.net_cents||0)),reserveCents=Math.floor(eligible*reserve/10000),afterReserve=eligible-reserveCents,distributable=Math.floor(afterReserve*allocation/10000);const clean=holders.map(h=>({wallet:String(h.wallet||'').toLowerCase(),units:Math.max(0,Math.trunc(Number(h.units||0)))})).filter(h=>h.wallet&&h.units>0),totalUnits=clean.reduce((n,h)=>n+h.units,0),snapshotHash=sha(JSON.stringify(clean)),manifestHash=sha(JSON.stringify({businessId,seriesId:b.series_id,basis,eligible,reserveCents,distributable,allocation,reserve,snapshotHash}));const entitlements=totalUnits?clean.map(h=>({...h,amount_cents:Math.floor(distributable*h.units/totalUnits)})):[];let assigned=entitlements.reduce((n,x)=>n+x.amount_cents,0),remainder=distributable-assigned;if(remainder>0&&entitlements.length)entitlements[0].amount_cents+=remainder;const manifest=store.distributionPut({businessId,seriesId:b.series_id,basis,eligibleRevenueCents:eligible,reserveCents,distributableCents:distributable,investorAllocationBps:allocation,reserveBps:reserve,snapshotHash,manifestHash});return{manifest,entitlements,total_units:totalUnits,conservation:entitlements.reduce((n,x)=>n+x.amount_cents,0)===distributable};
}
