import type { ReactElement } from "react";
import { Tooltip } from "radix-ui";

/** Wraps the app (or a screen) once so every `Tip` shares the same open delay. */
export function TipProvider({ children }: { children: React.ReactNode }) {
  return <Tooltip.Provider delayDuration={300}>{children}</Tooltip.Provider>;
}

/** Short label shown on hover and keyboard focus. The child keeps its own accessible name (aria-label). */
export function Tip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltip" sideOffset={8}>
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
