"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui";
import "./overlay.css";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export type OverlayPlacement = "center" | "right" | "bottom";

export interface OverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  placement?: OverlayPlacement;
  size?: "sm" | "md" | "lg" | "xl";
  dismissible?: boolean;
  showClose?: boolean;
  className?: string;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  labelledBy?: string;
}

export function Overlay({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  placement = "center",
  size = "md",
  dismissible = true,
  showClose = true,
  className,
  initialFocusRef,
  labelledBy,
}: OverlayProps) {
  const [mounted, setMounted] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open || !mounted) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      const fallback = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (initialFocusRef?.current ?? fallback ?? panelRef.current)?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = bodyOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [open, mounted, initialFocusRef]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) {
        event.preventDefault();
        onOpenChange(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (!focusable.length) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, dismissible, onOpenChange]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className={cn("rwa-overlay", `rwa-overlay--${placement}`)}
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onOpenChange(false);
      }}
      data-placement={placement}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? (title ? titleId : undefined)}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn("rwa-overlay__panel", `rwa-overlay__panel--${size}`, className)}
      >
        {(title || description || showClose) && (
          <header className="rwa-overlay__header">
            <div className="rwa-overlay__heading">
              {title && <h2 id={titleId} className="rwa-overlay__title">{title}</h2>}
              {description && <p id={descriptionId} className="rwa-overlay__description">{description}</p>}
            </div>
            {showClose && (
              <button
                type="button"
                className="rwa-overlay__close"
                aria-label="Close dialog"
                onClick={() => onOpenChange(false)}
              >
                ×
              </button>
            )}
          </header>
        )}
        <div className="rwa-overlay__body">{children}</div>
        {footer && <footer className="rwa-overlay__footer">{footer}</footer>}
      </section>
    </div>,
    document.body,
  );
}

export type DialogProps = Omit<OverlayProps, "placement">;
export function Dialog(props: DialogProps) {
  return <Overlay {...props} placement="center" />;
}

export type DrawerProps = Omit<OverlayProps, "placement"> & { side?: "right" | "bottom" };
export function Drawer({ side = "right", ...props }: DrawerProps) {
  return <Overlay {...props} placement={side} />;
}

export function OverlayStack({ children }: { children: React.ReactNode }) {
  return <div className="rwa-overlay-stack">{children}</div>;
}

export function OverlayActions({ children, stacked = false }: { children: React.ReactNode; stacked?: boolean }) {
  return <div className={cn("rwa-overlay-actions", stacked && "rwa-overlay-actions--stacked")}>{children}</div>;
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  destructive = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  destructive?: boolean;
  children?: React.ReactNode;
}) {
  const [pending, setPending] = React.useState(false);
  const confirm = async () => {
    try {
      setPending(true);
      await onConfirm();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <OverlayActions>
          <Button variant="secondary" onClick={() => onOpenChange(false)}> {cancelLabel} </Button>
          <Button variant={destructive ? "danger" : "primary"} loading={pending} onClick={confirm}>{confirmLabel}</Button>
        </OverlayActions>
      }
    >
      {children}
    </Dialog>
  );
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  onSubmit,
  pending = false,
  size = "sm",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  pending?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description} size={size}>
      <form onSubmit={onSubmit} className="rwa-overlay-stack">
        {children}
        <OverlayActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>{cancelLabel}</Button>
          <Button type="submit" loading={pending}>{submitLabel}</Button>
        </OverlayActions>
      </form>
    </Dialog>
  );
}

export function SuccessDialog({
  open,
  onOpenChange,
  title,
  message,
  reference,
  primaryLabel = "Done",
  onPrimary,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message?: string;
  reference?: React.ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={message}
      size="sm"
      footer={<Button className="rwa-overlay__full" onClick={() => { onPrimary?.(); onOpenChange(false); }}>{primaryLabel}</Button>}
    >
      <div className="rwa-success-mark" aria-hidden="true">✓</div>
      {reference && <div className="rwa-overlay-reference">{reference}</div>}
    </Dialog>
  );
}
