import { randomUUID } from "node:crypto";
import type { createSceneSchema, SceneDto, updateSceneSchema } from "@openvtt/shared";
import type { z } from "zod";
import type { AssetService } from "./assets.ts";
import { type Db, transaction } from "./db.ts";
import { AppError } from "./errors.ts";

interface SceneRow {
  id: string;
  world_id: string;
  name: string;
  asset_id: string | null;
  width: number;
  height: number;
  grid_type: "square" | "none";
  grid_size: number;
  grid_distance: number;
  distance_unit: string;
}

const toDto = (r: SceneRow): SceneDto => ({
  id: r.id,
  name: r.name,
  assetId: r.asset_id,
  width: r.width,
  height: r.height,
  gridType: r.grid_type,
  gridSize: r.grid_size,
  gridDistance: r.grid_distance,
  distanceUnit: r.distance_unit,
});

export class SceneService {
  constructor(
    private db: Db,
    private assets: AssetService,
  ) {}

  list(worldId: string): SceneDto[] {
    const rows = this.db.prepare("SELECT * FROM scenes WHERE world_id = ? ORDER BY created_at, id").all(worldId);
    return (rows as unknown as SceneRow[]).map(toDto);
  }

  worldIdOf(sceneId: string): string | null {
    const row = this.db.prepare("SELECT world_id FROM scenes WHERE id = ?").get(sceneId) as { world_id: string } | undefined;
    return row?.world_id ?? null;
  }

  get(sceneId: string): SceneDto | null {
    const row = this.db.prepare("SELECT * FROM scenes WHERE id = ?").get(sceneId) as SceneRow | undefined;
    return row ? toDto(row) : null;
  }

  create(worldId: string, input: z.infer<typeof createSceneSchema>): SceneDto {
    if (!this.assets.belongsToWorld(input.assetId, worldId)) throw new AppError("asset_invalid");
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO scenes (id, world_id, name, asset_id, width, height, grid_type, grid_size, grid_distance, distance_unit, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        Date.now(),
      );
    // The first scene of a world becomes active so players have something to see.
    this.db.prepare("UPDATE worlds SET active_scene_id = ? WHERE id = ? AND active_scene_id IS NULL").run(id, worldId);
    return this.get(id)!;
  }

  update(sceneId: string, worldId: string, input: z.infer<typeof updateSceneSchema>): SceneDto {
    const current = this.get(sceneId);
    if (!current) throw new AppError("not_found");
    const next = { ...current, ...input };
    if (!this.assets.belongsToWorld(next.assetId, worldId)) throw new AppError("asset_invalid");
    this.db
      .prepare(
        `UPDATE scenes SET name = ?, asset_id = ?, width = ?, height = ?, grid_type = ?, grid_size = ?,
         grid_distance = ?, distance_unit = ? WHERE id = ?`,
      )
      .run(next.name, next.assetId, next.width, next.height, next.gridType, next.gridSize, next.gridDistance, next.distanceUnit, sceneId);
    return this.get(sceneId)!;
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
