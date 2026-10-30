/**
 * Hex grid geometry. `size` is the distance between the centers of two neighboring hexes (the scene's cell size),
 * and the hex at axial (0, 0) is centered on the map's top-left corner.
 */
export type HexOrientation = "pointy" | "flat";
type Point = { x: number; y: number };

const SQRT3 = Math.sqrt(3);

export function hexCenter(q: number, r: number, size: number, orientation: HexOrientation): Point {
  return orientation === "pointy"
    ? { x: size * (q + r / 2), y: ((size * SQRT3) / 2) * r }
    : { x: ((size * SQRT3) / 2) * q, y: size * (r + q / 2) };
}

/** Axial coordinates of the hex containing `p`. */
export function hexAt(p: Point, size: number, orientation: HexOrientation): { q: number; r: number } {
  const step = (size * SQRT3) / 2;
  const [q, r] = orientation === "pointy" ? [p.x / size - p.y / step / 2, p.y / step] : [p.x / step, p.y / size - p.x / step / 2];
  // Cube rounding: round all three, then fix the one that moved most so q + r + s stays 0.
  const s = -q - r;
  let [rq, rr, rs] = [Math.round(q), Math.round(r), Math.round(s)];
  const [dq, dr, ds] = [Math.abs(rq - q), Math.abs(rr - r), Math.abs(rs - s)];
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq + 0, r: rr + 0 };
}

export const snapToHex = (p: Point, size: number, orientation: HexOrientation): Point => {
  const { q, r } = hexAt(p, size, orientation);
  return hexCenter(q, r, size, orientation);
};

/** Steps between the hexes under two points. */
export function hexDistance(a: Point, b: Point, size: number, orientation: HexOrientation): number {
  const from = hexAt(a, size, orientation);
  const to = hexAt(b, size, orientation);
  const dq = to.q - from.q;
  const dr = to.r - from.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** Corners of a hex as flat `[x1, y1, ...]`. */
export function hexCorners(center: Point, size: number, orientation: HexOrientation): number[] {
  const radius = size / SQRT3;
  const start = orientation === "pointy" ? 30 : 0;
  return Array.from({ length: 6 }, (_, i) => {
    const angle = ((start + 60 * i) * Math.PI) / 180;
    return [center.x + radius * Math.cos(angle), center.y + radius * Math.sin(angle)];
  }).flat();
}

/** Centers of every hex that touches a `width` × `height` map. */
export function hexCentersIn(width: number, height: number, size: number, orientation: HexOrientation): Point[] {
  const out: Point[] = [];
  const step = (size * SQRT3) / 2;
  const [rows, cols] = orientation === "pointy" ? [height / step, width / size] : [height / size, width / step];
  for (let major = -1; major <= (orientation === "pointy" ? rows : cols) + 1; major++) {
    const shift = Math.floor(major / 2);
    for (let minor = -1 - shift; minor <= (orientation === "pointy" ? cols : rows) + 1 - shift; minor++) {
      const c = orientation === "pointy" ? hexCenter(minor, major, size, orientation) : hexCenter(major, minor, size, orientation);
      if (c.x > -size && c.y > -size && c.x < width + size && c.y < height + size) out.push(c);
    }
  }
  return out;
}

export const hexOrientationOf = (gridType: string): HexOrientation | null =>
  gridType === "hexPointy" ? "pointy" : gridType === "hexFlat" ? "flat" : null;
