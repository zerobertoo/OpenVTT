import { DropdownMenu as RadixMenu, Popover as RadixPopover } from "radix-ui";
import type { ReactElement, ReactNode } from "react";
import { cn } from "../../lib/cn";

const floatingStyles = "z-50 animate-overlay-in rounded-card bg-surface text-ink shadow-float motion-reduce:animate-none";

interface PopoverProps {
  /** The control that opens it; it keeps its own accessible name. */
  trigger: ReactElement;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  label?: string;
}

/** A small floating panel for a short form or a hint. Esc and an outside click close it; focus moves in and back. */
export function Popover({ trigger, children, open, onOpenChange, className, label }: PopoverProps) {
  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          aria-label={label}
          sideOffset={8}
          collisionPadding={12}
          className={cn(floatingStyles, "w-72 max-w-[calc(100vw-1.5rem)] p-4", className)}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

export interface MenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  /** Paints the item red, for deletes. */
  tone?: "default" | "danger";
  disabled?: boolean;
}

interface DropdownMenuProps {
  /** The button that opens the menu (for example an icon button with an `aria-label`). */
  trigger: ReactElement;
  items: MenuItem[];
  /** Which edge of the trigger the menu lines up with. */
  align?: "start" | "end";
}

/** Row or overflow actions. Arrow keys, typeahead, Esc and focus return come from Radix. */
export function DropdownMenu({ trigger, items, align = "end" }: DropdownMenuProps) {
  return (
    <RadixMenu.Root>
      <RadixMenu.Trigger asChild>{trigger}</RadixMenu.Trigger>
      <RadixMenu.Portal>
        <RadixMenu.Content align={align} sideOffset={6} collisionPadding={12} className={cn(floatingStyles, "min-w-44 p-1")}>
          {items.map((item) => (
            <RadixMenu.Item
              key={item.id}
              disabled={item.disabled}
              onSelect={item.onSelect}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 font-semibold outline-none pointer-coarse:min-h-11",
                "data-[highlighted]:bg-surface-2 data-[disabled]:cursor-default data-[disabled]:opacity-55",
                item.tone === "danger" && "text-danger",
              )}
            >
              {item.icon}
              {item.label}
            </RadixMenu.Item>
          ))}
        </RadixMenu.Content>
      </RadixMenu.Portal>
    </RadixMenu.Root>
  );
}
