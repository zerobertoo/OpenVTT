import type { Point, Segment } from "./geometry.ts";

/** Angular step of the sweep that rounds the edge of the radius into a circle. */
const ROUND_STEP = (3 * Math.PI) / 180;
const EPSILON = 1e-4;

/** Distance along the ray `origin + t * (dx, dy)` to the segment, or null when it misses (parallel counts as a miss). */
function rayHit(ox: number, oy: number, dx: number, dy: number, s: Segment): number | null {
  const ex = s.x2 - s.x1;
  const ey = s.y2 - s.y1;
  const denominator = dx * ey - dy * ex;
  if (Math.abs(denominator) < 1e-12) return null;
  const t = ((s.x1 - ox) * ey - (s.y1 - oy) * ex) / denominator;
  const u = ((s.x1 - ox) * dy - (s.y1 - oy) * dx) / denominator;
  return t >= 0 && u >= 0 && u <= 1 ? t : null;
}

/**
 * The area visible from `origin` within `radius`, as a polygon in sweep order. Walls stop sight; only walls near
 * the origin are looked at, so the cost follows what is in reach, not the size of the map.
 */
export function visibilityPolygon(origin: Point, walls: readonly Segment[], radius: number): Point[] {
  const near = walls.filter(
    (w) =>
      Math.max(w.x1, w.x2) >= origin.x - radius &&
      Math.min(w.x1, w.x2) <= origin.x + radius &&
      Math.max(w.y1, w.y2) >= origin.y - radius &&
      Math.min(w.y1, w.y2) <= origin.y + radius,
  );

  const angles: number[] = [];
  for (const w of near)
    for (const [x, y] of [
      [w.x1, w.y1],
      [w.x2, w.y2],
    ] as const) {
      const a = Math.atan2(y - origin.y, x - origin.x);
      angles.push(a - EPSILON, a, a + EPSILON);
    }
  for (let a = -Math.PI; a < Math.PI; a += ROUND_STEP) angles.push(a);
  angles.sort((a, b) => a - b);

  return angles.map((a) => {
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let distance = radius;
    for (const wall of near) {
      const hit = rayHit(origin.x, origin.y, dx, dy, wall);
      if (hit !== null && hit < distance) distance = hit;
    }
    return { x: origin.x + dx * distance, y: origin.y + dy * distance };
  });
}

/** Even-odd test. Points exactly on the edge may fall either way. */
export function pointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
