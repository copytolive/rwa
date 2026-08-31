"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/public";
import { Button, Input } from "@/components/ui";
import "./auth.css";

const walletOptions = ["MetaMask", "Rabby Wallet", "Coinbase Wallet", "WalletConnect"];

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

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault?.();
    const next: Record<string,string> = {};
    if (signup && name.trim().length < 2) next.name = "Enter your name.";
    if (!validateEmail(email)) next.email = "Enter a valid email address.";
    if (password.length < 6) next.password = "Password must be at least 6 characters.";
    if (signup && !terms) next.terms = "Accept the terms to continue.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 450));
    router.push("/onboarding");
  };

  const socialAuth = async (provider: string) => {
    setNotice(`Continuing with ${provider}…`);
    setSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    router.push("/onboarding");
  };

  const walletAuth = async (wallet: string) => {
    setNotice(`${wallet} connected. Preparing onboarding…`);
    setSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    router.push("/onboarding");
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
          <div className="rwa-auth-heading"><h1>{signup ? "Create your account" : "Welcome back"}</h1><p>{signup ? "Join RWA.MS and access real-world markets" : "Log in to access your RWA.MS account"}</p></div>
          <form onSubmit={submit} className="rwa-auth-form" noValidate>
            {signup && <Input label="Full name" value={name} onChange={e=>setName(e.target.value)} error={errors.name} placeholder="Your name" autoComplete="name"/>}
            <Input label="Email address" type="email" value={email} onChange={e=>setEmail(e.target.value)} error={errors.email} placeholder="you@example.com" autoComplete="email"/>
            <div className="rwa-password-wrap">
              <Input label="Password" type={showPassword ? "text" : "password"} value={password} onChange={e=>setPassword(e.target.value)} error={errors.password} placeholder="Enter your password" autoComplete={signup ? "new-password" : "current-password"}/>
              <button type="button" className="rwa-eye" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "◉" : "◎"}</button>
            </div>
            {!signup && <button type="button" className="rwa-auth-text-action" onClick={()=>{ if(validateEmail(email)) setNotice(`Password reset instructions sent to ${email}.`); else setErrors(v=>({...v,email:"Enter your email first."})); }}>Forgot password?</button>}
            {signup && <label className="rwa-auth-check"><input type="checkbox" checked={terms} onChange={e=>setTerms(e.target.checked)}/><span>I agree to the <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>.</span></label>}
            {errors.terms && <span className="rwa-auth-inline-error">{errors.terms}</span>}
            <Button size="lg" type="submit" loading={submitting} className="rwa-auth-submit">{signup ? "Create Account" : "Log In"}</Button>
          </form>
          <div className="rwa-auth-divider"><span>or continue with</span></div>
          <div className="rwa-auth-social">
            {["Google", "Apple", "Passkey"].map(provider=><Button key={provider} variant="secondary" onClick={()=>socialAuth(provider)} disabled={submitting}>Continue with {provider}</Button>)}
          </div>
          <p className="rwa-auth-switch">{signup ? "Already have an account?" : "Don’t have an account?"} <Link href={signup?"/login":"/signup"}>{signup?"Log in":"Sign up"}</Link></p>
          {notice && <div className="rwa-auth-notice" role="status">{notice}</div>}
        </div>
        <aside className="rwa-auth-wallet">
          <div className="rwa-auth-wallet__icon">▣</div><h2>Or connect with wallet</h2><p>Connect a self-custodial wallet to access RWA.MS</p>
          <div className="rwa-wallet-auth-list">{walletOptions.map(wallet=><button type="button" key={wallet} disabled={submitting} onClick={()=>walletAuth(wallet)}><span className={`wallet-mark wallet-${wallet.toLowerCase().replace(/\s/g,"-")}`}>{wallet.slice(0,1)}</span><b>{wallet}</b><span>›</span></button>)}</div>
          <div className="rwa-auth-custody"><span>♢</span><div><strong>RWA.MS is self-custodial</strong><p>You’re in control. We never take custody of your funds or private keys.</p></div></div>
        </aside>
        <div className="rwa-auth-benefits">
          {[["◈","Secure by design","Bank-grade encryption and rigorous security standards protect your data and assets."],["♙","Non-custodial","You remain in full control of your assets and private keys at all times."],["▤","Transparent & compliant","Built with regulatory best practices and verifiable on-chain transparency."],["◇","All-in-one platform","Access tokenized real-world assets, markets, and insights in one unified experience."]].map(([icon,title,text])=><div key={title}><span>{icon}</span><p><strong>{title}</strong>{text}</p></div>)}
        </div>
      </section>
      <footer className="rwa-auth-footer">© 2024 RWA.MS. All rights reserved. <Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link></footer>
    </main>
  );
}
