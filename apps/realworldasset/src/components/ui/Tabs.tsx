"use client";
import * as React from "react";
import { cn } from "@/lib/cn";
import "./ui.css";

export interface TabItem { value: string; label: React.ReactNode; disabled?: boolean; }
export function Tabs({ items, value, defaultValue, onValueChange, className }: { items: TabItem[]; value?: string; defaultValue?: string; onValueChange?: (value: string) => void; className?: string }) {
  const [internal, setInternal] = React.useState(defaultValue ?? items[0]?.value ?? "");
  const current = value ?? internal;
  return <div className={cn("rwa-tabs", className)} role="tablist">{items.map(item => <button key={item.value} type="button" role="tab" aria-selected={current===item.value} disabled={item.disabled} data-active={current===item.value ? "true" : undefined} className="rwa-tab" onClick={() => { if (value === undefined) setInternal(item.value); onValueChange?.(item.value); }}>{item.label}</button>)}</div>;
}
