import type { EffectDto, EffectKind, TokenDto } from "@openvtt/shared";
import { type Application, Container, Graphics, type PointData, Text } from "pixi.js";
import { GlowFilter } from "pixi-filters/glow";
import { type EmitSpec, ParticleSystem, softDot } from "./particles";
import { shakeWorld, shockwave } from "./screenFx";
import { jaggedLine } from "./weatherScene";

const GOLD = 0xffc914;
const VIOLET = 0x8b5cf6;
const GREEN = 0x3ecf6d;
const ORANGE = 0xff7a1a;
const CYAN = 0x66d9ff;
const FIRE = [0xfff2b0, 0xffd04a, 0xff9a2e, 0xff6a1a];

/** Fast at the start, slow at the end. */
const ease = (t: number) => 1 - (1 - t) ** 3;
/** How far `t` is between `from` and `to`, held to 0..1. */
const phase = (t: number, from: number, to: number) => Math.min(1, Math.max(0, (t - from) / (to - from)));

/** Points spread evenly around a circle. */
function around(count: number, radius: number, turn = 0) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + turn;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
}

/**
 * The effects worth showing when the tokens on a floor change: a token that appeared arrives, and one whose hit points
 * moved takes damage or heals. Every screen works this out from the state it already has, so nothing is sent.
 * `arrivals` is off when tokens come and go with sight, which would make every step of a player flash.
 */
export function tokenChangeEffects(before: ReadonlyMap<string, TokenDto>, after: readonly TokenDto[], grid: number, arrivals: boolean) {
  const effects: Pick<EffectDto, "kind" | "x" | "y" | "value">[] = [];
  for (const token of after) {
    const x = token.x + (token.size * grid) / 2;
    const y = token.y + (token.size * grid) / 2;
    const old = before.get(token.id);
    if (!old) {
      if (arrivals) effects.push({ kind: "arrive", x, y });
    } else if (old.hp !== null && token.hp !== null && old.hp !== token.hp) {
      effects.push({ kind: token.hp < old.hp ? "damage" : "heal", x, y, value: Math.abs(token.hp - old.hp) });
    }
  }
  return effects;
}

/** The topmost token whose square covers a point on the map. */
export function tokenAt(tokens: readonly TokenDto[], grid: number, x: number, y: number) {
  return tokens.findLast((t) => x >= t.x && x <= t.x + t.size * grid && y >= t.y && y <= t.y + t.size * grid);
}

/** How long after the effect starts the token flips, so the change lands while the effect is at its peak. */
export const VISIBILITY_DELAY_MS = { vanish: 600, arrive: 250 } as const;

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
  /** Lasts this long, in milliseconds. */
  ms: number;
}

/** Called once when the effect starts; returns what draws a frame at progress `t` (0 to 1), `dt` seconds after the last. */
type Frame = (t: number, dt: number) => void;

interface Effect {
  ms: number;
  /** The colour of the glow around what is drawn. */
  glow: number;
  start: (c: Context) => Frame;
}

/** A burst of fire, smoke and embers that rattles the screen; shared by the blast and the fireball's landing. */
function explode(c: Context, x: number, y: number, cells: number): (seconds: number) => void {
  const { grid, shape: g } = c;
  const radius = grid * Math.min(Math.max(cells, 0.5), 10);
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
  c.emit("add", {
    x,
    y,
    count: 34,
    speed: [radius * 0.4, radius * 1.6],
    life: [0.9, 1.5],
    size: [grid * 0.05, grid * 0.1],
    colors: [0xffd27a, 0xffffff, 0xff9a3c],
    gravity: -grid * 1.2,
    drag: 1.4,
    spread: radius * 0.2,
  });
  c.emit("normal", {
    x,
    y,
    count: 22 + Math.round(cells * 5),
    speed: [radius * 0.3, radius * 1.7],
    life: [1.1, 1.8],
    size: [grid * 0.4, grid * 0.85],
    grow: 2.2,
    colors: [0x2a2a2e, 0x3b3b42, 0x55505a, 0x6a5f58],
    alpha: 0.38,
    drag: 1.5,
    gravity: -grid * 0.35,
    spread: radius * 0.5,
  });
  c.shake(Math.min(16, 4 + cells * 2.2), 520);
  c.shockwave({ x, y }, radius * 2.2 + grid, 900, Math.min(1.6, 0.6 + cells * 0.15));
  return (s) => {
    const grow = ease(phase(s, 0, 0.55));
    g.circle(x, y, radius * 0.8).fill({ color: 0x120a05, alpha: 0.2 * Math.min(1, s * 8) * (1 - phase(s, 0.2, 1.4)) });
    g.circle(x, y, radius * (0.4 + 0.7 * ease(phase(s, 0, 0.6)))).fill({ color: ORANGE, alpha: 0.2 * (1 - phase(s, 0, 0.6)) });
    g.circle(x, y, radius * (0.2 + 0.4 * ease(phase(s, 0, 0.3)))).fill({ color: 0xfff1c2, alpha: 0.75 * (1 - phase(s, 0, 0.35)) });
    g.circle(x, y, radius * (0.3 + 0.9 * grow)).stroke({ width: 4 + (1 - grow) * 6, color: 0xffd27a, alpha: 1 - phase(s, 0, 0.6) });
  };
}

/** A bright orb with a glowing tail: what a projectile, a bolt of magic and a fireball all fly as. */
function flyingOrb(c: Context, dx: number, dy: number, colors: number[], fadeTo: number, core: number, outer: number) {
  const { grid, shape: g } = c;
  let carry = 0;
  return (u: number, dt: number) => {
    const head = { x: dx * u, y: dy * u };
    carry += 110 * dt;
    const count = Math.floor(carry);
    carry -= count;
    c.emit("add", {
      x: head.x,
      y: head.y,
      count,
      speed: [0, grid * 0.8],
      life: [0.25, 0.5],
      size: [grid * 0.16, grid * 0.34],
      colors,
      fadeTo,
      drag: 3,
      gravity: -grid * 0.4,
      spread: grid * 0.1,
    });
    g.circle(head.x, head.y, grid * 0.3).fill({ color: outer, alpha: 0.45 });
    g.circle(head.x, head.y, grid * 0.19).fill({ color: core, alpha: 0.95 });
    g.circle(head.x, head.y, grid * 0.09).fill({ color: 0xffffff });
  };
}

const EFFECTS: Record<EffectKind, Effect> = {
  arrive: {
    ms: 1700,
    glow: GOLD,
    start(c) {
      const { grid, shape: g } = c;
      c.emit("add", {
        x: 0,
        y: 0,
        count: 46,
        speed: [grid * 2.3, grid * 3],
        life: [0.42, 0.5],
        size: [grid * 0.09, grid * 0.2],
        colors: [GOLD, 0xfff2b0, 0xffffff],
        spread: grid * 1.3,
        inward: true,
      });
      let burst = false;
      return (t) => {
        const s = (t * c.ms) / 1000;
        if (!burst && s > 0.5) {
          burst = true;
          c.emit("add", {
            x: 0,
            y: 0,
            count: 38,
            speed: [grid * 0.8, grid * 2.6],
            life: [0.5, 0.9],
            size: [grid * 0.1, grid * 0.24],
            colors: [GOLD, 0xfff2b0, 0xffffff],
            fadeTo: 0xff9a2e,
            drag: 2,
          });
          c.shake(3, 200);
          c.shockwave({ x: 0, y: 0 }, grid * 2, 700, 0.45);
        }
        const beam = Math.sin(Math.PI * phase(s, 0.05, 1.2));
        const height = grid * 3.4 * ease(phase(s, 0, 0.5));
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
        if (ring > 0) g.circle(0, 0, grid * (0.2 + 1.1 * ease(ring))).stroke({ width: 4, color: GOLD, alpha: 1 - ring });
        g.circle(0, 0, grid * 0.7 * ease(phase(s, 0.4, 0.9))).fill({ color: 0xfff2b0, alpha: 0.4 * (1 - phase(s, 0.5, 1.1)) });
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
        count: 40,
        speed: [grid * 1.6, grid * 2.4],
        life: [0.5, 0.6],
        size: [grid * 0.09, grid * 0.2],
        colors: [VIOLET, 0xc9b3ff, 0xffffff],
        spread: grid * 1.2,
        inward: true,
      });
      let puff = false;
      return (t) => {
        const s = (t * c.ms) / 1000;
        if (!puff && s > 0.55) {
          puff = true;
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
          });
          c.emit("normal", {
            x: 0,
            y: 0,
            count: 14,
            speed: [0, grid * 0.8],
            life: [0.9, 1.3],
            size: [grid * 0.6, grid * 1],
            grow: 2,
            colors: [0x1a0a33, 0x2a1450],
            alpha: 0.5,
            drag: 1.6,
            gravity: -grid * 0.3,
            spread: grid * 0.3,
          });
        }
        const pull = ease(phase(s, 0, 0.7));
        g.circle(0, 0, grid * (1.2 - 1 * pull)).stroke({ width: 5, color: VIOLET, alpha: 1 - phase(s, 0.55, 1) });
        g.circle(0, 0, grid * (0.8 - 0.65 * pull)).stroke({ width: 2.5, color: 0xc9b3ff, alpha: 0.9 * (1 - phase(s, 0.5, 0.9)) });
        g.circle(0, 0, grid * (0.15 + 0.45 * Math.sin(Math.PI * phase(s, 0, 0.9)))).fill({
          color: 0x1a0a33,
          alpha: 0.8 * (1 - phase(s, 0.7, 1.2)),
        });
      };
    },
  },
  damage: {
    ms: 1100,
    glow: 0xff3b3b,
    start(c) {
      const { grid, shape: g, effect } = c;
      c.emit("add", {
        x: 0,
        y: 0,
        count: 26,
        speed: [grid * 1.2, grid * 3.4],
        life: [0.25, 0.55],
        size: [grid * 0.1, grid * 0.22],
        colors: [0xff4d4d, 0xffa0a0, 0xffffff],
        gravity: grid * 3,
        drag: 1.5,
        stretch: 1.3,
      });
      c.shake(Math.min(10, 3 + Math.abs(effect.value ?? 0) / 5), 220);
      return (t) => {
        const s = (t * c.ms) / 1000;
        g.circle(0, 0, grid * (0.2 + 0.5 * ease(phase(s, 0, 0.25)))).fill({ color: 0xe5484d, alpha: 0.5 * (1 - phase(s, 0, 0.35)) });
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
    ms: 1700,
    glow: GREEN,
    start(c) {
      const { grid, shape: g } = c;
      let carry = 0;
      return (t, dt) => {
        const s = (t * c.ms) / 1000;
        if (s < 0.85) {
          carry += 46 * dt;
          const count = Math.floor(carry);
          carry -= count;
          c.emit("add", {
            x: 0,
            y: grid * 0.2,
            count,
            speed: [grid * 0.3, grid * 1.1],
            angle: [-Math.PI / 2 - 0.4, -Math.PI / 2 + 0.4],
            life: [0.7, 1.1],
            size: [grid * 0.07, grid * 0.16],
            colors: [0x7dffb0, 0xd6ffe6, 0xffffff, 0xb7f75a],
            fadeTo: 0x2ecc71,
            drag: 0.8,
            spread: grid * 0.5,
          });
        }
        for (const delay of [0, 0.25]) {
          const u = phase(s, delay, delay + 0.9);
          if (u > 0 && u < 1) g.circle(0, 0, grid * (0.2 + 0.8 * ease(u))).stroke({ width: 3, color: GREEN, alpha: 1 - u });
        }
        g.circle(0, 0, grid * 0.55).fill({ color: GREEN, alpha: 0.22 * Math.sin(Math.PI * phase(s, 0, 1.2)) });
        const rise = ease(phase(s, 0, 1.2));
        for (const p of around(5, grid * 0.45, 1)) {
          const size = grid * 0.09;
          const y = p.y - grid * 0.9 * rise;
          const alpha = 1 - phase(s, 0.3, 1.2);
          g.rect(p.x - size, y - size / 3, size * 2, (size * 2) / 3).fill({ color: GREEN, alpha });
          g.rect(p.x - size / 3, y - size, (size * 2) / 3, size * 2).fill({ color: GREEN, alpha });
        }
      };
    },
  },
  blast: {
    ms: 1900,
    glow: ORANGE,
    start(c) {
      const draw = explode(c, 0, 0, c.effect.value ?? 2);
      return (t) => draw((t * c.ms) / 1000);
    },
  },
  fireball: {
    ms: 2500,
    glow: ORANGE,
    start(c) {
      const dx = (c.effect.toX ?? c.effect.x) - c.effect.x;
      const dy = (c.effect.toY ?? c.effect.y) - c.effect.y;
      const TRAVEL = 0.6;
      const fly = flyingOrb(c, dx, dy, FIRE, 0x7a1d0a, 0xffd04a, ORANGE);
      let landed: ((seconds: number) => void) | null = null;
      return (t, dt) => {
        const s = (t * c.ms) / 1000;
        if (s < TRAVEL) return fly(ease(s / TRAVEL), dt);
        landed ??= explode(c, dx, dy, c.effect.value ?? 2);
        landed(s - TRAVEL);
      };
    },
  },
  projectile: {
    ms: 1500,
    glow: CYAN,
    start(c) {
      const { grid, shape: g } = c;
      const dx = (c.effect.toX ?? c.effect.x) - c.effect.x;
      const dy = (c.effect.toY ?? c.effect.y) - c.effect.y;
      const TRAVEL = 0.55;
      const fly = flyingOrb(c, dx, dy, [CYAN, 0xb8f0ff, 0xffffff], 0x2a6df4, 0xb8f0ff, CYAN);
      let hit = false;
      return (t, dt) => {
        const s = (t * c.ms) / 1000;
        if (s < TRAVEL) return fly(ease(s / TRAVEL), dt);
        if (!hit) {
          hit = true;
          c.emit("add", {
            x: dx,
            y: dy,
            count: 30,
            speed: [grid * 1, grid * 3.5],
            life: [0.3, 0.7],
            size: [grid * 0.08, grid * 0.2],
            colors: [CYAN, GOLD, 0xffffff],
            drag: 2,
            stretch: 1,
          });
          c.shake(3, 180);
          c.shockwave({ x: dx, y: dy }, grid * 2.2, 600, 0.5);
        }
        const v = phase(s, TRAVEL, TRAVEL + 0.6);
        g.circle(dx, dy, grid * (0.15 + 0.6 * ease(v))).stroke({ width: 3, color: GOLD, alpha: 1 - v });
        g.circle(dx, dy, grid * 0.35 * (1 - v)).fill({ color: 0xfff2b0, alpha: 1 - v });
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
      let sparks = false;
      return (t) => {
        const s = (t * c.ms) / 1000;
        const sweep = ease(phase(s, 0, 0.22));
        const fade = 1 - phase(s, 0.22, 0.65);
        const start = lean - 1.2;
        const outer: number[] = [];
        const inner: number[] = [];
        for (let i = 0; i <= steps; i++) {
          const along = i / steps;
          const angle = start + 2.4 * sweep * along;
          const thickness = radius * 0.24 * Math.sin(Math.PI * along) * (1 - 0.4 * phase(s, 0.22, 0.65));
          outer.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
          inner.unshift(Math.cos(angle) * (radius - thickness), Math.sin(angle) * (radius - thickness));
        }
        g.poly([...outer, ...inner]).fill({ color: 0xffffff, alpha: 0.95 * fade });
        if (!sparks && s > 0.12) {
          sparks = true;
          const tip = start + 2.4 * sweep;
          c.emit("add", {
            x: Math.cos(tip) * radius,
            y: Math.sin(tip) * radius,
            count: 22,
            speed: [grid * 1.5, grid * 4],
            angle: [tip + Math.PI / 2 - 0.7, tip + Math.PI / 2 + 0.7],
            life: [0.2, 0.45],
            size: [grid * 0.07, grid * 0.16],
            colors: [0xffffff, 0xffe29a, 0xff8a4c],
            gravity: grid * 4,
            drag: 1.5,
            stretch: 1.4,
          });
          c.shake(5, 220);
        }
        g.circle(0, 0, grid * 0.45 * (1 - phase(s, 0.05, 0.3))).fill({ color: 0xffffff, alpha: 0.5 * (1 - phase(s, 0.05, 0.3)) });
      };
    },
  },
  bolt: {
    ms: 1000,
    glow: 0x7fa8ff,
    start(c) {
      const { grid, shape: g } = c;
      const dx = (c.effect.toX ?? c.effect.x) - c.effect.x;
      const dy = (c.effect.toY ?? c.effect.y) - c.effect.y;
      const from = { x: 0, y: 0 };
      const to = { x: dx, y: dy };
      let line = jaggedLine(from, to, grid * 1.4, 6);
      let branches: { x: number; y: number }[][] = [];
      let lastChange = -1;
      let struck = false;
      return (t) => {
        const s = (t * c.ms) / 1000;
        if (!struck) {
          struck = true;
          c.emit("add", {
            x: dx,
            y: dy,
            count: 34,
            speed: [grid * 1, grid * 4],
            life: [0.25, 0.6],
            size: [grid * 0.07, grid * 0.18],
            colors: [0xffffff, 0xb8d2ff, 0x7fa8ff],
            drag: 2,
            stretch: 1.2,
          });
          c.shake(6, 260);
          c.shockwave(to, grid * 3, 700, 0.8);
        }
        const alive = 1 - phase(s, 0.15, 0.6);
        if (alive <= 0) return;
        // Lightning never holds still: a new path every few frames.
        if (s - lastChange > 0.05) {
          lastChange = s;
          line = jaggedLine(from, to, grid * 1.4, 6);
          branches = [0.3, 0.55, 0.75].map((along) => {
            const origin = line[Math.floor(line.length * along)]!;
            const aim = { x: origin.x + (Math.random() - 0.5) * grid * 3, y: origin.y + (Math.random() - 0.5) * grid * 3 };
            return jaggedLine(origin, aim, grid * 0.7, 4);
          });
        }
        for (const [width, color, alpha] of [
          [grid * 0.22, 0x7fa8ff, 0.35 * alive],
          [grid * 0.07, 0xffffff, alive],
        ] as const) {
          g.moveTo(line[0]!.x, line[0]!.y);
          for (const p of line) g.lineTo(p.x, p.y);
          for (const branch of branches) {
            g.moveTo(branch[0]!.x, branch[0]!.y);
            for (const p of branch) g.lineTo(p.x, p.y);
          }
          g.stroke({ width, color, alpha, join: "round", cap: "round" });
        }
        for (const spot of [from, to]) g.circle(spot.x, spot.y, grid * 0.5 * alive).fill({ color: 0xdbe7ff, alpha: 0.5 * alive });
      };
    },
  },
  frost: {
    ms: 2200,
    glow: 0x9be3ff,
    start(c) {
      const { grid, shape: g } = c;
      const radius = grid * Math.min(Math.max(c.effect.value ?? 2, 0.5), 10);
      c.emit("add", {
        x: 0,
        y: 0,
        count: 56,
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
        count: 18,
        speed: [0, radius * 0.8],
        life: [1.2, 1.9],
        size: [grid * 0.7, grid * 1.2],
        grow: 2,
        colors: [0xcfeaff, 0xe8f6ff],
        alpha: 0.35,
        drag: 1.5,
        spread: radius * 0.3,
      });
      c.shockwave({ x: 0, y: 0 }, radius * 2, 800, 0.5);
      const spikes = 14;
      return (t) => {
        const s = (t * c.ms) / 1000;
        const spread = ease(phase(s, 0, 0.35));
        g.circle(0, 0, radius * spread).fill({ color: 0xbfe8ff, alpha: 0.22 * (1 - phase(s, 0.6, 2)) });
        g.circle(0, 0, radius * spread).stroke({ width: 4, color: 0xe8f9ff, alpha: 0.9 * (1 - phase(s, 0.3, 1.2)) });
        const shards = 1 - phase(s, 0.7, 1.8);
        for (let i = 0; i < spikes; i++) {
          const angle = (i / spikes) * Math.PI * 2;
          const base = radius * spread * 0.92;
          const length = grid * (0.25 + 0.3 * (((i * 5) % 7) / 7)) * spread;
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
    ms,
    emit: (blend, spec) => (blend === "add" ? sparks : smoke)?.emit(spec),
    shake: (amplitude, duration) => {
      if (!reduced) shakeWorld(ticker, world, amplitude, duration);
    },
    shockwave: (at, reach, duration, strength) => {
      if (!reduced) shockwave(ticker, world, { x: effect.x + at.x, y: effect.y + at.y }, reach, duration, strength);
    },
  };
  const draw = start(context);

  const frame = (t: number, dt: number) => {
    shape.clear();
    draw(t, dt);
    smoke?.update(dt);
    sparks?.update(dt);
    if (label) {
      label.position.set(0, -grid * (0.4 + 0.8 * ease(t)));
      label.scale.set(1 + 0.6 * (1 - phase(t, 0, 0.12)));
      label.alpha = 1 - t ** 3;
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
