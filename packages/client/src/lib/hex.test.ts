import { describe, expect, it } from "vitest";
import { hexAt, hexCenter, hexCentersIn, hexCorners, hexDistance, snapToHex } from "./hex";

describe.each(["pointy", "flat"] as const)("%s hex grid", (orientation) => {
  it("finds the hex back from its own center and from points near it", () => {
    for (const [q, r] of [
      [0, 0],
      [3, -1],
      [-2, 5],
    ] as const) {
      const c = hexCenter(q, r, 70, orientation);
      expect(hexAt(c, 70, orientation)).toEqual({ q, r });
      expect(hexAt({ x: c.x + 20, y: c.y - 15 }, 70, orientation)).toEqual({ q, r });
    }
  });

  it("puts neighbors one cell size apart and counts steps between hexes", () => {
    const a = hexCenter(0, 0, 70, orientation);
    const b = hexCenter(1, 0, 70, orientation);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(70);
    expect(hexDistance(a, hexCenter(3, -1, 70, orientation), 70, orientation)).toBe(3);
    expect(hexDistance(a, hexCenter(2, 2, 70, orientation), 70, orientation)).toBe(4);
  });

  it("snaps to the nearest center and covers the whole map", () => {
    const c = hexCenter(2, 1, 50, orientation);
    expect(snapToHex({ x: c.x + 5, y: c.y + 5 }, 50, orientation)).toEqual(c);
    expect(hexCorners(c, 50, orientation)).toHaveLength(12);
    const centers = hexCentersIn(500, 400, 50, orientation);
    for (const probe of [
      { x: 1, y: 1 },
      { x: 499, y: 399 },
      { x: 250, y: 200 },
    ]) {
      const snapped = snapToHex(probe, 50, orientation);
      expect(centers.some((p) => Math.abs(p.x - snapped.x) < 0.01 && Math.abs(p.y - snapped.y) < 0.01)).toBe(true);
    }
  });
});
