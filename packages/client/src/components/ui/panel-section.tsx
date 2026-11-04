import type { ReactNode } from "react";
import { useId } from "react";
import { cn } from "../../lib/cn";

interface PanelSectionProps {
  title: string;
  /** The one main action of the section (a "New" button or menu), shown beside the title. */
  action?: ReactNode;
  /** The latest failed action, so it appears next to what caused it instead of at the end of a long panel. */
  error?: ReactNode;
  headingLevel?: 3 | 4 | 5;
  /** `group` names a sub-block of a card (not a page landmark) and uses the quieter heading style. */
  variant?: "section" | "group";
  children: ReactNode;
  className?: string;
}

/** A titled block of a side panel: heading, one main action, an inline error slot, then the content. */
export function PanelSection({ title, action, error, headingLevel = 3, variant = "section", children, className }: PanelSectionProps) {
  const headingId = useId();
  const Heading = `h${headingLevel}` as const;
  const group = variant === "group";
  return (
    <section
      role={group ? "group" : undefined}
      aria-labelledby={headingId}
      className={cn("grid grid-cols-[minmax(0,1fr)] content-start gap-3", className)}
    >
      <div className={cn("flex items-center justify-between gap-2", !group && "min-h-9")}>
        <Heading id={headingId} className={cn("m-0 font-bold", group && "text-ink-2 text-label")}>
          {title}
        </Heading>
        {action}
      </div>
      {error}
      {children}
    </section>
  );
}
