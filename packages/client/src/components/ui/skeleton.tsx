import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/** A placeholder shape that stands in for content that is still loading. Shape it like the real content. */
export function Skeleton({ shape = "line", className }: { shape?: "line" | "block" | "circle"; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block animate-pulse bg-surface-2 motion-reduce:animate-none",
        shape === "line" && "h-4 rounded-full",
        shape === "block" && "h-20 rounded-card",
        shape === "circle" && "size-10 rounded-full",
        className,
      )}
    />
  );
}

/**
 * Wraps skeletons for one loading area. Screen readers hear `label` right away; the skeletons only
 * appear after a short delay, so a fast load never flashes them.
 */
export function Loading({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: <output> is for form results; this is a generic busy region
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      <div className="animate-appear-late">{children}</div>
    </div>
  );
}
