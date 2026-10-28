import { randomUUID } from "node:crypto";
import type { createSceneSchema, LightDto, SceneDto, updateSceneSchema, WallDto } from "@openvtt/shared";
import type { z } from "zod";
import type { AssetService } from "./assets.ts";
import { type Db, transaction } from "./db.ts";
import { AppError } from "./errors.ts";

interface SceneRow {
  id: string;
  world_id: string;
  name: string;
  asset_id: string | null;
  asset_mime: string | null;
  width: number;
  height: number;
  grid_type: "square" | "none";
  grid_size: number;
  grid_distance: number;
  distance_unit: string;
  baked_lighting: number;
  floor_group: string | null;
  floor: number;
  vision_enabled: number;
  vision_radius: number;
}

interface WallRow {
  id: string;
  scene_id: string;
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
  x: number;
  y: number;
  radius: number;
  intensity: number;
  color: string;
  shadows: number;
}

const SELECT_SCENE = "SELECT scenes.*, assets.mime AS asset_mime FROM scenes LEFT JOIN assets ON assets.id = scenes.asset_id";

const toWall = (r: WallRow): WallDto => ({ id: r.id, x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2, kind: r.kind, open: r.open === 1 });
const toLight = (r: LightRow): LightDto => ({
  id: r.id,
  x: r.x,
  y: r.y,
  radius: r.radius,
  intensity: r.intensity,
  color: r.color,
  shadows: r.shadows === 1,
});

const toDto = (r: SceneRow, walls: WallDto[], lights: LightDto[]): SceneDto => ({
  id: r.id,
  name: r.name,
  assetId: r.asset_id,
  assetKind: r.asset_mime === null ? null : r.asset_mime.startsWith("video/") ? "video" : "image",
  width: r.width,
  height: r.height,
  gridType: r.grid_type,
  gridSize: r.grid_size,
  gridDistance: r.grid_distance,
  distanceUnit: r.distance_unit,
  walls,
  lights,
  bakedLighting: r.baked_lighting === 1,
  floorGroup: r.floor_group,
  floor: r.floor,
  visionEnabled: r.vision_enabled === 1,
  visionRadius: r.vision_radius,
});

/** What a player may see of a scene: walls and lights stay with the game master until per-player vision exists. */
export const withoutHiddenMapData = (scene: SceneDto): SceneDto => ({ ...scene, walls: [], lights: [] });

export class SceneService {
  constructor(
    private db: Db,
    private assets: AssetService,
  ) {}

  private hydrate(rows: SceneRow[]): SceneDto[] {
    if (rows.length === 0) return [];
    const marks = rows.map(() => "?").join(",");
    const ids = rows.map((r) => r.id);
    const walls = this.db.prepare(`SELECT * FROM walls WHERE scene_id IN (${marks}) ORDER BY rowid`).all(...ids) as unknown as WallRow[];
    const lights = this.db.prepare(`SELECT * FROM lights WHERE scene_id IN (${marks}) ORDER BY rowid`).all(...ids) as unknown as LightRow[];
    return rows.map((r) =>
      toDto(r, walls.filter((w) => w.scene_id === r.id).map(toWall), lights.filter((l) => l.scene_id === r.id).map(toLight)),
    );
  }

  list(worldId: string): SceneDto[] {
    const rows = this.db.prepare(`${SELECT_SCENE} WHERE scenes.world_id = ? ORDER BY scenes.created_at, scenes.id`).all(worldId);
    return this.hydrate(rows as unknown as SceneRow[]);
  }

  worldIdOf(sceneId: string): string | null {
    const row = this.db.prepare("SELECT world_id FROM scenes WHERE id = ?").get(sceneId) as { world_id: string } | undefined;
    return row?.world_id ?? null;
  }

  get(sceneId: string): SceneDto | null {
    const row = this.db.prepare(`${SELECT_SCENE} WHERE scenes.id = ?`).get(sceneId) as SceneRow | undefined;
    return row ? this.hydrate([row])[0]! : null;
  }

  /** Replaces every wall and light of a scene. */
  private replaceMap(sceneId: string, input: Pick<z.infer<typeof createSceneSchema>, "walls" | "lights">) {
    this.db.prepare("DELETE FROM walls WHERE scene_id = ?").run(sceneId);
    this.db.prepare("DELETE FROM lights WHERE scene_id = ?").run(sceneId);
    const insertWall = this.db.prepare("INSERT INTO walls (id, scene_id, x1, y1, x2, y2, kind, open) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    for (const w of input.walls) insertWall.run(randomUUID(), sceneId, w.x1, w.y1, w.x2, w.y2, w.kind, w.kind === "door" && w.open ? 1 : 0);
    const insertLight = this.db.prepare(
      "INSERT INTO lights (id, scene_id, x, y, radius, intensity, color, shadows) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const l of input.lights) insertLight.run(randomUUID(), sceneId, l.x, l.y, l.radius, l.intensity, l.color, l.shadows ? 1 : 0);
  }

  create(worldId: string, input: z.infer<typeof createSceneSchema>): SceneDto {
    if (!this.assets.belongsToWorld(input.assetId, worldId)) throw new AppError("asset_invalid");
    const id = randomUUID();
    transaction(this.db, () => {
      this.db
        .prepare(
          `INSERT INTO scenes (id, world_id, name, asset_id, width, height, grid_type, grid_size, grid_distance, distance_unit,
             baked_lighting, floor_group, floor, vision_enabled, vision_radius, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          worldId,
          input.name,
          input.assetId,
          input.width,
          input.height,
          input.gridType,
          input.gridSize,
          input.gridDistance,
          input.distanceUnit,
          input.bakedLighting ? 1 : 0,
          input.floorGroup,
          input.floor,
          input.visionEnabled ? 1 : 0,
          input.visionRadius,
          Date.now(),
        );
      this.replaceMap(id, input);
      // The first scene of a world becomes active so players have something to see.
      this.db.prepare("UPDATE worlds SET active_scene_id = ? WHERE id = ? AND active_scene_id IS NULL").run(id, worldId);
    });
    return this.get(id)!;
  }

  update(sceneId: string, worldId: string, input: z.infer<typeof updateSceneSchema>): SceneDto {
    const current = this.get(sceneId);
    if (!current) throw new AppError("not_found");
    const next = { ...current, ...input };
    if (!this.assets.belongsToWorld(next.assetId, worldId)) throw new AppError("asset_invalid");
    transaction(this.db, () => {
      this.db
        .prepare(
          `UPDATE scenes SET name = ?, asset_id = ?, width = ?, height = ?, grid_type = ?, grid_size = ?,
           grid_distance = ?, distance_unit = ?, baked_lighting = ?, floor_group = ?, floor = ?, vision_enabled = ?, vision_radius = ? WHERE id = ?`,
        )
        .run(
          next.name,
          next.assetId,
          next.width,
          next.height,
          next.gridType,
          next.gridSize,
          next.gridDistance,
          next.distanceUnit,
          next.bakedLighting ? 1 : 0,
          next.floorGroup,
          next.floor,
          next.visionEnabled ? 1 : 0,
          next.visionRadius,
          sceneId,
        );
      if (input.walls || input.lights) {
        this.replaceMap(sceneId, {
          walls: input.walls ?? current.walls.map(({ id: _id, ...w }) => w),
          lights: input.lights ?? current.lights.map(({ id: _id, ...l }) => l),
        });
      }
    });
    return this.get(sceneId)!;
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
