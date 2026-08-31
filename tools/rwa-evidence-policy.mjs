import {isIP} from 'node:net';

const REQUIRED_EVIDENCE=['ownership','appraisal','legal','kyb','disclosure'];
const CHECKS=['issuer',...REQUIRED_EVIDENCE];
const PLACEHOLDER_HOSTS=new Set(['example.com','example.org','example.net','www.example.com','www.example.org','www.example.net']);

function privateIp(host){
  const ip=isIP(host);
  if(ip===4){
    const p=host.split('.').map(Number);
    return p[0]===10||p[0]===127||p[0]===0||p[0]===169&&p[1]===254||p[0]===192&&p[1]===168||p[0]===172&&p[1]>=16&&p[1]<=31;
  }
  if(ip===6){const h=host.toLowerCase();return h==='::1'||h==='::'||h.startsWith('fc')||h.startsWith('fd')||h.startsWith('fe80:')}
  return false;
}

export function publicHttps(value){
  try{
    const u=new URL(String(value||''));
    const host=u.hostname.toLowerCase();
    if(u.protocol!=='https:'||!host)return false;
    if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||PLACEHOLDER_HOSTS.has(host)||privateIp(host))return false;
    return true;
  }catch{return false}
}

export function validateEvidencePayload(p,{now=Date.now()}={}){
  if(Number(p?.schema)!==2)throw Error('RWA approval payload schema 2 is required');
  if(!String(p?.asset?.name||'').trim())throw Error('Asset name is required');
  if(!(Number(p?.asset?.nav)>0))throw Error('Verified asset NAV must be greater than zero');
  if(!String(p?.issuer||'').trim())throw Error('Issuer/SPV is required');
  if(!CHECKS.every(k=>p?.checks?.[k]===true))throw Error('Verification checklist is incomplete');
  for(const k of REQUIRED_EVIDENCE)if(!publicHttps(p?.[k]))throw Error(`${k} evidence must be a public HTTPS URL`);
  const urls=REQUIRED_EVIDENCE.map(k=>new URL(String(p[k])).href);
  if(new Set(urls).size!==urls.length)throw Error('Ownership/appraisal/legal/KYB/disclosure evidence URLs must be distinct');
  const approved=Number(p?.approved_at||0);
  if(!(approved>0)||Math.abs(now-approved)>7*86400000)throw Error('Reviewer approval timestamp is missing or stale');
  if(Array.isArray(p?.nav)&&p.nav.length){
    const valid=p.nav.every(x=>String(x?.date||'').trim()&&Number(x?.value)>0);
    if(!valid)throw Error('NAV history contains invalid rows');
  }
  return true;
}

async function probeOne(kind,url){
  const options={redirect:'follow',cache:'no-store',signal:AbortSignal.timeout(12000),headers:{'user-agent':'RWA-Registry-Evidence-Validator/2.0'}};
  let r;
  try{r=await fetch(url,{...options,method:'HEAD'})}catch{}
  if(!r?.ok){
    r=await fetch(url,{...options,method:'GET',headers:{...options.headers,range:'bytes=0-4095'}});
  }
  if(!r.ok)throw Error(`${kind} evidence is not publicly reachable (HTTP ${r.status})`);
  if(!publicHttps(r.url||url))throw Error(`${kind} evidence redirected to a non-public HTTPS location`);
  return{kind,url:String(url),final_url:String(r.url||url),http_status:r.status,content_type:String(r.headers.get('content-type')||'').slice(0,160)};
}

export async function probePublicEvidence(kind,url){
  if(!publicHttps(url))throw Error(`${kind} evidence must be a public HTTPS URL`);
  return probeOne(kind,url);
}

export async function probeEvidencePayload(p){
  validateEvidencePayload(p);
  const out=[];
  for(const kind of REQUIRED_EVIDENCE)out.push(await probeOne(kind,p[kind]));
  return out;
}

export const RWA_EVIDENCE_POLICY='public-https-distinct-probed-v1';
export const RWA_REQUIRED_EVIDENCE=[...REQUIRED_EVIDENCE];
