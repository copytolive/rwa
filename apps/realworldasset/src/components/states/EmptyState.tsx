import * as React from "react";
import { StateShell, type StateAction } from "./StateShell";

export type EmptyStateProps = {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: StateAction[];
};

export function EmptyState({ title = "Nothing here yet", ...props }: EmptyStateProps) {
  return <StateShell title={title} {...props} />;
}
