import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const files=[
 "src/components/account-tools/AccountTools.tsx",
 "src/components/account-tools/account-tools.css",
 "src/components/account-tools/index.ts",
 "src/app/notifications/page.tsx",
 "src/app/alerts/page.tsx",
 "src/app/watchlist/page.tsx",
 "src/app/reports/page.tsx",
 "scripts/capture-chat06.py",
];
for(const f of files) if(!fs.existsSync(path.join(root,f))) throw new Error(`CHAT06 missing ${f}`);
const src=fs.readFileSync(path.join(root,"src/components/account-tools/AccountTools.tsx"),"utf8");
for(const token of ["NotificationsCenter","AlertsManagement","WatchlistPage","ReportsPage","ExportModal","EmptyState","LoadingState","ErrorState","/alerts","/watchlist","/reports","/notifications","/orders/","/community/thesis/"]) if(!src.includes(token)) throw new Error(`CHAT06 missing integration token ${token}`);
const buttons=[...src.matchAll(/<button\b[^>]*>/g)].map(m=>m[0]);
const dead=buttons.filter(tag=>!tag.includes("onClick=")&&!tag.includes("disabled"));
if(dead.length) throw new Error(`CHAT06 has ${dead.length} native button(s) without action: ${dead.slice(0,5).join(" | ")}`);
if(buttons.length<60) throw new Error(`CHAT06 expected at least 60 native controls; only ${buttons.length} found`);
console.log(`CHAT06 account tools PASS: 4 routes + reusable ExportModal; ${buttons.length} native button controls have actions.`);
