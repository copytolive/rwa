"use client";
import * as React from "react";
import "./ui.css";

export function Tooltip({ content, children }: { content: React.ReactNode; children: React.ReactElement }) {
  const [open, setOpen] = React.useState(false);
  return <span style={{ position:"relative", display:"inline-flex" }} onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)} onFocusCapture={()=>setOpen(true)} onBlurCapture={()=>setOpen(false)}>{children}{open && <span role="tooltip" className="rwa-tooltip" style={{ top:"calc(100% + 8px)", left:0 }}>{content}</span>}</span>;
}
