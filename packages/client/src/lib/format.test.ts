import { describe, expect, it } from "vitest";
import { createFormatter } from "./format";

describe("createFormatter", () => {
  it("writes numbers the way the language does", () => {
    expect(createFormatter("en").number(1234.56, 2)).toBe("1,234.56");
    expect(createFormatter("pt-BR").number(1234.56, 2)).toBe("1.234,56");
  });

  it("limits decimals to one by default", () => {
    expect(createFormatter("en").number(2.345)).toBe("2.3");
  });

  it("formats a distance with the scene unit", () => {
    expect(createFormatter("en").distance(3, { gridDistance: 5, distanceUnit: "ft" })).toBe("15 ft");
    expect(createFormatter("pt-BR").distance(1.5, { gridDistance: 1.5, distanceUnit: "m" })).toBe("2,3 m");
  });

  it("converts to the measurement preference when one is given", () => {
    const prefs = { system: "metric" as const, metersPerFoot: 0.3 };
    expect(createFormatter("en").distance(3, { gridDistance: 5, distanceUnit: "ft" }, prefs)).toBe("4.5 m");
  });

  it("formats times and dates and reuses the formatter per language", () => {
    const en = createFormatter("en");
    expect(en.time(Date.UTC(2026, 0, 2, 15, 4))).toMatch(/\d{1,2}:04/);
    expect(en.date(Date.UTC(2026, 0, 2, 12))).toContain("2026");
    expect(createFormatter("en")).toBe(en);
  });
});
