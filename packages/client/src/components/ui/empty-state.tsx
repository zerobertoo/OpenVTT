import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Button } from "./button";

interface EmptyStateProps {
  title: string;
  /** One sentence on what to do next or why it is empty. */
  description?: string;
  /** The next step, usually a `Button`. */
  action?: ReactNode;
  icon?: ReactNode;
  /** Heading level, to fit the surrounding outline. */
  headingLevel?: 2 | 3 | 4;
  className?: string;
}

/** Explains an empty list and offers the next step, so an empty screen is never a dead end. */
export function EmptyState({ title, description, action, icon, headingLevel = 3, className }: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div className={cn("grid justify-items-center gap-2 px-4 py-6 text-center", className)}>
      {icon && <span className="text-ink-2">{icon}</span>}
      <Heading className="m-0 font-bold text-[1.05rem]">{title}</Heading>
      {description && <p className="m-0 max-w-[34ch] text-ink-2">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title: string;
  description?: string;
  /** Shows a retry button when given. */
  onRetry?: () => void;
  retryLabel?: string;
  retrying?: boolean;
  className?: string;
}

/** A failed load in plain words, with a way to try again. Announced to screen readers when it appears. */
export function ErrorState({ title, description, onRetry, retryLabel, retrying, className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn("grid justify-items-start gap-2 rounded-card bg-surface-2 p-4", className)}>
      <p className="m-0 font-bold">{title}</p>
      {description && <p className="m-0 text-ink-2">{description}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" pending={retrying} onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
