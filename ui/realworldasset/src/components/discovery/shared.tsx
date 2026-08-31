"use client";

import * as React from "react";
import Link from "next/link";
import { Badge, Button } from "@/components/ui";
import type { Asset, Business, Person } from "./data";

export function SearchBox({ defaultValue = "", placeholder = "Search businesses, assets, tokens, categories, or people...", onSubmit }: { defaultValue?: string; placeholder?: string; onSubmit: (value:string)=>void }) {
  const [value,setValue]=React.useState(defaultValue);
  return <form className="core-search" onSubmit={e=>{e.preventDefault();onSubmit(value.trim())}} role="search"><span>⌕</span><input aria-label={placeholder} value={value} onChange={e=>setValue(e.target.value)} placeholder={placeholder}/>{value&&<button type="button" aria-label="Clear search" onClick={()=>setValue("")}>×</button>}<kbd>⌘ K</kbd></form>;
}

export function FollowButton({ label="Follow" }: { label?:string }){
 const [following,setFollowing]=React.useState(false);
 return <Button size="sm" variant={following?"secondary":"ghost"} onClick={()=>setFollowing(v=>!v)}>{following?"Following":label}</Button>;
}

export function BusinessCard({business}:{business:Business}){
 const [following,setFollowing]=React.useState(false);
 return <article className="business-card"><div className="entity-cover cover-business"><span className="entity-logo">{business.symbol.slice(0,2)}</span>{business.verified&&<Badge tone="success">● Verified Business</Badge>}</div><div className="entity-card-body"><h3>{business.name}</h3><p>{business.category} · {business.country}</p><div className="entity-meta"><span>★ {business.rating}</span><span>{business.followers} Followers</span></div><div className="price-strip"><b>${business.symbol}</b><span>{business.price}</span><em>{business.change}</em></div><div className="metrics-row">{business.metrics.map(x=><span key={x}>{x}</span>)}</div><div className="entity-actions"><Button variant="secondary" onClick={()=>setFollowing(v=>!v)}>{following?"Following":"☆ Follow"}</Button><Link className="rwa-link-button rwa-link-button--primary" href={`/businesses/${business.slug}`}>View Business</Link></div></div></article>;
}

export function AssetCard({asset}:{asset:Asset}){
 const [watch,setWatch]=React.useState(false);
 return <article className="asset-card"><div className={`entity-cover asset-${asset.className.toLowerCase().replace(/[^a-z]+/g,"-")}`}><Badge tone={asset.verified?"success":"neutral"}>{asset.verified?"● Verified":"Unverified"}</Badge><button className="star-button" aria-label={watch?`Remove ${asset.name} from watchlist`:`Add ${asset.name} to watchlist`} type="button" onClick={()=>setWatch(v=>!v)}>{watch?"★":"☆"}</button><span className="asset-class">{asset.className}</span></div><div className="entity-card-body"><h3>{asset.name}</h3><p>{asset.issuer} · {asset.country}</p><div className="asset-symbol">{asset.symbol}</div><dl className="asset-stats"><div><dt>AUM</dt><dd>{asset.aum}</dd></div><div><dt>Yield (APY)</dt><dd className="positive">{asset.yield}</dd></div><div><dt>Maturity</dt><dd>{asset.maturity}</dd></div></dl><div className="entity-actions"><Link className="rwa-link-button rwa-link-button--primary" href={`/rwa/${asset.slug}`}>View Asset</Link><Button variant="secondary" onClick={()=>setWatch(v=>!v)}>{watch?"★ Watching":"☆ Add to Watchlist"}</Button></div></div></article>;
}

export function PersonRow({person}:{person:Person}){
 return <div className="person-row"><Link href={`/community/users/${person.slug}`} className="person-main"><span className="person-avatar">{person.name.split(" ").map(x=>x[0]).join("")}</span><span><b>{person.name} ✓</b><small>{person.handle}</small><small>{person.role}</small><em>{person.followers} Followers</em></span></Link><FollowButton/></div>;
}

export function SectionHeader({title,href="/discover"}:{title:string;href?:string}){return <div className="section-head"><h2>{title}</h2><Link href={href}>View all</Link></div>}
