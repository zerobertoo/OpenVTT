import type { FloorDto, TokenDto } from "@openvtt/shared";
import { type GridSpec, rulerDistanceInCells } from "./gridGeometry";
import type { DiagonalRule, Point, RulerShape } from "./ruler";

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
export function zoomAtCursor(
  view: { scale: number; x: number; y: number },
  cursor: Point,
  wheelDeltaY: number,
  min: number,
  max: number,
): { scale: number; x: number; y: number } {
  const anchor = { x: (cursor.x - view.x) / view.scale, y: (cursor.y - view.y) / view.scale };
  const scale = Math.min(max, Math.max(min, view.scale * Math.exp(-wheelDeltaY * WHEEL_ZOOM_SPEED)));
  return { scale, x: cursor.x - anchor.x * scale, y: cursor.y - anchor.y * scale };
}

/** Backgrounds and token images on screen; their textures are never released from memory. */
export function assetIdsInUse(
  floor: Pick<FloorDto, "assetId"> | null,
  ghostFloor: Pick<FloorDto, "assetId"> | null,
  tokens: Pick<TokenDto, "assetId">[],
): Set<string> {
  return new Set([floor?.assetId, ghostFloor?.assetId, ...tokens.map((token) => token.assetId)].filter((id): id is string => Boolean(id)));
}
