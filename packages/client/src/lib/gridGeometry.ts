import { hexDistance, hexOrientationOf, snapToHex } from "./hex";
import { type DiagonalRule, lineCells, type Point } from "./ruler";

/** The part of a scene that grid maths needs. */
export interface GridSpec {
  gridType: string;
  gridSize: number;
}

/**
 * Where the top-left corner of a token ends up after it is dropped. A square grid snaps the corner to the nearest cell
 * corner, a hex grid snaps the token's centre to the nearest hex centre, and no grid leaves the position as it is.
 */
export function snapTokenCorner(grid: GridSpec, tokenSizeInCells: number, corner: Point): Point {
  if (grid.gridType === "square") {
    return { x: Math.round(corner.x / grid.gridSize) * grid.gridSize, y: Math.round(corner.y / grid.gridSize) * grid.gridSize };
  }
  const orientation = hexOrientationOf(grid.gridType);
  if (!orientation) return corner;
  const half = (tokenSizeInCells * grid.gridSize) / 2;
  const center = snapToHex({ x: corner.x + half, y: corner.y + half }, grid.gridSize, orientation);
  return { x: center.x - half, y: center.y - half };
}

/**
 * Distance between two map points in grid cells. The diagonal rules count whole steps, so they only apply on a square
 * grid; a hex grid counts hexes and no grid measures the straight line.
 */
export function rulerDistanceInCells(grid: GridSpec, from: Point, to: Point, rule: DiagonalRule): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (grid.gridType === "square") return lineCells(dx, dy, grid.gridSize, rule);
  const orientation = hexOrientationOf(grid.gridType);
  if (orientation) return hexDistance(from, to, grid.gridSize, orientation);
  return Math.hypot(dx, dy) / grid.gridSize;
}
