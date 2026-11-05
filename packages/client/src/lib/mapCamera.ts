import type { Point } from "./ruler";

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;
/** How much one press of the zoom keys scales the view. */
export const ZOOM_STEP = 1.25;

interface Size {
  width: number;
  height: number;
}

/** Where the map is: its zoom and the screen position of its top-left corner. */
export interface View {
  scale: number;
  x: number;
  y: number;
}

/** The smallest zoom allowed: a huge map must still fit a small screen, so the floor drops to the fit scale when needed. */
export function minZoomFor(screen: Size, scene: Size | null | undefined): number {
  return scene ? Math.min(MIN_ZOOM, screen.width / scene.width, screen.height / scene.height) : MIN_ZOOM;
}

/** The view that shows the whole map centered on screen, never enlarged past its real size. */
export function fitView(screen: Size, scene: Size): View {
  const scale = Math.min(screen.width / scene.width, screen.height / scene.height, 1);
  return { scale, x: (screen.width - scene.width * scale) / 2, y: (screen.height - scene.height * scale) / 2 };
}

/** Scales the view by `factor` (kept within `[min, max]`) so the map point under the screen point `around` stays put. */
export function zoomAround(view: View, around: Point, factor: number, min: number, max: number): View {
  const anchor = { x: (around.x - view.x) / view.scale, y: (around.y - view.y) / view.scale };
  const scale = Math.min(max, Math.max(min, view.scale * factor));
  return { scale, x: around.x - anchor.x * scale, y: around.y - anchor.y * scale };
}

/** Where the map's top-left corner goes so `point` (a map position) ends up in the middle of the screen. */
export function viewCenteredOn(screen: Size, point: Point, scale: number): Point {
  return { x: screen.width / 2 - point.x * scale, y: screen.height / 2 - point.y * scale };
}
