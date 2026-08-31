import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const required=[
  "src/app/businesses/[business]/page.tsx",
  "src/app/businesses/[business]/token/page.tsx",
  "src/app/rwa/[asset]/page.tsx",
  "src/app/markets/[asset]/page.tsx",
  "src/components/details/BusinessProfile.tsx",
  "src/components/details/AssetDetail.tsx",
  "src/components/details/DetailPrimitives.tsx",
  "src/components/details/data.ts",
  "src/components/details/details.css",
  "ASSET_DETAILS.md",
];
for(const file of required) if(!fs.existsSync(path.join(root,file))) throw new Error(`Missing ${file}`);
const business=fs.readFileSync(path.join(root,"src/components/details/BusinessProfile.tsx"),"utf8");
const asset=fs.readFileSync(path.join(root,"src/components/details/AssetDetail.tsx"),"utf8");
const primitives=fs.readFileSync(path.join(root,"src/components/details/DetailPrimitives.tsx"),"utf8");
for(const token of ["AppShell","JoinRewardsModal","ShareModal","/businesses/${slug}/token","/businesses/${slug}/store"]){if(!business.includes(token))throw new Error(`Business detail contract missing ${token}`)}
for(const token of ["AppShell","AddWatchlistModal","SetAlertModal","ShareModal","/rwa/${asset.slug}/disclosures","TradeCard"]){if(!asset.includes(token))throw new Error(`Asset detail contract missing ${token}`)}
for(const token of ["DetailPanel","MetricStrip","DetailTabs","ChartShell","KeyValueGrid","DocumentsRow","TradeCard"]){if(!primitives.includes(`function ${token}`))throw new Error(`Shared detail primitive missing ${token}`)}
const duplicatedHeaders=["PublicHeader","AppHeader"].filter(name=>business.includes(`function ${name}`)||asset.includes(`function ${name}`));
if(duplicatedHeaders.length)throw new Error(`CHAT 03 duplicates global header: ${duplicatedHeaders.join(", ")}`);
console.log(`CHAT 03 detail architecture PASS: ${required.length} required modules, 4 route variants, shared primitives and reused overlays present.`);
