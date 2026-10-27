import { describe, expect, it } from "vitest";
import { computeSheet, DiceError, evaluateFormula, parseFormula, rollDice, sheetTemplateSchema, validateSheetData } from "./index.ts";

/** Deterministic rng that replays a list of values. */
const fixed = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe("rollDice", () => {
  it("sums dice and modifiers", () => {
    const r = rollDice("2d6+3", fixed(4, 5));
    expect(r.total).toBe(12);
    expect(r.parts[0]!.results).toEqual([4, 5]);
  });
  it("supports subtraction, implicit count and whitespace", () => {
    expect(rollDice("d20 - 2", fixed(10)).total).toBe(8);
    expect(rollDice("1d8 + 1d4 + 2", fixed(3, 2)).total).toBe(7);
  });
  it("keeps the higher die with adv and the lower with dis", () => {
    expect(rollDice("1d20 adv", fixed(5, 17)).total).toBe(17);
    expect(rollDice("1d20+2 dis", fixed(5, 17)).total).toBe(7);
  });
  it("rejects bad notation and limits", () => {
    for (const bad of ["", "abc", "2d6+", "2d6 3", "101d6", "1d1", "1d2000", "2d6 adv"])
      expect(() => rollDice(bad, fixed(1)), bad).toThrow(DiceError);
  });
});

describe("formulas", () => {
  const run = (src: string, vars: Record<string, number> = {}) => evaluateFormula(parseFormula(src), (n) => vars[n]!);
  it("respects precedence and functions", () => {
    expect(run("2 + 3 * 4")).toBe(14);
    expect(run("floor((@str - 10) / 2)", { str: 15 })).toBe(2);
    expect(run("-max(1, 2) + 10 % 4")).toBe(0);
  });
  it("rejects malformed input", () => {
    for (const bad of ["1 +", "foo(1)", "(1", "1 $ 2", "@"]) expect(() => parseFormula(bad), bad).toThrow();
  });
});

describe("sheets", () => {
  const template = sheetTemplateSchema.parse({
    sections: [
      {
        id: "main",
        fields: [
          { id: "str", type: "number", default: 10 },
          { id: "str_mod", type: "computed", formula: "floor((@str - 10) / 2)" },
          { id: "bag", type: "list", itemFields: [{ id: "item", type: "text" }] },
        ],
      },
    ],
  });
  it("applies defaults and computes fields", () => {
    expect(computeSheet(template, {})).toMatchObject({ str: 10, str_mod: 0 });
    expect(computeSheet(template, { str: 18 }).str_mod).toBe(4);
  });
  it("validates submitted data", () => {
    expect(validateSheetData(template, { str: 12, bag: [{ item: "rope" }] })).toBe(true);
    expect(validateSheetData(template, { str_mod: 3 })).toBe(false);
    expect(validateSheetData(template, { str: "12" })).toBe(false);
    expect(validateSheetData(template, { nope: 1 })).toBe(false);
  });
  it("rejects templates with unknown references, cycles-free duplicates and bad formulas", () => {
    const bad = (fields: object[]) => sheetTemplateSchema.safeParse({ sections: [{ id: "s", fields }] }).success;
    expect(bad([{ id: "a", type: "computed", formula: "@missing" }])).toBe(false);
    expect(
      bad([
        { id: "a", type: "number" },
        { id: "a", type: "number" },
      ]),
    ).toBe(false);
    expect(bad([{ id: "a", type: "computed", formula: "1 +" }])).toBe(false);
  });
  it("yields null for circular formulas instead of hanging", () => {
    const circular = sheetTemplateSchema.parse({
      sections: [
        {
          id: "s",
          fields: [
            { id: "a", type: "computed", formula: "@b" },
            { id: "b", type: "computed", formula: "@a" },
          ],
        },
      ],
    });
    expect(computeSheet(circular, {})).toEqual({ a: null, b: null });
  });
});
