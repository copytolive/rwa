"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import "./compliance-parity.css";

const portfolio = [
  ["Overview", "/portfolio"], ["Holdings", "/portfolio/holdings"], ["Orders", "/portfolio/orders"],
  ["Transactions", "/portfolio/transactions"], ["Rewards", "/rewards"], ["Reports", "/reports"],
] as const;
const markets = [
  ["Asset Explorer", "/rwa"], ["Watchlist", "/watchlist"], ["Trending", "/markets"],
  ["RWA Tokens", "/rwa"], ["Real Estate", "/rwa?class=real-estate"], ["Private Credit", "/rwa?class=private-credit"], ["Commodities", "/rwa?class=commodities"],
] as const;
const account = [["Profile", "/account"], ["Security", "/settings/security"], ["API Access", "/account/api"], ["Settings", "/settings"]] as const;
const docs = ["Offering Memorandum", "Valuation Report", "Audit Report", "Property Appraisal", "Legal Opinion", "Term Sheet"];

export function EligibilityParityChrome({assetSlug}:{assetSlug:string}) {
  const router = useRouter();
  const [notice,setNotice]=React.useState("");
  const go=(href:string)=>router.push(href);
  const row=(label:string,href:string,index:number)=><button key={label} type="button" onClick={()=>go(href)}><span aria-hidden="true">{["⌂","▣","▤","♧","◇","▱","◎","☆"][index%8]}</span>{label}{label==="Orders"&&<em>2</em>}</button>;
  return <>
    <aside className="eligibility-target-rail" aria-label="Restricted market navigation">
      <button className="rail-back" type="button" onClick={()=>go("/markets")}>← Back to Markets</button>
      <section><h4>PORTFOLIO</h4>{portfolio.map(([l,h],i)=>row(l,h,i))}</section>
      <section><h4>MARKETS</h4>{markets.map(([l,h],i)=>row(l,h,i+2))}</section>
      <section><h4>ACCOUNT</h4>{account.map(([l,h],i)=>row(l,h,i+5))}</section>
      <div className="eligibility-help"><span>◉</span><div><b>Need help?</b><button type="button" onClick={()=>go("/help")}>Visit Help Center →</button></div></div>
    </aside>
    <section className="eligibility-target-docs" aria-label="Key documents">
      <header><b>Documents</b></header>
      <div>{docs.map((d,i)=><button type="button" key={d} onClick={()=>go(`/rwa/${assetSlug}/documents/${Math.min(i+1,5)}`)}><span>▤</span><b>{d}</b><small>{i===0?"Version 2.1 · May 1, 2024":i===1?"Mar 31, 2024":i===2?"FY 2023":i===3?"Mar 31, 2024":i===4?"Apr 15, 2024":"Apr 1, 2024"}</small><em>PDF</em></button>)}</div>
      <button className="docs-all" type="button" onClick={()=>go(`/rwa/${assetSlug}/documents`)}>View All Documents →</button>
    </section>
    <footer className="eligibility-target-ticker" aria-label="Market status ticker">
      <button type="button" onClick={()=>go("/status")}><span className="ticker-ok">● System Operational</span></button>
      <button type="button" onClick={()=>{setNotice("Harbourview AM announces Q1 2024 investor update");go(`/rwa/${assetSlug}/activity`)}}><small>NEWS</small><span>Harbourview AM announces Q1 2024 investor update</span><em>2h ago</em></button>
      <button type="button" onClick={()=>go("/markets/btc-usdc")}><b>₿ BTC</b><span>$66,842.35</span><em>+1.82%</em></button>
      <button type="button" onClick={()=>go("/markets")}><b>◈ ETH</b><span>$3,142.87</span><em>+1.21%</em></button>
      <button type="button" onClick={()=>go("/rwa")}><b>◆ RWA INDEX</b><span>1,842.12</span><em>+2.34%</em></button>
      {notice&&<span className="sr-only" role="status">{notice}</span>}
    </footer>
  </>;
}
