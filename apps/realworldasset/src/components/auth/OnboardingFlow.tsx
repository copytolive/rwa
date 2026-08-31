"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/public";
import { Button, Input } from "@/components/ui";
import { ConnectWalletModal } from "@/components/overlays";
import "./onboarding.css";

const categories = [
  ["Real Estate","Properties, REITs, and real estate assets","⌂"],
  ["Private Credit","Private loans, credit funds, and debt investments","▤"],
  ["Businesses","Private companies and revenue-generating businesses","▣"],
  ["Commodities","Precious metals, energy, and agricultural assets","◈"],
  ["Crypto Assets","Tokenized digital assets and crypto-native opportunities","₿"],
  ["Infrastructure","Infrastructure projects and essential services","⌁"],
  ["Treasury & Bonds","Government securities and fixed income assets","🏛"],
  ["Venture Capital","Early-stage startups and growth equity","◉"],
] as const;
const follows = ["Kopi Nusantara","Seablue Estate","Blue Ocean Shipping"];

export function OnboardingFlow(){
  const router = useRouter();
  const [step,setStep]=React.useState(1);
  const [selected,setSelected]=React.useState<string[]>(["Real Estate","Businesses","Infrastructure"]);
  const [followed,setFollowed]=React.useState<string[]>([]);
  const [walletOpen,setWalletOpen]=React.useState(false);
  const [wallet,setWallet]=React.useState<string | null>(null);
  const [name,setName]=React.useState("");
  const [handle,setHandle]=React.useState("");
  const [bio,setBio]=React.useState("");
  const [softTheme,setSoftTheme]=React.useState(false);

  const toggleCategory=(name:string)=>setSelected(current=>current.includes(name)?current.filter(x=>x!==name):(current.length<3?[...current,name]:current));
  const toggleFollow=(name:string)=>setFollowed(current=>current.includes(name)?current.filter(x=>x!==name):[...current,name]);
  const goNext=()=>setStep(s=>Math.min(4,s+1));
  const finish=()=>router.push("/home");

  return <main className={`rwa-onboarding-page ${softTheme?"soft-theme":""}`}>
    <header className="rwa-onboarding-header"><Brand/><nav>{["Home","Discover","Markets","Businesses","Intelligence","Portfolio"].map(x=><button key={x} onClick={()=>router.push(`/${x.toLowerCase()}`)}>{x}</button>)}</nav><div><button className="rwa-icon-button" aria-label="Toggle theme" aria-pressed={softTheme} onClick={()=>setSoftTheme(v=>!v)}>☾</button><button className="rwa-icon-button" aria-label="Notifications" onClick={()=>router.push("/notifications")}>♧<sup>3</sup></button><Button onClick={()=>setWalletOpen(true)}>{wallet??"Connect Wallet"}</Button></div></header>
    <section className="rwa-onboarding-shell">
      <aside className="rwa-onboarding-side"><h2>Welcome to <span>RWA.MS</span></h2><p>Let's tailor your experience</p><p>Help us understand what matters most to you so we can surface the right markets, businesses, and opportunities.</p><hr/>{[["◎","Curated markets","See the tokenized real-world assets that match your interests."],["♟","Relevant businesses","Follow top-performing businesses in the sectors you care about."],["▰","Personalized insights","Get data, news, and alerts tailored to your preferences."],["ϟ","Better opportunities","Discover early opportunities across private markets and tokenized assets."]].map(([i,t,d])=><div className="rwa-onboarding-benefit" key={t}><span>{i}</span><p><b>{t}</b>{d}</p></div>)}<svg className="rwa-mini-chart" viewBox="0 0 330 82" aria-hidden="true"><defs><linearGradient id="onboarding-area" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#0a64ff" stopOpacity=".34"/><stop offset="1" stopColor="#0a64ff" stopOpacity="0"/></linearGradient></defs><path d="M0 70 L15 62 L28 65 L40 50 L52 57 L66 46 L82 55 L98 42 L112 48 L126 31 L141 38 L155 24 L170 33 L184 37 L198 51 L215 43 L232 50 L248 39 L264 42 L280 27 L295 34 L310 18 L330 25 L330 82 L0 82Z" fill="url(#onboarding-area)"/><polyline fill="none" stroke="currentColor" strokeWidth="2" points="0,70 15,62 28,65 40,50 52,57 66,46 82,55 98,42 112,48 126,31 141,38 155,24 170,33 184,37 198,51 215,43 232,50 248,39 264,42 280,27 295,34 310,18 330,25"/></svg></aside>
      <div className="rwa-onboarding-main">
        <div className="rwa-stepper">{[[1,"Tell us your interests"],[2,"Connect your wallet"],[3,"Profile setup"],[4,"You're all set!"]].map(([n,label],idx)=><React.Fragment key={n}><div className={step>=Number(n)?"active":""}><span>{n}</span><b>{label}</b></div>{idx<3&&<i/>}</React.Fragment>)}</div>
        {step===1&&<div className="rwa-step-content"><h1>What are you most interested in?</h1><p>Choose up to 3 categories that interest you. We'll customize your dashboard and recommendations.</p><div className="rwa-category-grid">{categories.map(([name,desc,icon])=>{const active=selected.includes(name);return <button type="button" key={name} className={active?"selected":""} onClick={()=>toggleCategory(name)}><span className="category-icon">{icon}</span>{active&&<em>✓</em>}<b>{name}</b><small>{desc}</small></button>})}</div><div className="rwa-selection-count">{selected.length} of 3 selected</div><h3>Suggested follows <mark>Recommended for you</mark></h3><div className="rwa-follow-grid">{follows.map((name,index)=><div key={name}><span>{name[0]}</span><p><b>{name} <i>✓</i></b><small>{index===0?"$KOPI · Indonesia":index===1?"$SEA · Singapore":"$SHIP · UAE"}</small><small>{index===0?"Real Estate · Agriculture":index===1?"Real Estate · Hospitality":"Logistics · Maritime"}</small><small>{index===0?"12.6K":index===1?"8.4K":"9.2K"} followers</small></p><Button size="sm" variant={followed.includes(name)?"primary":"secondary"} onClick={()=>toggleFollow(name)}>{followed.includes(name)?"Following":"＋ Follow"}</Button></div>)}</div><button className="rwa-view-more" onClick={()=>router.push("/discover")}>View more suggestions　⌄</button></div>}
        {step===2&&<div className="rwa-step-content rwa-onboarding-center"><span className="rwa-big-icon">▣</span><h1>Connect your wallet</h1><p>Link a self-custodial wallet to unlock trading, portfolio tracking, and rewards. You can skip this and connect later.</p>{wallet?<div className="rwa-connected-card"><b>✓ {wallet} connected</b><span>Ethereum Mainnet · 0x7f3a…9c4b</span><Button variant="secondary" onClick={()=>router.push("/account/wallet")}>Manage wallets</Button></div>:<Button size="lg" onClick={()=>setWalletOpen(true)}>Connect Wallet</Button>}</div>}
        {step===3&&<div className="rwa-step-content rwa-profile-step"><h1>Set up your profile</h1><p>Choose how the community sees you. You can edit this later in Settings.</p><div className="rwa-profile-avatar">R</div><Input label="Display name" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/><Input label="Username" value={handle} onChange={e=>setHandle(e.target.value.replace(/\s/g,""))} placeholder="@username"/><label className="rwa-textarea-field"><span>Bio</span><textarea value={bio} onChange={e=>setBio(e.target.value)} maxLength={160} placeholder="Tell the community about yourself"/><small>{bio.length}/160</small></label></div>}
        {step===4&&<div className="rwa-step-content rwa-onboarding-center"><span className="rwa-done-mark">✓</span><h1>You're all set!</h1><p>Your RWA.MS experience is ready. Your selected interests, follows, and wallet preferences have been saved locally for this UI prototype.</p><div className="rwa-summary-pills">{selected.map(x=><span key={x}>{x}</span>)}{wallet&&<span>{wallet}</span>}</div><Button size="lg" onClick={finish}>Enter RWA.MS →</Button></div>}
        <footer className="rwa-onboarding-footer">{step<4&&<><div className="rwa-onboarding-footer__buttons"><Button variant="secondary" onClick={()=>step===1?finish():setStep(s=>s-1)}>{step===1?"Skip for now":"Back"}</Button><Button onClick={()=>{if(step===3&&name.trim().length<2)setName("RWA Explorer");goNext();}}>{step===1?"Continue　→":step===2?"Continue　→":"Save & Continue　→"}</Button></div><small className="rwa-preference-note">▣　You can update your preferences anytime in Settings.</small></>}</footer>
      </div>
    </section>
    <ConnectWalletModal open={walletOpen} onOpenChange={setWalletOpen} wallets={["MetaMask","Rabby Wallet","WalletConnect","Coinbase Wallet","Trust Wallet","OKX Wallet"]} onConnect={w=>{setWallet(w);setWalletOpen(false);}}/>
  </main>
}
