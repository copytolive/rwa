import {readFile} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const [r,m,rev,assets,product,commerce,worker,control,external,beta]=await Promise.all([
  read('launch/readiness.json'),read('launch/multichain-readiness.json'),read('rwa-multichain-revenue.json'),read('rwa-assets.json'),read('launch/product-rwa-testnet.json'),read('rwa-commerce-config.json'),read('agent-worker/public-config.json'),read('agent-worker/control.json'),read('launch/external-gates.json'),read('launch/beta-registry.json')
]);
const errors=[];
if(r?.mainnet_ready===true&&r?.status!=='READY_FOR_MAINNET')errors.push('global readiness mismatch');
if(m?.ready===true&&m?.status!=='READY')errors.push('multichain readiness mismatch');
if(rev?.lifi?.enabled===true&&!(rev.lifi.integrator_verified&&rev.lifi.portal_configured&&rev.lifi.fee_wallet_configured_externally))errors.push('LI.FI cannot be enabled before verified portal + fee wallet');
if(rev?.hyperliquid?.enabled===true&&!(rev.hyperliquid.builder_wallet_configured&&rev.hyperliquid.builder_account_value_verified&&rev.hyperliquid.builder_address))errors.push('Hyperliquid builder cannot be enabled before verified builder setup');
if(product?.status==='TESTNET_VERIFIED'&&(product.deployment_transactions||[]).length<3)errors.push('Product RWA TESTNET_VERIFIED requires real deployment transactions');
if(worker?.enabled===true&&!/^https:\/\//i.test(String(worker.base_url||'')))errors.push('enabled worker requires public HTTPS base_url');
if(control?.mainnet_enabled===true&&!(control.enabled===true&&control.production_ready===true&&control.kill_switch===false))errors.push('mainnet control requires enabled production-ready worker with kill switch off');
for(const [k,g] of Object.entries(external?.gates||{}))if(g?.approved===true&&!(g.status==='VERIFIED'&&/^https:\/\//i.test(String(g.evidence_url||''))))errors.push(`external gate ${k} approval lacks VERIFIED HTTPS evidence`);
if(Array.isArray(assets?.verified)&&assets.verified.some(a=>a?.status==='VERIFIED'&&!(a.ownership&&a.appraisal&&a.legal&&a.kyb&&a.disclosure)))errors.push('verified RWA asset missing required evidence fields');
if(Array.isArray(beta?.proofs)&&beta.proofs.some(p=>p?.status==='VERIFIED'&&!/^0x[a-fA-F0-9]{40}$/.test(String(p.wallet||''))))errors.push('verified beta proof has invalid wallet');
if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,contract:'rwa-launch-v6-non-fabrication-assertions'},null,2));
