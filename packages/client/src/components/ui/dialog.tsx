import { cva, type VariantProps } from "class-variance-authority";
import { AlertDialog, Dialog as RadixDialog } from "radix-ui";
import { type ReactNode, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../icons";
import { cn } from "../../lib/cn";
import { Button } from "./button";

// Centered card on wide screens; a sheet pinned to the bottom edge below 52rem, like the table drawer.
const overlayStyles =
  "fixed inset-0 z-50 grid animate-overlay-in place-items-center bg-black/55 p-4 max-[52rem]:place-items-end max-[52rem]:p-0 motion-reduce:animate-none";
const contentStyles = cva(
  "relative grid max-h-[85dvh] w-full animate-dialog-in gap-3 overflow-y-auto bg-surface p-5 text-ink shadow-float rounded-panel max-[52rem]:max-h-[90dvh] max-[52rem]:rounded-b-none motion-reduce:animate-none",
  { variants: { size: { sm: "max-w-sm", md: "max-w-lg" } }, defaultVariants: { size: "md" } },
);

/**
 * Radix returns focus only to a `Trigger`, but our dialogs are controlled from state. This remembers the
 * element that had focus when the dialog opened and gives focus back to it on close.
 */
function useRestoreFocus() {
  const opener = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: () => {
      opener.current = document.activeElement as HTMLElement | null;
    },
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault();
      opener.current?.focus();
    },
  };
}

interface DialogProps extends VariantProps<typeof contentStyles> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
}

/** A modal for a focused task. Focus is trapped inside, Esc and the close button dismiss it, and focus returns to what opened it. */
export function Dialog({ open, onOpenChange, title, description, size, children }: DialogProps) {
  const restoreFocus = useRestoreFocus();
  const { t } = useTranslation();
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={overlayStyles}>
          <RadixDialog.Content className={contentStyles({ size })} {...restoreFocus}>
            <div className="flex items-start justify-between gap-3">
              <RadixDialog.Title className="m-0 font-bold text-[1.3rem] tracking-tight">{title}</RadixDialog.Title>
              <RadixDialog.Close asChild>
                <Button variant="ghost" size="icon" aria-label={t("common.close")} className="-mt-2 -mr-2">
                  <Icon name="close" />
                </Button>
              </RadixDialog.Close>
            </div>
            {description ? (
              <RadixDialog.Description className="m-0 text-ink-2">{description}</RadixDialog.Description>
            ) : (
              // Radix warns without a description; the title already says what the dialog is for.
              <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
            )}
            {children}
          </RadixDialog.Content>
        </RadixDialog.Overlay>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  /** `danger` paints the confirm button red, for deletes. */
  tone?: "default" | "danger";
  pending?: boolean;
}

/** Asks before something that cannot be undone. Focus starts on Cancel, the safe choice. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  tone = "default",
  pending,
}: ConfirmDialogProps) {
  const restoreFocus = useRestoreFocus();
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlayStyles}>
          <AlertDialog.Content className={cn(contentStyles({ size: "sm" }))} {...restoreFocus}>
            <AlertDialog.Title className="m-0 font-bold text-[1.3rem] tracking-tight">{title}</AlertDialog.Title>
            <AlertDialog.Description className="m-0 text-ink-2">{description}</AlertDialog.Description>
            <div className="mt-2 flex flex-wrap justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button variant="secondary">{cancelLabel}</Button>
              </AlertDialog.Cancel>
              <Button variant={tone === "danger" ? "danger" : "primary"} pending={pending} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Overlay>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
