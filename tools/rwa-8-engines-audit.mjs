import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=p=>fs.readFileSync(p,'utf8');
const config=JSON.parse(read('rwa-8-engines/config.json'));
const upstreams=JSON.parse(read('rwa-8-engines/upstreams.lock.json'));
const jurisdictions=JSON.parse(read('rwa-8-engines/jurisdictions.json'));
const engine=read('rwa-8-engines/engine.js');
const app=read('rwa-8-engines/app.js');
const html=read('rwa-8-engines/index.html');
const suite=read('suite-nav.js');

assert.equal(config.defaultMode,'REGISTER');
assert.equal(config.mainnet.enabled,false,'mainnet must remain disabled by default');
assert.equal(config.tokenDeployment.enabled,false,'token deployment must remain disabled by default');
assert.equal(config.engines.length,8,'exactly 8 engines required');
assert.equal(upstreams.upstreams.length,8,'exactly 8 upstream mappings required');
assert.match(jurisdictions.disclaimer,/not legal advice/i);
assert.equal(jurisdictions.default.finance,'REVIEW_REQUIRED');
assert.equal(jurisdictions.default.trade,'REVIEW_REQUIRED');

for(const name of ['passportEngine','registryEngine','proofEngine','valuationEngine','legalEngine','complianceEngine','factoryEngine','marketplaceEngine','runPipeline'])assert.match(engine,new RegExp(`function ${name}\\(`),`missing ${name}`);
assert.match(engine,/providerVerified===true/,'screening cannot self-clear without provider verification');
assert.match(engine,/LICENSED_LEGAL_REVIEW_REQUIRED/,'finance/trade must require legal review');
assert.match(engine,/deployment:\{enabled:false/,'factory must default deployment off');
assert.match(engine,/Regulated secondary trading requires eligible investor/,'marketplace restriction missing');
assert.match(html,/Create My RWA/);
assert.match(html,/REGISTER · Create RWA Passport/);
assert.match(app,/RWA8Engines\.runPipeline/);
assert.match(suite,/rwa-8-engines\/\?embed=1/,'institutional suite must embed the factory internally');
assert.match(suite,/RWA Factory/,'suite tab label missing');

const forbidden=[/mainnet\s*:\s*\{\s*enabled\s*:\s*true/i,/tokenDeployment\s*:\s*\{\s*enabled\s*:\s*true/i,/transferEligible\s*:\s*true\s*[,}]/i];
for(const rx of forbidden)assert.ok(!rx.test(read('rwa-8-engines/config.json')),`unsafe config: ${rx}`);

console.log('RWA_8_ENGINE_UPSTREAMS=PASS');
console.log('RWA_8_ENGINE_STATIC=PASS');
console.log('RWA_8_ENGINE_SAFETY_GATES=PASS');
console.log('RWA_8_ENGINE_INTERNAL_EMBED=PASS');
