import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/cn";
import { Input } from "./input";
import { Popover } from "./popover";

/** Ready-made colors: readable on the dark map and on light backgrounds, so most people never need the hex field. */
export const COLOR_SWATCHES = [
  "#e5484d",
  "#f76b15",
  "#ffc914",
  "#46a758",
  "#12a594",
  "#3e63dd",
  "#8e4ec6",
  "#d6409f",
  "#ffffff",
  "#889096",
  "#4a4f55",
  "#1b1d22",
] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Accepts `e5484d`, `#e5484d` and the `#fa0` shorthand; returns `#rrggbb` or null. */
function normalizeHex(raw: string): string | null {
  const body = raw.trim().replace(/^#/, "");
  const full = /^[0-9a-fA-F]{3}$/.test(body) ? [...body].map((c) => c + c).join("") : body;
  const hex = `#${full}`;
  return HEX.test(hex) ? hex.toLowerCase() : null;
}

interface ColorPickerProps {
  /** A color as `#rrggbb`. */
  value: string;
  onChange: (hex: string) => void;
  /** Accessible name when there is no `Field` label. */
  "aria-label"?: string;
  "aria-describedby"?: string;
  id?: string;
  className?: string;
}

/**
 * Pick a color from swatches or type a hex code. It looks the same in every browser, unlike the platform color
 * dialog. The button shows the current color and its hex, so the color is never conveyed by the swatch alone.
 */
export function ColorPicker({ value, onChange, className, id, ...aria }: ColorPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(value);

  const choose = (hex: string) => {
    setTyped(hex);
    onChange(hex.toLowerCase());
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setTyped(value);
      }}
      label={aria["aria-label"] ?? t("color.pick")}
      className="w-60"
      trigger={
        <button
          type="button"
          id={id}
          {...aria}
          // With an explicit name, include the visible hex in it (WCAG 2.5.3); inside a Field the label text names the button.
          aria-label={aria["aria-label"] ? `${aria["aria-label"]}: ${value}` : undefined}
          className={cn(
            "flex min-h-11 items-center gap-2 rounded-sm border-[1.5px] border-line bg-surface px-2 text-ink tabular-nums",
            className,
          )}
        >
          <span aria-hidden="true" className="size-6 shrink-0 rounded-full border-2 border-ink-2" style={{ backgroundColor: value }} />
          <span className="font-mono text-[0.85rem] uppercase">{value}</span>
        </button>
      }
    >
      <div role="group" aria-label={t("color.swatches")} className="grid grid-cols-6 gap-2">
        {COLOR_SWATCHES.map((hex) => (
          <button
            key={hex}
            type="button"
            aria-label={hex}
            aria-pressed={hex === value.toLowerCase()}
            onClick={() => choose(hex)}
            style={{ backgroundColor: hex }}
            className="size-9 rounded-full border-2 border-ink-2 outline-offset-2 aria-pressed:outline-3 aria-pressed:outline-dice focus-visible:outline-3 focus-visible:outline-dice"
          />
        ))}
      </div>
      <label className="mt-3 grid gap-1 font-semibold text-[0.9rem]">
        {t("color.hex")}
        <Input
          value={typed}
          maxLength={8}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          aria-invalid={normalizeHex(typed) ? undefined : true}
          onChange={(e) => {
            setTyped(e.target.value);
            const hex = normalizeHex(e.target.value);
            if (hex) onChange(hex);
          }}
        />
      </label>
    </Popover>
  );
}
