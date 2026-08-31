"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { ConnectWalletModal } from "@/components/overlays";
import "./public.css";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="rwa-brand" aria-label="RWA.MS home">
      <span className="rwa-brand__mark" aria-hidden="true"><i/><i/><i/></span>
      {!compact && <span className="rwa-brand__name">RWA.<b>MS</b></span>}
    </Link>
  );
}

const publicNav = [
  ["Markets", "/markets"],
  ["Businesses", "/businesses"],
  ["RWA", "/rwa"],
  ["Intelligence", "/intelligence"],
  ["About", "/about"],
  ["Docs", "/docs"],
] as const;

export function PublicHeader({ authenticated = false }: { authenticated?: boolean }) {
  const router = useRouter();
  const [walletOpen, setWalletOpen] = React.useState(false);
  const [connectedWallet, setConnectedWallet] = React.useState<string | null>(null);

  return (
    <>
      <header className="rwa-public-header">
        <Brand />
        <nav className="rwa-public-nav" aria-label="Primary navigation">
          {publicNav.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <div className="rwa-public-actions">
          {authenticated ? (
            <Button variant="secondary" onClick={() => router.push("/home")}>Home</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => router.push("/login")}>Log In</Button>
              <Button variant="secondary" onClick={() => router.push("/signup")}>Sign Up</Button>
            </>
          )}
          <Button onClick={() => setWalletOpen(true)}>{connectedWallet ? connectedWallet : "Connect Wallet"}</Button>
        </div>
      </header>
      <ConnectWalletModal
        open={walletOpen}
        onOpenChange={setWalletOpen}
        wallets={["MetaMask", "Rabby Wallet", "WalletConnect", "Coinbase Wallet", "Trust Wallet", "OKX Wallet"]}
        onConnect={(wallet) => {
          setConnectedWallet(wallet);
          setWalletOpen(false);
        }}
      />
    </>
  );
}

export function PublicShell({ children, authenticated = false }: { children: React.ReactNode; authenticated?: boolean }) {
  return <div className="rwa-public-shell"><PublicHeader authenticated={authenticated}/>{children}</div>;
}

export function RoutePlaceholder({ title, path }: { title: string; path: string }) {
  return (
    <PublicShell authenticated>
      <main className="rwa-placeholder">
        <span className="rwa-placeholder__eyebrow">Route-safe placeholder</span>
        <h1>{title}</h1>
        <p><code>{path}</code> is already wired so buttons never dead-end. Its full screen arrives in a later RWA.MS batch.</p>
        <div className="rwa-placeholder__actions">
          <Link className="rwa-link-button rwa-link-button--primary" href="/home">Go to Home</Link>
          <Link className="rwa-link-button" href="/">Public Landing</Link>
        </div>
      </main>
    </PublicShell>
  );
}
