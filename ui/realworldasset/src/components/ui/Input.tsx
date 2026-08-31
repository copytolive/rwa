import * as React from "react";
import { cn } from "@/lib/cn";
import "./ui.css";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  valid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  props: InputProps,
  ref: React.ForwardedRef<HTMLInputElement>,
) {
  const { className, id, label, hint, error, valid, ...inputProps } = props;
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;
  const descriptionId = error || hint ? `${fieldId}-description` : undefined;
  return (
    <label className="rwa-field" htmlFor={fieldId}>
      {label && <span className="rwa-field__label">{label}</span>}
      <input
        ref={ref}
        id={fieldId}
        className={cn("rwa-control", className)}
        data-invalid={error ? "true" : undefined}
        data-valid={!error && valid ? "true" : undefined}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={descriptionId}
        {...inputProps}
      />
      {(error || hint) && (
        <span id={descriptionId} className={error ? "rwa-field__error" : "rwa-field__hint"}>
          {error ?? hint}
        </span>
      )}
    </label>
  );
});
