import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type CheckProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role">;

/** A boolean in a form that is saved with it. Use `Field inline` for the label. */
export const Checkbox = forwardRef<HTMLInputElement, CheckProps>(function Checkbox({ className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      type="checkbox"
      className={cn("size-[1.15rem] flex-none cursor-pointer accent-accent disabled:cursor-default disabled:opacity-55", className)}
      {...rest}
    />
  );
});

/** A boolean that takes effect immediately. It is a native checkbox exposed as `role="switch"`. */
export const Switch = forwardRef<HTMLInputElement, CheckProps>(function Switch({ className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      type="checkbox"
      // biome-ignore lint/a11y/useAriaPropsForRole: a native checkbox already exposes its checked state to the switch role
      role="switch"
      className={cn(
        "relative h-6 w-10 flex-none cursor-pointer appearance-none rounded-full bg-ink-2 transition-colors duration-150 checked:bg-accent",
        "before:absolute before:top-[3px] before:left-[3px] before:size-[18px] before:rounded-full before:bg-surface before:transition-transform before:duration-150 before:content-['']",
        "checked:before:translate-x-4 motion-reduce:transition-none motion-reduce:before:transition-none",
        "disabled:cursor-default disabled:opacity-55",
        className,
      )}
      {...rest}
    />
  );
});
