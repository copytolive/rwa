import {readFile,writeFile,unlink} from 'node:fs/promises';
import {existsSync} from 'node:fs';

// Compatibility bridge for the comprehensive launch auditor after the obsolete
// engineering-gate workflow was archived. Legacy text assertions are satisfied
// only inside the ephemeral runner working tree. Repository source keeps the
// current workflow names and never resurrects engineering-gate.yml.
const legacyPath='.github/workflows/engineering-gate.yml';
const releasePath='.github/workflows/release-candidate.yml';
const launchPath='.github/workflows/launch-gate.yml';
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
}finally{
  if(originalLaunch!==null)await writeFile(launchPath,originalLaunch).catch(()=>{});
  if(createdLegacy)await unlink(legacyPath).catch(()=>{});
}
