import type { SceneDto } from "@openvtt/shared";

export interface Formatter {
  /** Clock time, for example "14:05". */
  time: (timestamp: number) => string;
  /** Calendar date in the person's language. */
  date: (timestamp: number) => string;
  /** Number with at most `maximumFractionDigits` decimals (default 1). */
  number: (value: number, maximumFractionDigits?: number) => string;
  /** Distance across `cells` grid cells in the scene's unit, for example "15 ft". */
  distance: (cells: number, scene: Pick<SceneDto, "gridDistance" | "distanceUnit">) => string;
}

const cache = new Map<string, Formatter>();

/** Dates and numbers for a locale. Created once per locale because building `Intl` objects is not free. */
export function createFormatter(locale: string): Formatter {
  const cached = cache.get(locale);
  if (cached) return cached;
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const numbers = new Map<number, Intl.NumberFormat>();
  const number = (value: number, maximumFractionDigits = 1) => {
    let format = numbers.get(maximumFractionDigits);
    if (!format) {
      format = new Intl.NumberFormat(locale, { maximumFractionDigits });
      numbers.set(maximumFractionDigits, format);
    }
    return format.format(value);
  };
  const formatter: Formatter = {
    time: (timestamp) => time.format(timestamp),
    date: (timestamp) => date.format(timestamp),
    number,
    distance: (cells, scene) => `${number(cells * scene.gridDistance)} ${scene.distanceUnit}`,
  };
  cache.set(locale, formatter);
  return formatter;
}
