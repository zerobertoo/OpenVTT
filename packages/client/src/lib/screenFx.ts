import type { Container, Filter, PointData, Ticker } from "pixi.js";
import { ShockwaveFilter } from "pixi-filters/shockwave";

const MAX_SHOCKWAVES = 2;

/**
 * Shakes the map for `ms`, strongest at the start. Each frame moves the world by the change in the shake only, so a
 * person panning the map while it shakes is not fought, and the map ends exactly where it was.
 */
export function shakeWorld(ticker: Ticker, world: Container, amplitude: number, ms: number) {
  const started = performance.now();
  let offsetX = 0;
  let offsetY = 0;
  const step = () => {
    if (world.destroyed) return ticker.remove(step);
    const t = Math.min(1, (performance.now() - started) / ms);
    const strength = amplitude * (1 - t) ** 2;
    const nextX = (Math.random() * 2 - 1) * strength;
    const nextY = (Math.random() * 2 - 1) * strength;
    world.x += nextX - offsetX;
    world.y += nextY - offsetY;
    offsetX = nextX;
    offsetY = nextY;
    if (t >= 1) ticker.remove(step);
  };
  ticker.add(step);
}

/**
 * A ripple that bends the whole view outward from a spot on the map (scene pixels) and fades away. It is a filter on
 * the stage, so it only costs anything while it plays.
 */
export function shockwave(ticker: Ticker, world: Container, at: PointData, reachPixels: number, ms: number, strength = 1) {
  const stage = world.parent;
  // Each ripple is a full-screen pass, so a crowd of effects at once shares the first few.
  if (!stage || ((stage.filters as Filter[] | null) ?? []).filter((f) => f instanceof ShockwaveFilter).length >= MAX_SHOCKWAVES) return;
  const zoom = world.scale.x;
  const center = world.toGlobal(at);
  const filter = new ShockwaveFilter({
    center,
    speed: ((reachPixels * zoom) / ms) * 1000,
    amplitude: 26 * strength,
    wavelength: Math.max(60, 150 * zoom),
    brightness: 1.08,
    radius: -1,
  });
  stage.filters = [...((stage.filters as Filter[] | null) ?? []), filter];
  const started = performance.now();
  const step = () => {
    const t = Math.min(1, (performance.now() - started) / ms);
    if (world.destroyed || t >= 1) {
      ticker.remove(step);
      if (!stage.destroyed) stage.filters = ((stage.filters as Filter[] | null) ?? []).filter((f) => f !== filter);
      filter.destroy();
      return;
    }
    filter.time = t * (ms / 1000);
    filter.amplitude = 26 * strength * (1 - t);
  };
  ticker.add(step);
}
