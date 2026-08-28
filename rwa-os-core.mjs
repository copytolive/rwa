const SERIES_TYPES=['PROPERTY','AGRICULTURE','HOTEL','FRANCHISE','SME','RENTAL','ENERGY','INFRASTRUCTURE','CUSTOM'];
const BASES=['GROSS_REVENUE','NET_REVENUE','NET_PROFIT','RENTAL_INCOME','ROYALTY','HARVEST_PROCEEDS','CUSTOM'];
const FREQUENCIES=['DAILY','WEEKLY','MONTHLY','QUARTERLY','ANNUAL','MANUAL'];
const SNAPSHOTS=['RECORD_DATE','AVERAGE_BALANCE','TIME_WEIGHTED'];
const TX_STATES={CREATED:['PAID','CANCELLED'],PAID:['SETTLED','REFUNDED','CANCELLED'],SETTLED:['REFUNDED','REVERSED'],REFUNDED:[],REVERSED:[],CANCELLED:[]};
const normWallet=v=>String(v||'').trim().toLowerCase();
const int=v=>{const n=Number(v);if(!Number.isSafeInteger(n))throw Error('integer_required');return n};
const positiveInt=(v,label)=>{const n=int(v);if(n<=0)throw Error(`${label}_must_be_positive`);return n};
const bps=(v,label)=>{const n=int(v);if(n<0||n>10000)throw Error(`${label}_invalid_bps`);return n};
export const canonical=value=>Array.isArray(value)?value.map(canonical):(value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value);
export const canonicalJson=value=>JSON.stringify(canonical(value));
export async function sha256Hex(value){const bytes=new TextEncoder().encode(typeof value==='string'?value:canonicalJson(value));const hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')}
export const seriesTypes=()=>[...SERIES_TYPES];
export const distributionBases=()=>[...BASES];
export const frequencies=()=>[...FREQUENCIES];
export const snapshotPolicies=()=>[...SNAPSHOTS];

export function validateSeries(input={}){
  const id=String(input.id||'').trim().toUpperCase();
  if(!/^[A-Z0-9][A-Z0-9-]{4,63}$/.test(id))throw Error('invalid_series_id');
  const type=String(input.type||'').trim().toUpperCase();if(!SERIES_TYPES.includes(type))throw Error('invalid_series_type');
  const title=String(input.title||'').trim();if(title.length<3||title.length>160)throw Error('invalid_series_title');
  const issuer=String(input.issuer||'').trim();if(issuer.length<3)throw Error('issuer_required');
  const jurisdiction=String(input.jurisdiction||'').trim().toUpperCase();if(jurisdiction.length<2)throw Error('jurisdiction_required');
  const currency=String(input.currency||'USD').trim().toUpperCase();if(!/^[A-Z]{3,8}$/.test(currency))throw Error('invalid_currency');
  const totalUnits=positiveInt(input.totalUnits,'total_units');
  const economic=validateEconomicTerms(input.economic||{});
  const evidence=input.evidence&&typeof input.evidence==='object'?input.evidence:{};
  const required=['ownership','legal','valuation','issuer','disclosure'];
  const missingEvidence=required.filter(k=>!/^https:\/\//i.test(String(evidence[k]||'')));
  return{id,type,title,issuer,jurisdiction,currency,totalUnits,economic,evidence,missingEvidence,status:missingEvidence.length?'DRAFT_EVIDENCE_REQUIRED':String(input.status||'DRAFT').toUpperCase()};
}

export function validateEconomicTerms(e={}){
  const basis=String(e.basis||'NET_PROFIT').toUpperCase();if(!BASES.includes(basis))throw Error('invalid_distribution_basis');
  const investorAllocationBps=bps(e.investorAllocationBps??0,'investor_allocation');
  const reserveBps=bps(e.reserveBps??0,'reserve');
  const frequency=String(e.frequency||'QUARTERLY').toUpperCase();if(!FREQUENCIES.includes(frequency))throw Error('invalid_frequency');
  const snapshotPolicy=String(e.snapshotPolicy||'RECORD_DATE').toUpperCase();if(!SNAPSHOTS.includes(snapshotPolicy))throw Error('invalid_snapshot_policy');
  const payoutAsset=String(e.payoutAsset||'USDC').trim().toUpperCase();if(!payoutAsset)throw Error('payout_asset_required');
  const minimumPayoutMinor=Math.max(0,int(e.minimumPayoutMinor??0));
  const immutable={basis,investorAllocationBps,payoutAsset,holderUnitDefinition:String(e.holderUnitDefinition||'SERIES_UNIT').trim()||'SERIES_UNIT'};
  const governed={reserveBps,frequency,snapshotPolicy,minimumPayoutMinor,noticeSeconds:Math.max(0,int(e.noticeSeconds??86400))};
  return{immutable,governed};
}

export async function termsManifest(series){
  const s=validateSeries(series),immutableHash=await sha256Hex({seriesId:s.id,...s.economic.immutable}),governedHash=await sha256Hex({seriesId:s.id,...s.economic.governed});
  return{seriesId:s.id,immutable:s.economic.immutable,governed:s.economic.governed,immutableHash,governedHash,activationAllowed:s.missingEvidence.length===0,missingEvidence:s.missingEvidence};
}

export function transaction(input={}){
  const id=String(input.id||'').trim();if(!/^[A-Za-z0-9._:-]{8,128}$/.test(id))throw Error('invalid_transaction_id');
  const seriesId=String(input.seriesId||'').trim().toUpperCase();if(!seriesId)throw Error('series_required');
  const merchantId=String(input.merchantId||'').trim(),locationId=String(input.locationId||'').trim(),terminalId=String(input.terminalId||'').trim();if(!merchantId||!locationId||!terminalId)throw Error('merchant_location_terminal_required');
  const amountMinor=positiveInt(input.amountMinor,'amount');const currency=String(input.currency||'').trim().toUpperCase();if(!currency)throw Error('currency_required');
  const externalRef=String(input.externalRef||'').trim();if(!externalRef)throw Error('external_ref_required');
  const occurredAt=int(input.occurredAt??Date.now());
  return{id,seriesId,merchantId,locationId,terminalId,productId:String(input.productId||''),amountMinor,currency,externalRef,occurredAt,state:'CREATED',settledAt:null,refundedAt:null,reversedAt:null,metadata:input.metadata&&typeof input.metadata==='object'?input.metadata:{},events:[{state:'CREATED',at:occurredAt}]};
}
export function transitionTransaction(tx,next,{at=Date.now(),reason='',providerRef=''}={}){
  const n=String(next||'').toUpperCase(),allowed=TX_STATES[String(tx.state||'').toUpperCase()]||[];if(!allowed.includes(n))throw Error(`invalid_transaction_transition:${tx.state}->${n}`);
  const out={...tx,state:n,events:[...(tx.events||[]),{state:n,at:int(at),reason:String(reason||''),providerRef:String(providerRef||'')}]};
  if(n==='SETTLED')out.settledAt=int(at);if(n==='REFUNDED')out.refundedAt=int(at);if(n==='REVERSED')out.reversedAt=int(at);return out;
}
export const eligibleTransaction=tx=>String(tx?.state||'').toUpperCase()==='SETTLED'&&Number(tx.amountMinor)>0;
export function ledgerSummary(rows=[]){
  const seen=new Set(),duplicates=[];let created=0,paid=0,settled=0,refunded=0,reversed=0,cancelled=0,eligibleRevenueMinor=0;
  for(const tx of rows){if(seen.has(tx.externalRef))duplicates.push(tx.externalRef);seen.add(tx.externalRef);const s=String(tx.state||'').toUpperCase();if(s==='CREATED')created++;if(s==='PAID')paid++;if(s==='SETTLED'){settled++;eligibleRevenueMinor+=Number(tx.amountMinor||0)}if(s==='REFUNDED')refunded++;if(s==='REVERSED')reversed++;if(s==='CANCELLED')cancelled++}
  return{count:rows.length,created,paid,settled,refunded,reversed,cancelled,eligibleRevenueMinor,duplicateExternalRefs:[...new Set(duplicates)]};
}

export function calculateDistribution({terms,ledger=[],expensesMinor=0,deductionsMinor=0,royaltyEligibleMinor=null,customBaseMinor=null}={}){
  if(!terms?.immutable||!terms?.governed)throw Error('economic_terms_required');
  const gross=ledger.filter(eligibleTransaction).reduce((n,x)=>n+Number(x.amountMinor||0),0),expenses=Math.max(0,int(expensesMinor)),deductions=Math.max(0,int(deductionsMinor));
  let basisMinor=0;switch(terms.immutable.basis){case'GROSS_REVENUE':case'HARVEST_PROCEEDS':basisMinor=gross;break;case'NET_REVENUE':case'RENTAL_INCOME':basisMinor=Math.max(0,gross-deductions);break;case'NET_PROFIT':basisMinor=Math.max(0,gross-expenses-deductions);break;case'ROYALTY':basisMinor=Math.max(0,int(royaltyEligibleMinor??0));break;case'CUSTOM':basisMinor=Math.max(0,int(customBaseMinor??0));break;default:throw Error('unsupported_basis')}
  const reserveMinor=Math.floor(basisMinor*Number(terms.governed.reserveBps)/10000),afterReserveMinor=Math.max(0,basisMinor-reserveMinor),poolMinor=Math.floor(afterReserveMinor*Number(terms.immutable.investorAllocationBps)/10000);
  return{grossSettledMinor:gross,expensesMinor:expenses,deductionsMinor:deductions,basis:terms.immutable.basis,basisMinor,reserveMinor,afterReserveMinor,investorAllocationBps:terms.immutable.investorAllocationBps,poolMinor,payoutAsset:terms.immutable.payoutAsset};
}

function checkpointsByWallet(checkpoints=[]){const m=new Map();for(const c of checkpoints){const w=normWallet(c.wallet);if(!w||!Number.isFinite(Number(c.balance))||Number(c.balance)<0)throw Error('invalid_holder_checkpoint');if(!m.has(w))m.set(w,[]);m.get(w).push({wallet:w,balance:Number(c.balance),ts:int(c.ts)})}for(const a of m.values())a.sort((x,y)=>x.ts-y.ts);return m}
function balanceAt(arr,ts){let b=0;for(const c of arr){if(c.ts>ts)break;b=c.balance}return b}
export function holderSnapshot({checkpoints=[],policy='RECORD_DATE',recordAt=Date.now(),periodStart=null,periodEnd=null}={}){
  const p=String(policy).toUpperCase();if(!SNAPSHOTS.includes(p))throw Error('invalid_snapshot_policy');const by=checkpointsByWallet(checkpoints),rows=[];
  if(p==='RECORD_DATE'){for(const[w,a]of by){const weight=balanceAt(a,int(recordAt));if(weight>0)rows.push({wallet:w,weight,balance:weight})}}
  else if(p==='AVERAGE_BALANCE'){for(const[w,a]of by){const inside=a.filter(x=>(periodStart===null||x.ts>=periodStart)&&(periodEnd===null||x.ts<=periodEnd));if(!inside.length)continue;const weight=inside.reduce((n,x)=>n+x.balance,0)/inside.length;if(weight>0)rows.push({wallet:w,weight,balance:balanceAt(a,int(periodEnd??recordAt))})}}
  else {const start=int(periodStart),end=int(periodEnd);if(end<=start)throw Error('invalid_snapshot_period');for(const[w,a]of by){let last=start,b=balanceAt(a,start),area=0;for(const c of a){if(c.ts<=start)continue;if(c.ts>end)break;area+=b*(c.ts-last);last=c.ts;b=c.balance}area+=b*(end-last);const weight=area/(end-start);if(weight>0)rows.push({wallet:w,weight,balance:b})}}
  rows.sort((a,b)=>a.wallet.localeCompare(b.wallet));return{policy:p,recordAt:int(recordAt),periodStart,periodEnd,holders:rows,totalWeight:rows.reduce((n,x)=>n+x.weight,0)};
}
export function allocateEntitlements(poolMinor,snapshot,{minimumPayoutMinor=0}={}){
  const pool=Math.max(0,int(poolMinor)),min=Math.max(0,int(minimumPayoutMinor));if(!snapshot?.holders?.length||snapshot.totalWeight<=0)return{poolMinor:pool,allocatedMinor:0,withheldMinor:pool,entitlements:[]};
  const raw=snapshot.holders.map(h=>({wallet:h.wallet,weight:h.weight,raw:pool*h.weight/snapshot.totalWeight}));let rows=raw.map(x=>({...x,amountMinor:Math.floor(x.raw),fraction:x.raw-Math.floor(x.raw)}));let remainder=pool-rows.reduce((n,x)=>n+x.amountMinor,0);rows.sort((a,b)=>b.fraction-a.fraction||a.wallet.localeCompare(b.wallet));for(let i=0;i<remainder;i++)rows[i%rows.length].amountMinor++;rows.sort((a,b)=>a.wallet.localeCompare(b.wallet));let withheld=0;const entitlements=[];for(const x of rows){if(x.amountMinor<min){withheld+=x.amountMinor;continue}entitlements.push({wallet:x.wallet,amountMinor:x.amountMinor,weight:x.weight})}const allocated=entitlements.reduce((n,x)=>n+x.amountMinor,0);return{poolMinor:pool,allocatedMinor:allocated,withheldMinor:pool-allocated,minimumPayoutMinor:min,entitlements};
}
export async function distributionManifest({seriesId,periodId,calculation,snapshot,allocation,evidenceUrls=[]}={}){
  if(!seriesId||!periodId)throw Error('series_period_required');if(!calculation||!snapshot||!allocation)throw Error('distribution_inputs_required');if(allocation.allocatedMinor>calculation.poolMinor)throw Error('allocation_exceeds_pool');
  const body={schema:1,seriesId:String(seriesId).toUpperCase(),periodId:String(periodId),calculation,snapshotPolicy:snapshot.policy,snapshotAt:snapshot.recordAt,totalWeight:snapshot.totalWeight,entitlements:allocation.entitlements,poolMinor:calculation.poolMinor,allocatedMinor:allocation.allocatedMinor,withheldMinor:allocation.withheldMinor,payoutAsset:calculation.payoutAsset,evidenceUrls:[...evidenceUrls]};
  return{...body,manifestHash:await sha256Hex(body),status:'AWAITING_AUTHORIZED_FUNDING_AND_PAYOUT'};
}
export async function auditOperatingSystem({series,ledger=[],distribution=null}={}){
  const issues=[];let s=null;try{s=validateSeries(series)}catch(e){issues.push(String(e.message||e))}const summary=ledgerSummary(ledger);if(summary.duplicateExternalRefs.length)issues.push('duplicate_external_reference');if(s?.missingEvidence.length)issues.push('asset_evidence_incomplete');if(distribution&&distribution.allocatedMinor>distribution.poolMinor)issues.push('distribution_overallocated');for(const tx of ledger){if(tx.state==='SETTLED'&&!tx.settledAt)issues.push(`settlement_timestamp_missing:${tx.id}`);if(['REFUNDED','REVERSED'].includes(tx.state)&&eligibleTransaction(tx))issues.push(`reversal_still_eligible:${tx.id}`)}
  const audit={schema:1,seriesId:s?.id||String(series?.id||''),ledger:summary,distribution:distribution?{poolMinor:distribution.poolMinor,allocatedMinor:distribution.allocatedMinor,manifestHash:distribution.manifestHash||null}:null,issues:[...new Set(issues)],ok:issues.length===0};return{...audit,auditHash:await sha256Hex(audit)};
}
export function transactionCodePayload(tx){return{v:1,ref:tx.id,series:tx.seriesId,merchant:tx.merchantId,location:tx.locationId,terminal:tx.terminalId,amountMinor:tx.amountMinor,currency:tx.currency,externalRef:tx.externalRef,occurredAt:tx.occurredAt}}
export async function transactionCode(tx){const payload=transactionCodePayload(tx),digest=(await sha256Hex(payload)).slice(0,16).toUpperCase();return{reference:`RWA-${tx.seriesId.replace(/[^A-Z0-9]/g,'').slice(0,12)}-${digest}`,payload,payloadHash:await sha256Hex(payload)}}

export const RWA_OS_VERSION='14.0.0';
