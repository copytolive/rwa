import fs from "node:fs";
const files=[
  "src/components/public/PublicShell.tsx","src/components/public/HomePlaceholder.tsx","src/components/auth/AuthFlow.tsx","src/components/auth/OnboardingFlow.tsx","src/components/wallet/WalletManager.tsx","src/app/page.tsx"
];
const dead=[];
for(const file of files){const s=fs.readFileSync(file,"utf8");for(const tag of s.matchAll(/<(button|Button)\b[\s\S]*?>/g)){const open=tag[0];if(!/onClick\s*=/.test(open)&&!/type\s*=\s*["']submit["']/.test(open))dead.push(`${file}: ${open.slice(0,120)}`)}for(const tag of s.matchAll(/<Link\b[\s\S]*?>/g)){if(!/href\s*=/.test(tag[0]))dead.push(`${file}: Link missing href`)}}
if(dead.length)throw new Error(`Dead interactive controls found:\n${dead.join("\n")}`);
console.log(`Interaction audit passed across ${files.length} CHAT 01 surfaces: every Button/button has onClick or submit behavior and every Link has href.`);
