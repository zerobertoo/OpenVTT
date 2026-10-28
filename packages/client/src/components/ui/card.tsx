import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const cardStyles = cva("", {
  variants: {
    // `plain` is a page-level card; `inset` is a row or tile inside one.
    variant: {
      plain: "rounded-panel bg-surface p-5 shadow-card",
      inset: "rounded-card bg-surface-2 px-[0.9rem] py-[0.8rem]",
    },
  },
  defaultVariants: { variant: "plain" },
});

export interface CardProps extends HTMLAttributes<HTMLElement>, VariantProps<typeof cardStyles> {
  /** The element to render; use `li` inside a list and `section` or `article` when it has its own heading. */
  as?: "div" | "section" | "article" | "li";
}

/** A surface that groups related content. Heading level is the caller's choice. */
export function Card({ as: Tag = "div", variant, className, ...rest }: CardProps) {
  return <Tag className={cn(cardStyles({ variant }), className)} {...rest} />;
}
