import { type Particle, type ParticleKind, particleCount, SPECS, spawnParticles, stepParticle } from "./environment";

/** How quickly a layer fades in or out; about two seconds to settle. */
const FADE_RATE = 2.2;
const LEAF_COLORS = ["#c4561c", "#d98a1f", "#a63d12"];
const PETAL_COLORS = ["#f6b8d0", "#fbd5e2", "#f29bbd"];
const MAX_RIPPLES = 90;

interface Layer {
  items: Particle[];
  /** How much of the layer shows, 0 to 1; it eases toward `target`. */
  level: number;
  target: 0 | 1;
}

interface Point {
  x: number;
  y: number;
}

interface Bolt {
  trunk: Point[];
  branches: Point[][];
  age: number;
}

interface Ripple extends Point {
  age: number;
}

export interface WeatherOptions {
  /** With reduced motion nothing moves: layers appear at once and are drawn as one still frame. */
  reduced: boolean;
  /** A strike's rumble, `strength` 0 to 1, called after the delay light takes to beat sound. */
  onThunder: (strength: number) => void;
}

/** Splits a line into a jagged one by moving midpoints sideways, the way lightning forks and wanders. */
export function jaggedLine(from: Point, to: Point, spread: number, rounds: number, random: () => number = Math.random): Point[] {
  let points = [from, to];
  let wobble = spread;
  for (let round = 0; round < rounds; round++) {
    const next: Point[] = [points[0]!];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!;
      const b = points[i]!;
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const offset = (random() - 0.5) * wobble;
      next.push({ x: (a.x + b.x) / 2 + (-(b.y - a.y) / length) * offset, y: (a.y + b.y) / 2 + ((b.x - a.x) / length) * offset }, b);
    }
    points = next;
    wobble *= 0.55;
  }
  return points;
}

let fogSprite: HTMLCanvasElement | null = null;

/** A soft white blob, drawn once and stretched for every patch of fog. */
function fogBlob(): HTMLCanvasElement | null {
  if (fogSprite) return fogSprite;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, "rgba(222, 228, 238, 0.55)");
  gradient.addColorStop(0.5, "rgba(222, 228, 238, 0.22)");
  gradient.addColorStop(1, "rgba(222, 228, 238, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  fogSprite = canvas;
  return canvas;
}

const band = (r: number) => (r < 0.34 ? 0 : r < 0.67 ? 1 : 2);

/**
 * Everything that moves over the map: rain, storm, snow, falling leaves and petals, and drifting fog. Each kind is a
 * layer with a level that eases toward shown or hidden, so changing the weather blends one into the next, and a layer
 * that has faded out is removed completely: nothing from an earlier weather stays behind. Drawing is a pure function
 * of this state, so the owner clears the canvas and calls `draw` every frame.
 */
export class WeatherScene {
  width = 0;
  height = 0;
  private readonly layers = new Map<ParticleKind, Layer>();
  private ripples: Ripple[] = [];
  private bolt: Bolt | null = null;
  private flash = 0;
  private flicker: number | null = null;
  private nextStrike = 0;
  private thunder: { at: number; strength: number } | null = null;
  private time = 0;
  private wind = 0;

  constructor(private readonly options: WeatherOptions) {}

  /** What should be showing now: kinds in the list fade in, every other layer fades out. */
  setKinds(kinds: readonly ParticleKind[]) {
    for (const [kind, layer] of this.layers) if (!kinds.includes(kind)) layer.target = 0;
    for (const kind of kinds) {
      const layer = this.layers.get(kind);
      if (layer) layer.target = 1;
      else this.layers.set(kind, { items: spawnParticles(kind, this.width, this.height), level: this.options.reduced ? 1 : 0, target: 1 });
    }
    if (this.options.reduced) {
      for (const layer of this.layers.values()) if (layer.target === 0) layer.level = 0;
      this.dropGoneLayers();
    }
  }

  /** Keeps every particle at the same relative place and tops the count up (or down) for the new size. */
  resize(width: number, height: number) {
    const scaleX = this.width ? width / this.width : 1;
    const scaleY = this.height ? height / this.height : 1;
    this.width = width;
    this.height = height;
    for (const [kind, layer] of this.layers) {
      for (const p of layer.items) {
        p.x *= scaleX;
        p.y *= scaleY;
      }
      const wanted = particleCount(kind, width, height);
      if (layer.items.length > wanted) layer.items.length = wanted;
      else layer.items.push(...extra(wanted - layer.items.length, width, height));
    }
  }

  /** True when nothing is showing or fading, so the owner can stop drawing. */
  get idle() {
    return this.layers.size === 0 && !this.bolt && !this.thunder && this.flash < 0.01;
  }

  private level(kind: ParticleKind) {
    return this.layers.get(kind)?.level ?? 0;
  }

  private dropGoneLayers() {
    for (const [kind, layer] of this.layers) if (layer.target === 0 && layer.level < 0.01) this.layers.delete(kind);
  }

  /** Advances everything by `dt` seconds. */
  step(dt: number) {
    this.time += dt;
    const stormy = Math.max(this.level("storm"), 0);
    // Slow gusts, stronger in a storm.
    const gust = (Math.sin(this.time * 0.35) + 0.5 * Math.sin(this.time * 0.9 + 2)) * (35 + 70 * stormy);
    this.wind = gust;
    const ease = 1 - Math.exp(-FADE_RATE * dt);
    for (const [kind, layer] of this.layers) {
      layer.level += (layer.target - layer.level) * ease;
      for (const p of layer.items) stepParticle(kind, p, dt, this.time, this.width, this.height, this.wind);
    }
    this.dropGoneLayers();
    this.stepRipples(dt);
    this.stepLightning(dt);
  }

  private stepRipples(dt: number) {
    this.ripples = this.ripples.filter((ripple) => (ripple.age += dt) < 0.6);
    const rain = Math.max(this.level("rain") * 28, this.level("storm") * 70);
    const born = rain * dt;
    const count = Math.floor(born) + (Math.random() < born % 1 ? 1 : 0);
    for (let i = 0; i < count && this.ripples.length < MAX_RIPPLES; i++)
      this.ripples.push({ x: Math.random() * this.width, y: Math.random() * this.height, age: 0 });
  }

  private stepLightning(dt: number) {
    if (this.options.reduced) return;
    const storm = this.level("storm");
    if (storm > 0.6 && this.time >= this.nextStrike) {
      this.strike();
      this.nextStrike = this.time + 4 + Math.random() * 8;
    }
    if (this.bolt) {
      this.bolt.age += dt;
      if (this.bolt.age > 0.4) this.bolt = null;
    }
    // A second, weaker flash right behind the first is what makes lightning look like lightning.
    if (this.flicker !== null) {
      this.flicker -= dt;
      if (this.flicker <= 0) {
        this.flash = Math.max(this.flash, 0.38);
        this.flicker = null;
      }
    }
    this.flash *= Math.exp(-dt * 8);
    if (this.thunder && this.time >= this.thunder.at) {
      this.options.onThunder(this.thunder.strength);
      this.thunder = null;
    }
  }

  private strike() {
    const x = this.width * (0.12 + Math.random() * 0.76);
    const end = { x: x + (Math.random() - 0.5) * 240, y: this.height * (0.5 + Math.random() * 0.4) };
    const trunk = jaggedLine({ x, y: -10 }, end, 180, 6);
    const branches: Point[][] = [];
    for (let i = 6; i < trunk.length - 4; i += 7 + Math.floor(Math.random() * 6)) {
      const from = trunk[i]!;
      const to = { x: from.x + (Math.random() - 0.5) * 380, y: from.y + 70 + Math.random() * 150 };
      branches.push(jaggedLine(from, to, 80, 4));
    }
    this.bolt = { trunk, branches, age: 0 };
    this.flash = 0.6;
    this.flicker = 0.1 + Math.random() * 0.08;
    // The farther off the strike, the later and the softer the rumble.
    const distance = Math.random();
    this.thunder = { at: this.time + 0.25 + distance * 2.2, strength: 1 - distance * 0.6 };
  }

  /** Draws the current state; the caller clears the canvas first. */
  draw(ctx: CanvasRenderingContext2D) {
    const order: ParticleKind[] = ["fog", "snow", "leaves", "petals", "rain", "storm"];
    for (const kind of order) {
      const layer = this.layers.get(kind);
      if (!layer || layer.level <= 0.003) continue;
      if (kind === "rain" || kind === "storm") this.drawRain(ctx, kind, layer);
      else if (kind === "snow") drawSnow(ctx, layer);
      else if (kind === "fog") drawFog(ctx, layer);
      else drawLeaves(ctx, kind, layer);
    }
    this.drawRipples(ctx);
    this.drawLightning(ctx);
  }

  private drawRain(ctx: CanvasRenderingContext2D, kind: "rain" | "storm", layer: Layer) {
    const { vx, vy, wind } = SPECS[kind];
    const dx = vx + this.wind * wind;
    const speed = Math.hypot(dx, vy);
    const lengths = [8, 14, 22].map((length) => length * (kind === "storm" ? 1.5 : 1));
    const widths = [0.7, 1, 1.5];
    const alphas = [0.28, 0.42, 0.62];
    for (let b = 0; b < 3; b++) {
      ctx.strokeStyle = `rgba(196, 214, 255, ${alphas[b]! * layer.level})`;
      ctx.lineWidth = widths[b]!;
      ctx.beginPath();
      for (const p of layer.items) {
        if (band(p.r) !== b) continue;
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - (dx / speed) * lengths[b]!, p.y - (vy / speed) * lengths[b]!);
      }
      ctx.stroke();
    }
  }

  private drawRipples(ctx: CanvasRenderingContext2D) {
    if (this.ripples.length === 0) return;
    const strength = Math.max(this.level("rain"), this.level("storm"));
    ctx.lineWidth = 1;
    for (const { x, y, age } of this.ripples) {
      const t = age / 0.6;
      ctx.strokeStyle = `rgba(210, 225, 255, ${0.5 * (1 - t) * strength})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 2 + 9 * t, 1 + 4 * t, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawLightning(ctx: CanvasRenderingContext2D) {
    const { bolt } = this;
    if (bolt) {
      const alpha = Math.max(0, 1 - bolt.age / 0.4) * (0.6 + 0.4 * Math.random());
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      for (const [width, color] of [
        [9, `rgba(140, 170, 255, ${0.3 * alpha})`],
        [3, `rgba(255, 255, 255, ${alpha})`],
      ] as const) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(bolt.trunk[0]!.x, bolt.trunk[0]!.y);
        for (const p of bolt.trunk) ctx.lineTo(p.x, p.y);
        for (const branch of bolt.branches) {
          ctx.moveTo(branch[0]!.x, branch[0]!.y);
          for (const p of branch) ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
    }
    if (this.flash > 0.01) {
      ctx.fillStyle = `rgba(228, 236, 255, ${this.flash})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }
}

function extra(count: number, width: number, height: number): Particle[] {
  return Array.from({ length: Math.max(0, count) }, () => ({ x: Math.random() * width, y: Math.random() * height, r: Math.random() }));
}

function drawSnow(ctx: CanvasRenderingContext2D, layer: Layer) {
  const alphas = [0.5, 0.75, 0.95];
  for (let b = 0; b < 3; b++) {
    ctx.fillStyle = `rgba(255, 255, 255, ${alphas[b]! * layer.level})`;
    ctx.beginPath();
    for (const p of layer.items) {
      if (band(p.r) !== b) continue;
      const radius = 1.2 + p.r * 2.4;
      ctx.moveTo(p.x + radius, p.y);
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    }
    ctx.fill();
  }
}

function drawLeaves(ctx: CanvasRenderingContext2D, kind: "leaves" | "petals", layer: Layer) {
  const colors = kind === "leaves" ? LEAF_COLORS : PETAL_COLORS;
  ctx.globalAlpha = layer.level;
  for (const p of layer.items) {
    ctx.fillStyle = colors[Math.floor(p.r * colors.length)] ?? colors[0]!;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 3 + p.r * 3, 1.8 + p.r, p.r * 6.28 + p.y * 0.02, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFog(ctx: CanvasRenderingContext2D, layer: Layer) {
  const blob = fogBlob();
  if (!blob) return;
  for (const p of layer.items) {
    const size = 420 + p.r * 380;
    ctx.globalAlpha = (0.5 + p.r * 0.4) * layer.level;
    ctx.drawImage(blob, p.x - size / 2, p.y - size / 2, size, size);
  }
  ctx.globalAlpha = 1;
}
