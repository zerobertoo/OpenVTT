import { describe, expect, it } from "vitest";
import { conePoints, lineCells } from "./ruler";

describe("lineCells", () => {
  it("measures the straight line when the rule is exact", () => {
    expect(lineCells(300, 400, 100, "exact")).toBe(5);
  });

  it("counts every diagonal step as one cell with the simple rule", () => {
    expect(lineCells(300, 300, 100, "simple")).toBe(3);
    expect(lineCells(500, 200, 100, "simple")).toBe(5);
  });

  it("makes every second diagonal cost two with the alternating rule", () => {
    expect(lineCells(100, 100, 100, "alternating")).toBe(1);
    expect(lineCells(200, 200, 100, "alternating")).toBe(3);
    expect(lineCells(300, 300, 100, "alternating")).toBe(4);
    expect(lineCells(500, 0, 100, "alternating")).toBe(5);
  });

  it("does not care which way the line points", () => {
    expect(lineCells(-300, -300, 100, "alternating")).toBe(lineCells(300, 300, 100, "alternating"));
  });
});

describe("conePoints", () => {
  it("is as wide at the far end as it is long", () => {
    const [apex, left, right] = conePoints({ x: 0, y: 0 }, { x: 400, y: 0 });
    expect(apex).toEqual({ x: 0, y: 0 });
    expect(Math.hypot(left.x - right.x, left.y - right.y)).toBe(400);
    expect(left.x).toBe(400);
    expect(right.x).toBe(400);
  });
});
