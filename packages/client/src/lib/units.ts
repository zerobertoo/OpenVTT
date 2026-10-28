export type MeasureSystem = "scene" | "imperial" | "metric";

export interface MeasurePrefs {
  /** `scene` shows distances in the unit the scene was authored in. */
  system: MeasureSystem;
  /** Table convention for converting feet: 0.3 makes 5 ft equal 1.5 m; 0.3048 is the exact value. */
  metersPerFoot: number;
}

export const DEFAULT_MEASURE_PREFS: MeasurePrefs = { system: "scene", metersPerFoot: 0.3 };

const FEET_PER_MILE = 5280;

/** Maps what people type in the unit field ("ft", "feet", "metros", "casas") to a known unit, or null. */
export function normalizeUnit(unit: string): "ft" | "mi" | "m" | "km" | "sq" | null {
  const u = unit.trim().toLowerCase().replace(/\.$/, "");
  if (["ft", "foot", "feet", "pé", "pés", "pe", "pes"].includes(u)) return "ft";
  if (["mi", "mile", "miles", "milha", "milhas"].includes(u)) return "mi";
  if (["m", "meter", "meters", "metre", "metres", "metro", "metros"].includes(u)) return "m";
  if (["km", "kilometer", "kilometers", "quilômetro", "quilômetros", "quilometro", "quilometros"].includes(u)) return "km";
  if (["sq", "square", "squares", "cell", "cells", "casa", "casas"].includes(u)) return "sq";
  return null;
}

/**
 * Converts a distance authored in `unit` to the person's measurement system. Squares and unknown units are
 * never converted (there is nothing to convert them with), and `scene` leaves everything as authored.
 */
export function convertDistance(value: number, unit: string, prefs: MeasurePrefs): { value: number; unit: string } {
  const known = normalizeUnit(unit);
  if (prefs.system === "scene" || known === null || known === "sq") return { value, unit };
  const meters =
    known === "m"
      ? value
      : known === "km"
        ? value * 1000
        : known === "ft"
          ? value * prefs.metersPerFoot
          : value * FEET_PER_MILE * prefs.metersPerFoot;
  if (prefs.system === "metric") return meters >= 1000 ? { value: meters / 1000, unit: "km" } : { value: meters, unit: "m" };
  const feet = meters / prefs.metersPerFoot;
  return feet >= FEET_PER_MILE ? { value: feet / FEET_PER_MILE, unit: "mi" } : { value: feet, unit: "ft" };
}
