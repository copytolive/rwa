import * as React from "react";
import { cn } from "@/lib/cn";
import "./ui.css";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  props: SelectProps,
  ref: React.ForwardedRef<HTMLSelectElement>,
) {
  const { className, id, label, hint, error, children, ...selectProps } = props;
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;
  const descriptionId = error || hint ? `${fieldId}-description` : undefined;
  return (
    <label className="rwa-field" htmlFor={fieldId}>
      {label && <span className="rwa-field__label">{label}</span>}
      <select
        ref={ref}
        id={fieldId}
        className={cn("rwa-control", className)}
        data-invalid={error ? "true" : undefined}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={descriptionId}
        {...selectProps}
      >
        {children}
      </select>
      {(error || hint) && <span id={descriptionId} className={error ? "rwa-field__error" : "rwa-field__hint"}>{error ?? hint}</span>}
    </label>
  );
});
