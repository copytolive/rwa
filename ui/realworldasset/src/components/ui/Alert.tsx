import * as React from "react";
import { cn } from "@/lib/cn";
import "./ui.css";

type AlertTone = "info" | "success" | "warning" | "danger";
export function Alert({ tone = "info", icon, children, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { tone?: AlertTone; icon?: React.ReactNode }) {
  return <div role={tone === "danger" ? "alert" : "status"} className={cn("rwa-alert", `rwa-alert--${tone}`, className)} {...props}>{icon}<div>{children}</div></div>;
}
