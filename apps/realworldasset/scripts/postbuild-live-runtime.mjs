import fs from "node:fs";
import path from "node:path";

const appRoot=process.cwd();
const repoRoot=path.resolve(appRoot,"../..");
const out=path.join(appRoot,"out");
const must=(p)=>{if(!fs.existsSync(p)||!fs.statSync(p).isFile()||fs.statSync(p).size===0)throw new Error(`Missing live runtime source: ${p}`);return p};
const copy=(src,dst)=>{must(src);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst)};

if(!fs.existsSync(out))throw new Error(`Static export output is missing: ${out}`);

const executionSource=fs.readFileSync(must(path.join(repoRoot,"execution-api.js")),"utf8");
const originalConfig="const CONFIG_URL='rwa-execution-config.json';";
const originalLaunch="function launchUrl(name){\n  const prefix=location.pathname.includes('/trade/')?'../launch/':'launch/';\n  return new URL(prefix+name,location.href).href;\n}";
if(!executionSource.includes(originalConfig))throw new Error("Execution config locator contract changed");
if(!executionSource.includes(originalLaunch))throw new Error("Execution launch locator contract changed");
const executionOutput=executionSource
  .replace(originalConfig,"const CONFIG_URL='/rwa/rwa-execution-config.json';")
  .replace(originalLaunch,"function launchUrl(name){return new URL('/rwa/launch/'+name,location.origin).href;}");
if(executionOutput.includes(originalConfig)||executionOutput.includes(originalLaunch))throw new Error("Execution runtime URL hardening did not apply");
fs.writeFileSync(path.join(out,"execution-api.js"),executionOutput);

copy(path.join(repoRoot,"rwa-execution-config.json"),path.join(out,"rwa-execution-config.json"));
const commerceSource=JSON.parse(fs.readFileSync(must(path.join(repoRoot,"rwa-commerce-config.json")),"utf8"));
const commerce={
  ...commerceSource,
  candidate_api_base:String(commerceSource.candidate_api_base||commerceSource.candidate_base||""),
  fallback_candidate_api_base:String(commerceSource.fallback_candidate_api_base||commerceSource.fallback_candidate_base||""),
};
fs.writeFileSync(path.join(out,"rwa-commerce-config.json"),JSON.stringify(commerce,null,2)+"\n");
for(const name of ["readiness.json","e2e-registry.json","external-gates.json","product-rwa-testnet.json"]){
  copy(path.join(repoRoot,"launch",name),path.join(out,"launch",name));
}

const execution=JSON.parse(fs.readFileSync(path.join(out,"rwa-execution-config.json"),"utf8"));
const readiness=JSON.parse(fs.readFileSync(path.join(out,"launch","readiness.json"),"utf8"));
const manifest={
  schema:"realworldasset-live-runtime-v1",
  generated_at:new Date().toISOString(),
  commerce:{api_base:String(commerce.api_base||""),candidate_api_base:String(commerce.candidate_api_base||""),fallback_candidate_api_base:String(commerce.fallback_candidate_api_base||""),write_policy:String(commerce.write_policy||"")},
  execution:{venue:String(execution.venue||""),mainnetApi:String(execution.mainnetApi||""),testnetApi:String(execution.testnetApi||"")},
  mainnet_gate:{status:String(readiness.status||"UNKNOWN"),mainnet_ready:readiness.mainnet_ready===true},
  safety:"candidate endpoints are probe-only; mainnet remains machine-gated"
};
fs.writeFileSync(path.join(out,"live-runtime-manifest.json"),JSON.stringify(manifest,null,2)+"\n");
console.log("REALWORLDASSET_LIVE_RUNTIME_PACKAGED",JSON.stringify(manifest));
