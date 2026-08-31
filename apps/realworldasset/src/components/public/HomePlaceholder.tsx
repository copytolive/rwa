"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { PublicShell } from "./PublicShell";
import { Button } from "@/components/ui";
import { ConnectWalletModal } from "@/components/overlays";

export function HomePlaceholder(){
  const router=useRouter();
  const [open,setOpen]=React.useState(false);
  const [wallet,setWallet]=React.useState<string|null>(null);
  return <PublicShell authenticated><main className="rwa-placeholder"><span className="rwa-placeholder__eyebrow">Authenticated hand-off</span><h1>Home is connected</h1><p>CHAT 01 hands authentication here. CHAT 02 will replace this placeholder with the full authenticated home/feed while preserving this route.</p><div className="rwa-placeholder__actions"><Button onClick={()=>router.push("/discover")}>Explore placeholder routes</Button><Button variant="secondary" onClick={()=>router.push("/account/wallet")}>Manage Wallets</Button><Button variant="secondary" onClick={()=>setOpen(true)}>{wallet??"Connect Wallet"}</Button><Button variant="ghost" onClick={()=>router.push("/")}>Public Landing</Button></div></main><ConnectWalletModal open={open} onOpenChange={setOpen} wallets={["MetaMask","Rabby Wallet","WalletConnect","Coinbase Wallet"]} onConnect={name=>{setWallet(name);setOpen(false)}}/></PublicShell>
}
