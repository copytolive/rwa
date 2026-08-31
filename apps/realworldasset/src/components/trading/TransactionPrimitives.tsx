"use client";

import * as React from "react";

export type TransactionStatus = "Filled" | "Partially Filled" | "Canceled" | "Rejected" | "Pending" | "Completed" | "Processing" | "Pending Review";

export function OrderStatusBadge({ status }: { status: TransactionStatus }) {
  const tone = status === "Filled" || status === "Completed" ? "success" : status === "Partially Filled" ? "info" : status === "Canceled" ? "muted" : status === "Rejected" ? "danger" : "warning";
  return <span className={`shared-status shared-status--${tone}`}>{status}</span>;
}

export function TransactionLinkRow({
  icon,
  title,
  subtitle,
  meta,
  onClick,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className="shared-transaction-row" onClick={onClick}>
      <span className="shared-transaction-row__icon">{icon}</span>
      <span className="shared-transaction-row__copy"><b>{title}</b>{subtitle && <small>{subtitle}</small>}</span>
      {meta && <span className="shared-transaction-row__meta">{meta}</span>}
    </button>
  );
}
