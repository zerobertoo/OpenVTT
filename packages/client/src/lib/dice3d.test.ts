import type { RollResult } from "@openvtt/sdk";
import { describe, expect, it } from "vitest";
import { thrownDice } from "./dice3dSupport";
import { dieFaces, dieGeometry } from "./dieFaces";

const roll = (parts: { sides: number; results: number[]; kept?: number[] }[]): RollResult => ({
  notation: "x",
  modifier: 0,
  advantage: null,
  total: 0,
  parts: parts.map((p) => ({
    sign: 1,
    count: p.results.length,
    sides: p.sides,
    results: p.results,
    kept: p.kept ?? p.results.map((_, i) => i),
  })),
});

describe("dieFaces", () => {
  it.each([4, 6, 8, 12, 20])("a d%i has one face per side, pointing outward", (sides) => {
    const faces = dieFaces(dieGeometry(sides));
    expect(faces.map((f) => f.value)).toEqual(Array.from({ length: sides }, (_, i) => i + 1));
    for (const face of faces) expect(face.center.dot(face.normal)).toBeGreaterThan(0);
  });
});

describe("thrownDice", () => {
  it("lists every die, flagging the ones advantage dropped", () => {
    expect(thrownDice(roll([{ sides: 20, results: [3, 17], kept: [1] }]))).toEqual([
      { sides: 20, value: 3, kept: false },
      { sides: 20, value: 17, kept: true },
    ]);
  });

  it("gives up on dice without a solid and on too many dice", () => {
    expect(thrownDice(roll([{ sides: 10, results: [4] }]))).toBeNull();
    expect(thrownDice(roll([{ sides: 6, results: Array(9).fill(1) }]))).toBeNull();
  });
});
