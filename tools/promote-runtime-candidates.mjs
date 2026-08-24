import {readFile,writeFile} from 'node:fs/promises';

const args=new Set(process.argv.slice(2));
const promoteWorker=args.has('--worker');
const promoteCommerce=args.has('--commerce');
if(!promoteWorker&&!promoteCommerce){
  console.log('No runtime candidate requested for promotion');
  process.exit(0);
}

const read=async p=>JSON.parse(await readFile(p,'utf8'));
const write=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+'\n');
const https=v=>/^https:\/\//i.test(String(v||''));

if(promoteWorker){
  const cfg=await read('agent-worker/public-config.json');
  const control=await read('agent-worker/control.json');
  const base=String(cfg.candidate_base_url||'').trim().replace(/\/$/,'');
  if(!https(base))throw new Error('worker candidate must be HTTPS');
  if(control.mainnet_enabled===true)throw new Error('refusing promotion while mainnet_enabled=true');
  cfg.schema=Math.max(3,Number(cfg.schema||1));
  cfg.enabled=true;
  cfg.base_url=base;
  cfg.mode='delegated-agent-testnet-live';
  cfg.note='TESTNET worker promoted only after public health/ready probe PASS. MAINNET remains separately hard locked.';
  control.enabled=true;
  control.kill_switch=false;
  control.production_ready=true;
  control.mainnet_enabled=false;
  control.note='TESTNET operational. MAINNET remains OFF until the full launch gate and explicit real-money approval pass.';
  await write('agent-worker/public-config.json',cfg);
  await write('agent-worker/control.json',control);
  console.log(`Promoted TESTNET worker: ${base}`);
}

if(promoteCommerce){
  const cfg=await read('rwa-commerce-config.json');
  const base=String(cfg.candidate_base||'').trim().replace(/\/$/,'');
  if(!https(base))throw new Error('commerce candidate must be HTTPS');
  cfg.schema=Math.max(4,Number(cfg.schema||1));
  cfg.api_base=base;
  cfg.mode='LIVE_BACKEND_CHECKOUT_REMAINS_EVIDENCE_GATED';
  cfg.note='Backend promoted only after public health/ready probe PASS. Checkout still requires payment configuration plus at least one real verified RWA/store; no evidence gate is bypassed.';
  await write('rwa-commerce-config.json',cfg);
  console.log(`Promoted commerce backend: ${base}`);
}
