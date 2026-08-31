import * as React from "react";
import { Skeleton } from "../ui/Skeleton";

export function LoadingState({ label = "Loading", rows = 4 }: { label?: string; rows?: number }) {
  return <section aria-busy="true" aria-label={label} style={{ display:"grid", gap:12 }}><span style={{ position:"absolute", width:1, height:1, overflow:"hidden", clip:"rect(0 0 0 0)" }}>{label}</span><Skeleton width="34%" height={18} />{Array.from({ length: rows }).map((_,i)=><Skeleton key={i} width={`${88 - i*7}%`} height={42} radius={8} />)}</section>;
}
