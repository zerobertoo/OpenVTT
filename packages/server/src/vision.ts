import {
  type FloorDto,
  type LightDto,
  type Point,
  pointInPolygon,
  type SceneDto,
  type TokenDto,
  type VisionLightDto,
  visibilityPolygon,
} from "@openvtt/shared";

export interface VisionRegion {
  polygons: Point[][];
  /** The lights that reach the visible area, with the area each one lights. */
  lit: { light: LightDto; polygon: Point[] }[];
  contains: (point: Point) => boolean;
}

/**
 * What a player sees in a scene: for each token they control, the area in line of sight within the scene's vision
 * radius, plus the area reached by every light that one of those areas contains. Walls and closed doors stop sight.
 * ponytail: a light only counts when it lies inside a token's own vision radius; far-off lit rooms stay dark until
 * a token gets close. Extend the sweep radius per light if tables ask for it.
 */
export function visionRegion(scene: SceneDto, floor: FloorDto, controlled: readonly TokenDto[]): VisionRegion {
  const blockers = floor.walls.filter((w) => w.kind === "wall" || !w.open);
  const sight = scene.visionRadius * scene.gridSize;
  const polygons = controlled.map((token) => {
    const half = (token.size * scene.gridSize) / 2;
    return visibilityPolygon({ x: token.x + half, y: token.y + half }, blockers, sight);
  });
  const lit: VisionRegion["lit"] = [];
  for (const light of floor.lights) {
    const position = { x: light.x, y: light.y };
    if (polygons.some((polygon) => pointInPolygon(position, polygon))) {
      // Walls always clip what a player is sent, whatever the light's `shadows`: an unclipped circle would open the
      // fog (and the tokens) behind a wall. The game master's own preview still draws such a light through walls.
      const polygon = visibilityPolygon(position, blockers, light.radius * scene.gridSize);
      polygons.push(polygon);
      lit.push({ light, polygon });
    }
  }
  return { polygons, lit, contains: (point) => polygons.some((polygon) => pointInPolygon(point, polygon)) };
}

/** What goes over the wire for the lights of a region: the pool each one lights, never the light list or the walls. */
export const flattenLights = (region: VisionRegion, gridSize: number): VisionLightDto[] =>
  region.lit.map(({ light, polygon }) => ({
    x: light.x,
    y: light.y,
    radius: light.radius * gridSize,
    intensity: light.intensity,
    color: light.color,
    feather: light.feather,
    polygon: flattenPolygons([polygon])[0]!,
  }));

/** Flat coordinate lists, which is what goes over the wire and into the map's fog mask. */
export const flattenPolygons = (polygons: readonly (readonly Point[])[]): number[][] =>
  polygons.map((polygon) => polygon.flatMap((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]));
