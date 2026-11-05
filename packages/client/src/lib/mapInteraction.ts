import type { FloorDto, TokenDto } from "@openvtt/shared";
import { type GridSpec, rulerDistanceInCells, snapTokenCorner } from "./gridGeometry";
import { type View, zoomAround } from "./mapCamera";
import type { DiagonalRule, Point, RulerShape } from "./ruler";
import type { Move } from "./tableActions";

/** Most points a free-hand stroke may hold (two numbers each); past it the server would refuse the drawing. */
const MAX_SKETCH_NUMBERS = 3998;
/** A free-hand point is added only this many screen pixels away from the last one. */
const SKETCH_POINT_SPACING_PX = 4;
/** A stroke shorter than this on screen is a stray click, not a drawing. */
const MIN_STROKE_PX = 3;
/** How fast the mouse wheel zooms: the scale is multiplied by `exp(-deltaY * WHEEL_ZOOM_SPEED)`. */
const WHEEL_ZOOM_SPEED = 0.0015;

/** The ids of the tokens of a scene whose centre falls inside the box between two map points (edges count). */
export function tokensInBox(
  tokens: Pick<TokenDto, "id" | "sceneId" | "x" | "y" | "size">[],
  scene: { id: string; gridSize: number },
  from: Point,
  to: Point,
): string[] {
  const [left, right] = [Math.min(from.x, to.x), Math.max(from.x, to.x)];
  const [top, bottom] = [Math.min(from.y, to.y), Math.max(from.y, to.y)];
  return tokens
    .filter((token) => {
      if (token.sceneId !== scene.id) return false;
      const half = (token.size * scene.gridSize) / 2;
      return token.x + half >= left && token.x + half <= right && token.y + half >= top && token.y + half <= bottom;
    })
    .map((token) => token.id);
}

/** The text next to the ruler: the distance for a line, circle or cone, both sides for a rectangle. */
export function rulerReadout(
  shape: RulerShape,
  start: Point,
  end: Point,
  scene: GridSpec | null,
  diagonalRule: DiagonalRule,
  formatDistance: (cells: number) => string,
): string {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const cellsOf = (pixels: number) => (scene ? pixels / scene.gridSize : 0);
  if (shape === "circle" || shape === "cone") return formatDistance(cellsOf(Math.hypot(dx, dy)));
  if (shape === "rectangle") return `${formatDistance(cellsOf(Math.abs(dx)))} × ${formatDistance(cellsOf(Math.abs(dy)))}`;
  return formatDistance(scene ? rulerDistanceInCells(scene, start, end, diagonalRule) : 0);
}

/**
 * The points of the mark being drawn after the pointer moved to `point`. A free-hand stroke gets a point every few
 * screen pixels (up to the server's limit); a shape keeps only its start and the latest point.
 */
export function extendSketch(sketch: number[], kind: string, point: Point, zoom: number): number[] {
  if (kind !== "free") {
    const [startX = point.x, startY = point.y] = sketch;
    return [startX, startY, point.x, point.y];
  }
  const [lastX = point.x, lastY = point.y] = sketch.slice(-2);
  const farEnough = Math.hypot(point.x - lastX, point.y - lastY) * zoom >= SKETCH_POINT_SPACING_PX;
  return farEnough && sketch.length < MAX_SKETCH_NUMBERS ? [...sketch, point.x, point.y] : sketch;
}

/** True when a finished mark spans enough screen pixels, from its first point to its last, to be kept. */
export function isDeliberateStroke(points: number[], zoom: number): boolean {
  if (points.length < 4) return false;
  const [startX = 0, startY = 0] = points;
  const [endX = 0, endY = 0] = points.slice(-2);
  return Math.hypot(endX - startX, endY - startY) * zoom >= MIN_STROKE_PX;
}

/** The view after a wheel turn: zoomed around the cursor so the map point under it stays put, within `[min, max]`. */
export function zoomAtCursor(view: View, cursor: Point, wheelDeltaY: number, min: number, max: number): View {
  return zoomAround(view, cursor, Math.exp(-wheelDeltaY * WHEEL_ZOOM_SPEED), min, max);
}

/** Backgrounds and token images on screen; their textures are never released from memory. */
export function assetIdsInUse(
  floor: Pick<FloorDto, "assetId"> | null,
  ghostFloor: Pick<FloorDto, "assetId"> | null,
  tokens: Pick<TokenDto, "assetId">[],
): Set<string> {
  return new Set([floor?.assetId, ghostFloor?.assetId, ...tokens.map((token) => token.assetId)].filter((id): id is string => Boolean(id)));
}

/** Where the centre of a token's picture sits on the map: its top-left corner plus half its size. */
export function tokenCenter(token: Pick<TokenDto, "x" | "y" | "size">, gridSize: number): Point {
  const half = (token.size * gridSize) / 2;
  return { x: token.x + half, y: token.y + half };
}

/** Where a dragged token's picture is drawn while the pointer has moved by `delta` from where the drag began. */
export function draggedCenter(token: Pick<TokenDto, "x" | "y" | "size">, delta: Point, gridSize: number): Point {
  const center = tokenCenter(token, gridSize);
  return { x: center.x + delta.x, y: center.y + delta.y };
}

/**
 * Where a token lands when dropped with its picture centred on `center`: the corner snapped to the grid, and the
 * move to record for undo, or null when it ended where it started.
 */
export function dropToken(
  grid: GridSpec,
  token: Pick<TokenDto, "id" | "x" | "y" | "size">,
  center: Point,
): { corner: Point; move: Move | null } {
  const half = (token.size * grid.gridSize) / 2;
  const corner = snapTokenCorner(grid, token.size, { x: center.x - half, y: center.y - half });
  const moved = corner.x !== token.x || corner.y !== token.y;
  return { corner, move: moved ? { tokenId: token.id, from: { x: token.x, y: token.y }, to: corner } : null };
}
