"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/public";
import { Button, Input } from "@/components/ui";
import { connectWalletAndAuthenticate, currentCommerceSession } from "@/lib/live-runtime";
import "./auth.css";

const walletOptions = ["Browser EVM Wallet", "MetaMask", "Rabby Wallet", "Coinbase Wallet"];

function validateEmail(value: string) { return /^\S+@\S+\.\S+$/.test(value); }

export function AuthFlow({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const signup = mode === "signup";
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [terms, setTerms] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string,string>>({});
  const [notice, setNotice] = React.useState("");

  React.useEffect(() => {
    const session = currentCommerceSession();
    if (session) setNotice(`Authenticated wallet session active: ${session.wallet.slice(0,8)}…${session.wallet.slice(-4)}.`);
  }, []);

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault?.();
    const next: Record<string,string> = {};
    if (signup && name.trim().length < 2) next.name = "Enter your name.";
    if (!validateEmail(email)) next.email = "Enter a valid email address.";
    if (password.length < 6) next.password = "Password must be at least 6 characters.";
    if (signup && !terms) next.terms = "Accept the terms to continue.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setNotice("Password authentication is not connected to a verified identity backend. No login or account was created. Use signed wallet authentication instead.");
  };

  const socialAuth = async (provider: string) => {
    setNotice(`${provider} authentication is not backed by a verified OAuth/passkey provider yet. No session was created.`);
  };

  const walletAuth = async (_wallet: string) => {
    setSubmitting(true);
    setNotice("Requesting an EVM wallet signature. The private key never leaves your wallet.");
    try {
      const session = await connectWalletAndAuthenticate();
      setNotice(`Wallet ${session.wallet.slice(0,8)}…${session.wallet.slice(-4)} authenticated by the server.`);
      router.push(signup ? "/onboarding" : "/home");
    } catch (error: any) {
      setNotice(`Wallet authentication blocked: ${String(error?.message || error)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="rwa-auth-page">
      <div className="rwa-auth-top"><Brand/><Link href="/" className="rwa-auth-back">← Back to Home</Link></div>
      <section className="rwa-auth-panel">
        <div className="rwa-auth-main">
          <div className="rwa-auth-tabs" role="tablist" aria-label="Authentication mode">
            <Link role="tab" aria-selected={!signup} className={!signup ? "active" : ""} href="/login">Log In</Link>
            <Link role="tab" aria-selected={signup} className={signup ? "active" : ""} href="/signup">Sign Up</Link>
          </div>
          <div className="rwa-auth-heading"><h1>{signup ? "Create your account" : "Welcome back"}</h1><p>{signup ? "Use signed wallet authentication for the live session path" : "Use a signed wallet session to access live backend capabilities"}</p></div>
          <form onSubmit={submit} className="rwa-auth-form" noValidate>
            {signup && <Input label="Full name" value={name} onChange={e=>setName(e.target.value)} error={errors.name} placeholder="Your name" autoComplete="name"/>}
            <Input label="Email address" type="email" value={email} onChange={e=>setEmail(e.target.value)} error={errors.email} placeholder="you@example.com" autoComplete="email"/>
            <div className="rwa-password-wrap">
              <Input label="Password" type={showPassword ? "text" : "password"} value={password} onChange={e=>setPassword(e.target.value)} error={errors.password} placeholder="Password backend not enabled" autoComplete={signup ? "new-password" : "current-password"}/>
              <button type="button" className="rwa-eye" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "◉" : "◎"}</button>
            </div>
            {!signup && <button type="button" className="rwa-auth-text-action" onClick={()=>{ if(validateEmail(email)) setNotice("Password reset delivery is not connected to a verified backend. No reset email was sent."); else setErrors(v=>({...v,email:"Enter your email first."})); }}>Forgot password?</button>}
            {signup && <label className="rwa-auth-check"><input type="checkbox" checked={terms} onChange={e=>setTerms(e.target.checked)}/><span>I agree to the <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>.</span></label>}
            {errors.terms && <span className="rwa-auth-inline-error">{errors.terms}</span>}
            <Button size="lg" type="submit" loading={submitting} className="rwa-auth-submit">{signup ? "Create Account" : "Log In"}</Button>
          </form>
          <div className="rwa-auth-divider"><span>unverified providers remain fail-closed</span></div>
          <div className="rwa-auth-social">
            {["Google", "Apple", "Passkey"].map(provider=><Button key={provider} variant="secondary" onClick={()=>socialAuth(provider)} disabled={submitting}>Continue with {provider}</Button>)}
          </div>
          <p className="rwa-auth-switch">{signup ? "Already have an account?" : "Don’t have an account?"} <Link href={signup?"/login":"/signup"}>{signup?"Log in":"Sign up"}</Link></p>
          {notice && <div className="rwa-auth-notice" role="status">{notice}</div>}
        </div>
        <aside className="rwa-auth-wallet">
          <div className="rwa-auth-wallet__icon">▣</div><h2>Live wallet authentication</h2><p>The server issues a nonce, your wallet signs it, and the server verifies the signature before creating a revocable bearer session.</p>
          <div className="rwa-wallet-auth-list">{walletOptions.map(wallet=><button type="button" key={wallet} disabled={submitting} onClick={()=>walletAuth(wallet)}><span className={`wallet-mark wallet-${wallet.toLowerCase().replace(/\s/g,"-")}`}>{wallet.slice(0,1)}</span><b>{wallet}</b><span>›</span></button>)}</div>
          <div className="rwa-auth-custody"><span>♢</span><div><strong>Self-custodial authentication</strong><p>Your private key never leaves the wallet. The backend stores only the hashed session token and the authenticated wallet address.</p></div></div>
        </aside>
        <div className="rwa-auth-benefits">
          {[["◈","Signed challenge","Server nonce + wallet signature prevents the old fake local-login success path."],["♙","Revocable session","Log Out revokes the backend bearer session and clears browser session state."],["▤","Fail-closed providers","Password, OAuth and passkey buttons never claim success without a verified provider."],["◇","Execution identity","The same authenticated wallet is required to match the browser signer before live execution."]].map(([icon,title,text])=><div key={title}><span>{icon}</span><p><strong>{title}</strong>{text}</p></div>)}
        </div>
      </section>
      <footer className="rwa-auth-footer">© 2026 RWA.MS. All rights reserved. <Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link></footer>
    </main>
  );
}
