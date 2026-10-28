import { z } from "zod";
import {
  type ImportedDoor,
  type ImportedLight,
  type ImportedUvtt,
  type ImportedWall,
  UVTT_MAX_DOORS,
  UVTT_MAX_LIGHTS,
  UVTT_MAX_WALL_SEGMENTS,
  UvttError,
  type UvttWarning,
} from "./uvtt.ts";

/** A map read from a Foundry-style scene file: the same data as a Universal VTT file, plus the distance per cell. */
export interface ImportedFoundry extends ImportedUvtt {
  name: string | null;
  gridDistance: number;
  distanceUnit: string;
}

const num = z.number().finite();

// Foundry's public scene shape: walls are `c: [x0, y0, x1, y1]` in pixels, lights sit at `x`, `y` in pixels with
// radii in distance units. Dungeon Alchemist writes the light radii at the top level, Foundry itself under `config`.
const foundrySchema = z.object({
  name: z.string().optional(),
  width: num,
  height: num,
  grid: z.union([num, z.object({ size: num, distance: num.optional(), units: z.string().optional() })]),
  shiftX: num.optional(),
  shiftY: num.optional(),
  gridDistance: num.optional(),
  gridUnits: z.string().optional(),
  walls: z
    .array(
      z.object({
        c: z.array(num).length(4),
        door: num.optional(),
        ds: num.optional(),
        move: num.optional(),
        sight: num.optional(),
      }),
    )
    .optional(),
  lights: z
    .array(
      z.object({
        x: num,
        y: num,
        dim: num.optional(),
        bright: num.optional(),
        tintColor: z.string().nullable().optional(),
        tintAlpha: num.optional(),
        config: z
          .object({ dim: num.optional(), bright: num.optional(), color: z.string().nullable().optional(), alpha: num.optional() })
          .optional(),
      }),
    )
    .optional(),
});

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Reads a Foundry-style scene JSON (the file next to the picture in Dungeon Alchemist's Foundry export).
 * Pixels stay pixels; light radii are converted from distance units to grid cells. Nothing is trusted.
 */
export function parseFoundryScene(text: string): ImportedFoundry {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new UvttError("not_json");
  }
  const parsed = foundrySchema.safeParse(json);
  if (!parsed.success) throw new UvttError("not_uvtt");
  const file = parsed.data;

  const gridSize = Math.round(typeof file.grid === "number" ? file.grid : file.grid.size);
  const width = Math.round(file.width);
  const height = Math.round(file.height);
  if (gridSize < 10 || gridSize > 500 || width < 1 || height < 1 || width > 16384 || height > 16384) throw new UvttError("bad_grid");
  const gridDistance = (typeof file.grid === "object" ? file.grid.distance : file.gridDistance) ?? 5;
  const distanceUnit = ((typeof file.grid === "object" ? file.grid.units : file.gridUnits) ?? "ft").slice(0, 10);

  const warnings: UvttWarning[] = [];
  const clampX = (px: number) => Math.min(Math.max(px, 0), width);
  const clampY = (px: number) => Math.min(Math.max(px, 0), height);
  if (file.shiftX || file.shiftY) warnings.push("grid_offset");

  const walls: ImportedWall[] = [];
  const doors: ImportedDoor[] = [];
  for (const wall of file.walls ?? []) {
    // 0 means "does not restrict"; a missing field is the default, which does.
    if (wall.move === 0 && wall.sight === 0) continue;
    const [x1, y1, x2, y2] = wall.c as [number, number, number, number];
    const segment = { x1: clampX(x1), y1: clampY(y1), x2: clampX(x2), y2: clampY(y2) };
    if ((wall.door ?? 0) > 0) {
      if (doors.length >= UVTT_MAX_DOORS) warnings.push("truncated");
      else doors.push({ ...segment, closed: wall.ds !== 1 });
    } else if (walls.length >= UVTT_MAX_WALL_SEGMENTS) warnings.push("truncated");
    else walls.push(segment);
  }

  const lights: ImportedLight[] = [];
  for (const light of file.lights ?? []) {
    if (lights.length >= UVTT_MAX_LIGHTS) {
      warnings.push("truncated");
      break;
    }
    const dim = light.dim ?? light.config?.dim ?? light.bright ?? light.config?.bright ?? 0;
    const tint = light.tintColor ?? light.config?.color;
    const tinted = (light.tintAlpha ?? light.config?.alpha ?? 0) > 0 && tint && HEX.test(tint);
    lights.push({
      x: clampX(light.x),
      y: clampY(light.y),
      radius: Math.min(Math.max(dim / gridDistance, 0), 200),
      intensity: 1,
      color: tinted ? tint.toLowerCase() : "#ffffff",
      shadows: true,
    });
  }

  if (walls.length === 0 && doors.length === 0) warnings.push("no_walls");
  warnings.push("no_image");

  return {
    name: file.name?.trim() || null,
    gridSize,
    columns: Math.round(width / gridSize),
    rows: Math.round(height / gridSize),
    width,
    height,
    image: null,
    walls,
    doors,
    lights,
    bakedLighting: false,
    gridDistance,
    distanceUnit,
    warnings: [...new Set(warnings)],
  };
}
