import type { FloorDto, SceneDto, VisionDto } from "@openvtt/shared";
import { describe, expect, it } from "vitest";
import { FOG_ALPHA, GM_DARKNESS_SHARE, lightStops, planShade, poolsOf, rgba, shadeSize } from "./lighting";

const light = { id: "l1", x: 100, y: 100, radius: 3, intensity: 1, color: "#ffffff", shadows: true, feather: 0.4 };
const floor: FloorDto = { id: "f1", name: "Ground", assetId: null, assetKind: null, walls: [], lights: [light], drawings: [] };
const scene = {
  id: "s1",
  width: 1000,
  height: 800,
  gridSize: 50,
  bakedLighting: false,
  ambientLight: 0.2,
  floors: [floor],
  tableFloorId: "f1",
} as unknown as SceneDto;

describe("lightStops", () => {
  it("keeps full strength in the core and fades to nothing at the edge", () => {
    expect(lightStops(0.4, 1)).toEqual([
      [0, 1],
      [0.6, 1],
      [1, 0],
    ]);
  });

  it("gives a hard edge without feather and fades from the center with full feather", () => {
    expect(lightStops(0, 1)[1]).toEqual([1, 1]);
    expect(lightStops(1, 1)[1]).toEqual([0, 1]);
  });

  it("clamps out-of-range values instead of producing invalid gradient offsets", () => {
    for (const [offset, strength] of lightStops(5, 20)) {
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThanOrEqual(1);
      expect(strength).toBeLessThanOrEqual(1);
    }
    expect(lightStops(Number.NaN, 1).every(([offset]) => offset >= 0 && offset <= 1)).toBe(true);
  });
});

describe("planShade", () => {
  it("draws nothing for a fully lit scene", () => {
    expect(planShade({ ...scene, ambientLight: 1 }, floor, null, false)).toBeNull();
  });

  it("draws nothing for a scene whose picture already has its lighting", () => {
    expect(planShade({ ...scene, bakedLighting: true }, floor, null, false)).toBeNull();
  });

  it("shows the game master half the darkness unless previewing, with the pools computed locally", () => {
    const half = planShade(scene, floor, null, false)!;
    expect(half.darkness).toBeCloseTo(0.8 * GM_DARKNESS_SHARE);
    expect(half.fogHoles).toBeNull();
    expect(half.pools).toHaveLength(1);
    expect(planShade(scene, floor, null, true)!.darkness).toBeCloseTo(0.8);
  });

  it("gives a player the server's polygons and pools and fog outside them", () => {
    const vision: VisionDto = { sceneId: "s1", polygons: [[0, 0, 10, 0, 10, 10]], lights: [] };
    const plan = planShade({ ...scene, ambientLight: 1 }, floor, vision, false)!;
    expect(plan.fogHoles).toEqual(vision.polygons);
    expect(plan.darkness).toBe(0);
    expect(plan.pools).toEqual([]);
    expect(FOG_ALPHA).toBeGreaterThan(0.9);
  });

  it("ignores a vision that belongs to another scene", () => {
    const vision: VisionDto = { sceneId: "other", polygons: [[0, 0, 10, 0, 10, 10]], lights: [] };
    expect(planShade({ ...scene, ambientLight: 1 }, floor, vision, false)).toBeNull();
  });
});

describe("poolsOf", () => {
  it("stops a light at a wall when it casts shadows and ignores the wall when it does not", () => {
    const wall = { id: "w1", x1: 160, y1: -1000, x2: 160, y2: 1000, kind: "wall" as const, open: false };
    const walled = { ...floor, walls: [wall] };
    const reach = (polygon: number[]) => Math.max(...polygon.filter((_, i) => i % 2 === 0));
    expect(reach(poolsOf(scene, walled)[0]!.polygon)).toBeLessThan(170);
    const open = { ...walled, lights: [{ ...light, shadows: false }] };
    expect(reach(poolsOf(scene, open)[0]!.polygon)).toBeGreaterThan(240);
  });

  it("skips lights without radius", () => {
    expect(poolsOf(scene, { ...floor, lights: [{ ...light, radius: 0 }] })).toEqual([]);
  });
});

describe("shadeSize and rgba", () => {
  it("keeps small maps at full size and shrinks big ones to the cap", () => {
    expect(shadeSize(1000, 800)).toEqual({ scale: 1, width: 1000, height: 800 });
    expect(shadeSize(4096, 2048).width).toBe(2048);
  });

  it("converts hex to rgba", () => {
    expect(rgba("#ff8000", 0.5)).toBe("rgba(255, 128, 0, 0.5)");
  });
});
