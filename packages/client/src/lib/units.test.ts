import { describe, expect, it } from "vitest";
import { convertDistance, DEFAULT_MEASURE_PREFS, normalizeUnit } from "./units";

const metric = { ...DEFAULT_MEASURE_PREFS, system: "metric" as const };
const imperial = { ...DEFAULT_MEASURE_PREFS, system: "imperial" as const };

describe("convertDistance", () => {
  it("leaves the scene's own unit alone by default", () => {
    expect(convertDistance(15, "ft", DEFAULT_MEASURE_PREFS)).toEqual({ value: 15, unit: "ft" });
  });

  it("uses the table convention of 5 ft = 1.5 m, and the exact factor when asked", () => {
    expect(convertDistance(5, "ft", metric)).toEqual({ value: 1.5, unit: "m" });
    expect(convertDistance(5, "ft", { ...metric, metersPerFoot: 0.3048 }).value).toBeCloseTo(1.524);
  });

  it("converts back to feet and rolls over to miles and kilometres", () => {
    expect(convertDistance(1.5, "m", imperial).value).toBeCloseTo(5);
    expect(convertDistance(5280, "ft", imperial)).toEqual({ value: 1, unit: "mi" });
    expect(convertDistance(2500, "m", metric)).toEqual({ value: 2.5, unit: "km" });
  });

  it("never converts squares or units it does not know", () => {
    expect(convertDistance(3, "casas", metric)).toEqual({ value: 3, unit: "casas" });
    expect(convertDistance(3, "leagues", imperial)).toEqual({ value: 3, unit: "leagues" });
  });

  it("recognizes common spellings", () => {
    expect(normalizeUnit("Metros")).toBe("m");
    expect(normalizeUnit("ft.")).toBe("ft");
    expect(normalizeUnit("xyz")).toBeNull();
  });
});
