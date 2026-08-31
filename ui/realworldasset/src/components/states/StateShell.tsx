import * as React from "react";
import { cn } from "@/lib/cn";
import "../ui/ui.css";

export interface StateAction { label: string; onClick?: () => void; href?: string; variant?: "primary" | "secondary" | "ghost" | "danger"; }
export function StateShell({ className, icon, title, description, actions, children, tone }: { className?: string; icon?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; actions?: StateAction[]; children?: React.ReactNode; tone?: string }) {
  return <section className={cn("rwa-state", className)} data-tone={tone}><div className="rwa-state__icon" aria-hidden="true">{icon ?? "◇"}</div><h2 className="rwa-state__title">{title}</h2>{description && <p className="rwa-state__description">{description}</p>}{children}{actions?.length ? <div className="rwa-state__actions">{actions.map((a,i) => a.href ? <a key={`${a.label}-${i}`} href={a.href} className={cn("rwa-button", `rwa-button--${a.variant ?? "primary"}`)}>{a.label}</a> : <button key={`${a.label}-${i}`} type="button" className={cn("rwa-button", `rwa-button--${a.variant ?? "primary"}`)} onClick={a.onClick}>{a.label}</button>)}</div> : null}</section>;
}
