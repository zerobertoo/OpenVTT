import { Toolbar as ToolbarPrimitive } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

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
    <ToolbarPrimitive.Root aria-label={label} className={cn("flex gap-1 rounded-[1.2rem] bg-chrome p-1.5 shadow-float", className)}>
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
            className={cn(
              "flex cursor-pointer flex-col items-center gap-0.5 rounded-[0.9rem] border-0 bg-transparent px-4 py-2 text-[0.78rem] text-on-chrome-2",
              "hover:bg-chrome-2 hover:text-on-chrome",
              "focus-visible:outline-2 focus-visible:outline-dice focus-visible:outline-offset-2",
              "data-[state=on]:bg-dice data-[state=on]:text-on-dice",
            )}
          >
            {choice.icon}
            {choice.label}
          </ToolbarPrimitive.ToggleItem>
        ))}
      </ToolbarPrimitive.ToggleGroup>
    </ToolbarPrimitive.Root>
  );
}
