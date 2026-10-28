import { cn } from "../../lib/cn";

/** A small ring for short waits. Decorative: whoever shows it announces the wait (for example `aria-busy`). */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      aria-hidden="true"
      className={cn("size-[1.1em] flex-none animate-spin motion-reduce:animate-none", className)}
    >
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" />
    </svg>
  );
}
