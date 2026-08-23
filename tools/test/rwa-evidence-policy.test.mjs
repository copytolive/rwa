import test from 'node:test';
import assert from 'node:assert/strict';
import {publicHttps,validateEvidencePayload,RWA_EVIDENCE_POLICY} from '../rwa-evidence-policy.mjs';

const payload=()=>({
  schema:2,
  asset:{name:'Asset One',nav:1000000},
  issuer:'PT Example SPV',
  ownership:'https://docs.valid-company.test/ownership.pdf',
  appraisal:'https://valuer.valid-company.test/appraisal.pdf',
  legal:'https://legal.valid-company.test/legal.pdf',
  kyb:'https://compliance.valid-company.test/kyb.pdf',
  disclosure:'https://disclosure.valid-company.test/risk.pdf',
  checks:{issuer:true,ownership:true,appraisal:true,legal:true,kyb:true,disclosure:true},
  nav:[{date:'2026-08-23',value:1000000}],
  approved_at:Date.now()
});

test('policy marker is stable',()=>assert.equal(RWA_EVIDENCE_POLICY,'public-https-distinct-probed-v1'));
test('rejects local/private/placeholder evidence',()=>{
  for(const x of ['http://public.test/x','https://localhost/x','https://127.0.0.1/x','https://10.0.0.1/x','https://192.168.1.2/x','https://172.16.0.1/x','https://example.com/x'])assert.equal(publicHttps(x),false,x);
  assert.equal(publicHttps('https://docs.valid-company.test/x.pdf'),true);
});
test('valid payload passes static evidence policy',()=>assert.equal(validateEvidencePayload(payload()),true));
test('schema 1 cannot be VERIFIED',()=>{const p=payload();p.schema=1;assert.throws(()=>validateEvidencePayload(p),/schema 2/i)});
test('all five evidence URLs must be distinct',()=>{const p=payload();p.kyb=p.legal;assert.throws(()=>validateEvidencePayload(p),/distinct/i)});
test('all verification checks are mandatory',()=>{const p=payload();p.checks.disclosure=false;assert.throws(()=>validateEvidencePayload(p),/checklist/i)});
test('NAV must be positive',()=>{const p=payload();p.asset.nav=0;assert.throws(()=>validateEvidencePayload(p),/NAV/i)});
test('stale reviewer approval is rejected',()=>{const p=payload();p.approved_at=Date.now()-8*86400000;assert.throws(()=>validateEvidencePayload(p),/stale/i)});
