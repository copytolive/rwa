"use client";

import * as React from "react";
import Link from "next/link";
import { AppShell } from "@/components/app";
import { Button } from "@/components/ui";
import {
  authorizeTestnetExecutionAgent,
  currentCommerceSession,
  getRuntimeCapabilities,
  submitRealExecutionOrder,
  type RuntimeCapabilities,
} from "@/lib/live-runtime";
import { getRealExecutionAccountSnapshot } from "@/lib/live-ops";
import "../program-workspaces/program-workspaces.css";
import "./trade-live.css";

type Side = "BUY" | "SELL";
type OrderType = "MARKET" | "LIMIT";
type Level = { px: number; sz: number; n: number | null };
type Candle = { t: number; c: number };

type MarketTruth = {
  mark: number | null;
  prevDay: number | null;
  changePct: number | null;
  volume: number | null;
  openInterest: number | null;
  funding: number | null;
  oracle: number | null;
};

const emptyTruth: MarketTruth = { mark:null, prevDay:null, changePct:null, volume:null, openInterest:null, funding:null, oracle:null };
function n(value: unknown){const x=Number(value);return Number.isFinite(x)?x:null}
function money(value:number|null){if(value==null)return "—";if(Math.abs(value)>=1e9)return `$${(value/1e9).toFixed(2)}B`;if(Math.abs(value)>=1e6)return `$${(value/1e6).toFixed(2)}M`;return `$${value.toLocaleString(undefined,{maximumFractionDigits:value>=10?2:6})}`}
function shortWallet(wallet?:string){return wallet?`${wallet.slice(0,8)}…${wallet.slice(-6)}`:"Not authenticated"}
function jsonText(value:any,max=2200){try{return JSON.stringify(value,null,2).slice(0,max)}catch{return String(value)}}

function Sparkline({candles}:{candles:Candle[]}){
  if(candles.length<2)return <div className="tl-chart-empty">Candle history unavailable from the public venue.</div>;
  const values=candles.map(x=>x.c);const lo=Math.min(...values),hi=Math.max(...values),range=Math.max(hi-lo,Number.EPSILON);
  const points=values.map((v,i)=>`${(i/(values.length-1))*100},${92-((v-lo)/range)*78}`).join(" ");
  return <div className="tl-chart" aria-label="Real one-minute close history"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img"><polyline points={points}/></svg><div className="tl-chart-axis"><span>{money(hi)}</span><span>{money(lo)}</span></div></div>;
}

export function TradeLiveWorkspace({asset}:{asset:string}){
  const coin=(asset.split("-")[0]||"BTC").toUpperCase();
  const session=currentCommerceSession();
  const [caps,setCaps]=React.useState<RuntimeCapabilities|null>(null);
  const [truth,setTruth]=React.useState<MarketTruth>(emptyTruth);
  const [bids,setBids]=React.useState<Level[]>([]);const [asks,setAsks]=React.useState<Level[]>([]);const [candles,setCandles]=React.useState<Candle[]>([]);
  const [feedState,setFeedState]=React.useState<"CONNECTING"|"LIVE"|"STALE">("CONNECTING");const [lastSuccess,setLastSuccess]=React.useState<Date|null>(null);const [feedError,setFeedError]=React.useState("");
  const [side,setSide]=React.useState<Side>("BUY");const [type,setType]=React.useState<OrderType>("MARKET");const [size,setSize]=React.useState("");const [price,setPrice]=React.useState("");const [leverage,setLeverage]=React.useState("1");
  const [agent,setAgent]=React.useState(false);const [busy,setBusy]=React.useState(false);const [message,setMessage]=React.useState("");const [orderResult,setOrderResult]=React.useState<any>(null);const [account,setAccount]=React.useState<any>(null);

  const loadMarket=React.useCallback(async()=>{
    try{
      const [metaRes,bookRes]=await Promise.all([
        fetch("https://api.hyperliquid.xyz/info",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({type:"metaAndAssetCtxs"}),cache:"no-store"}),
        fetch("https://api.hyperliquid.xyz/info",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({type:"l2Book",coin}),cache:"no-store"}),
      ]);
      if(!metaRes.ok)throw new Error(`Hyperliquid market HTTP ${metaRes.status}`);
      if(!bookRes.ok)throw new Error(`Hyperliquid order book HTTP ${bookRes.status}`);
      const payload=await metaRes.json();const meta=payload?.[0],ctxs=payload?.[1];
      const index=Array.isArray(meta?.universe)?meta.universe.findIndex((x:any)=>String(x?.name||"").toUpperCase()===coin):-1;
      const ctx=index>=0?ctxs?.[index]:null;if(!ctx)throw new Error(`${coin} market context unavailable`);
      const mark=n(ctx.markPx),prev=n(ctx.prevDayPx);
      setTruth({mark,prevDay:prev,changePct:mark!=null&&prev!=null&&prev!==0?((mark-prev)/prev)*100:null,volume:n(ctx.dayNtlVlm),openInterest:n(ctx.openInterest),funding:n(ctx.funding),oracle:n(ctx.oraclePx)});
      const book=await bookRes.json();const levels=Array.isArray(book?.levels)?book.levels:[];
      const parse=(rows:any[]):Level[]=>Array.isArray(rows)?rows.slice(0,12).map((x:any)=>({px:Number(x?.px),sz:Number(x?.sz),n:Number.isFinite(Number(x?.n))?Number(x.n):null})).filter(x=>x.px>0&&x.sz>=0):[];
      setBids(parse(levels[0]));setAsks(parse(levels[1]));setFeedState("LIVE");setFeedError("");setLastSuccess(new Date());
    }catch(e:any){setFeedState("STALE");setFeedError(String(e?.message||e));}
  },[coin]);

  const loadCandles=React.useCallback(async()=>{
    try{
      const end=Date.now(),start=end-2*60*60*1000;
      const r=await fetch("https://api.hyperliquid.xyz/info",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({type:"candleSnapshot",req:{coin,interval:"1m",startTime:start,endTime:end}}),cache:"no-store"});
      if(!r.ok)throw new Error(`Candle HTTP ${r.status}`);
      const p=await r.json();if(!Array.isArray(p))throw new Error("Candle response unavailable");
      setCandles(p.map((x:any)=>({t:Number(x?.t),c:Number(x?.c)})).filter((x:Candle)=>Number.isFinite(x.t)&&x.c>0).slice(-120));
    }catch{setCandles([]);}
  },[coin]);

  React.useEffect(()=>{
    void getRuntimeCapabilities().then(setCaps).catch(()=>setCaps(null));void loadMarket();void loadCandles();
    const timer=window.setInterval(()=>void loadMarket(),4000);const candleTimer=window.setInterval(()=>void loadCandles(),30000);
    return()=>{window.clearInterval(timer);window.clearInterval(candleTimer)};
  },[loadMarket,loadCandles]);

  const authorize=async()=>{setBusy(true);try{const out=await authorizeTestnetExecutionAgent();setAgent(true);setMessage("Hyperliquid TESTNET execution agent authorized for the signed wallet.");setOrderResult(out)}catch(e:any){setAgent(false);setMessage(String(e?.message||e))}finally{setBusy(false)}};
  const loadAccount=async()=>{if(!currentCommerceSession()){setMessage("Signed wallet session required.");return}setBusy(true);try{const out=await getRealExecutionAccountSnapshot(true);setAccount(out);setMessage(`Hyperliquid TESTNET returned ${out.fills.length} fill(s).`)}catch(e:any){setAccount(null);setMessage(String(e?.message||e))}finally{setBusy(false)}};
  const submit=async()=>{const qty=Number(size),limit=type==="LIMIT"?Number(price):undefined;if(!(qty>0)){setMessage("Enter a positive order size.");return}if(type==="LIMIT"&&!(Number(limit)>0)){setMessage("Enter a positive limit price.");return}setBusy(true);setOrderResult(null);try{const out=await submitRealExecutionOrder({coin,side,type,size:qty,price:limit,leverage:Math.max(1,Number(leverage)||1),environment:"testnet"});setOrderResult(out);setMessage("Hyperliquid TESTNET returned an authoritative order response.")}catch(e:any){setMessage(String(e?.message||e))}finally{setBusy(false)}};

  return <AppShell><main className="pw-page tl-page" data-live-source="hyperliquid-public" data-trade-environment="testnet">
    <header className="pw-hero tl-hero"><div><small>RWA.MS / HYPERLIQUID</small><h1>{coin} / USDC Trading</h1><p>Market reads come from Hyperliquid public endpoints. Order writes are sent only to the signed Hyperliquid TESTNET execution adapter; mainnet remains machine-gated.</p></div><div className="pw-hero-actions"><span className="tl-feed" data-state={feedState}>{feedState==="LIVE"?"LIVE VENUE DATA":feedState}</span><Button variant="secondary" onClick={()=>{void loadMarket();void loadCandles()}}>Refresh Venue</Button></div></header>

    <section className="tl-ticker">
      <article><span>Mark</span><strong>{money(truth.mark)}</strong><small>{lastSuccess?`Updated ${lastSuccess.toLocaleTimeString()}`:"No successful response"}</small></article>
      <article><span>24h change</span><strong className={truth.changePct!=null&&truth.changePct>=0?"tl-positive":"tl-negative"}>{truth.changePct==null?"—":`${truth.changePct>=0?"+":""}${truth.changePct.toFixed(2)}%`}</strong><small>Previous day {money(truth.prevDay)}</small></article>
      <article><span>24h venue volume</span><strong>{money(truth.volume)}</strong><small>Hyperliquid notional volume</small></article>
      <article><span>Open interest</span><strong>{money(truth.openInterest)}</strong><small>Funding {truth.funding==null?"—":`${(truth.funding*100).toFixed(4)}%`}</small></article>
      <article><span>Oracle</span><strong>{money(truth.oracle)}</strong><small>Public venue context</small></article>
    </section>

    {feedError?<div className="tl-inline-alert" role="status">{feedError}. No synthetic market values are substituted.</div>:null}

    <section className="tl-layout">
      <div className="tl-main">
        <section className="pw-panel tl-chart-panel"><div className="tl-section-head"><div><span>REAL 1-MINUTE CANDLES</span><h2>{coin} public close history</h2></div><small>{candles.length?`${candles.length} venue candles loaded`:"Venue candle history unavailable"}</small></div><Sparkline candles={candles}/></section>
        <section className="pw-panel tl-book"><div className="tl-section-head"><div><span>LIVE L2 BOOK</span><h2>Order book</h2></div><small>Top venue levels</small></div><div className="tl-book-grid"><div><h3>Asks</h3>{asks.length?asks.slice().reverse().map((x,i)=><div className="tl-level ask" key={`${x.px}-${i}`}><span>{x.px.toLocaleString()}</span><span>{x.sz.toLocaleString()}</span></div>):<p>No ask levels loaded.</p>}</div><div><h3>Bids</h3>{bids.length?bids.map((x,i)=><div className="tl-level bid" key={`${x.px}-${i}`}><span>{x.px.toLocaleString()}</span><span>{x.sz.toLocaleString()}</span></div>):<p>No bid levels loaded.</p>}</div></div></section>
        <section className="pw-panel"><div className="tl-section-head"><div><span>AUTHENTICATED TESTNET ACCOUNT</span><h2>Positions & fills evidence</h2></div><Button variant="secondary" disabled={!session||busy} onClick={loadAccount}>Load TESTNET Account</Button></div>{account?<div className="tl-account"><div><strong>{account.fills.length}</strong><span>venue fills</span></div><pre>{jsonText(account.state,3600)}</pre></div>:<div className="tl-empty">{session?"No TESTNET account response loaded yet.":"Connect and sign the wallet to load account-specific venue evidence."}</div>}</section>
      </div>

      <aside className="pw-panel tl-order"><div className="tl-order-head"><div><span>ORDER WRITE PATH</span><h2>TESTNET order</h2></div><b>MAINNET LOCKED</b></div><div className="tl-env"><span>Wallet</span><strong>{shortWallet(session?.wallet)}</strong><span>Execution capability</span><strong>{caps?.executionAvailable?"AVAILABLE":"LOCKED"}</strong><span>Agent</span><strong>{agent?"AUTHORIZED":"NOT AUTHORIZED"}</strong></div><div className="tl-side"><button type="button" data-active={side==="BUY"} onClick={()=>setSide("BUY")}>BUY</button><button type="button" data-active={side==="SELL"} onClick={()=>setSide("SELL")}>SELL</button></div><label>Order type<select value={type} onChange={e=>setType(e.target.value as OrderType)}><option>MARKET</option><option>LIMIT</option></select></label><label>Size<input inputMode="decimal" value={size} onChange={e=>setSize(e.target.value)} placeholder="0.001"/></label>{type==="LIMIT"?<label>Limit price<input inputMode="decimal" value={price} onChange={e=>setPrice(e.target.value)} placeholder={truth.mark?String(truth.mark):"Required"}/></label>:null}<label>Leverage<input type="number" min="1" value={leverage} onChange={e=>setLeverage(e.target.value)}/></label><Button disabled={!session||busy} variant="secondary" onClick={authorize}>{agent?"TESTNET Agent Authorized":"Authorize TESTNET Agent"}</Button><Button disabled={!session||!agent||busy} onClick={submit}>{busy?"Working…":`Submit ${side} to TESTNET`}</Button><p className="tl-order-note">No control on this page can enable mainnet. The server re-checks environment and machine readiness at write time.</p><Link className="tl-link" href="/account/wallet">Wallet & venue control</Link>{orderResult?<pre>{jsonText(orderResult,2600)}</pre>:null}</aside>
    </section>
    {message?<div className="pw-notice" role="status">{message}</div>:null}
  </main></AppShell>;
}
