export interface Point {
  x: number;
  y: number;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const cross = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);

/**
 * True when the two segments properly cross. Touching at an end point or running along each other does not count,
 * so a token can slide along a wall or stand in a corner without being blocked.
 */
export function segmentsCross(a: Segment, b: Segment): boolean {
  const d1 = cross(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1);
  const d2 = cross(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2);
  const d3 = cross(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1);
  const d4 = cross(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Whether a straight move from `from` to `to` passes through any of the blocking segments. */
export function pathIsBlocked(from: Point, to: Point, blockers: readonly Segment[]): boolean {
  const path = { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
  return blockers.some((wall) => segmentsCross(path, wall));
}
