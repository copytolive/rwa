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
  const [notice, setNotice] = React.useState("");

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
          <Button onClick={() => setWalletOpen(true)}>{connectedWallet ? connectedWallet : "Connect Wallet · Demo"}</Button>
        </div>
      </header>
      <div className="rwa-demo-badge" role="status">UI DEMO · BACKEND OFFLINE</div>
      {notice && <div className="rwa-demo-notice" role="alert">{notice}</div>}
      <ConnectWalletModal
        open={walletOpen}
        onOpenChange={setWalletOpen}
        wallets={["MetaMask", "Rabby Wallet", "WalletConnect", "Coinbase Wallet", "Trust Wallet", "OKX Wallet"]}
        onConnect={(wallet) => {
          setConnectedWallet(`${wallet} · Demo`);
          setWalletOpen(false);
          setNotice(`${wallet} selected for UI preview only — no wallet session was created.`);
          window.setTimeout(() => setNotice(""), 4200);
        }}
      />
    </>
  );
}

export function PublicShell({ children, authenticated = false }: { children: React.ReactNode; authenticated?: boolean }) {
  return <div className="rwa-public-shell" data-ui-demo="true" data-backend-connected="false"><PublicHeader authenticated={authenticated}/>{children}</div>;
}

export function RoutePlaceholder({ title, path }: { title: string; path: string }) {
  return (
    <PublicShell authenticated>
      <main className="rwa-placeholder">
        <span className="rwa-placeholder__eyebrow">Interactive UI Demo</span>
        <h1>{title}</h1>
        <p>This route is available as a realistic interface preview. Data is deterministic demo content; backend writes and financial execution remain locked until live services are connected.</p>
        <section className="rwa-placeholder__mock-grid" aria-label="Demo route status">
          <article><small>Route</small><strong>{path}</strong><span>Navigation ready</span></article>
          <article><small>Backend</small><strong>Offline</strong><span>Fail-closed mode</span></article>
          <article><small>Environment</small><strong>UI Demo</strong><span>No real transaction</span></article>
        </section>
        <div className="rwa-placeholder__actions">
          <Link className="rwa-link-button rwa-link-button--primary" href="/home">Open Demo Home</Link>
          <Link className="rwa-link-button" href="/">Public Landing</Link>
        </div>
      </main>
    </PublicShell>
  );
}
