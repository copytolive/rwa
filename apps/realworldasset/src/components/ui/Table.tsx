import * as React from "react";
import { cn } from "@/lib/cn";
import "./ui.css";

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <div className="rwa-table-wrap"><table className={cn("rwa-table", className)} {...props} /></div>;
}
export const THead = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <thead {...p} />;
export const TBody = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody {...p} />;
export const TR = (p: React.HTMLAttributes<HTMLTableRowElement>) => <tr {...p} />;
export const TH = (p: React.ThHTMLAttributes<HTMLTableCellElement>) => <th {...p} />;
export const TD = (p: React.TdHTMLAttributes<HTMLTableCellElement>) => <td {...p} />;
