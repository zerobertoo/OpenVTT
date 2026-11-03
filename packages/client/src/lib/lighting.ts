import { type FloorDto, type SceneDto, type VisionDto, type VisionLightDto, visibilityPolygon } from "@openvtt/shared";

/** The longest side of the shade picture in pixels; bigger maps are drawn smaller and stretched (light edges are soft anyway). */
export const SHADE_MAX_SIDE = 2048;
/** How dark the part of the map nobody can see is. */
export const FOG_ALPHA = 0.94;
/** The game master sees darkness this strong, so the map stays workable; the lighting preview shows the real thing. */
export const GM_DARKNESS_SHARE = 0.5;
/** Width of the soft edge between what a player sees and the fog, in grid cells. */
export const FOG_EDGE_CELLS = 1 / 6;

/** What to paint: darkness over everything, fog outside the visible area (players only) and the light pools. */
export interface ShadePlan {
  /** 0 to 1: how dark the visible, unlit part of the map is. */
  darkness: number;
  /** The visible area of a player; null shows the whole map (the game master, or a scene without vision). */
  fogHoles: number[][] | null;
  pools: VisionLightDto[];
  /** Soft edge of the visible area in map pixels. */
  edge: number;
}

const clamp01 = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

/**
 * Gradient stops `[offset, strength]` of a light from its center (0) to its edge (1): full strength in the bright core,
 * then a linear fade over the feather. Feather 0 keeps full strength up to the edge; 1 fades from the very center.
 */
export function lightStops(feather: number, intensity: number): [number, number][] {
  const core = 1 - clamp01(feather);
  const strength = clamp01(intensity);
  return [
    [0, strength],
    [core, strength],
    [1, 0],
  ];
}

/** `#rrggbb` as `rgba(r, g, b, alpha)`. */
export function rgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${clamp01(alpha)})`;
}

/** A white light only clears the dark; a colored one also tints what it reaches. */
export const isTinted = (color: string) => color.toLowerCase() !== "#ffffff";
/** How strongly a colored light tints, 0 to 0.4. */
export const tintStrength = (intensity: number) => 0.2 * Math.min(2, Math.max(0, intensity));

/**
 * The pools of a floor's lights as the game master sees them, computed from the walls the game master has.
 * ponytail: recomputed whenever lights, walls or doors change; a visibility sweep per light, fine for hundreds.
 */
export function poolsOf(scene: Pick<SceneDto, "gridSize">, floor: FloorDto): VisionLightDto[] {
  const blockers = floor.walls.filter((w) => w.kind === "wall" || !w.open);
  return floor.lights
    .filter((light) => light.radius > 0)
    .map((light) => {
      const radius = light.radius * scene.gridSize;
      const polygon = visibilityPolygon({ x: light.x, y: light.y }, light.shadows ? blockers : [], radius);
      return {
        x: light.x,
        y: light.y,
        radius,
        intensity: light.intensity,
        color: light.color,
        feather: light.feather,
        polygon: polygon.flatMap((p) => [p.x, p.y]),
      };
    });
}

/** Decides what the shade of the map looks like; null when nothing needs drawing. */
export function planShade(scene: SceneDto, floor: FloorDto, vision: VisionDto | null, preview: boolean): ShadePlan | null {
  const base = scene.bakedLighting ? 0 : 1 - scene.ambientLight;
  const sees = vision !== null && vision.sceneId === scene.id;
  const darkness = sees ? base : base * (preview ? 1 : GM_DARKNESS_SHARE);
  if (!sees && darkness <= 0) return null;
  if (sees && darkness <= 0 && vision.polygons.length === 0) return null;
  return {
    darkness,
    fogHoles: sees ? vision.polygons : null,
    pools: darkness <= 0 ? [] : sees ? vision.lights : poolsOf(scene, floor),
    edge: scene.gridSize * FOG_EDGE_CELLS,
  };
}

/** The size of the shade picture for a map, and how many of its pixels cover one map pixel. */
export function shadeSize(width: number, height: number) {
  const scale = Math.min(1, SHADE_MAX_SIDE / Math.max(width, height));
  return { scale, width: Math.max(1, Math.ceil(width * scale)), height: Math.max(1, Math.ceil(height * scale)) };
}

function tracePolygon(ctx: CanvasRenderingContext2D, polygon: readonly number[]) {
  ctx.beginPath();
  ctx.moveTo(polygon[0]!, polygon[1]!);
  for (let i = 2; i < polygon.length; i += 2) ctx.lineTo(polygon[i]!, polygon[i + 1]!);
  ctx.closePath();
}

/**
 * Paints the plan onto a canvas as black with alpha: the more opaque a pixel, the darker the map under it. Light pools
 * erase the darkness with their gradient and, when colored, tint what they reach.
 */
export function paintShade(ctx: CanvasRenderingContext2D, plan: ShadePlan, mapWidth: number, mapHeight: number, scale: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  if (plan.fogHoles) {
    ctx.fillStyle = `rgba(0, 0, 0, ${FOG_ALPHA})`;
    ctx.fillRect(0, 0, mapWidth, mapHeight);
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#000";
    // ponytail: a blur on the canvas softens the edge; Safari has no canvas filter and keeps a hard edge there.
    if ("filter" in ctx) ctx.filter = `blur(${plan.edge * scale}px)`;
    for (const hole of plan.fogHoles) {
      if (hole.length < 6) continue;
      tracePolygon(ctx, hole);
      ctx.fill();
    }
    if ("filter" in ctx) ctx.filter = "none";
    if (plan.darkness > 0) {
      // Behind what is left: the seen part of the map is dark too, the fog stays as it is.
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = `rgba(0, 0, 0, ${plan.darkness})`;
      ctx.fillRect(0, 0, mapWidth, mapHeight);
    }
  } else {
    ctx.fillStyle = `rgba(0, 0, 0, ${plan.darkness})`;
    ctx.fillRect(0, 0, mapWidth, mapHeight);
  }

  for (const pool of plan.pools) {
    if (pool.radius <= 0 || pool.polygon.length < 6) continue;
    ctx.save();
    tracePolygon(ctx, pool.polygon);
    ctx.clip();
    ctx.globalCompositeOperation = "destination-out";
    const clear = ctx.createRadialGradient(pool.x, pool.y, 0, pool.x, pool.y, pool.radius);
    for (const [offset, strength] of lightStops(pool.feather, pool.intensity)) clear.addColorStop(offset, `rgba(0, 0, 0, ${strength})`);
    ctx.fillStyle = clear;
    ctx.fillRect(pool.x - pool.radius, pool.y - pool.radius, pool.radius * 2, pool.radius * 2);
    if (isTinted(pool.color)) {
      ctx.globalCompositeOperation = "source-over";
      const glow = ctx.createRadialGradient(pool.x, pool.y, 0, pool.x, pool.y, pool.radius);
      const tint = tintStrength(pool.intensity);
      for (const [offset, strength] of lightStops(pool.feather, 1)) glow.addColorStop(offset, rgba(pool.color, strength * tint));
      ctx.fillStyle = glow;
      ctx.fillRect(pool.x - pool.radius, pool.y - pool.radius, pool.radius * 2, pool.radius * 2);
    }
    ctx.restore();
  }
  ctx.globalCompositeOperation = "source-over";
}
