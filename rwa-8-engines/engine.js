(()=>{
'use strict';
if(window.RWA8Engines?.version==='2.1.0')return;
const VERSION='2.1.0';
const STORAGE_KEY='rwa_global_business_passports_v2';
const EVENT_KEY='rwa_global_factory_events_v1';
const CONFIG_PATH='./config.json';
const JURISDICTIONS_PATH='./jurisdictions.json';
const UPSTREAMS_PATH='./upstreams.lock.json';
const nowIso=()=>new Date().toISOString();
const clean=v=>String(v??'').trim();
const upper=v=>clean(v).toUpperCase();
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const arr=v=>Array.isArray(v)?v:(v==null?[]:[v]);
function stableObject(obj){if(Array.isArray(obj))return obj.map(stableObject);if(obj&&typeof obj==='object')return Object.keys(obj).sort().reduce((o,k)=>(o[k]=stableObject(obj[k]),o),{});return obj}
async function sha256(value){const bytes=value instanceof ArrayBuffer?value:new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value));const hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function contentHash(obj){return sha256(JSON.stringify(stableObject(obj)))}
async function hashFile(file){if(!file?.arrayBuffer)return null;return sha256(await file.arrayBuffer())}
async function loadJson(path,fallback={}){try{const r=await fetch(`${path}?v=${VERSION}`,{cache:'no-store'});if(!r.ok)throw Error(String(r.status));return await r.json()}catch{return fallback}}
function normalizeBusiness(input={}){return{legalName:clean(input.legalName),tradingName:clean(input.tradingName||input.legalName),registrationId:clean(input.registrationId),country:upper(input.country||'ID'),businessType:clean(input.businessType||'Company'),website:clean(input.website),contactEmail:clean(input.contactEmail),declaredAt:nowIso()}}
function normalizeAsset(input={}){return{assetType:clean(input.assetType||'Other'),name:clean(input.name||input.assetType||'Asset'),description:clean(input.description),country:upper(input.country||'ID'),currency:upper(input.currency||'USD'),declaredValue:num(input.declaredValue),annualRevenue:num(input.annualRevenue),ebitdaMargin:num(input.ebitdaMargin),growthRate:num(input.growthRate),discountRate:num(input.discountRate),terminalGrowth:num(input.terminalGrowth),ownershipPercent:num(input.ownershipPercent)??100,externalRef:clean(input.externalRef),declaredAt:nowIso()}}
function normalizeEvidence(x={},i=0){return{id:clean(x.id||`EVIDENCE-${i+1}`),type:clean(x.type||'document'),name:clean(x.name||x.fileName||`Evidence ${i+1}`),issuer:clean(x.issuer),issuedAt:clean(x.issuedAt),source:clean(x.source),externalRef:clean(x.externalRef),fileSha256:clean(x.fileSha256),reviewStatus:upper(x.reviewStatus||'UNREVIEWED'),reviewer:clean(x.reviewer),reviewedAt:clean(x.reviewedAt)}}
function isApproved(v){return upper(v)==='APPROVED'}
function screeningFresh(screening,hours=24){if(!screening?.checkedAt)return false;const age=Date.now()-Date.parse(screening.checkedAt);return Number.isFinite(age)&&age>=0&&age<hours*60*60*1000}

async function passportEngine(businessInput={}){
 const business=normalizeBusiness(businessInput);const seed={legalName:business.legalName,registrationId:business.registrationId,country:business.country};const digest=await contentHash(seed);const id=`RWA-${business.country||'XX'}-${digest.slice(0,16).toUpperCase()}`;
 const credential={'@context':['https://www.w3.org/2018/credentials/v1','https://copytolive.github.io/rwa/contexts/business-rwa-v1'],type:['VerifiableCredential','BusinessRWAPassportCredential'],id:`urn:rwa:passport:${id}`,issuer:'did:web:copytolive.github.io:rwa',issuanceDate:nowIso(),credentialSubject:{id:`urn:rwa:business:${id}`,rwaBusinessId:id,...business},proofStatus:'UNSIGNED_UNTIL_IDENTITY_ADAPTER_CONNECTED'};
 const blockers=[];if(!business.legalName)blockers.push('LEGAL_NAME_REQUIRED');if(!business.country)blockers.push('COUNTRY_REQUIRED');
 return{engine:'passport',status:blockers.length?'INCOMPLETE':'CREATED',id,business,credential,blockers,upstream:'decentralized-identity/veramo'};
}

async function registryEngine(passport,assetsInput=[]){
 const assets=[];for(const raw of arr(assetsInput).filter(Boolean)){const asset=normalizeAsset(raw);const hash=await contentHash({business:passport.id,asset});assets.push({id:`RWA-ASSET-${hash.slice(0,16).toUpperCase()}`,owner:passport.id,...asset,status:'DECLARED'})}
 const graph={business:passport.id,assets:assets.map(a=>a.id),edges:assets.map(a=>({from:passport.id,to:a.id,type:'DECLARES_ASSET'})),updatedAt:nowIso()};
 return{engine:'registry',status:assets.length?'REGISTERED':'EMPTY',assets,graph,upstream:'hyperledger/firefly'};
}

async function proofEngine(passport,registry,evidenceInput=[]){
 const evidence=arr(evidenceInput).filter(Boolean).map(normalizeEvidence);const proofs=[];
 for(const row of evidence){const metadataHash=await contentHash({passport:passport.id,assets:registry.assets.map(a=>a.id),evidence:{...row,fileSha256:row.fileSha256||null}});proofs.push({...row,sha256:metadataHash,contentSha256:row.fileSha256||null,transparencyStatus:'LOCAL_HASH_ONLY',createdAt:nowIso()})}
 const packageHash=await contentHash({passport:passport.id,assets:registry.assets.map(a=>a.id),proofs:proofs.map(p=>[p.sha256,p.contentSha256])});const approved=proofs.filter(p=>isApproved(p.reviewStatus));
 return{engine:'proof',status:approved.length?'REVIEWED_EVIDENCE':proofs.length?'EVIDENCE_PRESENT':'NO_EVIDENCE',packageHash,proofs,approvedCount:approved.length,publishReady:false,upstream:'sigstore/rekor-tiles'};
}

function dcfValuation(asset){const revenue=num(asset.annualRevenue);if(!(revenue>0))return null;const margin=clamp((num(asset.ebitdaMargin)??15)/100,-1,1);const growth=clamp((num(asset.growthRate)??5)/100,-0.5,0.5);const discount=clamp((num(asset.discountRate)??15)/100,0.01,0.8);const terminal=clamp((num(asset.terminalGrowth)??2)/100,-0.1,Math.min(0.2,discount-0.005));let pv=0,rev=revenue;const forecast=[];for(let y=1;y<=5;y++){rev*=1+growth;const cash=rev*margin,discounted=cash/Math.pow(1+discount,y);pv+=discounted;forecast.push({year:y,revenue:rev,cashFlow:cash,presentValue:discounted})}const terminalCash=forecast.at(-1).cashFlow*(1+terminal),terminalValue=terminalCash/(discount-terminal),terminalPV=terminalValue/Math.pow(1+discount,5);return{method:'DCF_5Y',enterpriseValue:pv+terminalPV,forecast,assumptions:{margin,growth,discount,terminal},model:'RWA-DCF-v2'}}
function declaredValuation(asset){const v=num(asset.declaredValue);return v>0?{method:'DECLARED_VALUE',enterpriseValue:v,model:'DECLARED-v2'}:null}
async function valuationEngine(registry,review={}){
 const assets=registry.assets.map(asset=>{const valuation=dcfValuation(asset)||declaredValuation(asset);return{assetId:asset.id,currency:asset.currency||'USD',valuation,status:valuation?'MODELLED':'INSUFFICIENT_DATA'}});const total=assets.reduce((s,x)=>s+(x.valuation?.enterpriseValue||0),0),snapshotHash=await contentHash(assets);const independentApproved=review.valuationApproved===true&&clean(review.valuationReviewer)!=='';
 return{engine:'valuation',status:independentApproved?'INDEPENDENTLY_REVIEWED':assets.some(x=>x.valuation)?'MODELLED':'INSUFFICIENT_DATA',assets,totalModelValue:total,snapshotHash,asOf:nowIso(),independentReview:{approved:independentApproved,reviewer:clean(review.valuationReviewer),reviewedAt:independentApproved?nowIso():null},upstream:'lballabio/QuantLib',disclaimer:'Indicative model output only. Financeable status requires independent valuation/reviewer evidence.'};
}

function resolveJurisdiction(code,table){const k=upper(code);return{code:k,...(table?.default||{}),...(table?.jurisdictions?.[k]||{}),label:table?.jurisdictions?.[k]?.label||k||'Unknown'}}
async function legalEngine(passport,registry,mode='REGISTER',jurisdictions={},review={}){
 const requested=upper(mode||'REGISTER'),businessPolicy=resolveJurisdiction(passport.business.country,jurisdictions),assetCountries=[...new Set(registry.assets.map(a=>a.country).filter(Boolean))],assetPolicies=assetCountries.map(c=>resolveJurisdiction(c,jurisdictions));const approved=review.legalApproved===true&&clean(review.legalReviewer)!=='';const blockers=[];
 if(!passport.business.registrationId)blockers.push('BUSINESS_REGISTRATION_EVIDENCE_MISSING');if(!registry.assets.length)blockers.push('ASSET_MISSING');if(!['REGISTER','VERIFY','VALUE'].includes(requested)&&!approved)blockers.push('LICENSED_LEGAL_REVIEW_REQUIRED');
 return{engine:'legal',status:approved?'REVIEW_APPROVED':requested==='REGISTER'?'RECORD_ONLY_ALLOWED':'REVIEW_REQUIRED',requestedMode:requested,businessPolicy,assetPolicies,blockers,reviewerRequired:!['REGISTER'].includes(requested),reviewStatus:approved?'APPROVED':'PENDING',reviewer:approved?clean(review.legalReviewer):null,policyVersion:jurisdictions.version||'unknown',upstream:'open-policy-agent/opa',disclaimer:jurisdictions.disclaimer||'Product routing only; not legal advice.'};
}

async function complianceEngine(passport,proof,screening={},config={},review={}){
 const hours=Number(config?.screening?.freshnessHours||24),provider=clean(screening.provider),providerVerified=screening.providerVerified===true,clear=providerVerified&&upper(screening.status)==='CLEAR'&&screeningFresh(screening,hours),kybApproved=review.kybApproved===true&&clean(review.kybReviewer)!=='',evidenceApproved=proof.approvedCount>0,transferApproved=review.transferEligible===true&&clear&&kybApproved;const blockers=[];
 if(!passport.business.registrationId)blockers.push('KYB_BUSINESS_REGISTRATION_MISSING');if(!kybApproved)blockers.push('KYB_REVIEW_REQUIRED');if(!clear)blockers.push('SANCTIONS_PEP_SCREENING_REQUIRED');if(!evidenceApproved)blockers.push('EVIDENCE_REVIEW_REQUIRED');if(!transferApproved)blockers.push('TRANSFER_ELIGIBILITY_REVIEW_REQUIRED');
 return{engine:'compliance',status:clear&&kybApproved?'CLEAR':'PENDING',screening:{provider:provider||'NOT_CONNECTED',status:clear?'CLEAR':'PENDING',checkedAt:screening.checkedAt||null,providerVerified},kyb:{status:kybApproved?'APPROVED':'PENDING',reviewer:kybApproved?clean(review.kybReviewer):null},evidenceReview:evidenceApproved?'APPROVED_PRESENT':'PENDING',transferEligible:transferApproved,blockers,upstream:'opensanctions/yente + open-policy-agent/opa'};
}

async function factoryEngine({passport,registry,proof,valuation,legal,compliance,mode='REGISTER',config={},review={}}){
 const requested=upper(mode||'REGISTER'),registerReady=passport.status==='CREATED'&&registry.assets.length>0,verifiedReady=registerReady&&proof.approvedCount>0&&legal.reviewStatus==='APPROVED',valuedReady=verifiedReady&&valuation.independentReview.approved,financeReady=valuedReady&&compliance.status==='CLEAR',tokenizationReady=financeReady&&review.instrumentApproved===true&&clean(review.instrumentReviewer)!=='',tradeReady=tokenizationReady&&compliance.transferEligible===true&&config?.mainnet?.enabled===true&&config?.tokenDeployment?.enabled===true&&review.venueApproved===true;
 const terms={instrumentType:clean(review.instrumentType)||'UNDETERMINED',standard:'ERC-3643_COMPATIBLE_INTENT',network:'UNASSIGNED',supply:null,rights:'REVIEW_REQUIRED',transferPolicy:'REVIEW_REQUIRED',distributions:'REVIEW_REQUIRED'};const draftHash=await contentHash({passport:passport.id,assets:registry.assets.map(a=>a.id),valuation:valuation.snapshotHash,terms});
 let status='BLOCKED';if(requested==='REGISTER'&&registerReady)status='PASSPORT_READY';else if(requested==='VERIFY'&&verifiedReady)status='VERIFIED_READY';else if(requested==='VALUE'&&valuedReady)status='VALUED_READY';else if(requested==='FINANCE'&&financeReady)status='FINANCE_DRAFT_READY';else if(requested==='TOKENIZE'&&tokenizationReady)status='TOKENIZATION_DRAFT_READY';else if(requested==='TRADE'&&tradeReady)status='TRADE_DEPLOY_READY';
 return{engine:'factory',status,requestedMode:requested,terms,draftHash,registerReady,verifiedReady,valuedReady,financeReady,tokenizationReady,tradeReady,deployment:{enabled:false,network:null,address:null,reason:'Mainnet deployment remains disabled until explicit legal, compliance, custody, transfer, venue and operator gates are enabled.'},upstream:'hashgraph/asset-tokenization-studio',standards:['ERC-1400','ERC-3643']};
}

async function marketplaceEngine({passport,registry,valuation,factory,mode='REGISTER'}){
 const maturity=factory.tradeReady?'TRADABLE_RWA':factory.tokenizationReady?'TOKENIZATION_READY_RWA':factory.financeReady?'FINANCEABLE_RWA':factory.valuedReady?'VALUED_RWA':factory.verifiedReady?'VERIFIED_RWA':factory.registerReady?'REGISTERED_RWA':'INCOMPLETE_RWA';const listing={id:`LISTING-${passport.id}`,businessId:passport.id,businessName:passport.business.tradingName||passport.business.legalName,assetIds:registry.assets.map(a=>a.id),assetTypes:[...new Set(registry.assets.map(a=>a.assetType))],indicativeValue:valuation.totalModelValue,currencies:[...new Set(registry.assets.map(a=>a.currency))],visibility:factory.registerReady?'PUBLIC_DISCOVERY':'PRIVATE_DRAFT',execution:factory.tradeReady?'ELIGIBILITY_GATED':'DISABLED',maturity,requestedMode:upper(mode),createdAt:nowIso()};return{engine:'marketplace',status:factory.registerReady?'DISCOVERY_LISTING_READY':'DRAFT_ONLY',listing,executionAdapter:'0xProject/protocol (optional)',executionEnabled:factory.tradeReady,restriction:'Regulated financing or secondary trading requires eligible instrument, investor, jurisdiction, transfer policy and licensed venue/counterparty where applicable.'};
}

function determineMaturity(factory){return factory.tradeReady?'TRADABLE_RWA':factory.tokenizationReady?'TOKENIZATION_READY_RWA':factory.financeReady?'FINANCEABLE_RWA':factory.valuedReady?'VALUED_RWA':factory.verifiedReady?'VERIFIED_RWA':factory.registerReady?'REGISTERED_RWA':'INCOMPLETE_RWA'}
function blockersFrom(result){return[...(result.passport.blockers||[]),...(result.legal.blockers||[]),...(result.compliance.blockers||[])].filter((x,i,a)=>a.indexOf(x)===i)}
async function runPipeline(input={}){
 const [config,jurisdictions,upstreams]=await Promise.all([loadJson(CONFIG_PATH,{defaultMode:'REGISTER',mainnet:{enabled:false},tokenDeployment:{enabled:false}}),loadJson(JURISDICTIONS_PATH,{default:{finance:'REVIEW_REQUIRED',trade:'REVIEW_REQUIRED'}}),loadJson(UPSTREAMS_PATH,{upstreams:[]})]);const mode=upper(input.mode||config.defaultMode||'REGISTER'),review=input.review||{};
 const passport=await passportEngine(input.business||{}),registry=await registryEngine(passport,input.assets||[]),proof=await proofEngine(passport,registry,input.evidence||[]),valuation=await valuationEngine(registry,review),legal=await legalEngine(passport,registry,mode,jurisdictions,review),compliance=await complianceEngine(passport,proof,input.screening||{},config,review),factory=await factoryEngine({passport,registry,proof,valuation,legal,compliance,mode,config,review}),marketplace=await marketplaceEngine({passport,registry,valuation,factory,mode});
 const result={version:VERSION,program:'P21_GLOBAL_RWA_FACTORY',createdAt:nowIso(),mode,passport,registry,proof,valuation,legal,compliance,factory,marketplace,upstreams:upstreams.upstreams||[]};result.maturity=determineMaturity(factory);result.blockers=blockersFrom(result);result.pipelineHash=await contentHash({mode,passportId:passport.id,assetIds:registry.assets.map(a=>a.id),proof:proof.packageHash,valuation:valuation.snapshotHash,legal:legal.status,compliance:compliance.status,factory:factory.status,maturity:result.maturity});result.ready={register:factory.registerReady,verify:factory.verifiedReady,value:factory.valuedReady,finance:factory.financeReady,tokenize:factory.tokenizationReady,trade:factory.tradeReady};return result;
}

function loadSaved(){try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(x)?x:[]}catch{return[]}}
function savePassport(result){const all=loadSaved().filter(x=>x?.passport?.id!==result?.passport?.id);all.unshift(result);localStorage.setItem(STORAGE_KEY,JSON.stringify(all.slice(0,500)));recordEvent('passport_saved',{businessId:result?.passport?.id,maturity:result?.maturity});return all}
function removePassport(id){const all=loadSaved().filter(x=>x?.passport?.id!==id);localStorage.setItem(STORAGE_KEY,JSON.stringify(all));return all}
function recordEvent(type,detail={}){try{const rows=JSON.parse(localStorage.getItem(EVENT_KEY)||'[]');const out=Array.isArray(rows)?rows:[];out.unshift({type,detail,at:nowIso()});localStorage.setItem(EVENT_KEY,JSON.stringify(out.slice(0,1000)))}catch{}}
function northStar(){const rows=loadSaved(),active=rows.filter(x=>x?.ready?.register);return{metric:'businesses_with_active_rwa_passport',localActiveBusinesses:new Set(active.map(x=>x.passport?.id)).size,totalSavedPassports:rows.length,byMaturity:active.reduce((o,x)=>(o[x.maturity]=(o[x.maturity]||0)+1,o),{})}}
function exportJson(result){const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${result?.passport?.id||'rwa-passport'}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}

window.RWA8Engines={version:VERSION,runPipeline,passportEngine,registryEngine,proofEngine,valuationEngine,legalEngine,complianceEngine,factoryEngine,marketplaceEngine,hashFile,loadSaved,savePassport,removePassport,recordEvent,northStar,exportJson};
window.dispatchEvent(new CustomEvent('rwa:8-engines-ready',{detail:{version:VERSION,program:'P21_GLOBAL_RWA_FACTORY'}}));
})();
