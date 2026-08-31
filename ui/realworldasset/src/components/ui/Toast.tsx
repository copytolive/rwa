import * as React from "react";
import { Badge } from "./Badge";
import "./ui.css";

type ToastTone = "success" | "warning" | "danger" | "primary";
export function Toast({ tone = "primary", title, message, action }: { tone?: ToastTone; title: string; message?: string; action?: React.ReactNode }) {
  return <div className="rwa-toast" role={tone === "danger" ? "alert" : "status"}><Badge tone={tone === "primary" ? "primary" : tone}>{tone}</Badge><div><div className="rwa-toast__title">{title}</div>{message && <div className="rwa-toast__message">{message}</div>}</div>{action}</div>;
}
