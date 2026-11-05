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

/**
 * True when the path goes through a point where walls meet and they continue on both of its sides: a gap-free wall
 * that `segmentsCross` misses, because each piece is only touched at its end. Passing the tip of one wall or the
 * outside of a corner stays allowed, since nothing lies on the far side.
 */
function passesThroughWallJoint(path: Segment, blockers: readonly Segment[]): boolean {
  const lengthSquared = (path.x2 - path.x1) ** 2 + (path.y2 - path.y1) ** 2;
  const sidesAtJoint = new Map<string, Set<number>>();
  const visit = (endX: number, endY: number, otherX: number, otherY: number) => {
    if (cross(path.x1, path.y1, path.x2, path.y2, endX, endY) !== 0) return false;
    const along = (endX - path.x1) * (path.x2 - path.x1) + (endY - path.y1) * (path.y2 - path.y1);
    if (along <= 0 || along >= lengthSquared) return false;
    const side = Math.sign(cross(path.x1, path.y1, path.x2, path.y2, otherX, otherY));
    if (side === 0) return false;
    const key = `${endX},${endY}`;
    const sides = sidesAtJoint.get(key) ?? new Set<number>();
    sidesAtJoint.set(key, sides.add(side));
    return sides.size === 2;
  };
  return blockers.some((wall) => visit(wall.x1, wall.y1, wall.x2, wall.y2) || visit(wall.x2, wall.y2, wall.x1, wall.y1));
}

/** Whether a straight move from `from` to `to` passes through any of the blocking segments. */
export function pathIsBlocked(from: Point, to: Point, blockers: readonly Segment[]): boolean {
  const path = { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
  return blockers.some((wall) => segmentsCross(path, wall)) || passesThroughWallJoint(path, blockers);
}
