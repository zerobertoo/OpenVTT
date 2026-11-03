import { randomUUID } from "node:crypto";
import {
  type createSceneSchema,
  type DrawingDto,
  type FloorDto,
  type floorInputSchema,
  floorOf,
  type LightDto,
  MAX_FLOORS,
  type SceneDto,
  type updateFloorSchema,
  type updateSceneSchema,
  type WallDto,
} from "@openvtt/shared";
import type { z } from "zod";
import type { AssetService } from "./assets.ts";
import { type Db, transaction } from "./db.ts";
import { AppError } from "./errors.ts";

interface SceneRow {
  id: string;
  world_id: string;
  name: string;
  width: number;
  height: number;
  grid_type: "square" | "none";
  grid_hex: "pointy" | "flat" | null;
  grid_size: number;
  grid_distance: number;
  distance_unit: string;
  baked_lighting: number;
  ambient_light: number;
  table_floor_id: string;
  vision_enabled: number;
  vision_radius: number;
  locked_layers: string;
}

interface FloorRow {
  id: string;
  scene_id: string;
  name: string;
  position: number;
  asset_id: string | null;
  asset_mime: string | null;
}

interface WallRow {
  id: string;
  scene_id: string;
  floor_id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: "wall" | "door";
  open: number;
}

interface LightRow {
  id: string;
  scene_id: string;
  floor_id: string;
  x: number;
  y: number;
  radius: number;
  intensity: number;
  color: string;
  shadows: number;
  feather: number;
}

interface DrawingRow {
  id: string;
  scene_id: string;
  floor_id: string;
  author_id: string | null;
  kind: DrawingDto["kind"];
  layer: DrawingDto["layer"];
  points: string;
  color: string;
  text: string;
}

const toWall = (r: WallRow): WallDto => ({ id: r.id, x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2, kind: r.kind, open: r.open === 1 });
const toLight = (r: LightRow): LightDto => ({
  id: r.id,
  x: r.x,
  y: r.y,
  radius: r.radius,
  intensity: r.intensity,
  color: r.color,
  shadows: r.shadows === 1,
  feather: r.feather,
});

export const toDrawing = (r: DrawingRow): DrawingDto => ({
  id: r.id,
  authorId: r.author_id,
  kind: r.kind,
  layer: r.layer,
  points: JSON.parse(r.points) as number[],
  color: r.color,
  text: r.text,
});

const toFloor = (r: FloorRow, walls: WallDto[], lights: LightDto[], drawings: DrawingDto[]): FloorDto => ({
  id: r.id,
  name: r.name,
  assetId: r.asset_id,
  assetKind: r.asset_mime === null ? null : r.asset_mime.startsWith("video/") ? "video" : "image",
  walls,
  lights,
  drawings,
});

const toDto = (r: SceneRow, floors: FloorDto[]): SceneDto => ({
  id: r.id,
  name: r.name,
  width: r.width,
  height: r.height,
  gridType: r.grid_hex === "pointy" ? "hexPointy" : r.grid_hex === "flat" ? "hexFlat" : r.grid_type,
  gridSize: r.grid_size,
  gridDistance: r.grid_distance,
  distanceUnit: r.distance_unit,
  bakedLighting: r.baked_lighting === 1,
  ambientLight: r.ambient_light,
  floors,
  tableFloorId: r.table_floor_id,
  visionEnabled: r.vision_enabled === 1,
  visionRadius: r.vision_radius,
  lockedLayers: JSON.parse(r.locked_layers) as SceneDto["lockedLayers"],
});

/** What a player may see of a floor: walls, lights and the game master's drawing layer stay with the game master. */
export const withoutHiddenFloorData = (floor: FloorDto): FloorDto => ({
  ...floor,
  walls: [],
  lights: [],
  drawings: floor.drawings.filter((d) => d.layer !== "gm"),
});

/**
 * A scene as one viewer may receive it. A player gets only the floor they are on (never the other floors, their
 * names or backgrounds) and none of the game master's map data; the game master gets everything.
 */
export function sceneForViewer(scene: SceneDto, isGm: boolean, floorId: string): SceneDto {
  if (isGm) return scene;
  const floor = floorOf(scene, floorId);
  return { ...scene, floors: [withoutHiddenFloorData(floor)], tableFloorId: floor.id };
}

const storedGridType = (gridType: SceneDto["gridType"]) => (gridType === "none" ? "none" : "square");
const storedHex = (gridType: SceneDto["gridType"]) => (gridType === "hexPointy" ? "pointy" : gridType === "hexFlat" ? "flat" : null);

type FloorInput = z.infer<typeof floorInputSchema>;

export class SceneService {
  constructor(
    private db: Db,
    private assets: AssetService,
  ) {}

  private hydrate(rows: SceneRow[]): SceneDto[] {
    if (rows.length === 0) return [];
    const marks = rows.map(() => "?").join(",");
    const ids = rows.map((r) => r.id);
    const floors = this.db
      .prepare(
        `SELECT floors.*, assets.mime AS asset_mime FROM floors LEFT JOIN assets ON assets.id = floors.asset_id
         WHERE floors.scene_id IN (${marks}) ORDER BY floors.position, floors.rowid`,
      )
      .all(...ids) as unknown as FloorRow[];
    const walls = this.db.prepare(`SELECT * FROM walls WHERE scene_id IN (${marks}) ORDER BY rowid`).all(...ids) as unknown as WallRow[];
    const lights = this.db.prepare(`SELECT * FROM lights WHERE scene_id IN (${marks}) ORDER BY rowid`).all(...ids) as unknown as LightRow[];
    const drawings = this.db
      .prepare(`SELECT * FROM drawings WHERE scene_id IN (${marks}) ORDER BY rowid`)
      .all(...ids) as unknown as DrawingRow[];
    return rows.map((r) =>
      toDto(
        r,
        floors
          .filter((f) => f.scene_id === r.id)
          .map((f) =>
            toFloor(
              f,
              walls.filter((w) => w.floor_id === f.id).map(toWall),
              lights.filter((l) => l.floor_id === f.id).map(toLight),
              drawings.filter((d) => d.floor_id === f.id).map(toDrawing),
            ),
          ),
      ),
    );
  }

  list(worldId: string): SceneDto[] {
    const rows = this.db.prepare("SELECT * FROM scenes WHERE world_id = ? ORDER BY created_at, id").all(worldId);
    return this.hydrate(rows as unknown as SceneRow[]);
  }

  worldIdOf(sceneId: string): string | null {
    const row = this.db.prepare("SELECT world_id FROM scenes WHERE id = ?").get(sceneId) as { world_id: string } | undefined;
    return row?.world_id ?? null;
  }

  get(sceneId: string): SceneDto | null {
    const row = this.db.prepare("SELECT * FROM scenes WHERE id = ?").get(sceneId) as SceneRow | undefined;
    return row ? this.hydrate([row])[0]! : null;
  }

  /** Scene and world a floor belongs to, or null. */
  floorOwner(floorId: string): { sceneId: string; worldId: string } | null {
    const row = this.db
      .prepare("SELECT f.scene_id, s.world_id FROM floors f JOIN scenes s ON s.id = f.scene_id WHERE f.id = ?")
      .get(floorId) as { scene_id: string; world_id: string } | undefined;
    return row ? { sceneId: row.scene_id, worldId: row.world_id } : null;
  }

  /** The floor players without a token of their own see. */
  tableFloorId(sceneId: string): string | null {
    const row = this.db.prepare("SELECT table_floor_id FROM scenes WHERE id = ?").get(sceneId) as { table_floor_id: string } | undefined;
    return row?.table_floor_id ?? null;
  }

  /** True when `floorId` is a floor of `sceneId`. */
  hasFloor(sceneId: string, floorId: string): boolean {
    return this.db.prepare("SELECT 1 AS ok FROM floors WHERE id = ? AND scene_id = ?").get(floorId, sceneId) !== undefined;
  }

  /** Replaces every wall and light of a floor. */
  private replaceMap(sceneId: string, floorId: string, input: Pick<FloorInput, "walls" | "lights">) {
    this.db.prepare("DELETE FROM walls WHERE floor_id = ?").run(floorId);
    this.db.prepare("DELETE FROM lights WHERE floor_id = ?").run(floorId);
    const insertWall = this.db.prepare(
      "INSERT INTO walls (id, scene_id, floor_id, x1, y1, x2, y2, kind, open) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const w of input.walls) {
      insertWall.run(randomUUID(), sceneId, floorId, w.x1, w.y1, w.x2, w.y2, w.kind, w.kind === "door" && w.open ? 1 : 0);
    }
    const insertLight = this.db.prepare(
      "INSERT INTO lights (id, scene_id, floor_id, x, y, radius, intensity, color, shadows, feather) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const l of input.lights) {
      insertLight.run(randomUUID(), sceneId, floorId, l.x, l.y, l.radius, l.intensity, l.color, l.shadows ? 1 : 0, l.feather);
    }
  }

  private insertFloor(sceneId: string, worldId: string, input: FloorInput, position: number): string {
    if (!this.assets.belongsToWorld(input.assetId, worldId, "map")) throw new AppError("asset_invalid");
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO floors (id, scene_id, name, position, asset_id) VALUES (?, ?, ?, ?, ?)")
      .run(id, sceneId, input.name, position, input.assetId);
    this.replaceMap(sceneId, id, input);
    return id;
  }

  create(worldId: string, input: z.infer<typeof createSceneSchema>): SceneDto {
    const id = randomUUID();
    transaction(this.db, () => {
      this.db
        .prepare(
          `INSERT INTO scenes (id, world_id, name, width, height, grid_type, grid_size, grid_distance, distance_unit,
             baked_lighting, ambient_light, vision_enabled, vision_radius, locked_layers, grid_hex, table_floor_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?)`,
        )
        .run(
          id,
          worldId,
          input.name,
          input.width,
          input.height,
          storedGridType(input.gridType),
          input.gridSize,
          input.gridDistance,
          input.distanceUnit,
          input.bakedLighting ? 1 : 0,
          input.ambientLight,
          input.visionEnabled ? 1 : 0,
          input.visionRadius,
          JSON.stringify(input.lockedLayers),
          storedHex(input.gridType),
          Date.now(),
        );
      const floorIds = input.floors.map((floor, position) => this.insertFloor(id, worldId, floor, position));
      this.db.prepare("UPDATE scenes SET table_floor_id = ? WHERE id = ?").run(floorIds[0]!, id);
      // The first scene of a world becomes active so players have something to see.
      this.db.prepare("UPDATE worlds SET active_scene_id = ? WHERE id = ? AND active_scene_id IS NULL").run(id, worldId);
    });
    return this.get(id)!;
  }

  update(sceneId: string, input: z.infer<typeof updateSceneSchema>): SceneDto {
    const current = this.get(sceneId);
    if (!current) throw new AppError("not_found");
    const next = { ...current, ...input };
    if (!this.hasFloor(sceneId, next.tableFloorId)) throw new AppError("not_found");
    this.db
      .prepare(
        `UPDATE scenes SET name = ?, width = ?, height = ?, grid_type = ?, grid_size = ?,
         grid_distance = ?, distance_unit = ?, baked_lighting = ?, ambient_light = ?, vision_enabled = ?, vision_radius = ?, locked_layers = ?,
         grid_hex = ?, table_floor_id = ? WHERE id = ?`,
      )
      .run(
        next.name,
        next.width,
        next.height,
        storedGridType(next.gridType),
        next.gridSize,
        next.gridDistance,
        next.distanceUnit,
        next.bakedLighting ? 1 : 0,
        next.ambientLight,
        next.visionEnabled ? 1 : 0,
        next.visionRadius,
        JSON.stringify(next.lockedLayers),
        storedHex(next.gridType),
        next.tableFloorId,
        sceneId,
      );
    return this.get(sceneId)!;
  }

  /** Adds a floor on top of the scene's stack. */
  addFloor(sceneId: string, worldId: string, input: FloorInput): SceneDto {
    const { n } = this.db.prepare("SELECT COUNT(*) AS n FROM floors WHERE scene_id = ?").get(sceneId) as { n: number };
    if (n >= MAX_FLOORS) throw new AppError("invalid_input");
    transaction(this.db, () => this.insertFloor(sceneId, worldId, input, n));
    return this.get(sceneId)!;
  }

  updateFloor(floorId: string, worldId: string, input: z.infer<typeof updateFloorSchema>): SceneDto {
    const owner = this.floorOwner(floorId);
    if (!owner) throw new AppError("not_found");
    const scene = this.get(owner.sceneId)!;
    const current = scene.floors.find((f) => f.id === floorId)!;
    if (input.assetId !== undefined && !this.assets.belongsToWorld(input.assetId, worldId, "map")) throw new AppError("asset_invalid");
    transaction(this.db, () => {
      this.db
        .prepare("UPDATE floors SET name = ?, asset_id = ? WHERE id = ?")
        .run(input.name ?? current.name, input.assetId === undefined ? current.assetId : input.assetId, floorId);
      if (input.walls || input.lights) {
        this.replaceMap(owner.sceneId, floorId, {
          walls: input.walls ?? current.walls.map(({ id: _id, ...w }) => w),
          lights: input.lights ?? current.lights.map(({ id: _id, ...l }) => l),
        });
      }
      if (input.position !== undefined) {
        // Re-number the whole stack so positions stay 0..n-1 with no gaps.
        const order = scene.floors.map((f) => f.id).filter((id) => id !== floorId);
        order.splice(Math.min(input.position, order.length), 0, floorId);
        const set = this.db.prepare("UPDATE floors SET position = ? WHERE id = ?");
        order.forEach((id, position) => set.run(position, id));
      }
    });
    return this.get(owner.sceneId)!;
  }

  /** Deletes a floor with its tokens, walls, lights and drawings. The last floor of a scene cannot be deleted. */
  removeFloor(floorId: string): SceneDto {
    const owner = this.floorOwner(floorId);
    if (!owner) throw new AppError("not_found");
    const scene = this.get(owner.sceneId)!;
    if (scene.floors.length <= 1) throw new AppError("invalid_input");
    transaction(this.db, () => {
      // walls, lights, drawings and tokens of the floor go with it (ON DELETE CASCADE)
      this.db.prepare("DELETE FROM floors WHERE id = ?").run(floorId);
      const remaining = scene.floors.filter((f) => f.id !== floorId);
      const setPosition = this.db.prepare("UPDATE floors SET position = ? WHERE id = ?");
      remaining.forEach((f, position) => setPosition.run(position, f.id));
      if (scene.tableFloorId === floorId) {
        this.db.prepare("UPDATE scenes SET table_floor_id = ? WHERE id = ?").run(remaining[0]!.id, owner.sceneId);
      }
    });
    return this.get(owner.sceneId)!;
  }

  /** Opens or closes a door of the scene. Returns false when the id is not a door of that scene. */
  setDoorOpen(sceneId: string, wallId: string, open: boolean): boolean {
    const result = this.db
      .prepare("UPDATE walls SET open = ? WHERE id = ? AND scene_id = ? AND kind = 'door'")
      .run(open ? 1 : 0, wallId, sceneId);
    return Number(result.changes) > 0;
  }

  remove(sceneId: string, worldId: string): void {
    transaction(this.db, () => {
      this.db.prepare("UPDATE worlds SET active_scene_id = NULL WHERE id = ? AND active_scene_id = ?").run(worldId, sceneId);
      this.db.prepare("DELETE FROM scenes WHERE id = ?").run(sceneId);
    });
  }

  activeSceneId(worldId: string): string | null {
    const row = this.db.prepare("SELECT active_scene_id FROM worlds WHERE id = ?").get(worldId) as
      | { active_scene_id: string | null }
      | undefined;
    return row?.active_scene_id ?? null;
  }

  setActive(worldId: string, sceneId: string | null): void {
    if (sceneId !== null && this.worldIdOf(sceneId) !== worldId) throw new AppError("not_found");
    this.db.prepare("UPDATE worlds SET active_scene_id = ? WHERE id = ?").run(sceneId, worldId);
  }
}
