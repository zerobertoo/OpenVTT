import { Collapsible } from "radix-ui";
import type { ReactNode } from "react";
import { Icon } from "../../icons";
import { cn } from "../../lib/cn";

interface DisclosureProps {
  /** Always-visible heading text of the toggle. */
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Controls the open state from outside; `onOpenChange` then reports every change. */
  open?: boolean;
  /** Called when it opens or closes; handy to load the content on first open. */
  onOpenChange?: (open: boolean) => void;
  className?: string;
  /** Wraps the toggle in a heading of this level, so the section shows in the page outline. */
  headingLevel?: 3 | 4 | 5;
  /** Keeps the content mounted (hidden) while closed, so unsaved input in it survives folding. */
  keepMounted?: boolean;
}

/** A section the reader can open and close. The toggle is a real button (`aria-expanded`), and closed content is not in the page. */
export function Disclosure({ title, children, defaultOpen, open, onOpenChange, className, headingLevel, keepMounted }: DisclosureProps) {
  const trigger = (
    <Collapsible.Trigger className="group flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-sm bg-transparent p-0 text-left font-semibold text-ink hover:not-disabled:shadow-none">
      <span>{title}</span>
      <span className={cn("shrink-0 text-ink-2 transition-transform motion-reduce:transition-none", "group-data-[state=open]:rotate-180")}>
        <Icon name="chevronDown" />
      </span>
    </Collapsible.Trigger>
  );
  const Heading = headingLevel ? (`h${headingLevel}` as const) : null;
  return (
    <Collapsible.Root defaultOpen={defaultOpen} open={open} onOpenChange={onOpenChange} className={className}>
      {Heading ? <Heading className="m-0 text-base">{trigger}</Heading> : trigger}
      <Collapsible.Content forceMount={keepMounted || undefined} className="pt-1 data-[state=closed]:hidden">
        {children}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
