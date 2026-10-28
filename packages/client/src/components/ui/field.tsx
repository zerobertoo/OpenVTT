import { type ReactNode, useId } from "react";
import { cn } from "../../lib/cn";

/** Props a control needs to be wired to its `Field` (label, hint and error). Spread them on the control. */
export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

interface FieldProps {
  label: ReactNode;
  /** Short help shown under the control. */
  hint?: ReactNode;
  /** Error text; announced when it appears and marks the control invalid. */
  error?: ReactNode;
  /** Label to the right of the control, for checkboxes and switches. */
  inline?: boolean;
  className?: string;
  /** Renders the control with the generated id and ARIA wiring. */
  children: (control: FieldControlProps) => ReactNode;
}

/** A label, a control, an optional hint and an optional error, all linked for assistive technology. */
export function Field({ label, hint, error, inline = false, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  const control = children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined });

  return (
    <div className={cn("grid gap-1", className)}>
      {inline ? (
        <div className="flex items-center gap-2">
          {control}
          <label htmlFor={id} className="font-medium text-[0.95rem]">
            {label}
          </label>
        </div>
      ) : (
        <>
          <label htmlFor={id} className="font-semibold text-[0.9rem]">
            {label}
          </label>
          {control}
        </>
      )}
      {hint && (
        <p id={hintId} className="m-0 text-ink-2 text-sm">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="m-0 font-semibold text-danger text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
