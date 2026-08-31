import fs from "node:fs";import path from "node:path";
const root=process.cwd();
const must=[
 ["src/components/trading/TradingFlow.tsx",["PreviewOrderModal","OrderResultView","OrderDetailPage","PositionDetailPage","router.push(`/positions/${DEMO_POSITION_ID}`)","onFilled()"]],
 ["src/app/trade/[asset]/page.tsx",["TradingPage","generateStaticParams"]],
 ["src/app/orders/[id]/page.tsx",["OrderDetailPage","generateStaticParams"]],
 ["src/app/positions/[id]/page.tsx",["PositionDetailPage","generateStaticParams"]],
 ["src/components/details/DetailPrimitives.tsx",["router.push(`/trade/${asset.slug}`)"]],
];
for(const [file,needles] of must){const p=path.join(root,file);if(!fs.existsSync(p))throw new Error(`Missing CHAT04 file: ${file}`);const s=fs.readFileSync(p,"utf8");for(const n of needles)if(!s.includes(n))throw new Error(`CHAT04 contract missing ${n} in ${file}`)}
const s=fs.readFileSync(path.join(root,"src/components/trading/TradingFlow.tsx"),"utf8");let buttons=0;for(const m of s.matchAll(/<button\b([^>]*)>/g)){buttons++;if(!/onClick=/.test(m[1]))throw new Error(`Dead CHAT04 button: ${m[0]}`)}
for(const m of s.matchAll(/<Button\b([^>]*)>/g)){buttons++;if(!/onClick=/.test(m[1]))throw new Error(`Dead CHAT04 Button: ${m[0]}`)}
if(buttons<80)throw new Error(`CHAT04 interaction surface unexpectedly shrank: only ${buttons} controls`);
console.log(`CHAT04 trading flow PASS: routes + preview/confirm/result + order/position links; ${buttons} button controls have actions.`);
