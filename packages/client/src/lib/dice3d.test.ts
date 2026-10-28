import type { RollResult } from "@openvtt/sdk";
import { describe, expect, it } from "vitest";
import { faceLabel, thrownDice } from "./dice3dSupport";
import { diceFaces, diceGeometry } from "./diceFaces";

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

describe("diceFaces", () => {
  it.each([4, 6, 8, 10, 12, 20])("a d%i has one face per side, pointing outward", (sides) => {
    const faces = diceFaces(diceGeometry(sides));
    expect(faces.map((f) => f.index)).toEqual(Array.from({ length: sides }, (_, i) => i));
    for (const face of faces) expect(face.center.dot(face.normal)).toBeGreaterThan(0);
  });
});

describe("thrownDice", () => {
  it("lists every die, flagging the ones advantage dropped", () => {
    expect(thrownDice(roll([{ sides: 20, results: [3, 17], kept: [1] }]))).toEqual([
      { shape: 20, kind: "normal", face: 2, kept: false },
      { shape: 20, kind: "normal", face: 16, kept: true },
    ]);
  });

  it("rests a d10 on the face reading its number, with the 0 standing for 10", () => {
    const [seven, ten] = thrownDice(roll([{ sides: 10, results: [7, 10] }]))!;
    expect(faceLabel(seven!, seven!.face)).toBe("7");
    expect(faceLabel(ten!, ten!.face)).toBe("0");
  });

  it("throws a d100 as a tens die and a units die, 100 reading 00 and 0", () => {
    const read = (value: number) => thrownDice(roll([{ sides: 100, results: [value] }]))!.map((d) => faceLabel(d, d.face));
    expect(read(47)).toEqual(["40", "7"]);
    expect(read(100)).toEqual(["00", "0"]);
    expect(read(5)).toEqual(["00", "5"]);
  });

  it("gives up on dice without a solid and on too many dice", () => {
    expect(thrownDice(roll([{ sides: 3, results: [2] }]))).toBeNull();
    expect(thrownDice(roll([{ sides: 6, results: Array(13).fill(1) }]))).toBeNull();
  });
});
