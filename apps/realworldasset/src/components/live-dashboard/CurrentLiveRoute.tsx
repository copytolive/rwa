"use client";

import { usePathname } from "next/navigation";
import { LiveRouteWorkspace } from "./LiveDashboard";

function titleFromPath(path: string) {
  const clean = path.replace(/^\/rwa(?=\/|$)/, "").replace(/^\/+|\/+$/g, "");
  if (!clean) return "Live Market Truth";
  return clean.split("/").map(part => part.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())).join(" / ");
}

export function LiveCurrentRoutePage() {
  const path = usePathname() || "/";
  const canonicalPath = path.replace(/^\/rwa(?=\/|$)/, "") || "/";
  return <LiveRouteWorkspace title={titleFromPath(path)} path={canonicalPath}/>;
}
