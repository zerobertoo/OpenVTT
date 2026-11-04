import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The type scale in styles.css (`--text-*`) adds font sizes; without this, `text-caption` would be read as a color
// and cancel `text-on-chrome-2` when both are merged.
// cn.test.ts checks this list against the `--text-*` sizes in styles.css, so the two cannot drift apart.
export const FONT_SIZE_NAMES = ["caption", "label", "title", "headline", "display"];
const twMerge = extendTailwindMerge({ extend: { classGroups: { "font-size": [{ text: FONT_SIZE_NAMES }] } } });

/** Joins class names, drops falsy ones, and lets later Tailwind utilities override earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
