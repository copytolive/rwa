import fs from 'node:fs';
import { verifyMessage } from 'ethers';

const fail=(msg)=>{fs.writeFileSync('verify-error.txt',String(msg));console.error(msg);process.exit(1)};
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
  const required=['issuer','ownership','appraisal','legal','kyb','disclosure'];
  if(!required.every(k=>p.checks?.[k]===true))fail('Verification checklist is incomplete');
  for(const k of ['issuer','ownership','appraisal','legal'])if(!String(p[k]||'').trim())fail(`Missing ${k} evidence`);
  const reg=JSON.parse(fs.readFileSync('rwa-assets.json','utf8'));
  const id=String(p.asset.id||p.asset.name);
  const verified={
    id,
    name:String(p.asset.name),
    type:String(p.asset.type||'Real World Asset'),
    nav:Number(p.asset.nav||0),
    yield:Number(p.asset.yield||0),
    location:String(p.asset.location||''),
    document:String(p.asset.document||p.legal||''),
    issuer:String(p.issuer),
    ownership_document:String(p.ownership),
    appraisal_document:String(p.appraisal),
    legal_document:String(p.legal),
    nav_history:Array.isArray(p.nav)?p.nav:[],
    reviewer,
    verified_at:new Date().toISOString(),
    approval_signature:String(pkg.signature),
    status:'VERIFIED'
  };
  reg.schema=reg.schema||1;reg.verified=Array.isArray(reg.verified)?reg.verified:[];
  const i=reg.verified.findIndex(x=>String(x.id)===id||String(x.name).toLowerCase()===verified.name.toLowerCase());
  if(i>=0)reg.verified[i]=verified;else reg.verified.unshift(verified);
  reg.updated_at=new Date().toISOString().slice(0,10);
  fs.writeFileSync('rwa-assets.json',JSON.stringify(reg,null,2)+'\n');
  fs.writeFileSync('verify-success.txt',JSON.stringify({id,name:verified.name,reviewer,verified_at:verified.verified_at}));
  console.log(`VERIFIED ${verified.name} by ${reviewer}`);
}catch(e){fail(e?.stack||e)}
