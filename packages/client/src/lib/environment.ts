import type { EnvironmentDto } from "@openvtt/shared";

export type ParticleKind = "rain" | "storm" | "snow" | "leaves" | "petals";

export interface Tint {
  color: string;
  blend: "multiply" | "normal" | "soft-light";
}

export interface EnvironmentLook {
  /** Colour washes laid over the map, bottom to top. */
  tints: Tint[];
  /** Falling things drawn on the canvas above the tints. */
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
  fog: { color: "rgba(214, 220, 228, 0.5)", blend: "normal" },
};

/** Works out what to draw for an environment. Seasonal leaves and petals give way to rain and snow. */
export function environmentLook({ time, weather, season }: EnvironmentDto): EnvironmentLook {
  const tints = [TIME_TINTS[time], SEASON_TINTS[season], WEATHER_TINTS[weather]].filter((t): t is Tint => t !== null);
  const particles: ParticleKind[] = [];
  if (weather === "rain" || weather === "storm" || weather === "snow") particles.push(weather);
  else if (season === "autumn") particles.push("leaves");
  else if (season === "spring") particles.push("petals");
  return { tints, particles };
}

interface Spec {
  /** How many particles fill a 1280×720 screen. */
  count: number;
  /** Pixels per second, before the random spread. */
  vx: number;
  vy: number;
}

export const SPECS: Record<ParticleKind, Spec> = {
  rain: { count: 220, vx: -90, vy: 900 },
  storm: { count: 380, vx: -260, vy: 1200 },
  snow: { count: 150, vx: 0, vy: 55 },
  leaves: { count: 22, vx: 50, vy: 60 },
  petals: { count: 22, vx: 40, vy: 45 },
};

export interface Particle {
  x: number;
  y: number;
  /** Random 0..1 that varies speed, size and wobble so particles do not move in lockstep. */
  r: number;
}

export function spawnParticles(kind: ParticleKind, width: number, height: number): Particle[] {
  const n = Math.round((SPECS[kind].count * width * height) / (1280 * 720));
  return Array.from({ length: n }, () => ({ x: Math.random() * width, y: Math.random() * height, r: Math.random() }));
}

/** Moves a particle by `dt` seconds and wraps it around the screen edges. */
export function stepParticle(kind: ParticleKind, p: Particle, dt: number, time: number, width: number, height: number): void {
  const { vx, vy } = SPECS[kind];
  const speed = 0.7 + p.r * 0.6;
  const sway = kind === "rain" || kind === "storm" ? 0 : Math.sin(time * (0.8 + p.r) + p.r * 20) * 25;
  p.x += (vx * speed + sway) * dt;
  p.y += vy * speed * dt;
  if (p.y > height + 20) {
    p.y = -20;
    p.x = Math.random() * width;
  }
  if (p.x > width + 20) p.x = -20;
  if (p.x < -20) p.x = width + 20;
}
