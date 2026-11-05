import type { EnvironmentDto } from "@openvtt/shared";

export type ParticleKind = "rain" | "storm" | "snow" | "leaves" | "petals" | "fog";

export interface Tint {
  color: string;
  blend: "multiply" | "normal" | "soft-light";
}

export interface EnvironmentLook {
  /** Colour washes laid over the map, bottom to top. */
  tints: Tint[];
  /** Moving things drawn on the canvas above the tints. */
  particles: ParticleKind[];
}

const TIME_TINTS: Record<EnvironmentDto["time"], Tint | null> = {
  day: null,
  dawn: { color: "#ffcfa8", blend: "multiply" },
  dusk: { color: "#ff9f6e", blend: "multiply" },
  night: { color: "#34457f", blend: "multiply" },
};

const SEASON_TINTS: Record<EnvironmentDto["season"], Tint | null> = {
  none: null,
  spring: { color: "rgba(150, 230, 140, 0.12)", blend: "soft-light" },
  summer: { color: "rgba(255, 220, 120, 0.16)", blend: "soft-light" },
  autumn: { color: "rgba(255, 150, 60, 0.22)", blend: "soft-light" },
  winter: { color: "rgba(160, 200, 255, 0.22)", blend: "soft-light" },
};

const WEATHER_TINTS: Record<EnvironmentDto["weather"], Tint | null> = {
  clear: null,
  rain: { color: "#aab4c8", blend: "multiply" },
  storm: { color: "#6e7791", blend: "multiply" },
  snow: { color: "rgba(235, 242, 255, 0.14)", blend: "normal" },
  fog: { color: "rgba(214, 220, 228, 0.2)", blend: "normal" },
};

/** Works out what to draw for an environment. Seasonal leaves and petals give way to rain, storm and snow, not to fog. */
export function environmentLook({ time, weather, season }: EnvironmentDto): EnvironmentLook {
  const tints = [TIME_TINTS[time], SEASON_TINTS[season], WEATHER_TINTS[weather]].filter((t): t is Tint => t !== null);
  const particles: ParticleKind[] = [];
  if (weather !== "clear") particles.push(weather);
  if (weather === "clear" || weather === "fog") {
    if (season === "autumn") particles.push("leaves");
    else if (season === "spring") particles.push("petals");
  }
  return { tints, particles };
}

interface Spec {
  /** How many particles fill a 1280×720 screen. */
  count: number;
  /** Pixels per second, before the random spread. */
  vx: number;
  vy: number;
  /** How much of the wind carries it. */
  wind: number;
  /** How far past the screen edge it may drift before wrapping. */
  margin: number;
}

export const SPECS: Record<ParticleKind, Spec> = {
  rain: { count: 220, vx: -90, vy: 900, wind: 1, margin: 20 },
  storm: { count: 380, vx: -260, vy: 1200, wind: 1.6, margin: 20 },
  snow: { count: 150, vx: 0, vy: 55, wind: 0.8, margin: 20 },
  leaves: { count: 22, vx: 50, vy: 60, wind: 1.5, margin: 20 },
  petals: { count: 22, vx: 40, vy: 45, wind: 1.5, margin: 20 },
  fog: { count: 9, vx: 10, vy: 0, wind: 0.25, margin: 360 },
};

export interface Particle {
  x: number;
  y: number;
  /** Random 0..1 that varies speed, size, depth and wobble so particles do not move in lockstep. */
  r: number;
}

/** How many particles of a kind fill a screen of this size. */
export function particleCount(kind: ParticleKind, width: number, height: number): number {
  return Math.round((SPECS[kind].count * width * height) / (1280 * 720));
}

export function spawnParticles(kind: ParticleKind, width: number, height: number): Particle[] {
  return Array.from({ length: particleCount(kind, width, height) }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random(),
  }));
}

/** Moves a particle by `dt` seconds, pushed by `wind` (pixels per second), and wraps it around the screen edges. */
export function stepParticle(kind: ParticleKind, p: Particle, dt: number, time: number, width: number, height: number, wind = 0): void {
  const { vx, vy, wind: carried, margin } = SPECS[kind];
  const speed = 0.7 + p.r * 0.6;
  const sway = kind === "rain" || kind === "storm" ? 0 : Math.sin(time * (0.8 + p.r) + p.r * 20) * (kind === "fog" ? 6 : 25);
  p.x += (vx * speed + sway + wind * carried) * dt;
  p.y += vy * speed * dt;
  if (p.y > height + margin) {
    p.y = -margin;
    p.x = Math.random() * width;
  }
  if (p.x > width + margin) p.x = -margin;
  if (p.x < -margin) p.x = width + margin;
}
