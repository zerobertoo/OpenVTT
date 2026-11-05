import type { EffectDto, EffectKind } from "@openvtt/shared";
import { Container, Graphics, Text, type Ticker } from "pixi.js";

const GOLD = 0xffc914;
const VIOLET = 0x8b5cf6;
const RED = 0xe5484d;
const GREEN = 0x3ecf6d;
const ORANGE = 0xff7a1a;
const CYAN = 0x66d9ff;

/** Fast at the start, slow at the end. */
const ease = (t: number) => 1 - (1 - t) ** 3;

/** Points spread evenly around a circle: sparks, rays and petals share this. */
function around(count: number, radius: number, turn = 0) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + turn;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
}

interface Effect {
  /** How long it lasts, in milliseconds. */
  ms: number;
  /** Draws one frame at progress `t` (0 to 1); the origin is the spot where the effect happens, `grid` the size of a cell. */
  draw: (g: Graphics, t: number, grid: number, effect: EffectDto) => void;
}

const EFFECTS: Record<EffectKind, Effect> = {
  arrive: {
    ms: 1000,
    draw(g, t, grid) {
      const e = ease(t);
      g.circle(0, 0, grid * 0.7 * e).fill({ color: GOLD, alpha: 0.35 * (1 - t) });
      g.circle(0, 0, grid * (0.2 + e)).stroke({ width: 4, color: GOLD, alpha: 1 - t });
      for (const p of around(8, grid * (0.3 + 0.9 * e), 0.4))
        g.circle(p.x, p.y - grid * 0.4 * t, grid * 0.06).fill({ color: 0xfff2b0, alpha: 1 - t });
    },
  },
  vanish: {
    ms: 1000,
    draw(g, t, grid) {
      const e = ease(t);
      g.circle(0, 0, grid * (1.1 - 0.9 * e)).stroke({ width: 4, color: VIOLET, alpha: 1 - t * 0.6 });
      g.circle(0, 0, grid * 0.55 * (1 - e)).fill({ color: 0x2a1450, alpha: 0.7 * (1 - t) });
      for (const p of around(8, grid * (1.1 * (1 - e) + 0.1), 0.4)) g.circle(p.x, p.y, grid * 0.06).fill({ color: 0xc9b3ff, alpha: 1 - t });
    },
  },
  damage: {
    ms: 900,
    draw(g, t, grid) {
      const e = ease(t);
      g.circle(0, 0, grid * (0.25 + 0.45 * e)).fill({ color: RED, alpha: 0.55 * (1 - t) });
      for (const p of around(6, 1, 0.3)) {
        g.moveTo(p.x * grid * (0.25 + 0.2 * e), p.y * grid * (0.25 + 0.2 * e))
          .lineTo(p.x * grid * (0.45 + 0.4 * e), p.y * grid * (0.45 + 0.4 * e))
          .stroke({ width: 3, color: 0xffd0d0, alpha: 1 - t });
      }
    },
  },
  heal: {
    ms: 1100,
    draw(g, t, grid) {
      const e = ease(t);
      g.circle(0, 0, grid * (0.2 + 0.7 * e)).stroke({ width: 3, color: GREEN, alpha: 1 - t });
      // Little crosses rise from around the spot.
      for (const p of around(5, grid * 0.45, 1)) {
        const s = grid * 0.09;
        const y = p.y - grid * 0.9 * e;
        g.rect(p.x - s, y - s / 3, s * 2, (s * 2) / 3).fill({ color: GREEN, alpha: 1 - t });
        g.rect(p.x - s / 3, y - s, (s * 2) / 3, s * 2).fill({ color: GREEN, alpha: 1 - t });
      }
    },
  },
  blast: {
    ms: 1200,
    draw(g, t, grid, effect) {
      const radius = grid * Math.min(Math.max(effect.value ?? 2, 0.5), 10);
      const e = ease(t);
      g.circle(0, 0, radius * e).fill({ color: ORANGE, alpha: 0.45 * (1 - t) });
      g.circle(0, 0, radius * e).stroke({ width: 5, color: 0xffd27a, alpha: 1 - t });
      g.circle(0, 0, radius * e * 0.5).fill({ color: 0xfff1c2, alpha: 0.5 * (1 - t) });
    },
  },
  projectile: {
    ms: 1000,
    draw(g, t, grid, effect) {
      const dx = (effect.toX ?? effect.x) - effect.x;
      const dy = (effect.toY ?? effect.y) - effect.y;
      const TRAVEL = 0.7;
      const at = (u: number) => ({ x: dx * u, y: dy * u });
      if (t < TRAVEL) {
        const u = ease(t / TRAVEL);
        // The glow behind the orb is the same orb a few moments earlier.
        for (let k = 3; k >= 0; k--) {
          const p = at(Math.max(0, u - k * 0.05));
          g.circle(p.x, p.y, grid * 0.15 * (1 - k * 0.2)).fill({ color: CYAN, alpha: 1 - k * 0.25 });
        }
        const head = at(u);
        g.circle(head.x, head.y, grid * 0.07).fill({ color: 0xffffff });
      } else {
        const v = (t - TRAVEL) / (1 - TRAVEL);
        g.circle(dx, dy, grid * (0.15 + 0.5 * v)).stroke({ width: 3, color: GOLD, alpha: 1 - v });
        g.circle(dx, dy, grid * 0.3 * (1 - v)).fill({ color: 0xfff2b0, alpha: 1 - v });
      }
    },
  },
};

/**
 * Plays an effect on the map and removes itself when done. With reduced motion it shows one still frame briefly.
 * Returns a function that stops it early.
 */
export function playEffect(world: Container, ticker: Ticker, effect: EffectDto, grid: number, reduced: boolean): () => void {
  const { ms, draw } = EFFECTS[effect.kind];
  const view = new Container();
  view.position.set(effect.x, effect.y);
  const shape = new Graphics();
  view.addChild(shape);

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

  const frame = (t: number) => {
    shape.clear();
    draw(shape, t, grid, effect);
    if (label) {
      label.position.set(0, -grid * (0.4 + 0.8 * ease(t)));
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
  };
  const started = performance.now();
  function step() {
    const t = Math.min(1, (performance.now() - started) / ms);
    if (view.destroyed) return stop();
    frame(t);
    if (t >= 1) stop();
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (reduced) {
    frame(0.4);
    timer = setTimeout(stop, 700);
  } else ticker.add(step);
  return stop;
}
