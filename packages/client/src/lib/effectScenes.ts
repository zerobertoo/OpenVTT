import type { EffectDto, EffectKind } from "@openvtt/shared";
import { type Application, Container, Graphics, type PointData, Text } from "pixi.js";
import { GlowFilter } from "pixi-filters/glow";
import { type EmitSpec, ParticleSystem, softDot } from "./particles";
import { shakeWorld, shockwave } from "./screenFx";
import { jaggedLine } from "./weatherScene";

// Everything that draws an effect lives here, apart from the rest of the table, so it is only downloaded when the map opens.

const GOLD = 0xffc914;
const VIOLET = 0x8b5cf6;
const GREEN = 0x3ecf6d;
const ORANGE = 0xff7a1a;
const CYAN = 0x66d9ff;
const PINK = 0xff6ad5;
const FIRE = [0xfff2b0, 0xffd04a, 0xff9a2e, 0xff6a1a];
const SMOKE = [0x2a2a2e, 0x3b3b42, 0x55505a, 0x6a5f58];
const TURN = Math.PI * 2;

/** Fast at the start, slow at the end. */
const ease = (t: number) => 1 - (1 - t) ** 3;
/** Past the end and back, for things that pop into place. */
const back = (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
/** Rises from 0 to 1 and falls back to 0. */
const bell = (t: number) => Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
/** How far `t` is between `from` and `to`, held to 0..1. */
const phase = (t: number, from: number, to: number) => Math.min(1, Math.max(0, (t - from) / (to - from)));

/** Points spread evenly around a circle. */
function around(count: number, radius: number, turn = 0) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * TURN + turn;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
}

/** A number from 0 to 1 that depends only on `i` and `k`, so every screen draws the same scatter. */
function scatter(i: number, k = 0) {
  const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/** Random numbers that repeat for the same seed, so shapes made by chance still match on every screen. */
function seeded(seed: number) {
  let state = Math.floor(seed) | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let v = Math.imul(state ^ (state >>> 15), 1 | state);
    v = (v + Math.imul(v ^ (v >>> 7), 61 | v)) ^ v;
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}

/** What an effect can use while it plays. Everything is relative to the spot where the effect happens. */
interface Context {
  /** Drawn fresh every frame, between the smoke and the glowing particles. */
  shape: Graphics;
  grid: number;
  effect: EffectDto;
  /** Spawns a burst; ignored with reduced motion, which only shows one still frame. */
  emit: (blend: "add" | "normal", spec: EmitSpec) => void;
  shake: (amplitude: number, ms: number) => void;
  shockwave: (at: PointData, reach: number, ms: number, strength?: number) => void;
}

/** Called once when the effect starts; returns what draws a frame `s` seconds in, `dt` seconds after the last. */
type Frame = (s: number, dt: number) => void;

interface Effect {
  ms: number;
  /** The colour of the glow around what is drawn. */
  glow: number;
  start: (c: Context) => Frame;
}

/** Runs `fn` the first time the effect is at or past `at` seconds. */
function once(at: number, fn: () => void) {
  let done = false;
  return (s: number) => {
    if (done || s < at) return;
    done = true;
    fn();
  };
}

/** Turns a rate per second into whole particles per frame, carrying the fraction over. */
function stream(rate: number) {
  let carry = 0;
  return (dt: number) => {
    carry += rate * dt;
    const count = Math.floor(carry);
    carry -= count;
    return count;
  };
}

/** One big soft light that swells and fades: the flash at the heart of a hit. */
function flare(c: Context, x: number, y: number, size: number, color: number, life: number, alpha = 1) {
  c.emit("add", { x, y, count: 1, speed: [0, 0], life: [life, life], size: [size, size], grow: 1.5, colors: [color], alpha });
}

/** A four-pointed glint. */
function glint(g: Graphics, x: number, y: number, radius: number, color: number, alpha: number, turn = 0) {
  if (radius <= 0 || alpha <= 0) return;
  const points: number[] = [];
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.16;
    points.push(x + Math.cos(turn + (i * Math.PI) / 4) * r, y + Math.sin(turn + (i * Math.PI) / 4) * r);
  }
  g.poly(points).fill({ color, alpha });
}

/** Short lines bursting out of a spot, the way a hit throws light. */
function rays(
  g: Graphics,
  x: number,
  y: number,
  count: number,
  from: number,
  to: number,
  width: number,
  color: number,
  alpha: number,
  turn = 0,
) {
  if (alpha <= 0) return;
  for (let i = 0; i < count; i++) {
    const angle = turn + (i / count) * TURN;
    g.moveTo(x + Math.cos(angle) * from, y + Math.sin(angle) * from)
      .lineTo(x + Math.cos(angle) * to, y + Math.sin(angle) * to)
      .stroke({ width, color, alpha, cap: "round" });
  }
}

/** A ring broken into `count` dashes, turned by `turn`. */
function dashes(g: Graphics, radius: number, count: number, turn: number, fill: number, width: number, color: number, alpha: number) {
  if (alpha <= 0 || radius <= 0) return;
  const step = TURN / count;
  for (let i = 0; i < count; i++) {
    const from = turn + i * step;
    g.moveTo(Math.cos(from) * radius, Math.sin(from) * radius)
      .arc(0, 0, radius, from, from + step * fill)
      .stroke({ width, color, alpha, cap: "round" });
  }
}

/** The corners of a regular shape, as a flat list for `poly`. */
function corners(sides: number, radius: number, turn = 0, x = 0, y = 0) {
  return around(sides, radius, turn).flatMap((p) => [x + p.x, y + p.y]);
}

/** Where a travelling effect lands, relative to where it starts, with its length and direction. */
function path(c: Context) {
  const dx = (c.effect.toX ?? c.effect.x) - c.effect.x;
  const dy = (c.effect.toY ?? c.effect.y) - c.effect.y;
  const length = Math.hypot(dx, dy);
  return { dx, dy, length, ux: length ? dx / length : 1, uy: length ? dy / length : 0 };
}

/** The radius of an area effect in pixels. */
const areaRadius = (c: Context) => c.grid * Math.min(Math.max(c.effect.value ?? 2, 0.5), 10);

/** A burst of fire, smoke and embers that rattles the screen; shared by the blast, the fireball and the meteor. */
function explode(c: Context, x: number, y: number, cells: number): (seconds: number) => void {
  const { grid, shape: g } = c;
  const radius = grid * Math.min(Math.max(cells, 0.5), 10);
  // What stays behind: a scorch on the ground under everything else.
  c.emit("normal", {
    x,
    y,
    count: 1,
    speed: [0, 0],
    life: [2.4, 2.4],
    size: [radius * 2.1, radius * 2.1],
    grow: 1.08,
    colors: [0x0d0806],
    alpha: 0.55,
  });
  flare(c, x, y, radius * 3, 0xfff1c2, 0.4);
  c.emit("add", {
    x,
    y,
    count: Math.round(80 + (radius / grid) * 40),
    speed: [radius * 0.8, radius * 3.2],
    life: [0.45, 0.95],
    size: [grid * 0.22, grid * 0.55],
    grow: 0.3,
    colors: FIRE,
    fadeTo: 0x7a1d0a,
    drag: 2.2,
  });
  // A slower ball of flame rolling up from the middle.
  c.emit("add", {
    x,
    y,
    count: Math.round(24 + (radius / grid) * 8),
    speed: [0, radius * 0.9],
    life: [0.6, 1.1],
    size: [grid * 0.5, grid * 0.9],
    grow: 1.6,
    colors: [0xffb347, 0xff7a1a, 0xff5a1a],
    fadeTo: 0x3a0d05,
    alpha: 0.55,
    drag: 2.5,
    gravity: -grid * 0.5,
    spread: radius * 0.3,
  });
  c.emit("add", {
    x,
    y,
    count: 40,
    speed: [radius * 0.4, radius * 1.8],
    life: [0.9, 1.7],
    size: [grid * 0.05, grid * 0.1],
    colors: [0xffd27a, 0xffffff, 0xff9a3c],
    gravity: -grid * 1.2,
    drag: 1.4,
    spread: radius * 0.2,
    twinkle: 9,
  });
  // Bits of whatever was standing there.
  c.emit("normal", {
    x,
    y,
    count: 16,
    speed: [radius * 1.6, radius * 3.6],
    life: [0.45, 0.8],
    size: [grid * 0.07, grid * 0.14],
    colors: [0x1c1410, 0x30231a, 0x4a3828],
    drag: 2.8,
    stretch: 0.6,
  });
  c.emit("normal", {
    x,
    y,
    count: 22 + Math.round(cells * 5),
    speed: [radius * 0.3, radius * 1.7],
    life: [1.2, 2],
    size: [grid * 0.4, grid * 0.85],
    grow: 2.4,
    colors: SMOKE,
    alpha: 0.38,
    drag: 1.5,
    gravity: -grid * 0.35,
    spread: radius * 0.5,
    spin: [-1, 1],
  });
  c.shake(Math.min(16, 4 + cells * 2.2), 520);
  c.shockwave({ x, y }, radius * 2.2 + grid, 900, Math.min(1.6, 0.6 + cells * 0.15));
  return (s) => {
    const grow = ease(phase(s, 0, 0.55));
    g.circle(x, y, radius * (0.4 + 0.7 * ease(phase(s, 0, 0.6)))).fill({ color: ORANGE, alpha: 0.22 * (1 - phase(s, 0, 0.6)) });
    g.circle(x, y, radius * (0.2 + 0.4 * ease(phase(s, 0, 0.3)))).fill({ color: 0xfff1c2, alpha: 0.75 * (1 - phase(s, 0, 0.35)) });
    rays(g, x, y, 9, radius * 0.35, radius * (0.6 + 0.9 * ease(phase(s, 0, 0.3))), 5, 0xfff1c2, 0.8 * (1 - phase(s, 0.05, 0.35)), 0.3);
    g.circle(x, y, radius * (0.3 + 0.9 * grow)).stroke({ width: 4 + (1 - grow) * 6, color: 0xffd27a, alpha: 1 - phase(s, 0, 0.6) });
    const second = ease(phase(s, 0.1, 0.8));
    if (second > 0)
      g.circle(x, y, radius * (0.2 + 1.15 * second)).stroke({ width: 2, color: 0xff9a2e, alpha: 0.7 * (1 - phase(s, 0.1, 0.8)) });
  };
}

interface Orb {
  colors: number[];
  fadeTo: number;
  core: number;
  outer: number;
  /** How big the head is, in cells. */
  size?: number;
  /** Trails smoke as well as light. */
  smoke?: boolean;
  /** Weaves from side to side by this many cells, settling as it nears the target. */
  weave?: number;
}

/** A bright head with a glowing tail: what a projectile, a fireball and a meteor all fly as. Returns where the head is. */
function flyingOrb(c: Context, from: PointData, to: PointData, orb: Orb) {
  const { grid, shape: g } = c;
  const size = orb.size ?? 1;
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const ux = (to.x - from.x) / length;
  const uy = (to.y - from.y) / length;
  const sparks = stream(130);
  const puffs = stream(26);
  let age = 0;
  return (u: number, dt: number) => {
    age += dt;
    const sway = (orb.weave ?? 0) * grid * Math.sin(u * Math.PI * 3) * (1 - u);
    const head = { x: from.x + (to.x - from.x) * u - uy * sway, y: from.y + (to.y - from.y) * u + ux * sway };
    c.emit("add", {
      x: head.x,
      y: head.y,
      count: sparks(dt),
      speed: [0, grid * 0.8],
      life: [0.25, 0.55],
      size: [grid * 0.16 * size, grid * 0.34 * size],
      grow: 0.4,
      colors: orb.colors,
      fadeTo: orb.fadeTo,
      drag: 3,
      gravity: -grid * 0.4,
      spread: grid * 0.1 * size,
    });
    if (orb.smoke)
      c.emit("normal", {
        x: head.x,
        y: head.y,
        count: puffs(dt),
        speed: [0, grid * 0.4],
        life: [0.6, 1.1],
        size: [grid * 0.3 * size, grid * 0.5 * size],
        grow: 2.2,
        colors: SMOKE,
        alpha: 0.3,
        drag: 2,
        gravity: -grid * 0.3,
      });
    // The head flickers, and a tail of light points back the way it came.
    const pulse = 1 + 0.12 * Math.sin(age * 45);
    const tail = grid * 1.1 * size;
    const half = grid * 0.2 * size;
    g.poly([head.x - uy * half, head.y + ux * half, head.x + uy * half, head.y - ux * half, head.x - ux * tail, head.y - uy * tail]).fill({
      color: orb.outer,
      alpha: 0.4,
    });
    g.circle(head.x, head.y, grid * 0.3 * size * pulse).fill({ color: orb.outer, alpha: 0.45 });
    g.circle(head.x, head.y, grid * 0.19 * size * pulse).fill({ color: orb.core, alpha: 0.95 });
    g.circle(head.x, head.y, grid * 0.09 * size).fill({ color: 0xffffff });
    return head;
  };
}

const ORIGIN = { x: 0, y: 0 };

const EFFECTS: Record<EffectKind, Effect> = {
  arrive: {
    ms: 1900,
    glow: GOLD,
    start(c) {
      const { grid, shape: g } = c;
      // Motes spiral in from all around before the light comes down.
      c.emit("add", {
        x: 0,
        y: 0,
        count: 54,
        speed: [grid * 2.4, grid * 3.2],
        life: [0.42, 0.52],
        size: [grid * 0.09, grid * 0.2],
        colors: [GOLD, 0xfff2b0, 0xffffff],
        spread: grid * 1.4,
        inward: true,
        swirl: 3,
      });
      const burst = once(0.5, () => {
        flare(c, 0, 0, grid * 2.6, 0xfff2b0, 0.45);
        c.emit("add", {
          x: 0,
          y: 0,
          count: 40,
          speed: [grid * 0.8, grid * 2.6],
          life: [0.5, 0.9],
          size: [grid * 0.1, grid * 0.24],
          colors: [GOLD, 0xfff2b0, 0xffffff],
          fadeTo: 0xff9a2e,
          drag: 2,
        });
        c.emit("add", {
          x: 0,
          y: 0,
          count: 26,
          speed: [0, grid * 0.5],
          life: [0.8, 1.3],
          size: [grid * 0.06, grid * 0.13],
          colors: [0xffffff, 0xfff2b0],
          gravity: -grid * 1.1,
          spread: grid * 0.6,
          twinkle: 7,
        });
        c.shake(3, 200);
        c.shockwave(ORIGIN, grid * 2, 700, 0.45);
      });
      return (s) => {
        burst(s);
        // A circle of light on the ground, turning as it opens.
        const open = back(phase(s, 0, 0.45));
        const circle = 1 - phase(s, 1, 1.6);
        dashes(g, grid * 0.78 * open, 10, s * 2.2, 0.7, 3, GOLD, 0.9 * circle);
        dashes(g, grid * 0.56 * open, 6, -s * 3, 0.55, 2, 0xfff2b0, 0.7 * circle);
        const beam = bell(phase(s, 0.05, 1.25));
        const height = grid * 3.6 * ease(phase(s, 0, 0.5));
        // Three nested slivers, wide at the foot and narrow at the top, so the light has a soft edge and a bright heart.
        for (const [bottom, top, color, alpha] of [
          [0.9, 0.3, GOLD, 0.16],
          [0.55, 0.14, 0xffd96a, 0.3],
          [0.22, 0.05, 0xffffff, 0.6],
        ] as const)
          g.poly([-grid * bottom * 0.5, 0, grid * bottom * 0.5, 0, grid * top * 0.5, -height, -grid * top * 0.5, -height]).fill({
            color,
            alpha: alpha * beam,
          });
        const ring = phase(s, 0.5, 1.3);
        if (ring > 0) g.circle(0, 0, grid * (0.2 + 1.2 * ease(ring))).stroke({ width: 4, color: GOLD, alpha: 1 - ring });
        g.circle(0, 0, grid * 0.7 * ease(phase(s, 0.4, 0.9))).fill({ color: 0xfff2b0, alpha: 0.4 * (1 - phase(s, 0.5, 1.1)) });
        for (let i = 0; i < 5; i++) {
          const at = 0.55 + i * 0.13;
          const angle = scatter(i, 1) * TURN;
          const reach = grid * (0.5 + 0.7 * scatter(i, 2));
          glint(
            g,
            Math.cos(angle) * reach,
            Math.sin(angle) * reach - grid * 0.3,
            grid * 0.3 * bell(phase(s, at, at + 0.45)),
            0xffffff,
            0.95,
            s * 2,
          );
        }
      };
    },
  },
  vanish: {
    ms: 2000,
    glow: VIOLET,
    start(c) {
      const { grid, shape: g } = c;
      c.emit("add", {
        x: 0,
        y: 0,
        count: 48,
        speed: [grid * 1.7, grid * 2.5],
        life: [0.5, 0.62],
        size: [grid * 0.09, grid * 0.2],
        colors: [VIOLET, 0xc9b3ff, 0xffffff],
        spread: grid * 1.3,
        inward: true,
        swirl: -4,
      });
      const wisps = stream(30);
      const puff = once(0.55, () => {
        flare(c, 0, 0, grid * 1.8, 0xc9b3ff, 0.3);
        c.emit("add", {
          x: 0,
          y: 0,
          count: 54,
          speed: [grid * 0.2, grid * 1.4],
          life: [0.7, 1.2],
          size: [grid * 0.08, grid * 0.2],
          colors: [VIOLET, 0xc9b3ff, 0xffffff],
          fadeTo: 0x2a1450,
          drag: 1.2,
          gravity: -grid * 0.4,
          spread: grid * 0.4,
          twinkle: 6,
        });
        c.emit("normal", {
          x: 0,
          y: 0,
          count: 16,
          speed: [0, grid * 0.8],
          life: [0.9, 1.4],
          size: [grid * 0.6, grid * 1],
          grow: 2,
          colors: [0x1a0a33, 0x2a1450],
          alpha: 0.5,
          drag: 1.6,
          gravity: -grid * 0.3,
          spread: grid * 0.3,
          swirl: 1.5,
        });
        c.shockwave(ORIGIN, grid * 1.6, 600, 0.3);
      });
      return (s, dt) => {
        puff(s);
        // Thin wisps keep rising from the empty spot for a moment.
        if (s > 0.6 && s < 1.3)
          c.emit("add", {
            x: 0,
            y: 0,
            count: wisps(dt),
            speed: [0, grid * 0.3],
            life: [0.5, 0.9],
            size: [grid * 0.05, grid * 0.12],
            colors: [0xc9b3ff, VIOLET],
            gravity: -grid * 1.4,
            spread: grid * 0.35,
          });
        const pull = ease(phase(s, 0, 0.7));
        const closing = 1 - phase(s, 0.55, 0.9);
        dashes(g, grid * (1.25 - 1.05 * pull), 8, -s * 6, 0.7, 5, VIOLET, closing);
        dashes(g, grid * (0.85 - 0.7 * pull), 5, s * 8, 0.6, 2.5, 0xc9b3ff, 0.9 * closing);
        g.circle(0, 0, grid * (0.15 + 0.45 * bell(phase(s, 0, 0.9)))).fill({ color: 0x1a0a33, alpha: 0.8 * (1 - phase(s, 0.7, 1.2)) });
        // The blink: a line of light that snaps shut.
        const snap = phase(s, 0.5, 0.75);
        if (snap > 0 && snap < 1) {
          g.ellipse(0, 0, grid * 1.1 * (1 - ease(snap)), grid * 0.05).fill({ color: 0xffffff, alpha: 0.95 });
          g.ellipse(0, 0, grid * 0.05, grid * 0.7 * (1 - ease(snap))).fill({ color: 0xc9b3ff, alpha: 0.8 });
        }
      };
    },
  },
  damage: {
    ms: 1100,
    glow: 0xff3b3b,
    start(c) {
      const { grid, shape: g, effect } = c;
      // A bigger hit throws more and reaches farther.
      const force = Math.min(1, Math.abs(effect.value ?? 5) / 30);
      flare(c, 0, 0, grid * (1.3 + force), 0xff6b6b, 0.25, 0.8);
      c.emit("add", {
        x: 0,
        y: 0,
        count: Math.round(26 + 24 * force),
        speed: [grid * 1.2, grid * (3.4 + 2 * force)],
        life: [0.25, 0.55],
        size: [grid * 0.1, grid * 0.22],
        colors: [0xff4d4d, 0xffa0a0, 0xffffff],
        gravity: grid * 3,
        drag: 1.5,
        stretch: 1.3,
      });
      c.emit("normal", {
        x: 0,
        y: 0,
        count: Math.round(10 + 10 * force),
        speed: [grid * 0.8, grid * 2.6],
        life: [0.4, 0.8],
        size: [grid * 0.08, grid * 0.16],
        colors: [0x8a0f14, 0xb3151b, 0x5e0a0e],
        gravity: grid * 5,
        drag: 1.2,
        stretch: 0.8,
      });
      c.shake(Math.min(10, 3 + Math.abs(effect.value ?? 0) / 5), 220);
      return (s) => {
        g.circle(0, 0, grid * (0.2 + 0.5 * ease(phase(s, 0, 0.25)))).fill({ color: 0xe5484d, alpha: 0.5 * (1 - phase(s, 0, 0.35)) });
        g.circle(0, 0, grid * (0.3 + 0.7 * ease(phase(s, 0, 0.4)))).stroke({ width: 3, color: 0xff8f8f, alpha: 1 - phase(s, 0, 0.4) });
        rays(g, 0, 0, 7, grid * 0.5, grid * (0.6 + 0.5 * ease(phase(s, 0, 0.2))), 3, 0xffe0e0, 1 - phase(s, 0.05, 0.3), 0.4);
        for (const [i, offset] of [-0.38, 0, 0.38].entries()) {
          const reach = phase(s, i * 0.04, 0.16 + i * 0.04);
          const fade = 1 - phase(s, 0.2 + i * 0.03, 0.6);
          const from = { x: -grid * 0.45 + offset * grid, y: -grid * 0.5 };
          const to = { x: from.x + grid * 0.9, y: from.y + grid };
          for (const [width, color, alpha] of [
            [8, 0xe5484d, 0.6],
            [3, 0xffe0e0, 1],
          ] as const) {
            g.moveTo(from.x, from.y)
              .lineTo(from.x + (to.x - from.x) * reach, from.y + (to.y - from.y) * reach)
              .stroke({ width: width * (0.4 + 0.6 * fade), color, alpha: alpha * fade, cap: "round" });
          }
        }
      };
    },
  },
  heal: {
    ms: 1900,
    glow: GREEN,
    start(c) {
      const { grid, shape: g } = c;
      const motes = stream(46);
      const helix = stream(70);
      flare(c, 0, 0, grid * 2, 0x7dffb0, 0.7, 0.45);
      return (s, dt) => {
        if (s < 0.95)
          c.emit("add", {
            x: 0,
            y: grid * 0.2,
            count: motes(dt),
            speed: [grid * 0.3, grid * 1.1],
            angle: [-Math.PI / 2 - 0.4, -Math.PI / 2 + 0.4],
            life: [0.7, 1.1],
            size: [grid * 0.07, grid * 0.16],
            colors: [0x7dffb0, 0xd6ffe6, 0xffffff, 0xb7f75a],
            fadeTo: 0x2ecc71,
            drag: 0.8,
            spread: grid * 0.5,
            twinkle: 5,
          });
        // Two lights wind upward around the spot and leave a trail.
        const rise = phase(s, 0, 1.2);
        if (rise < 1) {
          const count = helix(dt);
          for (const side of [0, Math.PI]) {
            const angle = s * 8 + side;
            c.emit("add", {
              x: Math.cos(angle) * grid * 0.55 * (1 - 0.4 * rise),
              y: grid * 0.3 - grid * 1.4 * rise + Math.sin(angle) * grid * 0.16,
              count: Math.ceil(count / 2),
              speed: [0, grid * 0.15],
              life: [0.3, 0.5],
              size: [grid * 0.1, grid * 0.18],
              grow: 0.3,
              colors: [0xffffff, 0xd6ffe6],
              fadeTo: GREEN,
            });
          }
        }
        for (const delay of [0, 0.25, 0.5]) {
          const u = phase(s, delay, delay + 0.9);
          if (u > 0 && u < 1) g.circle(0, 0, grid * (0.2 + 0.85 * ease(u))).stroke({ width: 3, color: GREEN, alpha: 1 - u });
        }
        g.circle(0, 0, grid * 0.55).fill({ color: GREEN, alpha: 0.22 * bell(phase(s, 0, 1.3)) });
        const lift = ease(phase(s, 0, 1.3));
        for (const [i, p] of around(5, grid * 0.45, 1).entries()) {
          const size = grid * 0.09 * back(phase(s, i * 0.06, 0.3 + i * 0.06));
          const y = p.y - grid * 0.9 * lift;
          const alpha = 1 - phase(s, 0.5, 1.3);
          g.rect(p.x - size, y - size / 3, size * 2, (size * 2) / 3).fill({ color: 0xb9ffd2, alpha });
          g.rect(p.x - size / 3, y - size, (size * 2) / 3, size * 2).fill({ color: 0xb9ffd2, alpha });
        }
      };
    },
  },
  blast: {
    ms: 2600,
    glow: ORANGE,
    start(c) {
      return explode(c, 0, 0, c.effect.value ?? 2);
    },
  },
  fireball: {
    ms: 3200,
    glow: ORANGE,
    start(c) {
      const to = path(c);
      const TRAVEL = 0.6;
      const fly = flyingOrb(
        c,
        ORIGIN,
        { x: to.dx, y: to.dy },
        { colors: FIRE, fadeTo: 0x7a1d0a, core: 0xffd04a, outer: ORANGE, size: 1.25, smoke: true },
      );
      flare(c, 0, 0, c.grid * 1.4, 0xffb347, 0.3);
      let landed: ((seconds: number) => void) | null = null;
      return (s, dt) => {
        if (s < TRAVEL) return void fly(ease(s / TRAVEL), dt);
        landed ??= explode(c, to.dx, to.dy, c.effect.value ?? 2);
        landed(s - TRAVEL);
      };
    },
  },
  projectile: {
    ms: 1500,
    glow: CYAN,
    start(c) {
      const { grid, shape: g } = c;
      const to = path(c);
      const TRAVEL = 0.55;
      const fly = flyingOrb(
        c,
        ORIGIN,
        { x: to.dx, y: to.dy },
        { colors: [CYAN, 0xb8f0ff, 0xffffff], fadeTo: 0x2a6df4, core: 0xb8f0ff, outer: CYAN, weave: 0.45 },
      );
      flare(c, 0, 0, grid * 1.2, CYAN, 0.25);
      const hit = once(TRAVEL, () => {
        flare(c, to.dx, to.dy, grid * 2, 0xb8f0ff, 0.3);
        c.emit("add", {
          x: to.dx,
          y: to.dy,
          count: 34,
          speed: [grid * 1, grid * 3.5],
          life: [0.3, 0.7],
          size: [grid * 0.08, grid * 0.2],
          colors: [CYAN, GOLD, 0xffffff],
          drag: 2,
          stretch: 1,
        });
        c.shake(3, 180);
        c.shockwave({ x: to.dx, y: to.dy }, grid * 2.2, 600, 0.5);
      });
      return (s, dt) => {
        if (s < TRAVEL) return void fly(ease(s / TRAVEL), dt);
        hit(s);
        const v = phase(s, TRAVEL, TRAVEL + 0.6);
        g.circle(to.dx, to.dy, grid * (0.15 + 0.7 * ease(v))).stroke({ width: 3, color: GOLD, alpha: 1 - v });
        g.circle(to.dx, to.dy, grid * 0.35 * (1 - v)).fill({ color: 0xfff2b0, alpha: 1 - v });
        rays(g, to.dx, to.dy, 6, grid * 0.3, grid * (0.5 + 0.7 * ease(v)), 3, 0xffffff, 1 - phase(s, TRAVEL, TRAVEL + 0.35), 0.5);
        glint(g, to.dx, to.dy, grid * 0.9 * bell(phase(s, TRAVEL, TRAVEL + 0.4)), 0xffffff, 0.9);
      };
    },
  },
  slash: {
    ms: 900,
    glow: 0xffffff,
    start(c) {
      const { grid, shape: g, effect } = c;
      // Each slash leans its own way, but every screen agrees on it.
      const lean = (((effect.x * 7 + effect.y * 13) % 360) * Math.PI) / 180;
      const radius = grid * 0.95;
      const steps = 22;
      /** One crescent swept from `start`, `thick` cells wide at its middle. */
      const crescent = (start: number, sweep: number, thick: number, reach: number, color: number, alpha: number) => {
        if (alpha <= 0 || sweep <= 0) return;
        const outer: number[] = [];
        const inner: number[] = [];
        for (let i = 0; i <= steps; i++) {
          const along = i / steps;
          const angle = start + 2.4 * sweep * along;
          const thickness = reach * thick * Math.sin(Math.PI * along);
          outer.push(Math.cos(angle) * reach, Math.sin(angle) * reach);
          inner.unshift(Math.cos(angle) * (reach - thickness), Math.sin(angle) * (reach - thickness));
        }
        g.poly([...outer, ...inner]).fill({ color, alpha });
      };
      const sparks = once(0.12, () => {
        const tip = lean - 1.2 + 2.4 * ease(phase(0.12, 0, 0.22));
        c.emit("add", {
          x: Math.cos(tip) * radius,
          y: Math.sin(tip) * radius,
          count: 26,
          speed: [grid * 1.5, grid * 4],
          angle: [tip + Math.PI / 2 - 0.7, tip + Math.PI / 2 + 0.7],
          life: [0.2, 0.45],
          size: [grid * 0.07, grid * 0.16],
          colors: [0xffffff, 0xffe29a, 0xff8a4c],
          gravity: grid * 4,
          drag: 1.5,
          stretch: 1.4,
        });
        flare(c, 0, 0, grid * 1.4, 0xffffff, 0.2, 0.7);
        c.shake(5, 220);
      });
      return (s) => {
        sparks(s);
        const sweep = ease(phase(s, 0, 0.22));
        const fade = 1 - phase(s, 0.22, 0.65);
        const thin = 1 - 0.4 * phase(s, 0.22, 0.65);
        // An afterimage trails the blade, then the warm edge, then the white of the steel.
        crescent(lean - 1.35, ease(phase(s, 0.05, 0.3)), 0.16, radius * 1.12, 0xbfd9ff, 0.35 * (1 - phase(s, 0.25, 0.75)));
        crescent(lean - 1.2, sweep, 0.34 * thin, radius * 1.03, 0xffc46b, 0.55 * fade);
        crescent(lean - 1.2, sweep, 0.24 * thin, radius, 0xffffff, 0.95 * fade);
        // The cut itself: a thin line through the middle that outlasts the swing.
        const cut = ease(phase(s, 0.08, 0.2));
        const across = lean + Math.PI / 2;
        g.moveTo(-Math.cos(across) * radius * cut, -Math.sin(across) * radius * cut)
          .lineTo(Math.cos(across) * radius * cut, Math.sin(across) * radius * cut)
          .stroke({ width: 2.5, color: 0xffffff, alpha: 1 - phase(s, 0.25, 0.8), cap: "round" });
        g.circle(0, 0, grid * 0.45 * (1 - phase(s, 0.05, 0.3))).fill({ color: 0xffffff, alpha: 0.5 * (1 - phase(s, 0.05, 0.3)) });
      };
    },
  },
  bolt: {
    ms: 1200,
    glow: 0x7fa8ff,
    start(c) {
      const { grid, shape: g } = c;
      const to = path(c);
      const end = { x: to.dx, y: to.dy };
      let line = jaggedLine(ORIGIN, end, grid * 1.4, 6);
      let branches: { x: number; y: number }[][] = [];
      let lastChange = -1;
      const crackle = stream(60);
      flare(c, 0, 0, grid * 1.6, 0xdbe7ff, 0.25);
      flare(c, end.x, end.y, grid * 2.6, 0xdbe7ff, 0.35);
      c.emit("add", {
        x: end.x,
        y: end.y,
        count: 38,
        speed: [grid * 1, grid * 4],
        life: [0.25, 0.6],
        size: [grid * 0.07, grid * 0.18],
        colors: [0xffffff, 0xb8d2ff, 0x7fa8ff],
        drag: 2,
        stretch: 1.2,
      });
      c.emit("normal", {
        x: end.x,
        y: end.y,
        count: 1,
        speed: [0, 0],
        life: [1.1, 1.1],
        size: [grid * 1.5, grid * 1.5],
        colors: [0x0a0c14],
        alpha: 0.5,
      });
      c.shake(6, 260);
      c.shockwave(end, grid * 3, 700, 0.8);
      return (s, dt) => {
        // What was struck keeps spitting sparks after the light is gone.
        if (s < 0.7)
          c.emit("add", {
            x: end.x,
            y: end.y,
            count: crackle(dt),
            speed: [grid * 0.5, grid * 2.2],
            life: [0.12, 0.3],
            size: [grid * 0.05, grid * 0.11],
            colors: [0xffffff, 0xb8d2ff],
            spread: grid * 0.35,
            stretch: 1.5,
          });
        const ring = phase(s, 0, 0.5);
        g.circle(end.x, end.y, grid * (0.2 + 1.1 * ease(ring))).stroke({ width: 3, color: 0xb8d2ff, alpha: 1 - ring });
        const alive = 1 - phase(s, 0.15, 0.6);
        if (alive <= 0) return;
        // Lightning never holds still: a new path every few frames.
        if (s - lastChange > 0.05) {
          lastChange = s;
          line = jaggedLine(ORIGIN, end, grid * 1.4, 6);
          branches = [0.2, 0.4, 0.6, 0.8].map((along) => {
            const origin = line[Math.floor(line.length * along)]!;
            const aim = { x: origin.x + (Math.random() - 0.5) * grid * 3, y: origin.y + (Math.random() - 0.5) * grid * 3 };
            return jaggedLine(origin, aim, grid * 0.7, 4);
          });
        }
        // It stutters instead of fading evenly.
        const flicker = alive * (0.65 + 0.35 * Math.random());
        for (const [width, color, alpha] of [
          [grid * 0.34, 0x4f6bff, 0.18 * flicker],
          [grid * 0.2, 0x7fa8ff, 0.4 * flicker],
          [grid * 0.07, 0xffffff, flicker],
        ] as const) {
          g.moveTo(line[0]!.x, line[0]!.y);
          for (const p of line) g.lineTo(p.x, p.y);
          g.stroke({ width, color, alpha, join: "round", cap: "round" });
          for (const branch of branches) {
            g.moveTo(branch[0]!.x, branch[0]!.y);
            for (const p of branch) g.lineTo(p.x, p.y);
            g.stroke({ width: width * 0.55, color, alpha: alpha * 0.8, join: "round", cap: "round" });
          }
        }
        for (const spot of [ORIGIN, end]) g.circle(spot.x, spot.y, grid * 0.5 * alive).fill({ color: 0xdbe7ff, alpha: 0.5 * alive });
      };
    },
  },
  frost: {
    ms: 2600,
    glow: 0x9be3ff,
    start(c) {
      const { grid, shape: g } = c;
      const radius = areaRadius(c);
      flare(c, 0, 0, radius * 2.4, 0xdff6ff, 0.35, 0.8);
      c.emit("add", {
        x: 0,
        y: 0,
        count: 60,
        speed: [radius * 0.6, radius * 2.4],
        life: [0.6, 1.2],
        size: [grid * 0.08, grid * 0.2],
        colors: [0xdff6ff, 0xa8e6ff, 0x7cc8ff, 0xffffff],
        gravity: grid * 0.6,
        drag: 2.6,
        stretch: 0.8,
      });
      c.emit("normal", {
        x: 0,
        y: 0,
        count: 20,
        speed: [0, radius * 0.8],
        life: [1.3, 2.1],
        size: [grid * 0.7, grid * 1.2],
        grow: 2,
        colors: [0xcfeaff, 0xe8f6ff],
        alpha: 0.32,
        drag: 1.5,
        spread: radius * 0.3,
        swirl: 0.6,
      });
      c.shockwave(ORIGIN, radius * 2, 800, 0.5);
      const glitter = stream(34);
      const spikes = Math.round(12 + (radius / grid) * 2);
      return (s, dt) => {
        if (s > 0.3 && s < 1.7)
          c.emit("add", {
            x: 0,
            y: 0,
            count: glitter(dt),
            speed: [0, grid * 0.15],
            life: [0.4, 0.8],
            size: [grid * 0.06, grid * 0.14],
            colors: [0xffffff, 0xdff6ff],
            spread: radius,
            twinkle: 6,
          });
        const spread = ease(phase(s, 0, 0.35));
        const melt = 1 - phase(s, 1.2, 2.5);
        g.circle(0, 0, radius * spread).fill({ color: 0xbfe8ff, alpha: 0.22 * melt });
        g.circle(0, 0, radius * spread).stroke({ width: 4, color: 0xe8f9ff, alpha: 0.9 * (1 - phase(s, 0.3, 1.4)) });
        // A snowflake of ice grows across the ground: six arms, each with barbs.
        const grown = ease(phase(s, 0.05, 0.6));
        const reach = radius * 0.88 * grown;
        for (let arm = 0; arm < 6; arm++) {
          const angle = (arm / 6) * TURN + 0.26;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          g.moveTo(0, 0).lineTo(cos * reach, sin * reach);
          for (const [along, size] of [
            [0.4, 0.3],
            [0.68, 0.22],
          ] as const)
            for (const side of [-1, 1]) {
              const barb = angle + side * 0.95;
              g.moveTo(cos * reach * along, sin * reach * along).lineTo(
                cos * reach * along + Math.cos(barb) * reach * size,
                sin * reach * along + Math.sin(barb) * reach * size,
              );
            }
        }
        g.stroke({ width: Math.max(2, grid * 0.045), color: 0xf2fcff, alpha: 0.85 * melt, cap: "round" });
        const shards = 1 - phase(s, 0.9, 2.1);
        for (let i = 0; i < spikes; i++) {
          const angle = (i / spikes) * TURN;
          const base = radius * spread * 0.92;
          const length = grid * (0.25 + 0.4 * scatter(i)) * back(phase(s, 0.1 + 0.2 * scatter(i, 1), 0.5 + 0.2 * scatter(i, 1)));
          const width = 0.09;
          g.poly([
            Math.cos(angle - width) * base,
            Math.sin(angle - width) * base,
            Math.cos(angle) * (base + length),
            Math.sin(angle) * (base + length),
            Math.cos(angle + width) * base,
            Math.sin(angle + width) * base,
          ]).fill({ color: 0xe8f9ff, alpha: 0.9 * shards });
        }
      };
    },
  },
  poison: {
    ms: 3200,
    glow: 0x7ddc3a,
    start(c) {
      const { grid, shape: g } = c;
      const radius = areaRadius(c);
      const cells = radius / grid;
      const clouds = stream(14 + cells * 8);
      const spores = stream(12 + cells * 8);
      flare(c, 0, 0, radius * 1.6, 0x9be84a, 0.5, 0.35);
      return (s, dt) => {
        if (s < 1.9) {
          c.emit("normal", {
            x: 0,
            y: 0,
            count: clouds(dt),
            speed: [0, radius * 0.3],
            life: [1, 1.5],
            size: [grid * 0.8, grid * 1.4],
            grow: 1.8,
            colors: [0x4f8f1f, 0x6fae2a, 0x3d7a2a, 0x8a9b2a],
            alpha: 0.3,
            spread: radius * 0.75 * ease(phase(s, 0, 0.5)),
            swirl: 0.7,
            spin: [-1, 1],
          });
          c.emit("add", {
            x: 0,
            y: 0,
            count: spores(dt),
            speed: [0, grid * 0.3],
            life: [0.6, 1.2],
            size: [grid * 0.05, grid * 0.12],
            colors: [0xc6ff6b, 0x9be84a, 0xeaffb0],
            gravity: -grid * 0.5,
            spread: radius * 0.85,
            twinkle: 4,
          });
        }
        const pool = ease(phase(s, 0, 0.6));
        const linger = 1 - phase(s, 2.2, 3.1);
        g.circle(0, 0, radius * pool).fill({ color: 0x2f5d12, alpha: 0.28 * linger });
        g.circle(0, 0, radius * pool).stroke({ width: 3, color: 0x9be84a, alpha: 0.6 * linger * (0.7 + 0.3 * Math.sin(s * 5)) });
        // Bubbles swell and pop across the pool, each on its own beat.
        const bubbles = Math.round(6 + cells * 3);
        for (let i = 0; i < bubbles; i++) {
          const beat = 0.7 + 0.5 * scatter(i, 3);
          const life = ((s + scatter(i, 4) * beat) % beat) / beat;
          const angle = scatter(i, 1) * TURN;
          const reach = radius * 0.85 * Math.sqrt(scatter(i, 2)) * pool;
          const x = Math.cos(angle) * reach;
          const y = Math.sin(angle) * reach;
          const size = grid * (0.08 + 0.1 * scatter(i, 5));
          if (life < 0.75) {
            g.circle(x, y, size * (0.3 + 0.7 * (life / 0.75))).fill({ color: 0x9be84a, alpha: 0.5 * linger });
            g.circle(x - size * 0.25, y - size * 0.25, size * 0.22).fill({ color: 0xeaffb0, alpha: 0.8 * linger });
          } else {
            const pop = (life - 0.75) / 0.25;
            g.circle(x, y, size * (1 + pop)).stroke({ width: 1.5, color: 0xc6ff6b, alpha: (1 - pop) * linger });
          }
        }
      };
    },
  },
  radiant: {
    ms: 2100,
    glow: 0xffe9a3,
    start(c) {
      const { grid, shape: g } = c;
      const STRIKE = 0.22;
      const motes = stream(34);
      const strike = once(STRIKE, () => {
        flare(c, 0, 0, grid * 3.4, 0xfff6d6, 0.45);
        c.emit("add", {
          x: 0,
          y: 0,
          count: 56,
          speed: [grid * 1, grid * 4],
          life: [0.4, 0.9],
          size: [grid * 0.08, grid * 0.2],
          colors: [0xffffff, 0xfff2b0, GOLD],
          drag: 2.4,
          stretch: 0.9,
        });
        c.shake(6, 300);
        c.shockwave(ORIGIN, grid * 3, 800, 0.8);
      });
      return (s, dt) => {
        strike(s);
        if (s > STRIKE && s < 1.4)
          c.emit("add", {
            x: 0,
            y: 0,
            count: motes(dt),
            speed: [0, grid * 0.3],
            life: [0.7, 1.2],
            size: [grid * 0.05, grid * 0.13],
            colors: [0xffffff, 0xfff2b0],
            gravity: -grid * 1.2,
            spread: grid * 0.8,
            twinkle: 6,
          });
        // A column of light comes down from far above, then narrows to nothing.
        const fall = ease(phase(s, 0, STRIKE));
        const hold = 1 - phase(s, 0.7, 1.5);
        const top = -grid * 7;
        const foot = top * (1 - fall);
        for (const [width, color, alpha] of [
          [1.1, GOLD, 0.14],
          [0.6, 0xffe9a3, 0.32],
          [0.22, 0xffffff, 0.8],
        ] as const) {
          const half = (grid * width * (0.5 + 0.5 * hold) * (1 + 0.06 * Math.sin(s * 40))) / 2;
          g.poly([-half, foot, half, foot, half * 0.55, top, -half * 0.55, top]).fill({ color, alpha: alpha * hold });
        }
        const after = phase(s, STRIKE, STRIKE + 0.9);
        if (after > 0) {
          // Rays turn slowly around the spot where it struck.
          const length = grid * 1.9 * bell(phase(s, STRIKE, 1.7));
          for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * TURN + s * 0.6;
            const wide = i % 2 === 0 ? 0.07 : 0.04;
            const reach = length * (i % 2 === 0 ? 1 : 0.65);
            g.poly([
              Math.cos(angle - wide) * grid * 0.3,
              Math.sin(angle - wide) * grid * 0.3,
              Math.cos(angle) * (grid * 0.3 + reach),
              Math.sin(angle) * (grid * 0.3 + reach),
              Math.cos(angle + wide) * grid * 0.3,
              Math.sin(angle + wide) * grid * 0.3,
            ]).fill({ color: 0xfff2b0, alpha: 0.55 * hold });
          }
          g.circle(0, 0, grid * (0.3 + 1.5 * ease(after))).stroke({ width: 4, color: GOLD, alpha: 1 - after });
          g.circle(0, 0, grid * 0.75).stroke({ width: 2.5, color: 0xffffff, alpha: 0.8 * bell(phase(s, STRIKE, 1.8)) });
          g.circle(0, 0, grid * 0.6).fill({ color: 0xfff6d6, alpha: 0.35 * (1 - phase(s, STRIKE, 1.6)) });
        }
      };
    },
  },
  necrotic: {
    ms: 2300,
    glow: 0x9b5cff,
    start(c) {
      const { grid, shape: g } = c;
      const drain = stream(46);
      const TENDRILS = 7;
      let tendrils: { x: number; y: number }[][] = [];
      let lastChange = -1;
      const implode = once(1.35, () => {
        flare(c, 0, 0, grid * 2, 0xb388ff, 0.3);
        c.emit("add", {
          x: 0,
          y: 0,
          count: 36,
          speed: [grid * 0.6, grid * 2.6],
          life: [0.4, 0.8],
          size: [grid * 0.07, grid * 0.17],
          colors: [0xb388ff, 0x6dffb0, 0xffffff],
          fadeTo: 0x1a0a33,
          drag: 2,
        });
        c.shake(4, 240);
        c.shockwave(ORIGIN, grid * 2.2, 650, 0.5);
      });
      return (s, dt) => {
        implode(s);
        // Life is pulled out of the air around the spot: dark smoke and pale green wisps drift inward.
        if (s < 1.25) {
          const count = drain(dt);
          c.emit("normal", {
            x: 0,
            y: 0,
            count: Math.ceil(count / 3),
            speed: [grid * 0.9, grid * 1.5],
            life: [0.8, 1.1],
            size: [grid * 0.4, grid * 0.7],
            grow: 0.5,
            colors: [0x140a24, 0x24123f, 0x0c0714],
            alpha: 0.45,
            spread: grid * 1.5,
            inward: true,
            swirl: 1.4,
          });
          c.emit("add", {
            x: 0,
            y: 0,
            count,
            speed: [grid * 1.3, grid * 2],
            life: [0.6, 0.8],
            size: [grid * 0.05, grid * 0.12],
            colors: [0x6dffb0, 0xb388ff, 0xd9c7ff],
            spread: grid * 1.6,
            inward: true,
            swirl: 2.2,
          });
        }
        const reach = ease(phase(s, 0, 0.5)) * (1 - ease(phase(s, 1.1, 1.4)));
        // The tendrils writhe: their shape changes many times a second.
        if (s - lastChange > 0.09) {
          lastChange = s;
          tendrils = around(TENDRILS, grid * 1.45, 0.4).map((tip, i) =>
            jaggedLine(ORIGIN, { x: tip.x * (0.7 + 0.3 * scatter(i)), y: tip.y * (0.7 + 0.3 * scatter(i)) }, grid * 0.7, 4),
          );
        }
        if (reach > 0.02)
          for (const [width, color, alpha] of [
            [grid * 0.16, 0x0c0714, 0.85],
            [grid * 0.05, 0xb388ff, 0.9],
          ] as const) {
            for (const tendril of tendrils) {
              const shown = Math.max(2, Math.ceil(tendril.length * reach));
              g.moveTo(0, 0);
              for (const p of tendril.slice(0, shown)) g.lineTo(p.x, p.y);
            }
            g.stroke({ width, color, alpha, join: "round", cap: "round" });
          }
        const heart = 0.25 + 0.3 * bell(phase(s, 0, 1.4)) + 0.04 * Math.sin(s * 22);
        g.circle(0, 0, grid * heart * 1.5).fill({ color: 0x1a0a33, alpha: 0.4 * (1 - phase(s, 1.3, 1.9)) });
        g.circle(0, 0, grid * heart).fill({ color: 0x07040c, alpha: 0.9 * (1 - phase(s, 1.3, 1.7)) });
        g.circle(0, 0, grid * heart).stroke({ width: 3, color: 0x9b5cff, alpha: 1 - phase(s, 1.3, 1.7) });
        const ring = phase(s, 1.35, 2.1);
        if (ring > 0) g.circle(0, 0, grid * (0.3 + 1.2 * ease(ring))).stroke({ width: 3, color: 0x6dffb0, alpha: 0.8 * (1 - ring) });
      };
    },
  },
  shield: {
    ms: 1900,
    glow: 0x6fc3ff,
    start(c) {
      const { grid, shape: g } = c;
      const radius = grid * 0.85;
      const trail = stream(90);
      const ready = once(0.32, () => {
        flare(c, 0, 0, grid * 2.4, 0xbfe6ff, 0.35, 0.7);
        c.emit("add", {
          x: 0,
          y: 0,
          count: 30,
          speed: [0, grid * 0.9],
          life: [0.5, 0.9],
          size: [grid * 0.06, grid * 0.14],
          colors: [0xbfe6ff, 0xffffff, 0x6fc3ff],
          spread: radius,
          inward: true,
          twinkle: 6,
        });
        c.shockwave(ORIGIN, grid * 1.8, 600, 0.3);
      });
      return (s, dt) => {
        ready(s);
        const open = back(phase(s, 0, 0.32));
        const last = 1 - phase(s, 1.3, 1.85);
        const turn = Math.PI / 6;
        // A six-sided ward snaps open around the spot.
        g.poly(corners(6, radius * open, turn)).fill({ color: 0x6fc3ff, alpha: 0.14 * last });
        g.poly(corners(6, radius * open, turn)).stroke({ width: 4, color: 0xbfe6ff, alpha: last, join: "round" });
        g.poly(corners(6, radius * 0.72 * back(phase(s, 0.08, 0.4)), turn)).stroke({
          width: 1.5,
          color: 0x6fc3ff,
          alpha: 0.8 * last,
          join: "round",
        });
        // Its panels: the lines from the middle to each corner, lit one after another.
        for (const [i, p] of around(6, radius * open, turn).entries()) {
          const lit = bell(phase(s, 0.3 + i * 0.07, 0.75 + i * 0.07));
          g.moveTo(p.x * 0.72, p.y * 0.72)
            .lineTo(p.x, p.y)
            .stroke({ width: 2, color: 0xffffff, alpha: (0.25 + 0.75 * lit) * last });
          g.circle(p.x, p.y, grid * 0.06 * (1 + lit)).fill({ color: 0xffffff, alpha: last });
        }
        // A point of light runs once around the edge.
        const lap = phase(s, 0.3, 1.1);
        if (lap > 0 && lap < 1) {
          const edge = around(6, radius, turn);
          const at = lap * 6;
          const a = edge[Math.floor(at) % 6]!;
          const b = edge[(Math.floor(at) + 1) % 6]!;
          const x = a.x + (b.x - a.x) * (at % 1);
          const y = a.y + (b.y - a.y) * (at % 1);
          c.emit("add", {
            x,
            y,
            count: trail(dt),
            speed: [0, grid * 0.2],
            life: [0.2, 0.4],
            size: [grid * 0.08, grid * 0.16],
            grow: 0.3,
            colors: [0xffffff, 0xbfe6ff],
          });
          glint(g, x, y, grid * 0.28, 0xffffff, 1, s * 4);
        }
        const ripple = phase(s, 1.2, 1.85);
        if (ripple > 0)
          g.poly(corners(6, radius * (1 + 0.5 * ease(ripple)), turn)).stroke({
            width: 2,
            color: 0x6fc3ff,
            alpha: 0.8 * (1 - ripple),
            join: "round",
          });
      };
    },
  },
  arcane: {
    ms: 3000,
    glow: 0xb48cff,
    start(c) {
      const { grid, shape: g } = c;
      const radius = areaRadius(c);
      const motes = stream(18 + (radius / grid) * 8);
      const PULSE = 1.6;
      const pulse = once(PULSE, () => {
        flare(c, 0, 0, radius * 2.6, 0xd9c7ff, 0.4, 0.8);
        c.emit("add", {
          x: 0,
          y: 0,
          count: Math.round(50 + (radius / grid) * 14),
          speed: [0, grid * 0.3],
          life: [0.8, 1.4],
          size: [grid * 0.07, grid * 0.16],
          colors: [0xd9c7ff, 0xffffff, PINK],
          gravity: -grid * 1.6,
          spread: radius,
          inward: true,
          twinkle: 6,
        });
        c.shake(3, 220);
        c.shockwave(ORIGIN, radius * 1.8, 800, 0.6);
      });
      return (s, dt) => {
        pulse(s);
        if (s > 0.3 && s < 2.2)
          c.emit("add", {
            x: 0,
            y: 0,
            count: motes(dt),
            speed: [0, grid * 0.12],
            life: [0.5, 0.9],
            size: [grid * 0.05, grid * 0.11],
            colors: [0xd9c7ff, 0xb48cff],
            gravity: -grid * 0.5,
            spread: radius,
            inward: true,
          });
        const open = ease(phase(s, 0, 0.5));
        const shown = Math.min(phase(s, 0, 0.3), 1 - phase(s, 2.2, 2.9));
        const surge = 1 + 0.6 * bell(phase(s, PULSE, PULSE + 0.5));
        const r = radius * open;
        g.circle(0, 0, r).fill({ color: 0x3b1f7a, alpha: 0.2 * shown });
        g.circle(0, 0, r).stroke({ width: 3 * surge, color: 0xd9c7ff, alpha: shown });
        g.circle(0, 0, r * 0.8).stroke({ width: 2, color: 0xb48cff, alpha: 0.9 * shown });
        g.circle(0, 0, r * 0.3).stroke({ width: 2, color: 0xb48cff, alpha: 0.9 * shown });
        // Marks between the two rings turn one way, the star inside them the other.
        dashes(g, r * 0.9, 24, s * 0.9, 0.35, Math.max(3, grid * 0.09), 0xffffff, 0.85 * shown);
        for (const turn of [-s * 0.7, -s * 0.7 + Math.PI / 3])
          g.poly(corners(3, r * 0.8, turn)).stroke({ width: 2 * surge, color: 0xd9c7ff, alpha: 0.9 * shown, join: "round" });
        for (const [i, p] of around(6, r * 0.55, s * 1.3).entries())
          glint(g, p.x, p.y, grid * 0.16 * (1 + 0.4 * Math.sin(s * 6 + i)), i % 2 ? PINK : 0xffffff, shown, s);
        const ring = phase(s, PULSE, PULSE + 0.8);
        if (ring > 0) g.circle(0, 0, radius * (1 + 0.45 * ease(ring))).stroke({ width: 4, color: PINK, alpha: 1 - ring });
        glint(g, 0, 0, r * 0.3 * surge, 0xffffff, 0.9 * shown, -s * 1.5);
      };
    },
  },
  arrow: {
    ms: 1400,
    glow: 0xffe6b0,
    start(c) {
      const { grid, shape: g } = c;
      const to = path(c);
      const TRAVEL = 0.26;
      const length = grid * 0.95;
      /** The arrow with its head at (x, y), pointing along `angle`. */
      const arrow = (x: number, y: number, angle: number, alpha: number) => {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const tail = { x: x - cos * length, y: y - sin * length };
        g.moveTo(tail.x, tail.y)
          .lineTo(x, y)
          .stroke({ width: Math.max(2, grid * 0.045), color: 0xd9c49a, alpha, cap: "round" });
        // The feathers.
        for (const side of [-1, 1])
          for (const along of [0, 0.12])
            g.moveTo(tail.x + cos * length * along, tail.y + sin * length * along)
              .lineTo(
                tail.x + cos * length * (along - 0.12) - sin * side * grid * 0.11,
                tail.y + sin * length * (along - 0.12) + cos * side * grid * 0.11,
              )
              .stroke({ width: 2, color: 0xf2efe6, alpha, cap: "round" });
        g.poly([
          x + cos * grid * 0.16,
          y + sin * grid * 0.16,
          x - cos * grid * 0.06 - sin * grid * 0.09,
          y - sin * grid * 0.06 + cos * grid * 0.09,
          x - cos * grid * 0.06 + sin * grid * 0.09,
          y - sin * grid * 0.06 - cos * grid * 0.09,
        ]).fill({ color: 0xe9eef2, alpha });
      };
      const angle = Math.atan2(to.uy, to.ux);
      const thud = once(TRAVEL, () => {
        c.emit("normal", {
          x: to.dx,
          y: to.dy,
          count: 14,
          speed: [grid * 0.3, grid * 1.4],
          life: [0.4, 0.8],
          size: [grid * 0.2, grid * 0.4],
          grow: 2,
          colors: [0xb9a98c, 0x8f8068, 0xd6c8ab],
          alpha: 0.4,
          drag: 3,
        });
        c.emit("add", {
          x: to.dx,
          y: to.dy,
          count: 14,
          speed: [grid * 1, grid * 3],
          angle: [angle + Math.PI - 0.9, angle + Math.PI + 0.9],
          life: [0.15, 0.35],
          size: [grid * 0.05, grid * 0.12],
          colors: [0xffffff, 0xffe6b0],
          drag: 2,
          stretch: 1.4,
        });
        c.shake(2.5, 140);
      });
      return (s) => {
        if (s < TRAVEL) {
          const u = s / TRAVEL;
          const x = to.dx * u;
          const y = to.dy * u;
          // A streak of air behind it shows how fast it flies.
          const streak = Math.min(to.length * u, grid * 3);
          g.moveTo(x - to.ux * streak, y - to.uy * streak)
            .lineTo(x, y)
            .stroke({ width: grid * 0.09, color: 0xffffff, alpha: 0.22, cap: "round" });
          return arrow(x, y, angle, 1);
        }
        thud(s);
        // Stuck where it hit, it shivers and goes still.
        const v = phase(s, TRAVEL, TRAVEL + 0.5);
        const shiver = Math.sin(v * 38) * 0.14 * (1 - v) ** 2;
        arrow(to.dx, to.dy, angle + shiver, 1 - phase(s, 1, 1.4));
        g.circle(to.dx, to.dy, grid * (0.1 + 0.5 * ease(v))).stroke({ width: 2, color: 0xffe6b0, alpha: 0.9 * (1 - v) });
      };
    },
  },
  beam: {
    ms: 2100,
    glow: PINK,
    start(c) {
      const { grid, shape: g } = c;
      const to = path(c);
      const end = { x: to.dx, y: to.dy };
      const FIRE_AT = 0.35;
      const FIRE_END = 1.45;
      const gather = stream(90);
      const spray = stream(120);
      const fire = once(FIRE_AT, () => {
        flare(c, 0, 0, grid * 2, 0xffc2ee, 0.3);
        flare(c, end.x, end.y, grid * 2.6, 0xffc2ee, 0.4);
        c.shake(4, 900);
        c.shockwave(end, grid * 2.6, 700, 0.6);
      });
      return (s, dt) => {
        fire(s);
        // Light gathers where it starts...
        if (s < FIRE_AT)
          c.emit("add", {
            x: 0,
            y: 0,
            count: gather(dt),
            speed: [grid * 2, grid * 3],
            life: [0.25, 0.32],
            size: [grid * 0.06, grid * 0.14],
            colors: [PINK, 0xffc2ee, 0xffffff],
            spread: grid * 0.9,
            inward: true,
            swirl: 4,
          });
        const charge = ease(phase(s, 0, FIRE_AT));
        const power = ease(phase(s, FIRE_AT, FIRE_AT + 0.1)) * (1 - phase(s, FIRE_END - 0.25, FIRE_END));
        g.circle(0, 0, grid * (0.12 + 0.28 * charge) * (1 - 0.5 * phase(s, FIRE_END, FIRE_END + 0.3))).fill({
          color: 0xffc2ee,
          alpha: 0.9 * (1 - phase(s, FIRE_END, FIRE_END + 0.4)),
        });
        g.circle(0, 0, grid * 0.1 * charge).fill({ color: 0xffffff, alpha: 1 - phase(s, FIRE_END, FIRE_END + 0.4) });
        if (power <= 0) return;
        // ...and then pours out in one line, spraying sparks where it lands.
        c.emit("add", {
          x: end.x,
          y: end.y,
          count: spray(dt),
          speed: [grid * 1, grid * 3.6],
          angle: [Math.atan2(-to.uy, -to.ux) - 1.3, Math.atan2(-to.uy, -to.ux) + 1.3],
          life: [0.2, 0.5],
          size: [grid * 0.06, grid * 0.15],
          colors: [PINK, 0xffc2ee, 0xffffff],
          drag: 2,
          stretch: 1.3,
        });
        const shiver = 0.85 + 0.15 * Math.sin(s * 70);
        for (const [width, color, alpha] of [
          [0.55, 0xc13cff, 0.22],
          [0.3, PINK, 0.6],
          [0.11, 0xffffff, 1],
        ] as const)
          g.moveTo(0, 0)
            .lineTo(end.x, end.y)
            .stroke({ width: grid * width * power * shiver, color, alpha, cap: "round" });
        // Knots of brighter light race along it.
        for (let i = 0; i < 4; i++) {
          const along = (s * 2.4 + i / 4) % 1;
          g.circle(end.x * along, end.y * along, grid * 0.17 * power).fill({ color: 0xffffff, alpha: 0.85 });
        }
        g.circle(end.x, end.y, grid * (0.3 + 0.12 * Math.sin(s * 50)) * power).fill({ color: 0xffffff, alpha: 0.9 });
        rays(g, end.x, end.y, 8, grid * 0.3, grid * (0.7 + 0.2 * Math.sin(s * 37)), 3, 0xffc2ee, 0.8 * power, s * 3);
      };
    },
  },
  meteor: {
    ms: 3600,
    glow: ORANGE,
    start(c) {
      const { grid, shape: g } = c;
      const radius = areaRadius(c);
      const cells = radius / grid;
      const FALL = 0.9;
      // It comes in from high up and to one side.
      const sky = { x: grid * 7, y: -grid * 11 };
      const fly = flyingOrb(c, sky, ORIGIN, {
        colors: FIRE,
        fadeTo: 0x7a1d0a,
        core: 0x4a2a1a,
        outer: ORANGE,
        size: 1.5 + cells * 0.25,
        smoke: true,
      });
      const fires = stream(10 + cells * 6);
      let landed: ((seconds: number) => void) | null = null;
      return (s, dt) => {
        if (s < FALL) {
          const u = s / FALL;
          // A shadow and a ring close in on where it will land.
          g.circle(0, 0, radius * (0.3 + 0.6 * u)).fill({ color: 0x000000, alpha: 0.3 * u });
          dashes(g, radius * (1.5 - 0.5 * u), 12, s * 3, 0.6, 3, 0xff9a2e, 0.9 * u);
          return void fly(u * u, dt);
        }
        if (!landed) {
          landed = explode(c, 0, 0, cells);
          c.shake(Math.min(22, 10 + cells * 3), 800);
          c.emit("normal", {
            x: 0,
            y: 0,
            count: 18,
            speed: [radius * 1.5, radius * 4],
            life: [0.5, 1],
            size: [grid * 0.12, grid * 0.24],
            colors: [0x1c1410, 0x30231a, 0x5a3a20],
            drag: 2.4,
            stretch: 0.5,
          });
        }
        const after = s - FALL;
        landed(after);
        // The ground keeps burning in patches.
        if (after > 0.3 && after < 2)
          c.emit("add", {
            x: 0,
            y: 0,
            count: fires(dt),
            speed: [0, grid * 0.3],
            life: [0.4, 0.8],
            size: [grid * 0.2, grid * 0.42],
            grow: 0.4,
            colors: FIRE,
            fadeTo: 0x7a1d0a,
            alpha: 0.8,
            gravity: -grid * 1.3,
            spread: radius * 0.8,
          });
        // The crater glows and cools.
        g.circle(0, 0, radius * 0.45).fill({ color: 0xff5a1a, alpha: 0.4 * (1 - phase(after, 0.2, 2.4)) });
        g.circle(0, 0, radius * 0.5).stroke({ width: 3, color: 0xffb347, alpha: 0.7 * (1 - phase(after, 0.3, 2.2)) });
      };
    },
  },
  quake: {
    ms: 2800,
    glow: 0xff9a3c,
    start(c) {
      const { grid, shape: g, effect } = c;
      const radius = areaRadius(c);
      const cells = radius / grid;
      // The cracks come from chance, seeded by the spot, so every screen breaks the ground the same way.
      const random = seeded(effect.x * 31 + effect.y * 17);
      const cracks = around(7, radius, random() * TURN).map((tip) => {
        const reach = 0.65 + 0.35 * random();
        return jaggedLine(ORIGIN, { x: tip.x * reach, y: tip.y * reach }, radius * 0.5, 4, random);
      });
      const dust = stream(30 + cells * 10);
      c.shake(Math.min(18, 8 + cells * 2), 1500);
      c.shockwave(ORIGIN, radius * 2, 1000, Math.min(1.5, 0.7 + cells * 0.15));
      c.emit("normal", {
        x: 0,
        y: 0,
        count: Math.round(24 + cells * 8),
        speed: [radius * 0.5, radius * 1.6],
        life: [0.9, 1.6],
        size: [grid * 0.4, grid * 0.8],
        grow: 2.2,
        colors: [0x8f8068, 0xa3927a, 0x6f6252],
        alpha: 0.38,
        drag: 2,
        spread: radius * 0.3,
      });
      // Stones jump out of the ground and fall back.
      c.emit("normal", {
        x: 0,
        y: 0,
        count: Math.round(16 + cells * 5),
        speed: [grid * 2, grid * 4.5],
        angle: [-Math.PI / 2 - 0.7, -Math.PI / 2 + 0.7],
        life: [0.5, 0.85],
        size: [grid * 0.1, grid * 0.22],
        colors: [0x3b332b, 0x54493d, 0x2a241e],
        gravity: grid * 11,
        spread: radius * 0.8,
      });
      return (s, dt) => {
        if (s < 1.1) {
          // Dust puffs up along the cracks while they open.
          const crack = cracks[Math.floor(Math.random() * cracks.length)]!;
          const at = crack[Math.floor(Math.random() * crack.length * ease(phase(s, 0, 0.5)))] ?? ORIGIN;
          c.emit("normal", {
            x: at.x,
            y: at.y,
            count: dust(dt),
            speed: [0, grid * 0.7],
            life: [0.6, 1.1],
            size: [grid * 0.25, grid * 0.5],
            grow: 2,
            colors: [0xa3927a, 0x8f8068, 0xbcae96],
            alpha: 0.32,
            gravity: -grid * 0.3,
            spread: grid * 0.3,
          });
        }
        for (const delay of [0, 0.22, 0.44]) {
          const u = phase(s, delay, delay + 0.8);
          if (u > 0 && u < 1)
            g.circle(0, 0, radius * (0.15 + 1.05 * ease(u))).stroke({ width: 5 * (1 - u) + 1, color: 0xbcae96, alpha: 0.6 * (1 - u) });
        }
        const split = ease(phase(s, 0, 0.5));
        const close = 1 - phase(s, 1.9, 2.75);
        for (const [width, color, alpha] of [
          [grid * 0.2, 0x0b0806, 0.9],
          [grid * 0.07, 0xff7a1a, 0.9 * (1 - phase(s, 0.4, 1.8))],
        ] as const) {
          if (alpha <= 0) continue;
          for (const crack of cracks) {
            const shown = Math.max(2, Math.ceil(crack.length * split));
            g.moveTo(0, 0);
            for (const p of crack.slice(0, shown)) g.lineTo(p.x, p.y);
          }
          g.stroke({ width, color, alpha: alpha * close, join: "round", cap: "round" });
        }
        g.circle(0, 0, grid * 0.3 * split).fill({ color: 0x0b0806, alpha: 0.9 * close });
      };
    },
  },
  whirlwind: {
    ms: 3200,
    glow: 0xe8f2f8,
    start(c) {
      const { grid, shape: g } = c;
      const radius = areaRadius(c);
      const cells = radius / grid;
      const air = stream(40 + cells * 16);
      const debris = stream(10 + cells * 5);
      return (s, dt) => {
        const power = ease(phase(s, 0, 0.5)) * (1 - phase(s, 2.3, 3.1));
        if (s < 2.4) {
          c.emit("normal", {
            x: 0,
            y: 0,
            count: air(dt),
            speed: [0, radius * 0.25],
            life: [0.7, 1.2],
            size: [grid * 0.3, grid * 0.6],
            grow: 1.6,
            colors: [0xcfd8dc, 0xb0bec5, 0xe8eef1],
            alpha: 0.3,
            spread: radius * 0.9,
            swirl: 5.5,
          });
          // Leaves and grit caught in it, pulled toward the middle as they circle.
          c.emit("normal", {
            x: 0,
            y: 0,
            count: debris(dt),
            speed: [radius * 0.3, radius * 0.6],
            life: [0.9, 1.5],
            size: [grid * 0.08, grid * 0.16],
            colors: [0x6b8f3a, 0x8a6a3a, 0x4a3828, 0xa3b56a],
            spread: radius,
            inward: true,
            swirl: 6.5,
            drag: 0.6,
          });
          c.emit("add", {
            x: 0,
            y: 0,
            count: debris(dt),
            speed: [0, radius * 0.2],
            life: [0.5, 0.9],
            size: [grid * 0.05, grid * 0.12],
            colors: [0xffffff, 0xe8f2f8],
            alpha: 0.7,
            spread: radius * 0.8,
            swirl: 7,
          });
        }
        if (power <= 0) return;
        g.circle(0, 0, radius * power).fill({ color: 0xe8f2f8, alpha: 0.08 * power });
        // Three arms of wind spiral out from the eye, turning fast.
        for (let arm = 0; arm < 3; arm++) {
          const base = s * 8 + (arm / 3) * TURN;
          for (const [width, alpha, shift] of [
            [grid * 0.14, 0.22, 0],
            [grid * 0.05, 0.75, 0.05],
          ] as const) {
            for (let i = 0; i <= 26; i++) {
              const along = i / 26;
              const angle = base - along * 3.4 + shift;
              const reach = radius * power * (0.12 + 0.88 * along);
              if (i === 0) g.moveTo(Math.cos(angle) * reach, Math.sin(angle) * reach);
              else g.lineTo(Math.cos(angle) * reach, Math.sin(angle) * reach);
            }
            g.stroke({ width, color: 0xffffff, alpha: alpha * power, cap: "round", join: "round" });
          }
        }
        dashes(g, radius * power, 5, -s * 5, 0.6, 2, 0xffffff, 0.5 * power);
        g.circle(0, 0, radius * 0.12 * power).stroke({ width: 2, color: 0xffffff, alpha: 0.8 * power });
      };
    },
  },
};

/**
 * Plays an effect on the map and removes itself when done. Effects are built from layers: shapes with a glow, glowing
 * and smoky particles, and, for the big ones, a shaking map and a ripple across the screen. With reduced motion it
 * shows one still frame briefly. Returns a function that stops it early.
 */
export function playEffect(app: Application, world: Container, effect: EffectDto, grid: number, reduced: boolean): () => void {
  const { ticker } = app;
  const { ms, glow, start } = EFFECTS[effect.kind];
  const view = new Container();
  view.position.set(effect.x, effect.y);
  const smoke = reduced ? null : new ParticleSystem(softDot(), "normal");
  const sparks = reduced ? null : new ParticleSystem(softDot(), "add");
  const shape = new Graphics();
  const glowFilter = reduced ? null : new GlowFilter({ distance: 14, outerStrength: 2, innerStrength: 0, color: glow, quality: 0.25 });
  if (glowFilter) shape.filters = [glowFilter];
  if (smoke) view.addChild(smoke.container);
  view.addChild(shape);
  if (sparks) view.addChild(sparks.container);

  // Damage and healing show their number floating up.
  const number = effect.kind === "damage" || effect.kind === "heal" ? effect.value : undefined;
  const label =
    number === undefined
      ? null
      : new Text({
          text: `${effect.kind === "damage" ? "-" : "+"}${Math.abs(number)}`,
          style: {
            fill: effect.kind === "damage" ? 0xff6b6b : 0x6ff0a0,
            fontSize: grid * 0.5,
            fontWeight: "800",
            stroke: { color: 0x000000, width: 4 },
          },
        });
  if (label) {
    label.anchor.set(0.5);
    view.addChild(label);
  }
  world.addChild(view);

  const context: Context = {
    shape,
    grid,
    effect,
    emit: (blend, spec) => {
      if (spec.count > 0) (blend === "add" ? sparks : smoke)?.emit(spec);
    },
    shake: (amplitude, duration) => {
      if (!reduced) shakeWorld(ticker, world, amplitude, duration);
    },
    shockwave: (at, reach, duration, strength) => {
      if (!reduced) shockwave(ticker, world, { x: effect.x + at.x, y: effect.y + at.y }, reach, duration, strength);
    },
  };
  const draw = start(context);
  // A hit jolts its number sideways; healing floats straight up.
  const drift = effect.kind === "damage" ? (scatter(effect.x, effect.y) - 0.5) * grid * 0.8 : 0;

  const frame = (t: number, dt: number) => {
    shape.clear();
    draw((t * ms) / 1000, dt);
    smoke?.update(dt);
    sparks?.update(dt);
    if (label) {
      label.position.set(drift * ease(t), -grid * (0.4 + 0.9 * ease(t)));
      label.scale.set(0.4 + 0.6 * back(phase(t, 0, 0.18)));
      label.alpha = 1 - phase(t, 0.6, 1) ** 2;
    }
  };

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    ticker.remove(step);
    clearTimeout(timer);
    if (!view.destroyed) view.destroy({ children: true });
    glowFilter?.destroy();
  };
  const started = performance.now();
  let last = started;
  function step() {
    const now = performance.now();
    const t = Math.min(1, (now - started) / ms);
    if (view.destroyed) return stop();
    // Clamped so a tab coming back does not make the particles jump.
    frame(t, Math.min((now - last) / 1000, 0.05));
    last = now;
    if (t >= 1) stop();
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (reduced) {
    frame(0.4, 0);
    timer = setTimeout(stop, 700);
  } else ticker.add(step);
  return stop;
}
