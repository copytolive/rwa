"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/public";
import { Button, Input, Toast } from "@/components/ui";
import { ConnectWalletModal, ConfirmationDialog, FormDialog } from "@/components/overlays";
import "./wallet.css";

type WalletRow = { id:string; name:string; address:string; network:string; balance:string; unit:string; activity:string; primary?:boolean };
type SessionRow = { id:string; browser:string; device:string; location:string; country:string; ip:string; active:string; current?:boolean };

const initialWallets: WalletRow[] = [
  {id:"metamask",name:"MetaMask",address:"0x3a7e…9f2B",network:"Ethereum Mainnet",balance:"$4,248.35",unit:"2.1568 ETH",activity:"2 minutes ago",primary:true},
  {id:"rabby",name:"Rabby Wallet",address:"0x8b12…c4D9",network:"Arbitrum One",balance:"$1,284.72",unit:"0.8423 ETH",activity:"1 hour ago"},
  {id:"coinbase",name:"Coinbase Wallet",address:"0x7F59…a2E1",network:"Polygon",balance:"$315.60",unit:"1,045.23 USDC",activity:"5 hours ago"},
  {id:"walletconnect",name:"WalletConnect",address:"0x9c8D…b7A3",network:"BNB Smart Chain",balance:"$198.44",unit:"0.3891 BNB",activity:"Yesterday"},
];
const initialSessions: SessionRow[] = [
  {id:"chrome-current",browser:"Chrome 125.0.0.0",device:"macOS 14.4",location:"San Francisco, CA",country:"🇺🇸 United States",ip:"104.28.14.22",active:"Just now",current:true},
  {id:"mobile-safari",browser:"Mobile Safari",device:"iPhone 14 Pro · iOS 17.4",location:"New York, NY",country:"🇺🇸 United States",ip:"172.58.33.101",active:"2 hours ago"},
  {id:"chrome-windows",browser:"Chrome 124.0.6367.91",device:"Windows PC · Windows 11",location:"London, England",country:"🇬🇧 United Kingdom",ip:"185.199.108.153",active:"Yesterday"},
];

export function WalletManager(){
  const router=useRouter();
  const [wallets,setWallets]=React.useState(initialWallets);
  const [sessions,setSessions]=React.useState(initialSessions);
  const [walletOpen,setWalletOpen]=React.useState(false);
  const [renameId,setRenameId]=React.useState<string|null>(null);
  const [renameValue,setRenameValue]=React.useState("");
  const [disconnectId,setDisconnectId]=React.useState<string|null>(null);
  const [revokeId,setRevokeId]=React.useState<string|null>(null);
  const [notice,setNotice]=React.useState("");
  const [pro,setPro]=React.useState(true);
  const [softTheme,setSoftTheme]=React.useState(false);

  const nav = [["Profile","Personal information","/account"],["Preferences","Display, notifications, language","/settings"],["Security","Password, 2FA, sessions","/settings/security"],["Manage Wallets","Connect, organize, and manage","/account/wallet"],["API Access","Keys and integrations","/account/api"],["Billing","Subscriptions and invoices","/account/billing"],["Activity Log","Account and security events","/account/activity"]] as const;
  const selectedRename=wallets.find(w=>w.id===renameId);
  const copy=async(address:string)=>{try{await navigator.clipboard.writeText(address);setNotice("Wallet address copied to clipboard.");}catch{setNotice("Copy unavailable in this browser.");}};
  const setDefault=(id:string)=>{setWallets(rows=>rows.map(w=>({...w,primary:w.id===id})));setNotice("Default wallet updated.");};
  const addWallet=(name:string)=>{const id=`${name.toLowerCase().replace(/\W/g,"")}-${Date.now()}`;setWallets(rows=>[...rows,{id,name,address:"0x4f21…8C0a",network:"Ethereum Mainnet",balance:"$0.00",unit:"0.0000 ETH",activity:"Just now"}]);setWalletOpen(false);setNotice(`${name} connected.`)};

  return <main className={`rwa-wallet-page ${softTheme?"soft-theme":""}`}>
    <header className="rwa-wallet-header"><Brand/><nav>{[["Home","/home"],["Discover","/discover"],["Markets","/markets"],["Businesses","/businesses"],["Intelligence","/intelligence"],["Portfolio","/portfolio"]].map(([label,href])=><button key={href} onClick={()=>router.push(href)}>{label}</button>)}</nav><div className="rwa-wallet-header__actions"><div className="rwa-mode-toggle"><button className={!pro?"active":""} onClick={()=>setPro(false)}>Simple</button><button className={pro?"active":""} onClick={()=>setPro(true)}>PRO</button></div><Button variant="secondary" onClick={()=>router.push("/community/compose")}>＋ Post Thesis</Button><button className="rwa-icon-button" onClick={()=>router.push("/notifications")}>♧</button><button className="rwa-icon-button" aria-label="Theme" aria-pressed={softTheme} onClick={()=>setSoftTheme(v=>!v)}>☾</button><Button onClick={()=>setWalletOpen(true)}>Connect Wallet</Button></div></header>
    <div className="rwa-wallet-layout">
      <aside className="rwa-settings-nav"><h3>SETTINGS</h3>{nav.map(([label,desc,href],index)=><button key={href} className={href==="/account/wallet"?"active":""} onClick={()=>router.push(href)}><span>{["♙","♧","▣","▰","◇","▤","◷"][index]}</span><p><b>{label}</b><small>{desc}</small></p></button>)}<div className="rwa-custody-note"><span>♢</span><div><b>Your assets. Your control.</b><p>RWA.MS never stores your private keys or has access to your funds.</p><button onClick={()=>router.push("/docs/security")}>Learn more →</button></div></div><button type="button" className="rwa-system-status" onClick={()=>router.push("/status")}>● System Operational</button></aside>
      <section className="rwa-wallet-content"><div className="rwa-wallet-title"><div><h1>Manage Wallets</h1><p>Connect, manage, and secure your wallets. You’re always in control.</p></div><Button onClick={()=>setWalletOpen(true)}>▣ Connect New Wallet</Button></div>
        <h2>Active Wallet <small title="Your default wallet is used for preselected account actions">ⓘ</small></h2>{wallets.filter(w=>w.primary).map(w=><WalletCard key={w.id} wallet={w} active onCopy={copy}/>) }
        <h2>Other Wallets</h2><div className="rwa-wallet-list">{wallets.filter(w=>!w.primary).map(w=><WalletCard key={w.id} wallet={w} onCopy={copy} onDefault={()=>setDefault(w.id)} onRename={()=>{setRenameId(w.id);setRenameValue(w.name)}} onDisconnect={()=>setDisconnectId(w.id)}/>)}</div>
        <h2>Sessions & Permissions</h2><p className="rwa-section-description">Manage your active sessions across browsers and devices.</p><div className="rwa-sessions-table"><div className="rwa-session-row header"><span>Session</span><span>Device / Browser</span><span>Location</span><span>IP Address</span><span>Last Active</span><span>Actions</span></div>{sessions.map(s=><div className="rwa-session-row" key={s.id}><span><b className={s.current?"current":""}>{s.current?"This Browser (Current)":s.browser}</b><small>{s.current?"Desktop":s.device}</small></span><span>{s.current?s.browser:s.device}</span><span><b>{s.location}</b><small>{s.country}</small></span><span>{s.ip} ⓘ</span><span><i/> {s.active}</span><span><Button size="sm" variant="danger" disabled={s.current} onClick={()=>setRevokeId(s.id)}>{s.current?"Current":"Revoke"}</Button></span></div>)}</div>
        <div className="rwa-security-banner"><span>♢</span><div><b>RWA.MS never stores your private keys and cannot move or access your funds.</b><p>All connections are read-only and require your approval for transactions.</p></div><button onClick={()=>router.push("/docs/security")}>Learn more about security →</button></div>
      </section>
    </div>
    <ConnectWalletModal open={walletOpen} onOpenChange={setWalletOpen} wallets={["MetaMask","Rabby Wallet","WalletConnect","Coinbase Wallet","Trust Wallet","OKX Wallet"]} onConnect={addWallet}/>
    <FormDialog open={Boolean(renameId)} onOpenChange={open=>!open&&setRenameId(null)} title="Rename wallet" description={selectedRename?`Set a friendly name for ${selectedRename.address}.`:undefined} submitLabel="Save name" onSubmit={e=>{e.preventDefault();if(renameId&&renameValue.trim()){setWallets(rows=>rows.map(w=>w.id===renameId?{...w,name:renameValue.trim()}:w));setRenameId(null);setNotice("Wallet renamed.");}}}><Input label="Wallet name" value={renameValue} onChange={e=>setRenameValue(e.target.value)} autoFocus/></FormDialog>
    <ConfirmationDialog open={Boolean(disconnectId)} onOpenChange={open=>!open&&setDisconnectId(null)} title="Disconnect wallet?" description="This removes the wallet from RWA.MS. It never affects the wallet or funds on-chain." destructive confirmLabel="Disconnect" onConfirm={()=>{if(disconnectId){setWallets(rows=>rows.filter(w=>w.id!==disconnectId));setDisconnectId(null);setNotice("Wallet disconnected.");}}}/>
    <ConfirmationDialog open={Boolean(revokeId)} onOpenChange={open=>!open&&setRevokeId(null)} title="Revoke session?" description="This device will need to authenticate again before accessing your RWA.MS account." destructive confirmLabel="Revoke session" onConfirm={()=>{if(revokeId){setSessions(rows=>rows.filter(s=>s.id!==revokeId));setRevokeId(null);setNotice("Session revoked.");}}}/>
    {notice&&<div className="rwa-wallet-toast"><Toast tone="success" title={notice} action={<button onClick={()=>setNotice("")}>×</button>}/></div>}
  </main>
}

function WalletCard({wallet,active,onCopy,onDefault,onRename,onDisconnect}:{wallet:WalletRow;active?:boolean;onCopy:(address:string)=>void;onDefault?:()=>void;onRename?:()=>void;onDisconnect?:()=>void}){
  return <div className={`rwa-wallet-card ${active?"active":""}`}><span className={`rwa-wallet-logo ${wallet.id.includes("rabby")?"purple":wallet.id.includes("coinbase")?"blue":wallet.id.includes("walletconnect")?"azure":"orange"}`}>{wallet.name.slice(0,1)}</span><div className="rwa-wallet-ident"><b>{wallet.name}</b><button onClick={()=>onCopy(wallet.address)}>{wallet.address} ⧉</button></div><div><small>Network</small><b>{wallet.network}</b></div><div><small>Balance</small><b>{wallet.balance}</b><span>{wallet.unit}</span></div><div><small>Last Activity</small><b>● {wallet.activity}</b></div>{active?<span className="rwa-default-badge">DEFAULT</span>:<div className="rwa-wallet-actions"><Button size="sm" variant="secondary" onClick={onDefault}>Set as Default</Button><Button size="sm" variant="secondary" onClick={onRename}>Rename</Button><Button size="sm" variant="danger" onClick={onDisconnect}>Disconnect</Button><button aria-label="More wallet options" onClick={onRename}>⋮</button></div>}</div>
}
