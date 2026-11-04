import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

/**
 * A full-width row that can be picked (a token, a sheet, a scene). The picked row is exposed with `aria-pressed`
 * and outlined in the accent color. Use it inside an `li`; for rows with extra actions, keep those outside the button.
 */
export const ListItemButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(function ListItemButton(
  { className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "flex w-full cursor-pointer items-center justify-start gap-2.5 rounded-xl bg-transparent px-2 py-1.5 text-left text-ink",
        "shadow-[inset_0_0_0_1.5px_transparent] hover:bg-surface-2",
        "aria-pressed:bg-surface-2 aria-pressed:shadow-[inset_0_0_0_1.5px_var(--accent)] pointer-coarse:min-h-11",
        className,
      )}
      {...rest}
    />
  );
});
