import { describe, expect, it } from "vitest";
import { fitView, MAX_ZOOM, MIN_ZOOM, minZoomFor, viewCenteredOn, zoomAround } from "./mapCamera";

const screen = { width: 800, height: 600 };

describe("minZoomFor", () => {
  it("is the fixed floor when the map is small or missing", () => {
    expect(minZoomFor(screen, null)).toBe(MIN_ZOOM);
    expect(minZoomFor(screen, { width: 1000, height: 1000 })).toBe(MIN_ZOOM);
  });

  it("drops to the scale that fits a map too large for the screen", () => {
    // 16000 wide on an 800 wide screen needs 0.05; 12000 tall on a 600 tall screen needs 0.05 as well.
    expect(minZoomFor(screen, { width: 16000, height: 3000 })).toBeCloseTo(0.05);
    expect(minZoomFor(screen, { width: 1000, height: 12000 })).toBeCloseTo(0.05);
  });
});

describe("fitView", () => {
  it("centres the whole map and shrinks it to the tighter side", () => {
    expect(fitView(screen, { width: 1600, height: 600 })).toEqual({ scale: 0.5, x: 0, y: 150 });
  });

  it("never enlarges a small map past its real size", () => {
    expect(fitView(screen, { width: 400, height: 200 })).toEqual({ scale: 1, x: 200, y: 200 });
  });
});

describe("zoomAround", () => {
  const view = { scale: 1, x: 100, y: 50 };

  it("keeps the map point under the given screen point where it is", () => {
    const point = { x: 400, y: 300 };
    const next = zoomAround(view, point, 2, MIN_ZOOM, MAX_ZOOM);
    expect(next.scale).toBe(2);
    // The map point (300, 250) must still be under the screen point after the zoom.
    expect(next.x + 300 * next.scale).toBeCloseTo(point.x);
    expect(next.y + 250 * next.scale).toBeCloseTo(point.y);
  });

  it("stays within the limits", () => {
    expect(zoomAround({ ...view, scale: 6 }, { x: 0, y: 0 }, 10, 0.1, 8).scale).toBe(8);
    expect(zoomAround({ ...view, scale: 0.2 }, { x: 0, y: 0 }, 0.1, 0.1, 8).scale).toBe(0.1);
  });
});

describe("viewCenteredOn", () => {
  it("puts a map point in the middle of the screen at the current zoom", () => {
    expect(viewCenteredOn(screen, { x: 1000, y: 500 }, 0.5)).toEqual({ x: 400 - 500, y: 300 - 250 });
  });
});
