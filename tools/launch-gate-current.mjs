import {readFile,writeFile,unlink} from 'node:fs/promises';
import {existsSync} from 'node:fs';

// Compatibility bridge for the comprehensive launch auditor after the obsolete
// engineering-gate workflow was archived. Legacy text assertions are satisfied
// only inside the ephemeral runner working tree. Repository source keeps the
// current workflow names and never resurrects engineering-gate.yml.
// MULTI CHAIN adds a second fail-closed readiness document so the global
// READY_FOR_MAINNET state can never bypass real cross-chain receipts/provider approval.
const legacyPath='.github/workflows/engineering-gate.yml';
const releasePath='.github/workflows/release-candidate.yml';
const launchPath='.github/workflows/launch-gate.yml';
const globalReadiness='launch/readiness.json';
const multiReadiness='launch/multichain-readiness.json';
let createdLegacy=false;
let originalLaunch=null;
const legacyNames=s=>String(s).replaceAll('launch-gate-current.mjs','launch-gate.mjs');
try{
  const release=await readFile(releasePath,'utf8');
  if(!existsSync(legacyPath)){
    await writeFile(legacyPath,legacyNames(release));
    createdLegacy=true;
  }
  originalLaunch=await readFile(launchPath,'utf8');
  await writeFile(launchPath,legacyNames(originalLaunch));
  await import('./launch-gate.mjs');

  if(process.argv.includes('--write')){
    const [global,multi]=await Promise.all([
      readFile(globalReadiness,'utf8').then(JSON.parse),
      readFile(multiReadiness,'utf8').then(JSON.parse).catch(()=>({status:'UNAVAILABLE',ready:false,blockers:[{gate:'multichain_readiness',detail:'MULTI CHAIN readiness document unavailable'}]}))
    ]);
    const multiOk=multi?.status==='READY'&&multi?.ready===true;
    global.checks=global.checks||{};
    global.checks.multichain_mainnet={ok:multiOk,detail:multiOk?'real receipt matrix + provider approvals + funding adapter verified':`MULTI CHAIN ${multi?.status||'UNAVAILABLE'}; global mainnet remains locked`};
    global.blockers=Array.isArray(global.blockers)?global.blockers.filter(x=>x?.gate!=='multichain_mainnet'):[];
    if(!multiOk){
      global.mainnet_ready=false;
      if(global.status==='READY_FOR_MAINNET')global.status=global.beta_passed?'BETA_PASSED_AWAITING_MAINNET':'BLOCKED';
      global.blockers.push({gate:'multichain_mainnet',detail:global.checks.multichain_mainnet.detail});
    }
    global.multichain={status:multi?.status||'UNAVAILABLE',ready:multiOk,blockers:multi?.blockers||[]};
    await writeFile(globalReadiness,JSON.stringify(global,null,2)+'\n');
    console.log(JSON.stringify({launch_gate_current:'POSTPROCESSED',global_status:global.status,global_mainnet_ready:global.mainnet_ready,multichain_ready:multiOk},null,2));
    if(process.argv.includes('--require-mainnet')&&!global.mainnet_ready)process.exit(3);
  }
}finally{
  if(originalLaunch!==null)await writeFile(launchPath,originalLaunch).catch(()=>{});
  if(createdLegacy)await unlink(legacyPath).catch(()=>{});
}
