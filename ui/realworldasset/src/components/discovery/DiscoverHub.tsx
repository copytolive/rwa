"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app";
import { Badge, Button } from "@/components/ui";
import { businesses, assets, people } from "./data";
import { FollowButton, PersonRow, SearchBox, SectionHeader } from "./shared";
import "./discovery.css";

export function DiscoverHub(){
 const router=useRouter(); const [verified,setVerified]=React.useState(false); const [follows,setFollows]=React.useState<Record<string,boolean>>({});
 const chips=["Kopi Nusantara","Marina Bay Residences","Blue Ocean Shipping","GreenLeaf Farms","Maple Finance","Private Credit","Real Estate","Commodities"];
 return <AppShell><main className="discover-page page-pad"><div className="page-title"><div><h1>Discover Hub</h1><p>Explore the best real-world assets, businesses, tokens, and ideas shaping the future of onchain finance.</p></div></div>
 <div className="discover-search-row"><SearchBox onSubmit={q=>router.push(`/search?q=${encodeURIComponent(q)}`)}/><Button variant="secondary" onClick={()=>router.push("/search?saved=1")}>◉ Saved Searches</Button></div>
 <div className="filter-row"><Button variant="secondary" onClick={()=>router.push("/discover?filters=open")}>⌘ All Filters</Button>{["All Asset Types","All Regions","All Token Types","Min. Market Cap"].map(x=><button key={x} onClick={()=>router.push(`/search?q=${encodeURIComponent(x)}`)}>{x}⌄</button>)}<label className="switch-filter">Verified Only <input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/></label><button onClick={()=>setVerified(false)}>Reset</button></div>
 <div className="popular-searches"><span>Popular Searches:</span>{chips.map(x=><button key={x} onClick={()=>router.push(`/search?q=${encodeURIComponent(x)}`)}>{x}</button>)}</div>
 <div className="discover-grid-4">
  <section className="panel"><SectionHeader title="Trending Assets" href="/rwa"/><div className="rank-list">{assets.slice(0,5).map((a,i)=><Link key={a.slug} href={`/rwa/${a.slug}`}><span>{i+1}</span><b>{a.name}</b><small>{a.className}</small><em>{a.yield}</em></Link>)}</div></section>
  <section className="panel"><SectionHeader title="New Businesses" href="/businesses"/>{businesses.slice(0,5).map(b=><div className="compact-action-row" key={b.slug}><Link href={`/businesses/${b.slug}`}><span className="entity-logo">{b.symbol[0]}</span><span><b>{b.name}</b><small>{b.category} · {b.country}</small></span></Link><Button size="sm" variant="secondary" onClick={()=>router.push(`/businesses/${b.slug}`)}>View Business</Button></div>)}</section>
  <section className="panel"><SectionHeader title="New RWAs" href="/rwa"/>{assets.slice(0,5).map(a=><div className="compact-action-row" key={a.slug}><Link href={`/rwa/${a.slug}`}><span className="entity-logo">{a.symbol[0]}</span><span><b>{a.name}</b><small>{a.className} · {a.country}</small></span></Link><Button size="sm" variant="secondary" onClick={()=>router.push(`/rwa/${a.slug}`)}>Explore</Button></div>)}</section>
  <section className="panel"><SectionHeader title="Top Tokens" href="/markets"/>{businesses.slice(0,5).map(b=><div className="compact-action-row" key={b.slug}><Link href={`/businesses/${b.slug}/token`}><span className="entity-logo">{b.symbol[0]}</span><span><b>{b.symbol}</b><small>{b.name}</small></span></Link><span className="token-price"><b>{b.price}</b><small>{b.marketCap} MC</small></span><Button size="sm" variant="secondary" onClick={()=>router.push(`/businesses/${b.slug}/token`)}>View Token</Button></div>)}</section>
 </div>
 <section className="panel category-panel"><SectionHeader title="Categories" href="/rwa"/><div className="category-grid">{[["Real Estate","1,248"],["Private Credit","856"],["Commodities","642"],["Hospitality","312"],["Coffee","186"],["Shipping","274"],["Infrastructure","468"]].map(([x,n])=><button key={x} onClick={()=>router.push(`/search?q=${encodeURIComponent(x)}`)}><span>◇</span><b>{x}</b><small>{n} Assets</small></button>)}</div></section>
 <div className="discover-bottom-grid"><section className="panel"><SectionHeader title="People to Follow" href="/community"/>{people.map(p=><PersonRow key={p.slug} person={p}/>)}</section><section className="panel research-panel"><SectionHeader title="Featured Research" href="/intelligence"/><div className="research-grid">{["The Rise of Revenue-Based Financing in RWAs","Real Estate Tokenization: Q2 2024 Outlook","Private Credit Pools: Risk vs. Yield"].map((x,i)=><Link key={x} href={`/intelligence/research-${i+1}`}><Badge tone="primary">RESEARCH</Badge><h3>{x}</h3><small>RWA Research · {i+2}h ago</small><span>◉ {245+i*67}　◯ {18+i*3}　☆ Save</span></Link>)}</div></section><section className="panel"><SectionHeader title="Recommended Businesses" href="/businesses"/>{businesses.slice(0,3).map(b=><div className="compact-action-row" key={b.slug}><Link href={`/businesses/${b.slug}`}><span className="entity-logo">{b.symbol[0]}</span><span><b>{b.name}</b><small>{b.category}</small></span></Link><Button size="sm" variant="secondary" onClick={()=>router.push(`/businesses/${b.slug}`)}>View Business</Button></div>)}</section></div>
 </main></AppShell>
}
