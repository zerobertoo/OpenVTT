import { describe, expect, it } from "vitest";
import { MINIMAP_MAX_SIDE, minimapSize, sceneAt, visibleArea } from "./minimap";

describe("minimap", () => {
  it("keeps the scene's proportions with the longest side at the maximum", () => {
    expect(minimapSize({ width: 3200, height: 1600 })).toEqual({ width: MINIMAP_MAX_SIDE, height: MINIMAP_MAX_SIDE / 2 });
    expect(minimapSize({ width: 500, height: 1000 })).toEqual({ width: MINIMAP_MAX_SIDE / 2, height: MINIMAP_MAX_SIDE });
  });

  it("finds the part of the scene on screen from the view", () => {
    expect(visibleArea({ x: -200, y: -100, scale: 2 }, { width: 800, height: 600 })).toEqual({ x: 100, y: 50, width: 400, height: 300 });
  });

  it("turns a click on the minimap into a point in the scene, inside its edges", () => {
    const minimap = { width: 160, height: 80 };
    const scene = { width: 3200, height: 1600 };
    expect(sceneAt({ x: 80, y: 40 }, minimap, scene)).toEqual({ x: 1600, y: 800 });
    expect(sceneAt({ x: -10, y: 900 }, minimap, scene)).toEqual({ x: 0, y: 1600 });
  });
});
