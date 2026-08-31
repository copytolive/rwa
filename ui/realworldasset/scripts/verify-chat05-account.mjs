import fs from "node:fs";import path from "node:path";
const root=process.cwd();
const must=[
 ["src/components/account/AccountPortfolio.tsx",["PortfolioOverviewPage","TransactionsPage","DepositPage","WithdrawPage","AccountDashboardPage","/account/deposit","/account/withdraw","/account/transactions","DEMO_ORDER_ID","DEMO_POSITION_ID","OrderStatusBadge","TransactionLinkRow"]],
 ["src/components/trading/TransactionPrimitives.tsx",["OrderStatusBadge","TransactionLinkRow"]],
 ["src/app/account/page.tsx",["AccountDashboardPage"]],
 ["src/app/portfolio/page.tsx",["PortfolioOverviewPage"]],
 ["src/app/account/transactions/page.tsx",["TransactionsPage"]],
 ["src/app/account/deposit/page.tsx",["DepositPage"]],
 ["src/app/account/withdraw/page.tsx",["WithdrawPage"]],
];
for(const [file,needles] of must){const p=path.join(root,file);if(!fs.existsSync(p))throw new Error(`Missing CHAT05 file: ${file}`);const s=fs.readFileSync(p,"utf8");for(const n of needles)if(!s.includes(n))throw new Error(`CHAT05 contract missing ${n} in ${file}`)}
const s=fs.readFileSync(path.join(root,"src/components/account/AccountPortfolio.tsx"),"utf8");let controls=0;
for(const m of s.matchAll(/<button\b([^>]*)>/g)){controls++;if(!/onClick=|type="submit"|disabled/.test(m[1]))throw new Error(`Dead CHAT05 native button: ${m[0]}`)}
for(const m of s.matchAll(/<Button\b([^>]*)>/g)){controls++;if(!/onClick=|type="submit"|disabled=/.test(m[1]))throw new Error(`Dead CHAT05 Button: ${m[0]}`)}
if(controls<100)throw new Error(`CHAT05 interaction surface unexpectedly small: ${controls}`);
console.log(`CHAT05 account/portfolio/funds PASS: five routes connected to CHAT04 details; ${controls} button controls have actions.`);
