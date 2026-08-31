"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@/components/ui";
import type { AssetDetailData } from "./data";

export function DetailPanel({ title, actionHref, actionLabel = "View all", children, className = "" }: { title: string; actionHref?: string; actionLabel?: string; children: React.ReactNode; className?: string }) {
  return <section className={`detail-panel ${className}`}><header className="detail-panel-head"><h2>{title}</h2>{actionHref && <Link href={actionHref}>{actionLabel} →</Link>}</header>{children}</section>;
}

export function MetricStrip({ items }: { items: Array<[string, string, string?]> }) {
  return <div className="detail-metric-strip">{items.map(([label, value, change]) => <div key={label}><small>{label}</small><b>{value}</b>{change && <em>{change}</em>}</div>)}</div>;
}

export function DetailTabs({ tabs, value, onChange }: { tabs: string[]; value: string; onChange: (value: string) => void }) {
  return <div className="detail-tabs" role="tablist">{tabs.map(tab => <button type="button" role="tab" aria-selected={value === tab} data-active={value === tab ? "true" : undefined} key={tab} onClick={() => onChange(tab)}>{tab}</button>)}</div>;
}

export function ChartShell({ asset, mode = "line" }: { asset: AssetDetailData; mode?: "line" | "candles" }) {
  const ranges = ["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "All"];
  const [range, setRange] = React.useState(asset.variant === "crypto" || asset.variant === "business-token" ? "1D" : "1Y");
  const [toolNotice, setToolNotice] = React.useState("");
  return <div className={`detail-chart detail-chart--${mode}`}>
    <div className="detail-chart-toolbar"><div><b>{asset.variant === "crypto" || asset.variant === "business-token" ? `${asset.name} · 1H · RWA.MS` : "NAV per Token"}</b><span>{asset.price} <em>{asset.change}</em></span></div><div className="detail-chart-actions"><button type="button" onClick={() => setToolNotice("Indicators panel ready")}>Indicators</button><button type="button" onClick={() => setToolNotice("Compare mode ready")}>Compare</button><button type="button" onClick={() => setToolNotice("Chart templates ready")}>Templates</button></div></div>
    <div className="chart-canvas" aria-label={`${asset.name} chart for ${range}`}>
      {mode === "candles" ? <CandleArt/> : <LineArt/>}
      <span className="chart-price-tag">{asset.price.replace("$", "")}</span>
    </div>
    <div className="chart-range">{ranges.map(item => <button type="button" key={item} data-active={range === item ? "true" : undefined} onClick={() => { setRange(item); setToolNotice(`Range changed to ${item}`); }}>{item}</button>)}</div>{toolNotice && <span className="sr-only" role="status" aria-live="polite">{toolNotice}</span>}
  </div>;
}

function LineArt() {
  return <svg viewBox="0 0 1000 280" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="detailFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".24"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs><path d="M0,210 L35,196 L64,202 L95,174 L130,181 L160,164 L195,190 L230,172 L265,225 L300,215 L338,200 L365,230 L398,205 L430,245 L463,221 L498,194 L530,182 L563,160 L596,174 L630,147 L664,151 L700,126 L734,139 L768,118 L803,145 L840,128 L878,162 L913,149 L948,173 L1000,180 L1000,280 L0,280Z" fill="url(#detailFill)"/><polyline points="0,210 35,196 64,202 95,174 130,181 160,164 195,190 230,172 265,225 300,215 338,200 365,230 398,205 430,245 463,221 498,194 530,182 563,160 596,174 630,147 664,151 700,126 734,139 768,118 803,145 840,128 878,162 913,149 948,173 1000,180" fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke"/></svg>;
}

function CandleArt() {
  const bars = [48,54,45,63,58,74,68,81,76,88,69,72,84,92,86,101,96,112,105,118,109,122,115,130,119,126,138,131,145,137,151,141,158,149,163,154,170,159,166,175,162,169,158,172,164,177,168,181,174,185,176,183,170,178,165,173];
  return <svg viewBox="0 0 1000 280" preserveAspectRatio="none" aria-hidden="true">{bars.map((v,i) => { const x=22+i*17.2; const up=i%4!==2; const y=245-v; const h=16+(i%5)*4; return <g key={i}><line x1={x} y1={y-9} x2={x} y2={y+h+10} stroke={up?"#10b981":"#ef4444"} strokeWidth="2"/><rect x={x-5} y={y} width="10" height={h} fill={up?"#10b981":"#ef4444"}/></g>;})}</svg>;
}

export function AssetIdentity({ asset, regulated = false }: { asset: AssetDetailData; regulated?: boolean }) {
  return <div className="asset-identity"><span className={`detail-asset-logo detail-asset-logo--${asset.variant}`}>{asset.symbol === "BTC" ? "₿" : asset.symbol.slice(0, 2)}</span><div><div className="detail-eyebrow">{regulated ? <Badge tone="success">REGULATED RWA</Badge> : <Badge tone="success">● Verified RWA</Badge>} <Badge tone="primary">{asset.assetClass}</Badge></div><h1>{asset.name} <span className="verified-dot">✓</span></h1><p>{asset.subtitle}</p></div></div>;
}

export function KeyValueGrid({ rows }: { rows: Array<[string, string, string?]> }) {
  return <div className="detail-kv-grid">{rows.map(([label,value,tone]) => <div key={label}><span>{label}</span><b className={tone || ""}>{value}</b></div>)}</div>;
}

export function DocumentsRow({ assetSlug }: { assetSlug: string }) {
  const docs = ["Offering Memorandum", "Valuation Report", "Property Appraisal", "Financial Statements", "Audit Report"];
  return <div className="document-row">{docs.map((doc,i) => <Link key={doc} href={`/rwa/${assetSlug}/documents/${i+1}`}><span>▤</span><b>{doc}</b><small>{i===0?"Version 2.1 · May 1, 2024":i===1?"Mar 31, 2024":"FY 2023"}</small><em>PDF</em></Link>)}</div>;
}

export function TradeCard({ asset, regulated = false }: { asset: AssetDetailData; regulated?: boolean }) {
  const router=useRouter();
  const [side,setSide]=React.useState("Buy"); const [amount,setAmount]=React.useState("10000");
  const numeric = Number(amount.replace(/,/g,"")) || 0;
  const price = Number(asset.price.replace(/[$,]/g,"")) || 1;
  function preview(){
    if(asset.variant==="regulated"){
      const returnTo=`/trade/${asset.slug}`;
      router.push(`/compliance/kyc?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    router.push(`/trade/${asset.slug}`);
  }
  return <section className="detail-trade-card"><div className="trade-toggle"><button type="button" data-active={side==="Buy"?"true":undefined} onClick={()=>setSide("Buy")}>{regulated?"Subscribe":"Buy"}</button><button type="button" data-active={side==="Sell"?"true":undefined} onClick={()=>setSide("Sell")}>{regulated?"Redeem":"Sell"}</button></div><label><span>You {side==="Buy"?"Pay":"Sell"}</span><div><b>◉ USDC</b><input aria-label="Trade amount" value={amount} onChange={e=>setAmount(e.target.value.replace(/[^0-9.]/g,""))}/></div></label><div className="amount-presets">{[1000,10000,50000,100000].map(v=><button type="button" key={v} onClick={()=>setAmount(String(v))}>${v>=1000?`${v/1000}K`:v}</button>)}</div><label><span>You Receive (Est.)</span><div><b>{asset.symbol}</b><strong>{(numeric/price).toLocaleString(undefined,{maximumFractionDigits:4})}</strong></div></label><div className="trade-lines"><span>Est. Price <b>{asset.price}</b></span><span>Settlement <b>{regulated?"T+2 Business Days":"Instant"}</b></span><span>Slippage Tolerance <b>0.50%</b></span></div><Button onClick={preview}>{regulated?"Preview Subscription":"Preview Order"}</Button><p>◇ {regulated?"Eligibility verification required before subscribing.":"RWA.MS execution is self-custodial."}</p></section>;
}
