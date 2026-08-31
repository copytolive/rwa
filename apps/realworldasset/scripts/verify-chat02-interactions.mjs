import fs from "node:fs"; import path from "node:path";
const root=process.cwd();
const files=["src/components/app/AppShell.tsx","src/components/discovery/HomeFeed.tsx","src/components/discovery/DiscoverHub.tsx","src/components/discovery/SearchResults.tsx","src/components/discovery/BusinessDirectory.tsx","src/components/discovery/RwaDirectory.tsx","src/components/discovery/shared.tsx"];
let checked=0;
for(const file of files){const s=fs.readFileSync(path.join(root,file),"utf8");
 const native=[...s.matchAll(/<button\b([^>]*)>/g)];
 for(const m of native){checked++; const attrs=m[1]; if(!/onClick=|type="submit"|disabled/.test(attrs))throw new Error(`Potential dead native button in ${file}: ${m[0]}`)}
 const links=[...s.matchAll(/<Link\b([^>]*)>/g)]; for(const m of links){checked++; if(!/href=/.test(m[1]))throw new Error(`Link without href in ${file}: ${m[0]}`)}
 const btns=[...s.matchAll(/<Button\b([^>]*)>/g)]; for(const m of btns){checked++; if(!/onClick=|type="submit"|disabled=/.test(m[1]))throw new Error(`Potential dead Button in ${file}: ${m[0]}`)}
}
console.log(`CHAT 02 interaction audit PASS: ${checked} actionable controls checked.`);
