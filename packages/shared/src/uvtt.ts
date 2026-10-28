import { z } from "zod";

/** Hard caps so a hostile or broken file cannot make the importer allocate without bound. */
export const UVTT_MAX_WALL_SEGMENTS = 20000;
export const UVTT_MAX_LIGHTS = 1000;
export const UVTT_MAX_DOORS = 2000;

export interface ImportedWall {
  /** Segment end points in map pixels. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ImportedDoor extends ImportedWall {
  closed: boolean;
}

export interface ImportedLight {
  /** Position in map pixels. */
  x: number;
  y: number;
  /** Radius in grid cells. */
  radius: number;
  intensity: number;
  /** `#rrggbb`. */
  color: string;
  shadows: boolean;
}

export type UvttWarning = "no_walls" | "no_image" | "truncated" | "grid_offset";

export interface ImportedUvtt {
  gridSize: number;
  /** Map size in grid cells. */
  columns: number;
  rows: number;
  /** Map size in pixels (`columns * gridSize`). */
  width: number;
  height: number;
  /** Embedded picture, if the file carried one (video exports do not). */
  image: { mime: "image/png" | "image/webp"; base64: string } | null;
  walls: ImportedWall[];
  doors: ImportedDoor[];
  lights: ImportedLight[];
  bakedLighting: boolean;
  warnings: UvttWarning[];
}

export class UvttError extends Error {
  constructor(readonly code: "not_json" | "not_uvtt" | "bad_grid") {
    super(code);
  }
}

const num = z.number().finite();
const point = z.object({ x: num, y: num });

const uvttSchema = z.object({
  resolution: z.object({
    map_origin: point.optional(),
    map_size: point,
    pixels_per_grid: num,
  }),
  line_of_sight: z.array(z.array(point)).optional(),
  objects_line_of_sight: z.array(z.array(point)).optional(),
  portals: z.array(z.object({ bounds: z.array(point).min(2), closed: z.boolean().optional() }).passthrough()).optional(),
  lights: z
    .array(
      z.object({
        position: point,
        range: num,
        intensity: num.optional(),
        color: z.string().optional(),
        shadows: z.boolean().optional(),
      }),
    )
    .optional(),
  environment: z.object({ baked_lighting: z.boolean().optional() }).passthrough().optional(),
  image: z.string().optional(),
});

/** `ffFFE5BF` (alpha first, as Dungeon Alchemist writes it), `FFE5BF` or `#FFE5BF` to `#ffe5bf`. */
export function parseUvttColor(raw: string | undefined): string {
  const hex = (raw ?? "").replace(/^#/, "");
  if (/^[0-9a-f]{8}$/i.test(hex)) return `#${hex.slice(2).toLowerCase()}`;
  if (/^[0-9a-f]{6}$/i.test(hex)) return `#${hex.toLowerCase()}`;
  return "#ffffff";
}

/** Sniffs the picture type from the first base64 characters; only PNG and WebP are part of the format. */
function embeddedImage(base64: string | undefined): ImportedUvtt["image"] {
  if (!base64) return null;
  let head: string;
  try {
    head = atob(base64.slice(0, 16)); // 16 base64 chars = 12 bytes
  } catch {
    return null;
  }
  if (head.startsWith("\x89PNG")) return { mime: "image/png", base64 };
  if (head.startsWith("RIFF") && head.slice(8, 12) === "WEBP") return { mime: "image/webp", base64 };
  return null;
}

/**
 * Reads a Universal VTT file (`.dd2vtt` / `.uvtt`) from its JSON text. All distances in the file are grid cells,
 * so everything is converted to map pixels here. Anything outside the map is clamped; nothing is trusted.
 */
export function parseUvtt(text: string): ImportedUvtt {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new UvttError("not_json");
  }
  const parsed = uvttSchema.safeParse(json);
  if (!parsed.success) throw new UvttError("not_uvtt");
  const file = parsed.data;

  const gridSize = Math.round(file.resolution.pixels_per_grid);
  const columns = Math.round(file.resolution.map_size.x);
  const rows = Math.round(file.resolution.map_size.y);
  if (gridSize < 10 || gridSize > 500 || columns < 1 || rows < 1) throw new UvttError("bad_grid");
  const width = columns * gridSize;
  const height = rows * gridSize;

  const warnings: UvttWarning[] = [];
  const clampX = (cells: number) => Math.min(Math.max(cells * gridSize, 0), width);
  const clampY = (cells: number) => Math.min(Math.max(cells * gridSize, 0), height);

  const walls: ImportedWall[] = [];
  for (const line of [...(file.line_of_sight ?? []), ...(file.objects_line_of_sight ?? [])]) {
    for (let i = 1; i < line.length; i++) {
      if (walls.length >= UVTT_MAX_WALL_SEGMENTS) {
        warnings.push("truncated");
        break;
      }
      const a = line[i - 1];
      const b = line[i];
      if (!a || !b) continue;
      walls.push({ x1: clampX(a.x), y1: clampY(a.y), x2: clampX(b.x), y2: clampY(b.y) });
    }
  }

  const doors: ImportedDoor[] = [];
  for (const portal of file.portals ?? []) {
    if (doors.length >= UVTT_MAX_DOORS) {
      warnings.push("truncated");
      break;
    }
    const [a, b] = portal.bounds;
    if (!a || !b) continue;
    doors.push({ x1: clampX(a.x), y1: clampY(a.y), x2: clampX(b.x), y2: clampY(b.y), closed: portal.closed ?? true });
  }

  const lights: ImportedLight[] = [];
  for (const light of file.lights ?? []) {
    if (lights.length >= UVTT_MAX_LIGHTS) {
      warnings.push("truncated");
      break;
    }
    lights.push({
      x: clampX(light.position.x),
      y: clampY(light.position.y),
      radius: Math.min(Math.max(light.range, 0), 200),
      intensity: Math.min(Math.max(light.intensity ?? 1, 0), 10),
      color: parseUvttColor(light.color),
      shadows: light.shadows ?? true,
    });
  }

  const image = embeddedImage(file.image);
  if (walls.length === 0 && doors.length === 0) warnings.push("no_walls");
  if (!image) warnings.push("no_image");

  return {
    gridSize,
    columns,
    rows,
    width,
    height,
    image,
    walls,
    doors,
    lights,
    bakedLighting: file.environment?.baked_lighting ?? false,
    warnings: [...new Set(warnings)],
  };
}

const toCells = (pixels: number, gridSize: number) => Math.round((pixels / gridSize) * 1e4) / 1e4;
const uvttColor = (hex: string) => `ff${hex.replace(/^#/, "")}`;

/** The scene fields `buildUvtt` needs; a `SceneDto` satisfies it. */
export interface UvttSource {
  width: number;
  height: number;
  gridSize: number;
  bakedLighting: boolean;
  walls: readonly { x1: number; y1: number; x2: number; y2: number; kind: "wall" | "door"; open: boolean }[];
  lights: readonly { x: number; y: number; radius: number; intensity: number; color: string; shadows: boolean }[];
}

/**
 * Builds a Universal VTT document from a scene so the map can leave as easily as it arrived. Distances are
 * written in grid cells as the format asks. `image` is the base64 picture, or an empty string for videos
 * (Dungeon Alchemist does the same: the video travels as a sibling file).
 */
export function buildUvtt(scene: UvttSource, image: string) {
  const cell = (px: number) => toCells(px, scene.gridSize);
  return {
    format: 0.3,
    software: "OpenVTT",
    resolution: {
      map_origin: { x: 0, y: 0 },
      map_size: { x: cell(scene.width), y: cell(scene.height) },
      pixels_per_grid: scene.gridSize,
    },
    line_of_sight: scene.walls
      .filter((w) => w.kind === "wall")
      .map((w) => [
        { x: cell(w.x1), y: cell(w.y1) },
        { x: cell(w.x2), y: cell(w.y2) },
      ]),
    portals: scene.walls
      .filter((w) => w.kind === "door")
      .map((w) => ({
        position: { x: cell((w.x1 + w.x2) / 2), y: cell((w.y1 + w.y2) / 2) },
        bounds: [
          { x: cell(w.x1), y: cell(w.y1) },
          { x: cell(w.x2), y: cell(w.y2) },
        ],
        rotation: Math.atan2(w.y2 - w.y1, w.x2 - w.x1),
        closed: !w.open,
        freestanding: false,
      })),
    lights: scene.lights.map((l) => ({
      position: { x: cell(l.x), y: cell(l.y) },
      range: l.radius,
      intensity: l.intensity,
      color: uvttColor(l.color),
      shadows: l.shadows,
    })),
    environment: { baked_lighting: scene.bakedLighting, ambient_light: "ffffffff" },
    image,
  };
}
