import type { DrawingDto } from "@openvtt/shared";

type Point = { x: number; y: number };

function distanceToSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

const pointsOf = (flat: number[]): Point[] => {
  const out: Point[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push({ x: flat[i]!, y: flat[i + 1]! });
  return out;
};

/** How far `p` is from the outline of a drawing (texts and pins count as a point). */
export function distanceToDrawing(drawing: Pick<DrawingDto, "kind" | "points">, p: Point): number {
  const pts = pointsOf(drawing.points);
  const [a, b] = [pts[0]!, pts[1] ?? pts[0]!];
  switch (drawing.kind) {
    case "rect": {
      const corners = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }];
      return Math.min(...corners.map((c, i) => distanceToSegment(p, c, corners[(i + 1) % 4]!)));
    }
    case "circle":
      return Math.abs(Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(b.x - a.x, b.y - a.y));
    case "text":
    case "note":
      return Math.hypot(p.x - a.x, p.y - a.y);
    default:
      return pts.length === 1
        ? Math.hypot(p.x - a.x, p.y - a.y)
        : Math.min(...pts.slice(1).map((q, i) => distanceToSegment(p, pts[i]!, q)));
  }
}

/** The topmost drawing within `tolerance` pixels of `p`. */
export function drawingAt<T extends Pick<DrawingDto, "kind" | "points">>(drawings: T[], p: Point, tolerance: number): T | null {
  for (let i = drawings.length - 1; i >= 0; i--) if (distanceToDrawing(drawings[i]!, p) <= tolerance) return drawings[i]!;
  return null;
}

/** The two short strokes of an arrow head at `to`, as flat line endpoints. */
export function arrowHead(from: Point, to: Point, length: number): [Point, Point] {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const wing = (offset: number) => ({ x: to.x - length * Math.cos(angle + offset), y: to.y - length * Math.sin(angle + offset) });
  return [wing(Math.PI / 7), wing(-Math.PI / 7)];
}
