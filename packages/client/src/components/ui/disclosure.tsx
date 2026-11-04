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
}

/** A section the reader can open and close. The toggle is a real button (`aria-expanded`), and closed content is not in the page. */
export function Disclosure({ title, children, defaultOpen, open, onOpenChange, className }: DisclosureProps) {
  return (
    <Collapsible.Root defaultOpen={defaultOpen} open={open} onOpenChange={onOpenChange} className={className}>
      <Collapsible.Trigger className="group flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-sm bg-transparent p-0 text-left font-semibold text-ink hover:not-disabled:shadow-none">
        <span>{title}</span>
        <span
          className={cn("shrink-0 text-ink-2 transition-transform motion-reduce:transition-none", "group-data-[state=open]:rotate-180")}
        >
          <Icon name="chevronDown" />
        </span>
      </Collapsible.Trigger>
      <Collapsible.Content className="pt-1">{children}</Collapsible.Content>
    </Collapsible.Root>
  );
}
