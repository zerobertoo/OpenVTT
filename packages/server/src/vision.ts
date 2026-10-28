import { type Point, pointInPolygon, type SceneDto, type TokenDto, visibilityPolygon } from "@openvtt/shared";

export interface VisionRegion {
  polygons: Point[][];
  contains: (point: Point) => boolean;
}

/**
 * What a player sees in a scene: for each token they control, the area in line of sight within the scene's vision
 * radius, plus the area reached by every light that one of those areas contains. Walls and closed doors stop sight.
 * ponytail: a light only counts when it lies inside a token's own vision radius; far-off lit rooms stay dark until
 * a token gets close. Extend the sweep radius per light if tables ask for it.
 */
export function visionRegion(scene: SceneDto, controlled: readonly TokenDto[]): VisionRegion {
  const blockers = scene.walls.filter((w) => w.kind === "wall" || !w.open);
  const sight = scene.visionRadius * scene.gridSize;
  const polygons = controlled.map((token) => {
    const half = (token.size * scene.gridSize) / 2;
    return visibilityPolygon({ x: token.x + half, y: token.y + half }, blockers, sight);
  });
  for (const light of scene.lights) {
    const position = { x: light.x, y: light.y };
    if (polygons.some((polygon) => pointInPolygon(position, polygon))) {
      polygons.push(visibilityPolygon(position, blockers, light.radius * scene.gridSize));
    }
  }
  return { polygons, contains: (point) => polygons.some((polygon) => pointInPolygon(point, polygon)) };
}

/** Flat coordinate lists, which is what goes over the wire and into the map's fog mask. */
export const flattenPolygons = (polygons: readonly (readonly Point[])[]): number[][] =>
  polygons.map((polygon) => polygon.flatMap((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]));
