import { Toolbar as ToolbarPrimitive } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { DockGroup, dockItemStyles } from "./dock";

interface ToolbarChoice<T extends string> {
  value: T;
  label: string;
  icon: ReactNode;
}

interface Props<T extends string> {
  /** Accessible name of the whole toolbar. */
  label: string;
  value: T;
  onValueChange: (value: T) => void;
  choices: ToolbarChoice<T>[];
  className?: string;
}

/** A toolbar of mutually exclusive tools (one always active). Left/right arrows move between tools. */
export function ToolbarChoices<T extends string>({ label, value, onValueChange, choices, className }: Props<T>) {
  return (
    <ToolbarPrimitive.Root aria-label={label} asChild>
      <DockGroup className={className}>
        <ToolbarPrimitive.ToggleGroup
          type="single"
          value={value}
          // Radix reports "" when the active item is pressed again; a tool must stay selected.
          onValueChange={(next) => next && onValueChange(next as T)}
          className="flex gap-1"
        >
          {choices.map((choice) => (
            <ToolbarPrimitive.ToggleItem
              key={choice.value}
              value={choice.value}
              className={cn(dockItemStyles, "data-[state=on]:bg-dice data-[state=on]:text-on-dice")}
            >
              {choice.icon}
              {choice.label}
            </ToolbarPrimitive.ToggleItem>
          ))}
        </ToolbarPrimitive.ToggleGroup>
      </DockGroup>
    </ToolbarPrimitive.Root>
  );
}
