import { useTranslation } from "react-i18next";
import { Dialog } from "../ui/dialog";

const SHORTCUTS = [
  { keys: ["V"], label: "shortcuts.select" },
  { keys: ["R"], label: "shortcuts.ruler" },
  { keys: ["B"], label: "shortcuts.draw" },
  { keys: ["←", "↑", "→", "↓"], label: "shortcuts.move" },
  { keys: ["Esc"], label: "shortcuts.deselect" },
  { keys: ["+", "-"], label: "shortcuts.zoom" },
  { keys: ["0"], label: "shortcuts.fit" },
  { keys: ["C"], label: "shortcuts.center" },
  { keys: ["M"], label: "shortcuts.minimap" },
  { keys: ["Shift", "click"], label: "shortcuts.selectMany" },
  { keys: ["Shift", "drag"], label: "shortcuts.selectBox" },
  { keys: ["[", "]"], label: "shortcuts.turn" },
  { keys: ["Del"], label: "shortcuts.remove" },
  { keys: ["Alt", "click"], label: "shortcuts.ping" },
  { keys: ["Alt", "Shift", "click"], label: "shortcuts.lookHere" },
  { keys: ["P"], label: "shortcuts.panels" },
  { keys: ["F"], label: "shortcuts.focus" },
  { keys: ["D"], label: "shortcuts.dice" },
  { keys: ["?"], label: "shortcuts.help" },
] as const;

/** Lists the table's keyboard shortcuts. */
export function ShortcutHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("shortcuts.title")} description={t("shortcuts.intro")} size="sm">
      <dl className="m-0 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
        {SHORTCUTS.map((shortcut) => (
          <div key={shortcut.label} className="contents">
            <dt className="flex gap-1">
              {shortcut.keys.map((key) => (
                <kbd
                  key={key}
                  className="min-w-7 rounded-sm bg-surface-2 px-2 py-0.5 text-center font-mono font-semibold text-sm shadow-[inset_0_0_0_1.5px_var(--line)]"
                >
                  {key}
                </kbd>
              ))}
            </dt>
            <dd className="m-0">{t(shortcut.label)}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
