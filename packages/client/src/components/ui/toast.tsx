import { cva } from "class-variance-authority";
import { Toast } from "radix-ui";
import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../icons";
import { Button } from "./button";

type Tone = "info" | "success" | "error";
interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: Tone;
}

// A tiny module-level store, so `toast()` works from mutation callbacks and other code outside React.
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const publish = (next: ToastItem[]) => {
  items = next;
  for (const listener of listeners) listener();
};

/** Shows a short, non-blocking message. Errors that need action must also appear in the page, not only here. */
export function toast(input: { title: string; description?: string; tone?: Tone }) {
  publish([...items, { id: nextId++, tone: "info", ...input }]);
}

/** Removes every toast; for tests and for navigation away from a world. */
export function dismissAllToasts() {
  publish([]);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const getSnapshot = () => items;

const toastStyles = cva(
  "grid grid-cols-[1fr_auto] items-start gap-x-3 rounded-card bg-chrome p-3 text-on-chrome shadow-float data-[state=open]:animate-dialog-in motion-reduce:animate-none",
  {
    variants: { tone: { info: "", success: "ring-2 ring-crit ring-inset", error: "ring-2 ring-fumble ring-inset" } },
    defaultVariants: { tone: "info" },
  },
);

/** Mount once near the app root. Pauses on hover and focus, and is announced politely (errors assertively). */
export function Toaster() {
  const { t } = useTranslation();
  const current = useSyncExternalStore(subscribe, getSnapshot);
  return (
    <Toast.Provider swipeDirection="up" duration={5000}>
      {current.map((item) => (
        <Toast.Root
          key={item.id}
          type={item.tone === "error" ? "foreground" : "background"}
          duration={item.tone === "error" ? 8000 : 5000}
          className={toastStyles({ tone: item.tone })}
          onOpenChange={(open) => !open && publish(items.filter((other) => other.id !== item.id))}
        >
          <Toast.Title className="font-bold">{item.title}</Toast.Title>
          <Toast.Close asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("common.close")}
              className="-mt-1 -mr-1 size-9 text-on-chrome-2 hover:not-disabled:bg-chrome-2"
            >
              <Icon name="close" />
            </Button>
          </Toast.Close>
          {item.description && (
            <Toast.Description className="col-span-2 mt-1 text-on-chrome-2 text-sm">{item.description}</Toast.Description>
          )}
        </Toast.Root>
      ))}
      <Toast.Viewport
        label={t("common.notifications")}
        className="fixed top-4 left-1/2 z-[60] m-0 grid w-96 max-w-[calc(100vw-1.5rem)] -translate-x-1/2 list-none gap-2 p-0 outline-none max-[52rem]:top-16"
      />
    </Toast.Provider>
  );
}
