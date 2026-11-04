import { type ButtonHTMLAttributes, forwardRef, type HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

/** Shared look of every item on the dark floating chrome (tool dock, floor switcher). Amber marks the active one. */
export const dockItemStyles = cn(
  "flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-card border-0 bg-transparent px-4 py-2 text-caption text-on-chrome-2",
  "hover:not-disabled:bg-chrome-2 hover:not-disabled:text-on-chrome",
  "focus-visible:outline-2 focus-visible:outline-dice focus-visible:outline-offset-2",
  "disabled:cursor-default disabled:opacity-60 pointer-coarse:min-h-11 pointer-coarse:min-w-11",
);

/** A rounded dark pill that holds a few related dock items. Several groups sit side by side with a gap. */
export function DockGroup({ as: Tag = "div", className, ...rest }: HTMLAttributes<HTMLElement> & { as?: "div" | "ul" }) {
  return <Tag className={cn("flex gap-1 rounded-panel bg-chrome p-1.5 shadow-float", className)} {...rest} />;
}

interface DockButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Color of the pressed state: amber for dice and tools, teal for a state the game master switched on (previewing a player). */
  tone?: "dice" | "accent";
}

/** A dock button that toggles something on or off (`aria-pressed`). It forwards its ref so a popover can open from it. */
export const DockButton = forwardRef<HTMLButtonElement, DockButtonProps>(function DockButton(
  { tone = "dice", className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        dockItemStyles,
        tone === "dice" ? "aria-pressed:bg-dice aria-pressed:text-on-dice" : "aria-pressed:bg-accent aria-pressed:text-on-accent",
        className,
      )}
      {...rest}
    />
  );
});
