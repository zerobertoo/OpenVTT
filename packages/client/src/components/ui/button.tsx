import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";
import { Spinner } from "./spinner";

const buttonStyles = cva(
  [
    "inline-flex cursor-pointer items-center justify-center gap-[0.45rem] rounded-full font-bold",
    "transition-[transform,background-color,box-shadow] duration-150 ease-out-expo",
    "active:not-disabled:scale-95 disabled:cursor-default disabled:opacity-55",
    // Touch targets reach 44px on coarse pointers (phones) without bloating the desktop layout.
    "pointer-coarse:min-h-11",
  ],
  {
    variants: {
      variant: {
        primary: "bg-accent text-on-accent hover:not-disabled:shadow-[0_2px_10px_color-mix(in_srgb,var(--accent)_45%,transparent)]",
        // Pressed secondary buttons (toggles) fill with the accent.
        secondary:
          "bg-surface-2 text-ink shadow-[inset_0_0_0_1.5px_var(--line)] aria-pressed:bg-accent aria-pressed:text-on-accent aria-pressed:shadow-none",
        ghost: "bg-transparent text-ink hover:not-disabled:bg-surface-2 hover:not-disabled:shadow-none",
        danger: "bg-danger text-on-danger hover:not-disabled:shadow-[0_2px_10px_color-mix(in_srgb,var(--danger)_45%,transparent)]",
        link: "rounded-sm bg-transparent hover:not-disabled:shadow-none font-semibold text-accent-text underline underline-offset-[3px]",
        dangerLink: "rounded-sm bg-transparent hover:not-disabled:shadow-none font-semibold text-danger underline underline-offset-[3px]",
      },
      size: {
        md: "px-[1.1rem] py-[0.55rem]",
        sm: "px-3 py-[0.3rem] text-sm",
        // Square, for an icon with an accessible name from `aria-label`.
        icon: "size-[2.6rem] p-0",
      },
    },
    compoundVariants: [{ variant: ["link", "dangerLink"], size: ["md", "sm"], class: "px-[0.1rem] py-[0.15rem]" }],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonStyles> {
  /** Shows a spinner, disables the button and sets `aria-busy`, keeping its width. */
  pending?: boolean;
}

/** The one button for every action. Defaults to `type="button"` so it never submits a form by accident. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, pending = false, className, type = "button", disabled, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={cn(buttonStyles({ variant, size }), className)}
      {...rest}
    >
      {pending && <Spinner />}
      {children}
    </button>
  );
});
