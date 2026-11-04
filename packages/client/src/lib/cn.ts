import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The type scale in styles.css (`--text-*`) adds font sizes; without this, `text-caption` would be read as a color
// and cancel `text-on-chrome-2` when both are merged.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["caption", "label", "title", "headline", "display"] }] } },
});

/** Joins class names, drops falsy ones, and lets later Tailwind utilities override earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
