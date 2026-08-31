import * as React from "react";
import { cn } from "@/lib/cn";
import "./ui.css";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "purple";
export function Badge({ tone = "neutral", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn("rwa-badge", `rwa-badge--${tone}`, className)} {...props} />;
}
