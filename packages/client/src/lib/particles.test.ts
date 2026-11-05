import { Texture } from "pixi.js";
import { describe, expect, it } from "vitest";
import { mixColor, ParticleSystem } from "./particles";

const base = { x: 0, y: 0, speed: [100, 100], life: [1, 1], size: [10, 10], colors: [0xff0000] } as const;

describe("ParticleSystem", () => {
  it("moves particles and removes them once their life is over", () => {
    const system = new ParticleSystem(Texture.EMPTY, "add", () => 0.5);
    system.emit({ ...base, count: 5, angle: [0, 0] });
    expect(system.alive).toBe(5);
    system.update(0.5);
    expect(system.container.particleChildren[0]!.x).toBeCloseTo(50 * Math.exp(-0), 0);
    system.update(0.6);
    expect(system.alive).toBe(0);
    expect(system.container.particleChildren).toHaveLength(0);
  });

  it("slows with drag and falls with gravity", () => {
    const system = new ParticleSystem(Texture.EMPTY, "add", () => 0.5);
    system.emit({ ...base, count: 1, angle: [0, 0], drag: 2, gravity: 200 });
    system.update(0.25);
    const particle = system.container.particleChildren[0]!;
    expect(particle.x).toBeLessThan(25);
    expect(particle.y).toBeGreaterThan(0);
  });

  it("starts inward particles on a ring, flying at the spot", () => {
    const system = new ParticleSystem(Texture.EMPTY, "add", () => 0.25);
    system.emit({ ...base, count: 1, spread: 100, inward: true });
    const particle = system.container.particleChildren[0]!;
    expect(Math.hypot(particle.x, particle.y)).toBeCloseTo(100);
    system.update(0.1);
    expect(Math.hypot(particle.x, particle.y)).toBeLessThan(100);
  });
});

describe("mixColor", () => {
  it("blends two colours channel by channel", () => {
    expect(mixColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(mixColor(0xff0000, 0x0000ff, 0)).toBe(0xff0000);
  });
});
