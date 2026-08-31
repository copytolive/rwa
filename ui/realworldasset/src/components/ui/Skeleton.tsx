import * as React from "react";
import { cn } from "@/lib/cn";
import "./ui.css";

export function Skeleton({ className, width, height = 16, radius, ...props }: React.HTMLAttributes<HTMLDivElement> & { width?: number | string; height?: number | string; radius?: number | string }) {
  return <div aria-hidden="true" className={cn("rwa-skeleton", className)} style={{ width, height, borderRadius: radius, ...props.style }} {...props} />;
}
