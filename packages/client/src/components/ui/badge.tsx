import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const badgeStyles = cva("inline-flex items-center gap-1 rounded-full px-2 py-[0.1rem] font-bold text-xs leading-5", {
  variants: {
    // Amber is reserved for dice (see DESIGN.md), so `dice` is only for roll-related labels.
    tone: {
      neutral: "bg-surface-2 text-ink-2 shadow-[inset_0_0_0_1.5px_var(--line)]",
      accent: "bg-accent-soft text-accent-text",
      dice: "bg-dice text-on-dice",
      danger: "bg-danger text-on-danger",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeStyles> {}

/** A short status or role label. It always carries text: never rely on the color alone. */
export function Badge({ tone, className, ...rest }: BadgeProps) {
  return <span className={cn(badgeStyles({ tone }), className)} {...rest} />;
}
