import { describe, expect, it } from "vitest";
import { rulerDistanceInCells, snapTokenCorner } from "./gridGeometry";
import { hexAt, hexCenter, snapToHex } from "./hex";

const grid = (gridType: string, gridSize = 70) => ({ gridType, gridSize });

describe("snapTokenCorner", () => {
  it("snaps the corner of a token to the nearest cell corner on a square grid", () => {
    expect(snapTokenCorner(grid("square"), 1, { x: 100, y: 34 })).toEqual({ x: 70, y: 0 });
    expect(snapTokenCorner(grid("square"), 1, { x: 106, y: 36 })).toEqual({ x: 140, y: 70 });
    // The token size does not change where a square grid snaps.
    expect(snapTokenCorner(grid("square"), 3, { x: 100, y: 34 })).toEqual({ x: 70, y: 0 });
  });

  it("leaves the position alone when there is no grid", () => {
    expect(snapTokenCorner(grid("none"), 1, { x: 101.5, y: 33.25 })).toEqual({ x: 101.5, y: 33.25 });
  });

  it.each(["hexPointy", "hexFlat"] as const)("puts the centre of the token on the centre of a hex (%s)", (gridType) => {
    const orientation = gridType === "hexPointy" ? "pointy" : "flat";
    const size = 70;
    const tokenSize = 2;
    const half = (tokenSize * size) / 2;
    const corner = { x: 233, y: 187 };
    const snapped = snapTokenCorner(grid(gridType, size), tokenSize, corner);

    const expectedCenter = snapToHex({ x: corner.x + half, y: corner.y + half }, size, orientation);
    expect(snapped).toEqual({ x: expectedCenter.x - half, y: expectedCenter.y - half });
    // Centre lands exactly on some hex centre.
    const { q, r } = hexAt({ x: snapped.x + half, y: snapped.y + half }, size, orientation);
    expect(hexCenter(q, r, size, orientation)).toEqual({ x: snapped.x + half, y: snapped.y + half });
  });
});

describe("rulerDistanceInCells", () => {
  const from = { x: 0, y: 0 };

  it("counts whole steps with the chosen diagonal rule on a square grid", () => {
    const to = { x: 3 * 70, y: 3 * 70 };
    expect(rulerDistanceInCells(grid("square"), from, to, "simple")).toBe(3);
    expect(rulerDistanceInCells(grid("square"), from, to, "alternating")).toBe(4);
    expect(rulerDistanceInCells(grid("square"), from, to, "exact")).toBeCloseTo(Math.hypot(3, 3), 6);
  });

  it("counts hexes on a hex grid, whatever the diagonal rule", () => {
    const to = hexCenter(2, -1, 70, "pointy");
    expect(rulerDistanceInCells(grid("hexPointy"), hexCenter(0, 0, 70, "pointy"), to, "simple")).toBe(2);
    expect(rulerDistanceInCells(grid("hexPointy"), hexCenter(0, 0, 70, "pointy"), to, "exact")).toBe(2);
  });

  it("measures the straight line in cells when there is no grid", () => {
    expect(rulerDistanceInCells(grid("none"), from, { x: 210, y: 280 }, "simple")).toBe(5);
  });
});
