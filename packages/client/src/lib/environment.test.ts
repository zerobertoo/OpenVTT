import { DEFAULT_ENVIRONMENT } from "@openvtt/shared";
import { describe, expect, it } from "vitest";
import { environmentLook, spawnParticles, stepParticle } from "./environment";

describe("environmentLook", () => {
  it("draws nothing for a clear day", () => {
    expect(environmentLook(DEFAULT_ENVIRONMENT)).toEqual({ tints: [], particles: [] });
  });

  it("darkens the map at night and stacks the weather on top", () => {
    const look = environmentLook({ time: "night", weather: "rain", season: "none" });
    expect(look.tints.map((t) => t.color)).toEqual(["#34457f", "#aab4c8"]);
    expect(look.particles).toEqual(["rain"]);
  });

  it("lets leaves fall only when nothing else is falling", () => {
    expect(environmentLook({ time: "day", weather: "clear", season: "autumn" }).particles).toEqual(["leaves"]);
    expect(environmentLook({ time: "day", weather: "snow", season: "autumn" }).particles).toEqual(["snow"]);
    expect(environmentLook({ time: "day", weather: "fog", season: "spring" }).particles).toEqual(["fog", "petals"]);
  });
});

describe("particles", () => {
  it("fills the screen in proportion to its size and wraps at the bottom", () => {
    expect(spawnParticles("rain", 1280, 720)).toHaveLength(220);
    expect(spawnParticles("rain", 640, 360)).toHaveLength(55);
    const p = { x: 10, y: 739, r: 0.5 };
    stepParticle("rain", p, 0.1, 0, 1280, 720);
    expect(p.y).toBe(-20);
  });
});
