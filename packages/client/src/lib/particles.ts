import { Particle, ParticleContainer, Texture } from "pixi.js";

type Range = readonly [number, number];

/** What one burst of particles looks like. Every range picks a random value per particle. */
export interface EmitSpec {
  /** Where the burst happens, relative to the container's owner. */
  x: number;
  y: number;
  count: number;
  /** Pixels per second. */
  speed: Range;
  /** Direction in radians; a full circle when left out. */
  angle?: Range;
  /** Seconds. */
  life: Range;
  /** Pixels across at birth. */
  size: Range;
  /** Size at death as a multiple of the size at birth. */
  grow?: number;
  colors: readonly number[];
  /** Colour at death: each particle moves from its own colour to this one. */
  fadeTo?: number;
  alpha?: number;
  /** Pixels per second squared, downwards (negative floats up). */
  gravity?: number;
  /** Fraction of speed lost per second. */
  drag?: number;
  /** Radians per second. */
  spin?: Range;
  /** Stretch along the direction of travel, per 500 px/s; particles then point where they go. */
  stretch?: number;
  /** Spawn anywhere inside this radius around the spot. */
  spread?: number;
  /** Spawn on a ring of `spread` pixels and fly inward to the spot instead of outward from it. */
  inward?: boolean;
}

interface Live {
  particle: Particle;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  grow: number;
  from: number;
  to: number;
  alpha: number;
  gravity: number;
  drag: number;
  spin: number;
  stretch: number;
}

const DOT_SIZE = 64;
let dot: Texture | null = null;

/** A soft white dot, made once and tinted per particle. */
export function softDot(): Texture {
  if (dot) return dot;
  const canvas = typeof document === "undefined" ? null : document.createElement("canvas");
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return Texture.WHITE;
  canvas.width = canvas.height = DOT_SIZE;
  const gradient = context.createRadialGradient(DOT_SIZE / 2, DOT_SIZE / 2, 0, DOT_SIZE / 2, DOT_SIZE / 2, DOT_SIZE / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.55)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, DOT_SIZE, DOT_SIZE);
  dot = Texture.from(canvas);
  return dot;
}

const between = ([low, high]: Range, random: () => number) => low + (high - low) * random();

/** Mixes two 0xRRGGBB colours; `t` 0 is `a`, 1 is `b`. */
export function mixColor(a: number, b: number, t: number): number {
  const channel = (shift: number) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/**
 * Many small glowing sprites drawn in one batch. `add` blending makes fire, sparks and magic glow where they overlap;
 * `normal` is for smoke and dust. Add the `container` to the map, call `emit` for each burst and `update` every frame.
 */
export class ParticleSystem {
  readonly container: ParticleContainer;
  private live: Live[] = [];

  constructor(
    private readonly texture: Texture,
    blend: "add" | "normal" = "add",
    private readonly random: () => number = Math.random,
  ) {
    this.container = new ParticleContainer({
      texture,
      dynamicProperties: { position: true, rotation: true, vertex: true, color: true },
      blendMode: blend,
    });
  }

  get alive() {
    return this.live.length;
  }

  emit(spec: EmitSpec) {
    const random = this.random;
    for (let i = 0; i < spec.count; i++) {
      const direction = between(spec.angle ?? [0, Math.PI * 2], random);
      const speed = between(spec.speed, random);
      const radius = spec.inward ? (spec.spread ?? 0) : Math.sqrt(random()) * (spec.spread ?? 0);
      const ring = random() * Math.PI * 2;
      const at = spec.inward ? ring : direction;
      const heading = spec.inward ? ring + Math.PI : direction;
      const size = between(spec.size, random);
      const from = spec.colors[Math.floor(random() * spec.colors.length)] ?? 0xffffff;
      const particle = new Particle({
        texture: this.texture,
        x: spec.x + Math.cos(at) * radius,
        y: spec.y + Math.sin(at) * radius,
        anchorX: 0.5,
        anchorY: 0.5,
        scaleX: size / DOT_SIZE,
        scaleY: size / DOT_SIZE,
        tint: from,
        alpha: 0,
      });
      this.container.addParticle(particle);
      this.live.push({
        particle,
        vx: Math.cos(heading) * speed,
        vy: Math.sin(heading) * speed,
        age: 0,
        life: between(spec.life, random),
        size,
        grow: spec.grow ?? 1,
        from,
        to: spec.fadeTo ?? from,
        alpha: spec.alpha ?? 1,
        gravity: spec.gravity ?? 0,
        drag: spec.drag ?? 0,
        spin: spec.spin ? between(spec.spin, random) : 0,
        stretch: spec.stretch ?? 0,
      });
    }
  }

  /** Moves every particle by `dt` seconds and removes the ones that have lived their life. */
  update(dt: number) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const item = this.live[i]!;
      item.age += dt;
      if (item.age >= item.life) {
        this.container.removeParticle(item.particle);
        this.live[i] = this.live[this.live.length - 1]!;
        this.live.pop();
        continue;
      }
      const t = item.age / item.life;
      const keep = Math.exp(-item.drag * dt);
      item.vx *= keep;
      item.vy = item.vy * keep + item.gravity * dt;
      const { particle } = item;
      particle.x += item.vx * dt;
      particle.y += item.vy * dt;
      const scale = (item.size * (1 + (item.grow - 1) * t)) / DOT_SIZE;
      if (item.stretch > 0) {
        particle.rotation = Math.atan2(item.vy, item.vx);
        particle.scaleX = scale * (1 + (item.stretch * Math.hypot(item.vx, item.vy)) / 500);
      } else {
        particle.rotation += item.spin * dt;
        particle.scaleX = scale;
      }
      particle.scaleY = scale;
      // A quick fade in hides the pop of a particle appearing, then it dims as it ages.
      particle.alpha = item.alpha * Math.min(1, item.age / 0.05) * (1 - t) ** 1.3;
      particle.tint = item.to === item.from ? item.from : mixColor(item.from, item.to, t);
    }
  }

  destroy() {
    this.live = [];
    this.container.destroy();
  }
}
