import fs from 'node:fs';
import {verifyMessage} from 'ethers';
import {probeEvidencePayload,probePublicEvidence,publicHttps,RWA_EVIDENCE_POLICY} from './rwa-evidence-policy.mjs';

const fail=(msg)=>{fs.writeFileSync('verify-error.txt',String(msg));console.error(msg);process.exit(1)};
const text=(v,n=240)=>String(v??'').trim().slice(0,n);
const finite=(v,{min=-Infinity,max=Infinity}={})=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)throw Error(`Invalid numeric fundamentals value: ${v}`);return n};
const cleanDate=v=>{const s=text(v,40);if(!s)return'';const d=new Date(s);if(Number.isNaN(+d))throw Error(`Invalid fundamentals date: ${s}`);return s};
const allowedIncome=new Set(['none','dividend','rental','coupon','revenue-share','profit-share','royalty']);

function sanitizeFundamentals(raw){
  if(!raw||typeof raw!=='object')return null;
  const r=raw,token=r.token||{},income=r.income||{},cash=r.cashflow||{},fin=r.financials||{},val=r.valuation||{},asset=r.asset||{};
  const symbol=text(token.symbol,20).toUpperCase();
  if(symbol&&!/^[A-Z0-9._-]{2,20}$/.test(symbol))throw Error('Invalid RWA token symbol');
  const currency=(text(token.currency,6).toUpperCase()||'USD');
  if(!/^[A-Z]{3,6}$/.test(currency))throw Error('Invalid RWA fundamentals currency');
  const type=text(income.type||'none',32).toLowerCase();
  if(!allowedIncome.has(type))throw Error(`Unsupported income-right type: ${type}`);
  const incomeEvidence=text(income.evidence_url,1200);
  if(type!=='none'&&!publicHttps(incomeEvidence))throw Error('Income-bearing RWA requires public HTTPS income-right evidence');
  const history=Array.isArray(income.history)?income.history.slice(-120).map(x=>({period:text(x?.period||x?.date,40),date:cleanDate(x?.date||''),amount_per_token:finite(x?.amount_per_token??x?.amount,{min:0})})).filter(x=>x.period||x.date):[];
  const periods=Array.isArray(fin.periods)?fin.periods.slice(-40).map(x=>({period:text(x?.period,40),revenue:finite(x?.revenue,{min:0}),noi:finite(x?.noi),distribution:finite(x?.distribution,{min:0})})).filter(x=>x.period):[];
  const finEvidence=text(fin.evidence_url,1200),valEvidence=text(val.evidence_url,1200);
  if(periods.length&&!publicHttps(finEvidence))throw Error('Published RWA financial periods require public HTTPS financial evidence');
  if(valEvidence&&!publicHttps(valEvidence))throw Error('Valuation evidence must be public HTTPS');
  const calendar=Array.isArray(r.calendar)?r.calendar.slice(0,80).map(x=>({date:cleanDate(x?.date||''),type:text(x?.type||x?.title,80),detail:text(x?.detail||x?.description,240),status:text(x?.status||'SCHEDULED',40)})).filter(x=>x.date):[];
  const audit=Array.isArray(r.audit)?r.audit.slice(-200).map(x=>({date:cleanDate(x?.date||x?.ts||''),event:text(x?.event||x?.type,120),actor:text(x?.actor||x?.source,120)})).filter(x=>x.date||x.event):[];
  return{
    schema:1,
    token:{symbol,currency,supply:finite(token.supply,{min:0}),holders:finite(token.holders,{min:0}),tokenized_value:finite(token.tokenized_value,{min:0}),tokenized_ownership:finite(token.tokenized_ownership,{min:0,max:100})},
    income:{type,frequency:text(income.frequency,40),ttm_per_token:finite(income.ttm_per_token,{min:0}),current_yield:finite(income.current_yield,{min:0,max:10000}),next_per_token:finite(income.next_per_token,{min:0}),record_date:cleanDate(income.record_date||''),payment_date:cleanDate(income.payment_date||''),coverage_ratio:finite(income.coverage_ratio,{min:0}),evidence_url:incomeEvidence,history},
    cashflow:{gross_income:finite(cash.gross_income,{min:0}),opex:finite(cash.opex,{min:0}),debt_reserve_tax:finite(cash.debt_reserve_tax,{min:0}),net_distributable:finite(cash.net_distributable),distribution_paid:finite(cash.distribution_paid,{min:0}),reserve:finite(cash.reserve,{min:0})},
    financials:{periods,evidence_url:finEvidence},
    valuation:{nav_per_token:finite(val.nav_per_token,{min:0}),appraised_value:finite(val.appraised_value,{min:0}),income_fair_value:finite(val.income_fair_value,{min:0}),model_fair_value:finite(val.model_fair_value,{min:0}),debt:finite(val.debt,{min:0}),evidence_url:valEvidence},
    asset:{land_area:finite(asset.land_area,{min:0}),building_area:finite(asset.building_area,{min:0}),title:text(asset.title,160),manager:text(asset.manager,160),appraiser:text(asset.appraiser,160),insurer:text(asset.insurer,160),occupancy:finite(asset.occupancy,{min:0,max:100}),rent_per_m2:finite(asset.rent_per_m2,{min:0}),wault:finite(asset.wault,{min:0}),noi_margin:finite(asset.noi_margin,{min:-100,max:100}),cap_rate:finite(asset.cap_rate,{min:-100,max:100}),ltv:finite(asset.ltv,{min:0,max:1000}),dscr:finite(asset.dscr,{min:0})},
    calendar,audit
  };
}

try{
  const body=process.env.ISSUE_BODY||'';
  const m=body.match(/```json\s*([\s\S]*?)```/i);
  if(!m)fail('Missing JSON approval package');
  const pkg=JSON.parse(m[1]);
  const p=pkg?.payload||{};
  if(!p.asset?.name||!p.reviewer||!pkg.signature||!pkg.message)fail('Incomplete approval package');
  const expected=`RWA VERIFIED APPROVAL\n${JSON.stringify(p)}`;
  if(pkg.message!==expected)fail('Approval message does not match payload');
  const recovered=verifyMessage(pkg.message,pkg.signature).toLowerCase();
  const reviewer=String(p.reviewer).toLowerCase();
  if(recovered!==reviewer)fail('Reviewer signature mismatch');
  const reviewers=JSON.parse(fs.readFileSync('rwa-reviewers.json','utf8')).reviewers||[];
  const allow=reviewers.map(x=>typeof x==='string'?x:x.wallet).filter(Boolean).map(x=>String(x).toLowerCase());
  if(!allow.includes(reviewer))fail('Reviewer wallet is not authorized');

  const probes=await probeEvidencePayload(p);
  const fundamentals=sanitizeFundamentals(p.fundamentals);
  const fundamentalsProbes=[];
  if(fundamentals?.income?.type!=='none')fundamentalsProbes.push(await probePublicEvidence('income-right',fundamentals.income.evidence_url));
  if(fundamentals?.financials?.periods?.length)fundamentalsProbes.push(await probePublicEvidence('financials',fundamentals.financials.evidence_url));
  if(fundamentals?.valuation?.evidence_url)fundamentalsProbes.push(await probePublicEvidence('valuation',fundamentals.valuation.evidence_url));

  const reg=JSON.parse(fs.readFileSync('rwa-assets.json','utf8'));
  const id=String(p.asset.id||p.asset.name);
  const verified={
    id,
    name:String(p.asset.name),
    type:String(p.asset.type||'Real World Asset'),
    nav:Number(p.asset.nav),
    yield:Number(p.asset.yield||0),
    location:String(p.asset.location||''),
    document:String(p.asset.document||p.legal||''),
    issuer:String(p.issuer),
    ownership:String(p.ownership),
    appraisal:String(p.appraisal),
    legal:String(p.legal),
    kyb:String(p.kyb),
    disclosure:String(p.disclosure),
    ownership_document:String(p.ownership),
    appraisal_document:String(p.appraisal),
    legal_document:String(p.legal),
    kyb_document:String(p.kyb),
    disclosure_document:String(p.disclosure),
    nav_history:Array.isArray(p.nav)?p.nav:[],
    fundamentals,
    reviewer,
    reviewer_approved_at:new Date(Number(p.approved_at)).toISOString(),
    verified_at:new Date().toISOString(),
    approval_signature:String(pkg.signature),
    evidence_policy:RWA_EVIDENCE_POLICY,
    evidence_checked_at:new Date().toISOString(),
    evidence_probes:probes,
    fundamentals_evidence_policy:'supplemental-public-https-probed-v1',
    fundamentals_evidence_probes:fundamentalsProbes,
    status:'VERIFIED'
  };
  reg.schema=Math.max(Number(reg.schema||1),3);reg.verified=Array.isArray(reg.verified)?reg.verified:[];
  const i=reg.verified.findIndex(x=>String(x.id)===id||String(x.name).toLowerCase()===verified.name.toLowerCase());
  if(i>=0)reg.verified[i]=verified;else reg.verified.unshift(verified);
  reg.updated_at=new Date().toISOString().slice(0,10);
  fs.writeFileSync('rwa-assets.json',JSON.stringify(reg,null,2)+'\n');
  fs.writeFileSync('verify-success.txt',JSON.stringify({id,name:verified.name,reviewer,verified_at:verified.verified_at,evidence_policy:RWA_EVIDENCE_POLICY,fundamentals:!!fundamentals,fundamentals_evidence_probes:fundamentalsProbes.length}));
  console.log(`VERIFIED ${verified.name} by ${reviewer} · ${RWA_EVIDENCE_POLICY} · fundamentals ${fundamentals?'attached':'none'}`);
}catch(e){fail(e?.stack||e)}
