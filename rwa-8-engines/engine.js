(()=>{
'use strict';
if(window.RWA8Engines?.version==='1.0.0')return;

const VERSION='1.0.0';
const STORAGE_KEY='rwa_global_business_passports_v1';
const CONFIG_PATH='./config.json';
const JURISDICTIONS_PATH='./jurisdictions.json';
const UPSTREAMS_PATH='./upstreams.lock.json';
const nowIso=()=>new Date().toISOString();
const upper=v=>String(v||'').trim().toUpperCase();
const clean=v=>String(v||'').trim();
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));

async function sha256(value){
  const bytes=new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value));
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function stableObject(obj){
  if(Array.isArray(obj))return obj.map(stableObject);
  if(obj&&typeof obj==='object')return Object.keys(obj).sort().reduce((o,k)=>(o[k]=stableObject(obj[k]),o),{});
  return obj;
}
async function contentHash(obj){return sha256(JSON.stringify(stableObject(obj)))}
async function loadJson(path,fallback={}){try{const r=await fetch(`${path}?v=${VERSION}`,{cache:'no-store'});if(!r.ok)throw Error(String(r.status));return await r.json()}catch{return fallback}}

function normalizeBusiness(input={}){
  return{
    legalName:clean(input.legalName),
    tradingName:clean(input.tradingName||input.legalName),
    registrationId:clean(input.registrationId),
    country:upper(input.country||'ID'),
    businessType:clean(input.businessType||'Company'),
    website:clean(input.website),
    contactEmail:clean(input.contactEmail),
    declaredAt:nowIso()
  };
}
function normalizeAsset(input={}){
  return{
    assetType:clean(input.assetType||'Business Asset'),
    name:clean(input.name||input.assetType||'Asset'),
    description:clean(input.description),
    country:upper(input.country||'ID'),
    currency:upper(input.currency||'USD'),
    declaredValue:num(input.declaredValue),
    annualRevenue:num(input.annualRevenue),
    ebitdaMargin:num(input.ebitdaMargin),
    growthRate:num(input.growthRate),
    discountRate:num(input.discountRate),
    terminalGrowth:num(input.terminalGrowth),
    ownershipPercent:num(input.ownershipPercent)??100,
    declaredAt:nowIso()
  };
}

async function passportEngine(businessInput){
  const business=normalizeBusiness(businessInput);
  const seed={legalName:business.legalName,registrationId:business.registrationId,country:business.country};
  const digest=await contentHash(seed);
  const id=`RWA-${business.country}-${digest.slice(0,16).toUpperCase()}`;
  const credential={
    '@context':['https://www.w3.org/2018/credentials/v1','https://copytolive.github.io/rwa/contexts/business-rwa-v1'],
    type:['VerifiableCredential','BusinessRWAPassportCredential'],
    id:`urn:rwa:passport:${id}`,
    issuer:'did:web:copytolive.github.io:rwa',
    issuanceDate:nowIso(),
    credentialSubject:{id:`urn:rwa:business:${id}`,rwaBusinessId:id,...business},
    proofStatus:'UNSIGNED_DEMO'
  };
  return{engine:'passport',status:business.legalName&&business.country?'CREATED':'INCOMPLETE',id,business,credential,upstream:'decentralized-identity/veramo'};
}

async function registryEngine(passport,assetsInput=[]){
  const rows=(Array.isArray(assetsInput)?assetsInput:[assetsInput]).map(normalizeAsset);
  const assets=[];
  for(const asset of rows){
    const hash=await contentHash({business:passport.id,asset});
    assets.push({id:`RWA-ASSET-${hash.slice(0,16).toUpperCase()}`,owner:passport.id,...asset,status:'DECLARED'});
  }
  const graph={business:passport.id,assets:assets.map(a=>a.id),edges:assets.map(a=>({from:passport.id,to:a.id,type:'DECLARES_ASSET'})),updatedAt:nowIso()};
  return{engine:'registry',status:assets.length?'REGISTERED':'EMPTY',assets,graph,upstream:'hyperledger-firefly/firefly'};
}

async function proofEngine(passport,registry,evidenceInput=[]){
  const evidence=(Array.isArray(evidenceInput)?evidenceInput:[evidenceInput]).filter(Boolean).map((x,i)=>({
    id:clean(x.id||`EVIDENCE-${i+1}`),
    type:clean(x.type||'document'),
    name:clean(x.name||x.fileName||`Evidence ${i+1}`),
    issuer:clean(x.issuer),
    issuedAt:clean(x.issuedAt),
    source:clean(x.source),
    reviewStatus:upper(x.reviewStatus||'UNREVIEWED')
  }));
  const proofs=[];
  for(const row of evidence){
    const hash=await contentHash({passport:passport.id,assets:registry.assets.map(a=>a.id),evidence:row});
    proofs.push({...row,sha256:hash,transparencyStatus:'LOCAL_HASH_ONLY',createdAt:nowIso()});
  }
  const packageHash=await contentHash({passport:passport.id,assets:registry.assets.map(a=>a.id),proofs:proofs.map(p=>p.sha256)});
  return{engine:'proof',status:proofs.length?'HASHED':'NO_EVIDENCE',packageHash,proofs,upstream:'sigstore/rekor-tiles',publishReady:false};
}

function dcfValuation(asset){
  const revenue=num(asset.annualRevenue);
  if(!(revenue>0))return null;
  const margin=clamp((num(asset.ebitdaMargin)??15)/100,-1,1);
  const growth=clamp((num(asset.growthRate)??5)/100,-0.5,0.5);
  const discount=clamp((num(asset.discountRate)??15)/100,0.01,0.8);
  const terminal=clamp((num(asset.terminalGrowth)??2)/100,-0.1,Math.min(0.2,discount-0.005));
  let pv=0,rev=revenue;
  const forecast=[];
  for(let y=1;y<=5;y++){
    rev*=1+growth;
    const cash=rev*margin;
    const discounted=cash/Math.pow(1+discount,y);
    pv+=discounted;
    forecast.push({year:y,revenue:rev,cashFlow:cash,presentValue:discounted});
  }
  const terminalCash=forecast.at(-1).cashFlow*(1+terminal);
  const terminalValue=terminalCash/(discount-terminal);
  const terminalPV=terminalValue/Math.pow(1+discount,5);
  const enterpriseValue=pv+terminalPV;
  return{method:'DCF_5Y',enterpriseValue,forecast,assumptions:{margin,growth,discount,terminal},model:'RWA-DCF-v1'};
}
function declaredValuation(asset){
  const v=num(asset.declaredValue);return v>0?{method:'DECLARED_VALUE',enterpriseValue:v,model:'DECLARED-v1'}:null;
}
async function valuationEngine(registry){
  const assets=registry.assets.map(asset=>{
    const model=dcfValuation(asset)||declaredValuation(asset);
    return{assetId:asset.id,currency:asset.currency||'USD',valuation:model,status:model?'MODELLED':'INSUFFICIENT_DATA'};
  });
  const total=assets.reduce((s,x)=>s+(x.valuation?.enterpriseValue||0),0);
  const snapshotHash=await contentHash(assets);
  return{engine:'valuation',status:assets.some(x=>x.valuation)?'MODELLED':'INSUFFICIENT_DATA',assets,totalModelValue:total,snapshotHash,asOf:nowIso(),upstream:'lballabio/QuantLib',disclaimer:'Indicative model output only; independent valuation/reviewer evidence may be required.'};
}

function resolveJurisdiction(code,table){
  const k=upper(code);return table?.jurisdictions?.[k]||{...(table?.default||{}),label:k||'Unknown'};
}
async function legalEngine(passport,registry,mode='REGISTER',jurisdictions={}){
  const assetCountries=[...new Set(registry.assets.map(a=>a.country).filter(Boolean))];
  const businessPolicy=resolveJurisdiction(passport.business.country,jurisdictions);
  const assetPolicies=assetCountries.map(c=>({country:c,...resolveJurisdiction(c,jurisdictions)}));
  const requested=upper(mode||'REGISTER');
  let decision='REVIEW_REQUIRED';
  if(requested==='REGISTER')decision='ALLOWED';
  const blockers=[];
  if(!passport.business.registrationId)blockers.push('BUSINESS_REGISTRATION_EVIDENCE_MISSING');
  if(!registry.assets.length)blockers.push('ASSET_MISSING');
  if(requested!=='REGISTER')blockers.push('LICENSED_LEGAL_REVIEW_REQUIRED');
  return{
    engine:'legal',status:decision,requestedMode:requested,businessPolicy,assetPolicies,blockers,
    reviewerRequired:requested!=='REGISTER',reviewStatus:'PENDING',policyVersion:jurisdictions.version||'unknown',
    upstream:'open-policy-agent/opa',disclaimer:jurisdictions.disclaimer||'Product routing only; not legal advice.'
  };
}

function screeningFresh(screening){
  if(!screening?.checkedAt)return false;
  const age=Date.now()-Date.parse(screening.checkedAt);return Number.isFinite(age)&&age>=0&&age<24*60*60*1000;
}
async function complianceEngine(passport,proof,screening={}){
  const provider=clean(screening.provider);
  const providerVerified=screening.providerVerified===true;
  const clear=providerVerified&&upper(screening.status)==='CLEAR'&&screeningFresh(screening);
  const evidenceReviewed=proof.proofs.some(p=>p.reviewStatus==='APPROVED');
  return{
    engine:'compliance',status:clear?'CLEAR':'PENDING',
    screening:{provider:provider||'NOT_CONNECTED',status:clear?'CLEAR':'PENDING',checkedAt:screening.checkedAt||null,providerVerified},
    kyb:passport.business.registrationId?'DATA_PRESENT':'MISSING',
    evidenceReview:evidenceReviewed?'PARTIAL_APPROVED':'PENDING',
    transferEligible:false,
    blockers:[...(!clear?['SANCTIONS_PEP_SCREENING_REQUIRED']:[]),...(!evidenceReviewed?['EVIDENCE_REVIEW_REQUIRED']:[])],
    upstream:'opensanctions/yente + open-policy-agent/opa'
  };
}

async function factoryEngine({passport,registry,proof,valuation,legal,compliance,mode='REGISTER',config={}}){
  const requested=upper(mode||'REGISTER');
  const registerReady=passport.status==='CREATED'&&registry.assets.length>0;
  const reviewerApproved=legal.reviewStatus==='APPROVED';
  const complianceClear=compliance.status==='CLEAR';
  const evidenceApproved=proof.proofs.some(p=>p.reviewStatus==='APPROVED');
  const financeReady=registerReady&&reviewerApproved&&complianceClear&&evidenceApproved;
  const tradeReady=financeReady&&compliance.transferEligible===true&&config?.mainnet?.enabled===true&&config?.tokenDeployment?.enabled===true;
  const terms={
    instrumentType:'UNDETERMINED',standard:'ERC-3643_COMPATIBLE_INTENT',network:'UNASSIGNED',
    supply:null,rights:'REVIEW_REQUIRED',transferPolicy:'REVIEW_REQUIRED',distributions:'REVIEW_REQUIRED'
  };
  const draftHash=await contentHash({passport:passport.id,assets:registry.assets.map(a=>a.id),valuation:valuation.snapshotHash,terms});
  return{
    engine:'factory',status:requested==='REGISTER'?(registerReady?'PASSPORT_READY':'BLOCKED'):requested==='FINANCE'?(financeReady?'FINANCE_DRAFT_READY':'BLOCKED'):(tradeReady?'TRADE_DEPLOY_READY':'BLOCKED'),
    requestedMode:requested,terms,draftHash,registerReady,financeReady,tradeReady,
    deployment:{enabled:false,network:null,address:null,reason:'Explicit legal/compliance/reviewer/mainnet gates required'},
    upstream:'hashgraph/asset-tokenization-studio',standards:['ERC-1400','ERC-3643']
  };
}

async function marketplaceEngine({passport,registry,valuation,factory,mode='REGISTER'}){
  const requested=upper(mode||'REGISTER');
  const level=factory.tradeReady?'TRADING_ELIGIBLE':factory.financeReady?'FINANCING_ELIGIBLE':'DISCOVERY_ONLY';
  const listing={
    id:`LISTING-${passport.id}`,
    businessId:passport.id,
    businessName:passport.business.tradingName||passport.business.legalName,
    assetIds:registry.assets.map(a=>a.id),
    indicativeValue:valuation.totalModelValue,
    currencies:[...new Set(registry.assets.map(a=>a.currency))],
    visibility:'PUBLIC_DISCOVERY',
    execution:'DISABLED',
    level,
    requestedMode:requested,
    createdAt:nowIso()
  };
  return{engine:'marketplace',status:'LISTING_READY',listing,executionAdapter:'0xProject/protocol (optional)',executionEnabled:false,restriction:'Regulated secondary trading requires eligible investor, instrument, transfer policy and licensed venue where applicable.'};
}

async function runPipeline(input={}){
  const [config,jurisdictions,upstreams]=await Promise.all([
    loadJson(CONFIG_PATH,{mainnet:{enabled:false},tokenDeployment:{enabled:false}}),
    loadJson(JURISDICTIONS_PATH,{default:{register:'ALLOWED',finance:'REVIEW_REQUIRED',trade:'REVIEW_REQUIRED'}}),
    loadJson(UPSTREAMS_PATH,{upstreams:[]})
  ]);
  const mode=upper(input.mode||config.defaultMode||'REGISTER');
  const passport=await passportEngine(input.business||{});
  const registry=await registryEngine(passport,input.assets||[]);
  const proof=await proofEngine(passport,registry,input.evidence||[]);
  const valuation=await valuationEngine(registry);
  const legal=await legalEngine(passport,registry,mode,jurisdictions);
  if(input.review?.legalApproved===true){legal.reviewStatus='APPROVED';legal.status=mode==='REGISTER'?'ALLOWED':'REVIEW_APPROVED';legal.blockers=legal.blockers.filter(x=>x!=='LICENSED_LEGAL_REVIEW_REQUIRED')}
  const compliance=await complianceEngine(passport,proof,input.screening||{});
  if(input.review?.transferEligible===true&&compliance.status==='CLEAR')compliance.transferEligible=true;
  const factory=await factoryEngine({passport,registry,proof,valuation,legal,compliance,mode,config});
  const marketplace=await marketplaceEngine({passport,registry,valuation,factory,mode});
  const result={version:VERSION,createdAt:nowIso(),mode,passport,registry,proof,valuation,legal,compliance,factory,marketplace,upstreams:upstreams.upstreams||[]};
  result.pipelineHash=await contentHash({mode,passportId:passport.id,assetIds:registry.assets.map(a=>a.id),proof:proof.packageHash,valuation:valuation.snapshotHash,legal:legal.status,compliance:compliance.status,factory:factory.status});
  result.ready={register:factory.registerReady,finance:factory.financeReady,trade:factory.tradeReady};
  return result;
}

function loadSaved(){try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(x)?x:[]}catch{return[]}}
function savePassport(result){
  const all=loadSaved().filter(x=>x?.passport?.id!==result?.passport?.id);
  all.unshift(result);localStorage.setItem(STORAGE_KEY,JSON.stringify(all.slice(0,100)));return all;
}
function removePassport(id){const all=loadSaved().filter(x=>x?.passport?.id!==id);localStorage.setItem(STORAGE_KEY,JSON.stringify(all));return all}
function exportJson(result){
  const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${result?.passport?.id||'rwa-passport'}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

window.RWA8Engines={version:VERSION,runPipeline,passportEngine,registryEngine,proofEngine,valuationEngine,legalEngine,complianceEngine,factoryEngine,marketplaceEngine,loadSaved,savePassport,removePassport,exportJson};
window.dispatchEvent(new CustomEvent('rwa:8-engines-ready',{detail:{version:VERSION}}));
})();
