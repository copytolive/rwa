import * as React from "react";
import { Badge } from "../ui/Badge";
import { StateShell, type StateAction } from "./StateShell";

export type PermissionKind = "read-only" | "trading-disabled" | "kyc-required" | "business-verification" | "asset-unavailable";
const config: Record<PermissionKind, { title:string; description:string; badge:string; tone:"primary"|"warning"|"purple"|"danger"|"neutral" }> = {
  "read-only": { title:"Read-only mode", description:"You can view platform data and explore assets, but trading and on-chain actions are restricted.", badge:"Current state", tone:"primary" },
  "trading-disabled": { title:"Trading disabled", description:"Trading is disabled because of policy or jurisdictional restrictions applying to your account.", badge:"Not eligible", tone:"neutral" },
  "kyc-required": { title:"KYC required", description:"Identity verification is required to unlock trading, deposits, and full platform access.", badge:"Action required", tone:"purple" },
  "business-verification": { title:"Business verification pending", description:"Your business verification is under review. Some features remain restricted until approval.", badge:"In progress", tone:"warning" },
  "asset-unavailable": { title:"Asset unavailable", description:"This asset is unavailable in your jurisdiction or does not meet your eligibility criteria.", badge:"Unavailable", tone:"danger" }
};
export function PermissionState({ kind, actions, icon="◉", children }: { kind:PermissionKind; actions?:StateAction[]; icon?:React.ReactNode; children?:React.ReactNode }) { const c=config[kind]; return <StateShell className="rwa-permission-state" tone={kind === "kyc-required" ? "purple" : undefined} icon={icon} title={c.title} description={c.description} actions={actions}><div style={{ marginTop:12 }}><Badge tone={c.tone}>{c.badge}</Badge></div>{children}</StateShell>; }
