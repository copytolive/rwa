import * as React from "react";
import { StateShell, type StateAction } from "./StateShell";
export type ErrorKind = "wallet-rejected" | "insufficient-funds" | "venue-unavailable" | "stale-quote" | "invalid-amount" | "network" | "generic";
const copy: Record<ErrorKind, { title:string; description:string }> = {
  "wallet-rejected": { title:"Wallet connection rejected", description:"The connection request was declined. Try again or use another wallet." },
  "insufficient-funds": { title:"Insufficient funds", description:"Your balance is too low to complete this transaction." },
  "venue-unavailable": { title:"Venue unavailable", description:"The selected venue is currently unavailable or under maintenance." },
  "stale-quote": { title:"Quote expired", description:"The price quote has expired and is no longer valid." },
  "invalid-amount": { title:"Invalid amount", description:"Enter an amount within the allowed limits." },
  "network": { title:"Network error", description:"Check your connection and try again." },
  "generic": { title:"Something went wrong", description:"Please try again. If the issue continues, contact support." }
};
export function ErrorState({ kind="generic", icon="!", actions, title, description }: { kind?:ErrorKind; icon?:React.ReactNode; actions?:StateAction[]; title?:React.ReactNode; description?:React.ReactNode }) { const c=copy[kind]; return <StateShell className="rwa-error-state" icon={icon} title={title ?? c.title} description={description ?? c.description} actions={actions} />; }
