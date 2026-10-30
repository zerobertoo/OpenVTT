export interface Size {
  width: number;
  height: number;
}

/** Longest side of the minimap, in CSS pixels. */
export const MINIMAP_MAX_SIDE = 160;

/** The minimap's size: the scene's proportions, with the longest side at `MINIMAP_MAX_SIDE`. */
export function minimapSize(scene: Size): Size {
  const scale = MINIMAP_MAX_SIDE / Math.max(scene.width, scene.height);
  return { width: Math.max(1, Math.round(scene.width * scale)), height: Math.max(1, Math.round(scene.height * scale)) };
}

/** The part of the scene on screen, in scene pixels, for a world container at `position` with `scale`. */
export function visibleArea(view: { x: number; y: number; scale: number }, screen: Size) {
  return { x: -view.x / view.scale, y: -view.y / view.scale, width: screen.width / view.scale, height: screen.height / view.scale };
}

/** Where a click on the minimap points to in the scene, in scene pixels, kept inside the scene. */
export function sceneAt(click: { x: number; y: number }, minimap: Size, scene: Size) {
  const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));
  return {
    x: clamp((click.x / minimap.width) * scene.width, scene.width),
    y: clamp((click.y / minimap.height) * scene.height, scene.height),
  };
}
