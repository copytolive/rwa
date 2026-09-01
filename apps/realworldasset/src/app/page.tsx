import Link from "next/link";
import { PublicShell } from "@/components/public";
import "./landing.css";

const featured = [
  ["Kopi Nusantara","F&B · Indonesia","KOPI","$248.5M","$2.48","+8.72%","/businesses/kopi-nusantara"],
  ["Marina Bay Residences","Real Estate · Singapore","MBR","$482.3M","$1.92","+6.31%","/rwa/marina-bay-residences"],
  ["Blue Ocean Shipping","Maritime · Singapore","SHIP","$356.8M","$1.35","+3.20%","/businesses/blue-ocean-shipping"],
  ["Private Credit Fund","Private Credit · Global","SSPC","$612.4M","$1.08","+4.51%","/rwa/seaside-private-credit-fund"],
] as const;

const features = [
  ["Discover Businesses","Explore verified-ready business profiles across real estate, private credit, infrastructure, and more.","/businesses","▥"],
  ["Explore RWA","Preview tokenized real-world-asset workflows with transparent evidence gates.","/rwa","◫"],
  ["Explore Markets","Preview market and execution interfaces while live writes remain fail-closed.","/markets","↕"],
  ["Rewards","Explore rewards, missions, and allocation interfaces in the demo workspace.","/rewards","♢"],
  ["Build Community","Join the community interface for investors and business builders.","/community","♙"],
  ["Business OS","Manage, tokenize, and grow a business through the unified interface.","/merchant","◇"],
] as const;

const previewBusinesses = [
  ["K","Kopi Nusantara","F&B · Indonesia","$2.48","+8.72%"],
  ["M","Marina Bay Residences","Real Estate · Singapore","$1.92","+6.31%"],
  ["B","Blue Ocean Shipping","Maritime · Singapore","$1.35","+3.20%"],
  ["P","Private Credit Fund","Private Credit · Global","$1.08","+4.51%"],
] as const;

function Sparkline(){return <svg className="rwa-spark" viewBox="0 0 64 22" aria-hidden="true"><polyline fill="none" stroke="currentColor" strokeWidth="2" points="1,17 8,16 15,11 22,13 31,7 39,9 47,4 55,7 63,3"/></svg>}

export default function LandingPage(){
  return <PublicShell>
    <main className="rwa-landing">
      <section className="rwa-hero">
        <div className="rwa-hero__copy">
          <h1>Where Businesses<br/>Become <span>Markets</span></h1>
          <p>Discover businesses, explore tokenized real-world-asset workflows, and preview private-market interfaces. Market figures shown in this public preview are deterministic demo data until live evidence services are connected.</p>
          <div className="rwa-hero__actions">
            <Link className="rwa-link-button rwa-link-button--primary" href="/markets">Explore Markets <span>→</span></Link>
            <Link className="rwa-link-button" href="/businesses">Explore Businesses</Link>
            <Link className="rwa-link-button" href="/rwa">Explore RWA</Link>
          </div>
          <div className="rwa-stats">
            <div><b>1,248+</b><span>Demo Businesses <em>Sample</em></span></div>
            <div><b>$9.87B</b><span>Demo RWA Market Cap <em>Sample</em></span></div>
            <div><b>124K+</b><span>Demo Users <em>Sample</em></span></div>
            <div><b>93+</b><span>Demo Countries <em>Sample</em></span></div>
          </div>
        </div>
        <Link href="/home" className="rwa-dashboard-preview" aria-label="Open authenticated home preview">
          <img className="rwa-dashboard-reference" src="/rwa/chat01/landing-dashboard.jpg" alt="" aria-hidden="true"/>
          <div className="preview-top"><span className="preview-logo">◈ RWA.MS</span><span className="preview-search">⌕ Search markets, businesses, tokens…</span><span className="preview-utility">♧　☾</span><span className="preview-connect">Connect Wallet · Demo</span></div>
          <div className="preview-grid">
            <aside><b>◉ Overview</b><span>▧ Markets</span><span>⌂ Businesses</span><span>◇ RWA</span><span>☆ Watchlist</span><span>▣ Portfolio</span><span>♢ Rewards</span></aside>
            <section className="preview-main">
              <h3>Demo Market Overview</h3>
              <div className="preview-kpis">
                <i><small>Demo RWA Market Cap</small><strong>$9.87B</strong><em>Sample</em><Sparkline/></i>
                <i><small>Demo Total Value Locked</small><strong>$2.48B</strong><em>Sample</em><Sparkline/></i>
                <i><small>Demo 24H Volume</small><strong>$194.2M</strong><em>Sample</em><Sparkline/></i>
                <i><small>Demo Businesses</small><strong>1,248</strong><em>Sample</em><Sparkline/></i>
              </div>
              <div className="preview-lower">
                <div className="preview-trending"><div className="preview-block-title"><b>Demo Businesses</b><span>View all</span></div>{previewBusinesses.map(([avatar,name,sector,price,change])=><div className="preview-business" key={name}><span>{avatar}</span><p><b>{name}</b><small>{sector}</small></p><strong>{price}</strong><em>{change}</em></div>)}</div>
                <div className="preview-market-chart"><div className="preview-block-title"><b>Demo RWA Market Cap</b><span>1D　7D　1M　3M　1Y　<b>ALL</b></span></div><strong>$9.87B <em>Sample</em></strong><svg viewBox="0 0 320 115" aria-hidden="true"><defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#1174ff" stopOpacity=".35"/><stop offset="1" stopColor="#1174ff" stopOpacity="0"/></linearGradient></defs><path d="M2 104 L22 94 L38 88 L55 72 L72 79 L88 62 L103 66 L121 49 L137 57 L154 42 L170 48 L188 31 L205 38 L222 25 L238 31 L255 18 L270 27 L286 15 L304 20 L318 8 L318 112 L2 112Z" fill="url(#pg)"/><polyline fill="none" stroke="#2b7cff" strokeWidth="2.2" points="2,104 22,94 38,88 55,72 72,79 88,62 103,66 121,49 137,57 154,42 170,48 188,31 205,38 222,25 238,31 255,18 270,27 286,15 304,20 318,8"/></svg></div>
              </div>
            </section>
          </div>
        </Link>
      </section>
      <section className="rwa-featured">
        <div className="rwa-section-title"><h2>Featured Demo Businesses & Assets</h2><Link href="/markets">View all markets →</Link></div>
        <div className="rwa-featured-grid">{featured.map(([name,sector,symbol,cap,price,change,href])=><Link key={symbol} href={href} className="rwa-market-card"><div><span className={`rwa-market-avatar avatar-${symbol.toLowerCase()}`}>{name[0]}</span><p><b>{name}</b><small>{sector} <i>{symbol}</i></small></p><em>● Demo profile · verification gated</em></div><dl><div><dt>Demo Market Cap</dt><dd>{cap}</dd></div><div><dt>Demo Price</dt><dd>{price}</dd></div><div className="rwa-card-change"><Sparkline/><dt>Demo 24H</dt><dd className="positive">{change}</dd></div></dl></Link>)}</div>
      </section>
      <section className="rwa-everything"><h2>Everything in One Platform</h2><div className="rwa-feature-grid">{features.map(([title,text,href,icon])=><Link key={title} href={href}><span>{icon}</span><div><b>{title}</b><p>{text}</p></div></Link>)}</div></section>
      <section className="rwa-trust"><b>Integration Targets · Demo</b>{["Hyperliquid","Chainlink","Trust Wallet","CIRCLE","Fireblocks"].map((x,i)=><span className={`trust-${i}`} key={x}>◇ {x}</span>)}</section>
    </main>
    <footer className="rwa-footer"><div><b className="rwa-footer-brand">◈ RWA.MS</b><p>The gateway to real-world assets.<br/>Where businesses become markets.</p></div><div><b>Platform</b><Link href="/markets">Markets</Link><Link href="/businesses">Businesses</Link><Link href="/rwa">RWA</Link></div><div><b>Resources</b><Link href="/docs">Docs</Link><Link href="/blog">Blog</Link><Link href="/help">Help Center</Link></div><div><b>Company</b><Link href="/about">About</Link><Link href="/careers">Careers</Link><Link href="/press">Press</Link></div><div><b>Legal</b><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link><Link href="/risk-disclosure">Risk Disclosure</Link></div><div><b>Stay Connected</b><div className="rwa-socials"><a href="https://x.com" target="_blank" rel="noreferrer">𝕏</a><a href="https://discord.com" target="_blank" rel="noreferrer">◉</a><a href="https://telegram.org" target="_blank" rel="noreferrer">➤</a><a href="https://linkedin.com" target="_blank" rel="noreferrer">in</a></div><small>© 2026 RWA.MS. All rights reserved.</small></div></footer>
  </PublicShell>
}
