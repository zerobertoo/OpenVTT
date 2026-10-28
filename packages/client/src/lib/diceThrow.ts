/** Where and how fast a throw leaves the hand, in screen pixels and pixels per second. */
export interface Launch {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Bounds {
  width: number;
  height: number;
}

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** One step of the animation, so a throw plays at the same pace on any screen refresh rate. */
export const STEP_SECONDS = 1 / 60;
/** A throw longer than this is cut: dice that are still sliding stop where they are. */
export const MAX_STEPS = 150;
const FRICTION = 3.2;
const BOUNCE = 0.55;
const REST_SPEED = 10;
const MIN_THROW_SPEED = 380;
const MAX_THROW_SPEED = 2200;

type Random = () => number;

/** The launch for a roll nobody threw by hand: from a random edge towards the middle of the screen. */
export function randomLaunch(bounds: Bounds, random: Random = Math.random): Launch {
  const fromLeft = random() < 0.5;
  const x = fromLeft ? bounds.width * 0.1 : bounds.width * 0.9;
  const y = bounds.height * (0.15 + random() * 0.2);
  const toward = Math.atan2(bounds.height * (0.45 + random() * 0.2) - y, bounds.width / 2 - x);
  const speed = 900 + random() * 700;
  return { x, y, vx: Math.cos(toward) * speed, vy: Math.sin(toward) * speed };
}

/** Keeps a thrown speed in a range where the dice both visibly fly and land on screen. */
export function clampLaunch(launch: Launch): Launch {
  const speed = Math.hypot(launch.vx, launch.vy);
  // A drop without a flick still goes somewhere: straight up the screen, like a gentle toss.
  if (speed < 1) return { ...launch, vx: 0, vy: -MIN_THROW_SPEED };
  const wanted = Math.min(MAX_THROW_SPEED, Math.max(MIN_THROW_SPEED, speed));
  return { ...launch, vx: (launch.vx / speed) * wanted, vy: (launch.vy / speed) * wanted };
}

/** Starting positions for `count` dice leaving the same hand: side by side across the throw, each a little different. */
export function startBodies(count: number, launch: Launch, radius: number, random: Random = Math.random): Body[] {
  const speed = Math.hypot(launch.vx, launch.vy);
  const directionX = launch.vx / speed;
  const directionY = launch.vy / speed;
  return Array.from({ length: count }, (_, i) => {
    const across = (i - (count - 1) / 2) * radius * 1.4;
    const turn = (random() - 0.5) * 0.3;
    const faster = speed * (0.85 + random() * 0.3);
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    return {
      x: launch.x - directionY * across,
      y: launch.y + directionX * across,
      vx: (directionX * cos - directionY * sin) * faster,
      vy: (directionX * sin + directionY * cos) * faster,
    };
  });
}

/** Advances every die one step: friction, bouncing off the screen edges, and not sitting on each other. */
export function stepBodies(bodies: Body[], bounds: Bounds, radius: number) {
  const decay = Math.exp(-FRICTION * STEP_SECONDS);
  for (const body of bodies) {
    body.vx *= decay;
    body.vy *= decay;
    body.x += body.vx * STEP_SECONDS;
    body.y += body.vy * STEP_SECONDS;
    if (body.x < radius || body.x > bounds.width - radius) {
      body.x = Math.min(bounds.width - radius, Math.max(radius, body.x));
      body.vx *= -BOUNCE;
    }
    if (body.y < radius || body.y > bounds.height - radius) {
      body.y = Math.min(bounds.height - radius, Math.max(radius, body.y));
      body.vy *= -BOUNCE;
    }
    if (Math.hypot(body.vx, body.vy) < REST_SPEED) body.vx = body.vy = 0;
  }
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i]!;
      const b = bodies[j]!;
      const gap = Math.hypot(b.x - a.x, b.y - a.y);
      const wanted = radius * 2.1;
      if (gap >= wanted) continue;
      // Exactly on top of each other has no direction to push in; any one will do.
      const nx = gap === 0 ? 1 : (b.x - a.x) / gap;
      const ny = gap === 0 ? 0 : (b.y - a.y) / gap;
      const push = (wanted - gap) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
    }
  }
}

/**
 * Plays the whole throw ahead of time and returns where every die is at each step, so drawing it is only a lookup.
 * `frames[step][die]` is a position; the last frame is where the dice come to rest.
 */
export function planThrow(count: number, launch: Launch, bounds: Bounds, radius: number, random: Random = Math.random) {
  const bodies = startBodies(count, clampLaunch(launch), radius, random);
  const frames: { x: number; y: number }[][] = [bodies.map(({ x, y }) => ({ x, y }))];
  for (let step = 0; step < MAX_STEPS; step++) {
    stepBodies(bodies, bounds, radius);
    frames.push(bodies.map(({ x, y }) => ({ x, y })));
    if (bodies.every((b) => b.vx === 0 && b.vy === 0)) break;
  }
  return frames;
}
