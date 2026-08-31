import * as React from "react";
import { cn } from "@/lib/cn";
import "./ui.css";

export function Card({ elevated, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { elevated?: boolean }) {
  return <div className={cn("rwa-card", elevated && "rwa-card--elevated", className)} {...props} />;
}
export function CardHeader(props: React.HTMLAttributes<HTMLDivElement>) { return <div {...props} className={cn("rwa-card__header", props.className)} />; }
export function CardBody(props: React.HTMLAttributes<HTMLDivElement>) { return <div {...props} className={cn("rwa-card__body", props.className)} />; }
export function CardFooter(props: React.HTMLAttributes<HTMLDivElement>) { return <div {...props} className={cn("rwa-card__footer", props.className)} />; }
