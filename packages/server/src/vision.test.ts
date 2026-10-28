import { pathIsBlocked, pointInPolygon, visibilityPolygon } from "@openvtt/shared";
import { describe, expect, it } from "vitest";

const origin = { x: 500, y: 500 };

describe("visibilityPolygon", () => {
  it("is a disc of the radius in the open", () => {
    const polygon = visibilityPolygon(origin, [], 200);
    expect(pointInPolygon({ x: 500, y: 500 }, polygon)).toBe(true);
    expect(pointInPolygon({ x: 650, y: 500 }, polygon)).toBe(true);
    expect(pointInPolygon({ x: 720, y: 500 }, polygon)).toBe(false);
    expect(pointInPolygon({ x: 500, y: 300 + 10 }, polygon)).toBe(true);
  });

  it("hides what is behind a wall but not what is beside it", () => {
    const wall = { x1: 600, y1: 400, x2: 600, y2: 600 };
    const polygon = visibilityPolygon(origin, [wall], 400);
    expect(pointInPolygon({ x: 550, y: 500 }, polygon)).toBe(true);
    expect(pointInPolygon({ x: 700, y: 500 }, polygon)).toBe(false);
    expect(pointInPolygon({ x: 700, y: 750 }, polygon)).toBe(true);
    expect(pointInPolygon({ x: 400, y: 500 }, polygon)).toBe(true);
  });

  it("sees through a gap between two walls (a doorway)", () => {
    const walls = [
      { x1: 600, y1: 0, x2: 600, y2: 480 },
      { x1: 600, y1: 520, x2: 600, y2: 1000 },
    ];
    const polygon = visibilityPolygon(origin, walls, 400);
    expect(pointInPolygon({ x: 800, y: 500 }, polygon)).toBe(true);
    expect(pointInPolygon({ x: 800, y: 700 }, polygon)).toBe(false);
  });

  it("ignores walls out of reach", () => {
    const far = { x1: 5000, y1: 0, x2: 5000, y2: 1000 };
    expect(visibilityPolygon(origin, [far], 200)).toHaveLength(visibilityPolygon(origin, [], 200).length);
  });
});

describe("pathIsBlocked", () => {
  it("lets a path run along a wall or end on it, and stops one that crosses", () => {
    const wall = [{ x1: 100, y1: 0, x2: 100, y2: 100 }];
    expect(pathIsBlocked({ x: 0, y: 50 }, { x: 200, y: 50 }, wall)).toBe(true);
    expect(pathIsBlocked({ x: 100, y: 10 }, { x: 100, y: 90 }, wall)).toBe(false);
    expect(pathIsBlocked({ x: 0, y: 50 }, { x: 100, y: 50 }, wall)).toBe(false);
  });
});
