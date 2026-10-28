import { parseFoundryScene, UvttError } from "@openvtt/shared";
import { describe, expect, it } from "vitest";

// The shape Dungeon Alchemist writes next to the picture in its Foundry export (values from a real export).
const scene = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    name: "Little Oasis",
    width: 1484,
    height: 2014,
    grid: 53,
    shiftX: 0,
    shiftY: 0,
    gridDistance: 5.0,
    gridUnits: "ft",
    globalLight: true,
    lights: [{ x: 623, y: 631, dim: 25.0000019, bright: 12.500001, tintColor: "#FF9800", tintAlpha: 0.0 }],
    walls: [],
    img: null,
    ...extra,
  });

describe("parseFoundryScene", () => {
  it("reads grid, distance and lights, turning radii in feet into grid cells", () => {
    const map = parseFoundryScene(scene());
    expect(map).toMatchObject({ name: "Little Oasis", gridSize: 53, width: 1484, height: 2014, gridDistance: 5, distanceUnit: "ft" });
    expect(map.lights).toHaveLength(1);
    expect(map.lights[0]!.radius).toBeCloseTo(5);
    expect(map.lights[0]!.color).toBe("#ffffff");
    expect(map.warnings).toEqual(["no_walls", "no_image"]);
  });

  it("reads walls and doors from Foundry's public wall shape", () => {
    const map = parseFoundryScene(
      scene({
        walls: [
          { c: [0, 0, 530, 0], move: 20, sight: 20 },
          { c: [530, 0, 530, 106], door: 1, ds: 0 },
          { c: [530, 106, 530, 212], door: 2, ds: 1 },
          { c: [1, 1, 2, 2], move: 0, sight: 0 },
          { c: [0, 0, 99999, 0] },
        ],
      }),
    );
    expect(map.walls).toEqual([
      { x1: 0, y1: 0, x2: 530, y2: 0 },
      { x1: 0, y1: 0, x2: 1484, y2: 0 },
    ]);
    expect(map.doors.map((d) => d.closed)).toEqual([true, false]);
    expect(map.warnings).not.toContain("no_walls");
  });

  it("honors a tint only when it has strength, and warns about a grid offset", () => {
    const map = parseFoundryScene(scene({ shiftX: 10, lights: [{ x: 1, y: 1, dim: 10, tintColor: "#FF9800", tintAlpha: 0.5 }] }));
    expect(map.lights[0]!.color).toBe("#ff9800");
    expect(map.warnings).toContain("grid_offset");
  });

  it("rejects files that are not scenes", () => {
    expect(() => parseFoundryScene("nope")).toThrow(UvttError);
    expect(() => parseFoundryScene("{}")).toThrow(UvttError);
    expect(() => parseFoundryScene(scene({ grid: 1 }))).toThrow(UvttError);
  });
});
