import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const required=[
  "src/app/page.tsx","src/app/login/page.tsx","src/app/signup/page.tsx","src/app/onboarding/page.tsx","src/app/account/wallet/page.tsx","src/app/home/page.tsx","src/app/[...slug]/page.tsx",
  "src/components/public/PublicShell.tsx","src/components/auth/AuthFlow.tsx","src/components/auth/OnboardingFlow.tsx","src/components/wallet/WalletManager.tsx"
];
for(const f of required){if(!fs.existsSync(path.join(root,f))) throw new Error(`Missing ${f}`)}
const all=required.map(f=>fs.readFileSync(path.join(root,f),"utf8")).join("\n");
for(const route of ["/login","/signup","/onboarding","/home","/account/wallet"]){if(!all.includes(route)) throw new Error(`Route wiring missing: ${route}`)}
for(const token of ["ConnectWalletModal","ConfirmationDialog","FormDialog","router.push","onClick"]){if(!all.includes(token)) throw new Error(`Interaction wiring missing: ${token}`)}
const pageFiles=fs.readdirSync(path.join(root,"src/app"),{recursive:true}).filter(x=>String(x).endsWith("page.tsx"));
if(pageFiles.length<7) throw new Error("Expected public/auth routes and placeholder route");
console.log(`CHAT 01 verified: ${required.length} required modules, ${pageFiles.length} page routes, CTA/router/modal wiring present.`);
