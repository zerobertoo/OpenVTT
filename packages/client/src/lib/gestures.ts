export interface Point {
  x: number;
  y: number;
}

/** Position and scale of the map layer inside the screen. */
export interface MapTransform {
  scale: number;
  x: number;
  y: number;
}

export interface TwoFingerState {
  center: Point;
  /** Distance between the two fingers. */
  distance: number;
}

/** Midpoint and spread of two touches. */
export function twoFingerState(a: Point, b: Point): TwoFingerState {
  return { center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(a.x - b.x, a.y - b.y) };
}

/**
 * Moves from one two-finger state to the next: spreading zooms, moving both fingers pans.
 * The map point under the fingers' midpoint stays under it, so the gesture feels anchored.
 */
export function applyTwoFingerGesture(
  view: MapTransform,
  from: TwoFingerState,
  to: TwoFingerState,
  minScale: number,
  maxScale: number,
): MapTransform {
  // Fingers that start almost on top of each other would make the ratio explode.
  const ratio = from.distance > 1 ? to.distance / from.distance : 1;
  const scale = Math.min(maxScale, Math.max(minScale, view.scale * ratio));
  const anchor = { x: (from.center.x - view.x) / view.scale, y: (from.center.y - view.y) / view.scale };
  return { scale, x: to.center.x - anchor.x * scale, y: to.center.y - anchor.y * scale };
}
