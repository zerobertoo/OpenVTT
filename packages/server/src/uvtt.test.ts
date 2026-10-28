import { parseUvtt, parseUvttColor, UvttError } from "@openvtt/shared";
import { describe, expect, it } from "vitest";

const PNG_BASE64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).toString("base64");

function file(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    format: 0.2,
    resolution: { map_origin: { x: 0, y: 0 }, map_size: { x: 28, y: 38 }, pixels_per_grid: 53 },
    line_of_sight: [],
    portals: [],
    lights: [{ position: { x: 11.75, y: 11.9 }, range: 5, intensity: 2.5, color: "ffFFE5BF", shadows: true }],
    environment: { baked_lighting: true, ambient_light: "ffffffff" },
    image: "",
    ...overrides,
  });
}

describe("parseUvtt", () => {
  it("reads grid, size and lights (video export: no image, no walls)", () => {
    const map = parseUvtt(file());
    expect(map).toMatchObject({ gridSize: 53, columns: 28, rows: 38, width: 1484, height: 2014, bakedLighting: true });
    expect(map.lights[0]).toMatchObject({ x: 11.75 * 53, radius: 5, color: "#ffe5bf" });
    expect(map.warnings).toEqual(["no_walls", "no_image"]);
  });

  it("converts walls and doors from cells to pixels and clamps to the map", () => {
    const map = parseUvtt(
      file({
        line_of_sight: [
          [
            { x: 1, y: 1 },
            { x: 3, y: 1 },
            { x: 3, y: 99 },
          ],
        ],
        portals: [
          {
            position: { x: 2, y: 1 },
            bounds: [
              { x: 1.5, y: 1 },
              { x: 2.5, y: 1 },
            ],
            rotation: 0,
            closed: false,
            freestanding: false,
          },
        ],
        image: PNG_BASE64,
      }),
    );
    expect(map.walls).toEqual([
      { x1: 53, y1: 53, x2: 159, y2: 53 },
      { x1: 159, y1: 53, x2: 159, y2: 2014 },
    ]);
    expect(map.doors).toEqual([{ x1: 79.5, y1: 53, x2: 132.5, y2: 53, closed: false }]);
    expect(map.image?.mime).toBe("image/png");
    expect(map.warnings).toEqual([]);
  });

  it("rejects things that are not Universal VTT files", () => {
    expect(() => parseUvtt("nope")).toThrow(UvttError);
    expect(() => parseUvtt("{}")).toThrow(UvttError);
    expect(() => parseUvtt(file({ resolution: { map_size: { x: 5, y: 5 }, pixels_per_grid: 1 } }))).toThrow(UvttError);
    expect(() => parseUvtt(file({ resolution: { map_size: { x: 5, y: 5 }, pixels_per_grid: 1e9 } }))).toThrow(UvttError);
  });

  it("ignores an embedded image that is not PNG or WebP", () => {
    expect(parseUvtt(file({ image: Buffer.from("GIF89a-not-allowed").toString("base64") })).image).toBeNull();
  });

  it("parses colors with and without alpha", () => {
    expect(parseUvttColor("ffFFE5BF")).toBe("#ffe5bf");
    expect(parseUvttColor("#FFE5BF")).toBe("#ffe5bf");
    expect(parseUvttColor("zz")).toBe("#ffffff");
  });
});
