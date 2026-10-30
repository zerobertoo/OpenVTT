export type RulerShape = "line" | "circle" | "cone" | "rectangle";

/** How a diagonal step counts on a square grid. */
export type DiagonalRule = "exact" | "alternating" | "simple";

export const RULER_SHAPES: readonly RulerShape[] = ["line", "circle", "cone", "rectangle"];
export const DIAGONAL_RULES: readonly DiagonalRule[] = ["exact", "alternating", "simple"];

export interface Point {
  x: number;
  y: number;
}

/**
 * Distance in grid cells between two offsets, by the table's diagonal rule:
 * `exact` is the straight line, `simple` counts every step as one cell (5-5-5), and
 * `alternating` makes every second diagonal cost two (5-10-5).
 */
export function lineCells(dx: number, dy: number, gridSize: number, rule: DiagonalRule): number {
  const across = Math.abs(dx) / gridSize;
  const down = Math.abs(dy) / gridSize;
  if (rule === "exact") return Math.hypot(across, down);
  const long = Math.max(Math.round(across), Math.round(down));
  const short = Math.min(Math.round(across), Math.round(down));
  return rule === "simple" ? long : long + Math.floor(short / 2);
}

/** A cone is as wide at its far end as it is long, which is how most systems define it. */
export function conePoints(apex: Point, target: Point): [Point, Point, Point] {
  const dx = target.x - apex.x;
  const dy = target.y - apex.y;
  // Half the length, turned a quarter: the far edge runs from one side of the axis to the other.
  const side = { x: -dy / 2, y: dx / 2 };
  return [apex, { x: target.x + side.x, y: target.y + side.y }, { x: target.x - side.x, y: target.y - side.y }];
}
