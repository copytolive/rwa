import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const required=[
 "src/components/app/AppShell.tsx","src/components/app/app-shell.css","src/components/discovery/HomeFeed.tsx","src/components/discovery/DiscoverHub.tsx","src/components/discovery/SearchResults.tsx","src/components/discovery/BusinessDirectory.tsx","src/components/discovery/RwaDirectory.tsx","src/components/discovery/shared.tsx","src/components/discovery/data.ts","src/components/discovery/discovery.css","src/app/home/page.tsx","src/app/discover/page.tsx","src/app/search/page.tsx","src/app/businesses/page.tsx","src/app/rwa/page.tsx"
];
for(const file of required){if(!fs.existsSync(path.join(root,file)))throw new Error(`Missing ${file}`)}
const app=fs.readFileSync(path.join(root,"src/components/app/AppShell.tsx"),"utf8");
for(const route of ["/home","/discover","/businesses","/portfolio","/notifications","/account"]){if(!app.includes(route))throw new Error(`AppShell missing ${route}`)}
const shared=fs.readFileSync(path.join(root,"src/components/discovery/shared.tsx"),"utf8");
if(!shared.includes("/businesses/${business.slug}"))throw new Error("Business detail links missing");
if(!shared.includes("/rwa/${asset.slug}"))throw new Error("RWA detail links missing");
const pages=fs.readdirSync(path.join(root,"src/app"));
console.log(`Core navigation verified: ${required.length} modules; ${pages.length} top-level app entries.`);
