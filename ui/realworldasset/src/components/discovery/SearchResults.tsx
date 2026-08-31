"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app";
import { Button } from "@/components/ui";
import { assets, businesses, people } from "./data";
import { AssetCard, FollowButton, PersonRow, SearchBox, SectionHeader } from "./shared";
import "./discovery.css";

export function SearchResults(){
 const params=useSearchParams(); const router=useRouter(); const initial=params.get("q")||"kopi"; const [tab,setTab]=React.useState("All");
 const tabs=["All","Tokens","Businesses","RWA","People","Thesis"];
 return <AppShell><main className="search-page page-pad"><SearchBox defaultValue={initial} onSubmit={q=>router.push(`/search?q=${encodeURIComponent(q)}`)}/><div className="search-tabs">{tabs.map(x=><button key={x} data-active={tab===x?"true":undefined} onClick={()=>setTab(x)}>{x}</button>)}</div><p className="result-count">About 128 results for “{initial}”</p>
 <div className="search-results-grid">
  <section className="panel result-block"><SectionHeader title="TOKENS" href="/markets"/>{businesses.slice(0,3).map(b=><Link className="token-result" key={b.slug} href={`/businesses/${b.slug}/token`}><span className="entity-logo">{b.symbol[0]}</span><span><b>{b.symbol}</b><small>{b.name}</small></span><strong>{b.price}</strong><em>{b.change}</em><span>{b.marketCap}</span></Link>)}<Link className="view-all-row" href="/markets">View all Tokens (18)</Link></section>
  <section className="panel result-block businesses-result"><SectionHeader title="BUSINESSES" href="/businesses"/>{businesses.slice(0,3).map(b=><div className="business-result-row" key={b.slug}><Link href={`/businesses/${b.slug}`}><span className="entity-logo large">{b.symbol[0]}</span><span><b>{b.name} ✓</b><small>{b.category} business operating in {b.country}.</small><em>{b.category}　{b.country}　Real Assets</em></span><span><small>Market Cap</small><strong>{b.marketCap}</strong><small>Followers</small><strong>{b.followers}</strong></span></Link><FollowButton/></div>)}<Link className="view-all-row" href="/businesses">View all Businesses (32)</Link></section>
  <section className="panel result-block"><SectionHeader title="PEOPLE" href="/community"/>{people.map(p=><PersonRow key={p.slug} person={p}/>)}<Link className="view-all-row" href="/community">View all People (24)</Link></section>
  <section className="panel result-block rwa-results"><SectionHeader title="RWA" href="/rwa"/><div className="mini-asset-grid">{assets.slice(0,3).map(a=><Link key={a.slug} href={`/rwa/${a.slug}`}><div className="mini-asset-image"/><h3>{a.name}</h3><small>{a.className} · {a.country}</small><span>Valuation <b>{a.aum}</b></span><span>Token <b>{a.symbol}</b></span></Link>)}</div><Link className="view-all-row" href="/rwa">View all RWA (27)</Link></section>
  <section className="panel result-block thesis-results"><SectionHeader title="THESIS" href="/community"/>{["The Rise of Indonesian Coffee: Why KOPI is Brewing Long-Term Value","Tokenizing Agriculture: Kopi Nusantara Business Deep Dive","Kopi Chain: Building the Settlement Layer for Real-World Assets"].map((x,i)=><Link key={x} href={`/community/thesis/kopi-${i+1}`}><span className="thesis-icon">◇</span><span><b>{x}</b><small>RWA Research · {i+2} days ago</small><p>Research and analysis related to {initial}, real-world assets, and tokenized markets...</p></span><em>♡ {112-i*23}　◯ {24-i*4}</em></Link>)}<Link className="view-all-row" href="/community">View all Thesis (19)</Link></section>
  <aside className="search-side"><section className="panel snapshot-list"><h2>MARKET SNAPSHOT</h2>{[["Total RWA Market Cap","$9.87T","+1.26%"],["Total Businesses","24,891","+1.82%"],["Total RWA Assets","18,642","+1.31%"],["Active Markets (24H)","194","+2.08%"]].map(([a,b,c])=><div key={a}><span>{a}</span><b>{b}</b><em>{c}</em></div>)}</section><section className="panel listing-cta"><h3>Can’t find what you’re looking for?</h3><p>Request a business or asset to be listed on RWA.MS.</p><Button variant="secondary" onClick={()=>router.push("/listing-request")}>Submit Listing Request ↗</Button></section></aside>
 </div></main></AppShell>
}
