import { Graphics } from "pixi.js";
import { describe, expect, it } from "vitest";
import { drawGrid, gridKey } from "./mapGrid";

const square = { gridType: "square", gridSize: 100, width: 300, height: 200 };

/** How many separate line segments were queued on the graphics (`moveTo`/`lineTo` pairs and polygons). */
const instructionCount = (g: Graphics) => g.context.instructions.length;

describe("gridKey", () => {
  it("changes only with what the grid is drawn from", () => {
    expect(gridKey(square)).toBe(gridKey({ ...square }));
    expect(gridKey(square)).not.toBe(gridKey({ ...square, gridSize: 50 }));
    expect(gridKey(square)).not.toBe(gridKey({ ...square, gridType: "hexPointy" }));
    expect(gridKey(square)).not.toBe(gridKey({ ...square, width: 400 }));
    expect(gridKey(square)).not.toBe(gridKey({ ...square, height: 300 }));
  });
});

describe("drawGrid", () => {
  it("draws a line on every cell boundary of a square grid, edges included, in one stroke", () => {
    const g = new Graphics();
    drawGrid(g, square);
    // 4 vertical + 3 horizontal lines, then a single stroke.
    const lines = g.context.instructions.filter((i) => i.action === "stroke");
    expect(lines).toHaveLength(1);
    // The lines reach the map edges; the stroke itself adds a pixel.
    expect(g.bounds.width).toBeGreaterThanOrEqual(300);
    expect(g.bounds.width).toBeLessThanOrEqual(302);
    expect(g.bounds.height).toBeGreaterThanOrEqual(200);
    expect(g.bounds.height).toBeLessThanOrEqual(202);
  });

  it("draws nothing for a map without a grid", () => {
    const g = new Graphics();
    drawGrid(g, { ...square, gridType: "none" });
    expect(instructionCount(g)).toBe(0);
  });

  it("draws hexagons for a hex grid and no square lines", () => {
    const g = new Graphics();
    drawGrid(g, { ...square, gridType: "hexPointy" });
    expect(instructionCount(g)).toBeGreaterThan(0);
    expect(g.context.instructions.filter((i) => i.action === "stroke")).toHaveLength(1);
  });

  it("starts over every time it is called", () => {
    const g = new Graphics();
    drawGrid(g, square);
    const first = instructionCount(g);
    drawGrid(g, square);
    expect(instructionCount(g)).toBe(first);
  });
});
