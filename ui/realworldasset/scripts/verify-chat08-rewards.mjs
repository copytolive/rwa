import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const required=[
  "src/components/rewards/Rewards.tsx",
  "src/components/rewards/rewards.css",
  "src/components/rewards/index.ts",
  "src/app/rewards/page.tsx",
  "src/app/businesses/[business]/rewards/page.tsx",
  "scripts/capture-chat08.py",
];
for(const f of required) if(!fs.existsSync(path.join(root,f))) throw new Error(`CHAT08 missing ${f}`);
const rewards=fs.readFileSync(path.join(root,"src/components/rewards/Rewards.tsx"),"utf8");
for(const token of ["RewardsCenter","BusinessRewards","RewardProgramCard","PointsBalanceCard","RedeemFlow","ConfirmationDialog","Join Rewards Program","Redeemed Successfully"]) if(!rewards.includes(token)) throw new Error(`CHAT08 missing ${token}`);
const profile=fs.readFileSync(path.join(root,"src/components/details/BusinessProfile.tsx"),"utf8");
if(!profile.includes("router.push(`/businesses/${slug}/rewards`)")) throw new Error("CHAT08 BusinessProfile Rewards CTA not connected");
const catchall=fs.readFileSync(path.join(root,"src/app/[...slug]/page.tsx"),"utf8");
if(catchall.includes('"rewards",')) throw new Error("CHAT08 /rewards still conflicts with catch-all");
if(catchall.includes("`businesses/${b}/rewards`")) throw new Error("CHAT08 business rewards still conflicts with catch-all");
const buttons=[...rewards.matchAll(/<button\b[^>]*>/g)].map(m=>m[0]);
const dead=buttons.filter(tag=>!tag.includes("onClick=")&&!tag.includes("disabled"));
if(dead.length) throw new Error(`CHAT08 has ${dead.length} native button(s) without action: ${dead.slice(0,10).join(" | ")}`);
if(buttons.length<30) throw new Error(`CHAT08 expected at least 30 native reward controls; only ${buttons.length} found`);
console.log(`CHAT08 rewards PASS: explicit routes, reusable join/redeem states, shared overlay, BusinessProfile connection, catch-all exclusions; ${buttons.length} native buttons have actions.`);
