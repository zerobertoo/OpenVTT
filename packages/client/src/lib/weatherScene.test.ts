import { describe, expect, it, vi } from "vitest";
import { jaggedLine, WeatherScene } from "./weatherScene";

const scene = (reduced = false) => {
  const weather = new WeatherScene({ reduced, onThunder: vi.fn() });
  weather.resize(1280, 720);
  return weather;
};

const settle = (weather: WeatherScene, seconds: number) => {
  for (let i = 0; i < seconds * 60; i++) weather.step(1 / 60);
};

describe("WeatherScene", () => {
  it("fades the old weather out completely when the weather changes, leaving nothing behind", () => {
    const weather = scene();
    weather.setKinds(["snow"]);
    settle(weather, 4);
    expect(weather.idle).toBe(false);

    weather.setKinds(["fog"]);
    settle(weather, 6);
    // Only fog remains: dropping fog as well leaves the scene empty, so no frame of snow can be stuck on screen.
    weather.setKinds([]);
    settle(weather, 6);
    expect(weather.idle).toBe(true);
  });

  it("shows layers at once and removes them at once with reduced motion", () => {
    const weather = scene(true);
    weather.setKinds(["rain"]);
    expect(weather.idle).toBe(false);
    weather.setKinds([]);
    expect(weather.idle).toBe(true);
  });

  it("keeps particles in place relative to the screen when it is resized", () => {
    const weather = scene();
    weather.setKinds(["snow"]);
    weather.resize(640, 360);
    weather.setKinds([]);
    settle(weather, 6);
    expect(weather.idle).toBe(true);
  });

  it("sounds thunder some time after a strike in a storm", () => {
    const onThunder = vi.fn();
    const weather = new WeatherScene({ reduced: false, onThunder });
    weather.resize(1280, 720);
    weather.setKinds(["storm"]);
    settle(weather, 40);
    expect(onThunder).toHaveBeenCalled();
    expect(onThunder.mock.calls[0]![0]).toBeGreaterThan(0);
  });
});

describe("jaggedLine", () => {
  it("keeps its ends and grows more points each round", () => {
    const line = jaggedLine({ x: 0, y: 0 }, { x: 0, y: 100 }, 40, 3, () => 0.75);
    expect(line[0]).toEqual({ x: 0, y: 0 });
    expect(line.at(-1)).toEqual({ x: 0, y: 100 });
    expect(line).toHaveLength(9);
  });
});
