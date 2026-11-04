import type { ReactNode } from "react";
import { useId } from "react";
import { cn } from "../../lib/cn";

interface PanelSectionProps {
  title: string;
  /** The one main action of the section (a "New" button or menu), shown beside the title. */
  action?: ReactNode;
  /** The latest failed action, so it appears next to what caused it instead of at the end of a long panel. */
  error?: ReactNode;
  /** Heading level, to fit the surrounding outline. */
  headingLevel?: 3 | 4;
  children: ReactNode;
  className?: string;
}

/** A titled block of a side panel: heading, one main action, an inline error slot, then the content. */
export function PanelSection({ title, action, error, headingLevel = 3, children, className }: PanelSectionProps) {
  const headingId = useId();
  const Heading = `h${headingLevel}` as const;
  return (
    <section aria-labelledby={headingId} className={cn("grid grid-cols-[minmax(0,1fr)] content-start gap-3", className)}>
      <div className="flex min-h-9 items-center justify-between gap-2">
        <Heading id={headingId} className="m-0 font-bold">
          {title}
        </Heading>
        {action}
      </div>
      {error}
      {children}
    </section>
  );
}
