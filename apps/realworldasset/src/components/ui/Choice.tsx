import * as React from "react";
import "./ui.css";

type ChoiceProps = React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode };

export function Checkbox({ label, ...props }: ChoiceProps) {
  return <label className="rwa-choice"><input type="checkbox" {...props} /><span>{label}</span></label>;
}

export function Radio({ label, ...props }: ChoiceProps) {
  return <label className="rwa-choice"><input type="radio" {...props} /><span>{label}</span></label>;
}
