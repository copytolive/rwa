import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const tsx=[];
const stack=[path.join(root,"src")];
while(stack.length){
  const p=stack.pop(); const st=fs.statSync(p);
  if(st.isDirectory()){ for(const x of fs.readdirSync(p)) stack.push(path.join(p,x)); continue; }
  if(p.endsWith(".tsx")) tsx.push(p);
}
let controls=0, links=0, routeActions=0, stateActions=0;
const bad=[];
for(const p of tsx){
  const rel=path.relative(root,p); const s=fs.readFileSync(p,"utf8");
  for(const m of s.matchAll(/<button\b([^>]*)>/gs)){
    controls++; const a=m[1];
    if(!/onClick\s*=|type\s*=\s*["']submit["']|disabled(?:\s*=|\b)/.test(a)) bad.push(`${rel}: native button lacks action :: ${m[0].slice(0,180)}`);
    if(/onClick\s*=/.test(a)) stateActions++;
  }
  for(const m of s.matchAll(/<Button\b([^>]*)>/gs)){
    controls++; const a=m[1];
    if(!/onClick\s*=|type\s*=\s*["']submit["']|disabled(?:\s*=|\b)/.test(a)) bad.push(`${rel}: Button lacks action :: ${m[0].slice(0,180)}`);
    if(/onClick\s*=/.test(a)) stateActions++;
  }
  for(const m of s.matchAll(/<Link\b([^>]*)>/gs)){
    controls++; links++; const a=m[1];
    const hm=a.match(/href\s*=\s*["']([^"']*)["']/);
    if(!/href\s*=/.test(a)) bad.push(`${rel}: Link lacks href :: ${m[0].slice(0,180)}`);
    if(hm && (!hm[1] || hm[1]==="#" || hm[1].startsWith("javascript:"))) bad.push(`${rel}: unsafe/dead Link href ${hm[1]}`);
  }
  for(const m of s.matchAll(/<a\b([^>]*)>/gs)){
    controls++; links++; const a=m[1];
    const hm=a.match(/href\s*=\s*["']([^"']*)["']/);
    if(!/href\s*=/.test(a) && !/onClick\s*=/.test(a)) bad.push(`${rel}: anchor lacks href/action :: ${m[0].slice(0,180)}`);
    if(hm && (!hm[1] || hm[1]==="#" || hm[1].startsWith("javascript:"))) bad.push(`${rel}: unsafe/dead anchor href ${hm[1]}`);
  }
  for(const m of s.matchAll(/(?:router\.push|router\.replace)\(\s*["'`]([^"'`]*)["'`]/g)){
    routeActions++; if(!m[1] || m[1]==="#") bad.push(`${rel}: empty router destination`);
  }
  for(const m of s.matchAll(/location\.href\s*=\s*["'`]([^"'`]*)["'`]/g)){
    routeActions++; if(!m[1] || m[1]==="#") bad.push(`${rel}: empty location destination`);
  }
  if(/role\s*=\s*["']button["']/.test(s)) bad.push(`${rel}: use native button instead of role=button for keyboard-safe interaction`);
}

const catchAll=path.join(root,"src/app/[...slug]/page.tsx");
if(!fs.existsSync(catchAll)) bad.push("Missing root route-safe catch-all src/app/[...slug]/page.tsx");
const patterns=fs.readFileSync(path.join(root,"src/components/overlays/patterns.tsx"),"utf8");
for(const fallback of [
  "onConnect ? onConnect(selected) : onOpenChange(false)",
  "onConfirm ? onConfirm() : onOpenChange(false)",
  "onAdd ? onAdd(list) : onOpenChange(false)",
  "onCreate ? onCreate({ direction, price }) : onOpenChange(false)",
  "onShare ? onShare(network) : onOpenChange(false)",
  "onViewProject ? onViewProject() : onOpenChange(false)",
  "onJoin ? onJoin() : onOpenChange(false)",
  "onExplorer ? onExplorer() : onOpenChange(false)",
  "onCheckout ? onCheckout() : onOpenChange(false)",
  "onClear ? onClear() : onOpenChange(false)",
]) if(!patterns.includes(fallback)) bad.push(`Overlay optional callback lacks visible fallback: ${fallback}`);

const asset=fs.readFileSync(path.join(root,"src/components/details/AssetDetail.tsx"),"utf8");
for(const tab of ["Activity","Community","Order Book","Disclosures","Business","Rewards","Underlying Asset","Documents","Cashflows","Legal Terms"]){
  if(!asset.includes(`\"${tab}\"`)) bad.push(`CHAT 03 tab contract missing ${tab}`);
}

if(bad.length){ console.error(bad.join("\n")); process.exit(1); }
console.log(`Interaction contract PASS: ${controls} rendered control tags, ${links} links/anchors, ${routeActions} direct route actions across ${tsx.length} TSX files; route-safe catch-all and overlay callback fallbacks verified.`);
