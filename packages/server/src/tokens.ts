import { randomUUID } from "node:crypto";
import type { createTokenSchema, TokenDto, updateTokenSchema, WorldRole } from "@openvtt/shared";
import type { z } from "zod";
import type { AssetService } from "./assets.ts";
import { type Db, transaction } from "./db.ts";
import { AppError } from "./errors.ts";

export interface Viewer {
  userId: string;
  role: WorldRole;
}

interface TokenRow {
  id: string;
  scene_id: string;
  name: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  color: string;
  asset_id: string | null;
  hidden: number;
  actor_id: string | null;
  hp: number | null;
  hp_max: number | null;
  conditions: string;
  show_name: number;
}

export class TokenService {
  constructor(
    private db: Db,
    private assets: AssetService,
  ) {}

  private controllers(tokenId: string): string[] {
    const rows = this.db.prepare("SELECT user_id FROM token_controllers WHERE token_id = ?").all(tokenId);
    return (rows as { user_id: string }[]).map((r) => r.user_id);
  }

  private toDto(row: TokenRow): TokenDto {
    return {
      id: row.id,
      sceneId: row.scene_id,
      name: row.name,
      x: row.x,
      y: row.y,
      size: row.size,
      rotation: row.rotation,
      color: row.color,
      assetId: row.asset_id,
      hidden: row.hidden === 1,
      actorId: row.actor_id,
      controllerIds: this.controllers(row.id),
      hp: row.hp,
      hpMax: row.hp_max,
      conditions: JSON.parse(row.conditions) as string[],
      showName: row.show_name === 1,
    };
  }

  /** What a viewer may be told about a token: hit points are for the game master and the token's controllers only. */
  forViewer(token: TokenDto, viewer: Viewer): TokenDto {
    return this.canControl(token, viewer) ? token : { ...token, hp: null, hpMax: null };
  }

  /** Token plus the world it belongs to, or null. */
  find(tokenId: string): { token: TokenDto; worldId: string } | null {
    const row = this.db.prepare("SELECT t.*, s.world_id FROM tokens t JOIN scenes s ON s.id = t.scene_id WHERE t.id = ?").get(tokenId) as
      | (TokenRow & { world_id: string })
      | undefined;
    return row ? { token: this.toDto(row), worldId: row.world_id } : null;
  }

  /** The GM sees every token; others see non-hidden tokens of the active scene only. */
  visibleTo(worldId: string, viewer: Viewer, activeSceneId: string | null): TokenDto[] {
    const rows = this.db
      .prepare("SELECT t.* FROM tokens t JOIN scenes s ON s.id = t.scene_id WHERE s.world_id = ? ORDER BY t.rowid")
      .all(worldId) as unknown as TokenRow[];
    return rows
      .map((r) => this.toDto(r))
      .filter((t) => this.canSee(t, viewer, activeSceneId))
      .map((t) => this.forViewer(t, viewer));
  }

  canSee(token: TokenDto, viewer: Viewer, activeSceneId: string | null): boolean {
    return viewer.role === "gm" || (!token.hidden && token.sceneId === activeSceneId);
  }

  /** Controlling a token (moving it) requires being the GM or one of its controllers. */
  canControl(token: TokenDto, viewer: Viewer): boolean {
    return viewer.role === "gm" || token.controllerIds.includes(viewer.userId);
  }

  create(worldId: string, input: z.infer<typeof createTokenSchema>): TokenDto {
    const sceneWorld = this.db.prepare("SELECT world_id FROM scenes WHERE id = ?").get(input.sceneId) as { world_id: string } | undefined;
    if (sceneWorld?.world_id !== worldId) throw new AppError("not_found");
    this.assertReferences(worldId, input.assetId, input.actorId, input.controllerIds);
    const id = randomUUID();
    transaction(this.db, () => {
      this.db
        .prepare(
          `INSERT INTO tokens (id, scene_id, name, x, y, size, rotation, color, asset_id, hidden, actor_id, hp, hp_max, conditions, show_name)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.sceneId,
          input.name,
          input.x,
          input.y,
          input.size,
          input.color,
          input.assetId,
          input.hidden ? 1 : 0,
          input.actorId,
          input.hp,
          input.hpMax,
          JSON.stringify(input.conditions),
          input.showName ? 1 : 0,
        );
      this.setControllers(id, input.controllerIds);
    });
    return this.find(id)!.token;
  }

  update(tokenId: string, worldId: string, patch: z.infer<typeof updateTokenSchema>): TokenDto {
    const current = this.find(tokenId)?.token;
    if (!current) throw new AppError("not_found");
    const next = { ...current, ...patch };
    this.assertReferences(worldId, next.assetId, next.actorId, next.controllerIds);
    transaction(this.db, () => {
      this.db
        .prepare(
          `UPDATE tokens SET name = ?, x = ?, y = ?, size = ?, rotation = ?, color = ?, asset_id = ?, hidden = ?, actor_id = ?,
             hp = ?, hp_max = ?, conditions = ?, show_name = ?
           WHERE id = ?`,
        )
        .run(
          next.name,
          next.x,
          next.y,
          next.size,
          next.rotation,
          next.color,
          next.assetId,
          next.hidden ? 1 : 0,
          next.actorId,
          next.hp,
          next.hpMax,
          JSON.stringify(next.conditions),
          next.showName ? 1 : 0,
          tokenId,
        );
      if (patch.controllerIds) this.setControllers(tokenId, patch.controllerIds);
    });
    return this.find(tokenId)!.token;
  }

  remove(tokenId: string): void {
    this.db.prepare("DELETE FROM tokens WHERE id = ?").run(tokenId);
  }

  private setControllers(tokenId: string, userIds: string[]) {
    this.db.prepare("DELETE FROM token_controllers WHERE token_id = ?").run(tokenId);
    const insert = this.db.prepare("INSERT OR IGNORE INTO token_controllers (token_id, user_id) VALUES (?, ?)");
    for (const userId of userIds) insert.run(tokenId, userId);
  }

  /** Rejects references to assets, actors or users that do not belong to the world. */
  private assertReferences(worldId: string, assetId: string | null, actorId: string | null, controllerIds: string[]) {
    if (!this.assets.belongsToWorld(assetId, worldId, "image")) throw new AppError("asset_invalid");
    if (actorId) {
      const actor = this.db.prepare("SELECT world_id FROM actors WHERE id = ?").get(actorId) as { world_id: string } | undefined;
      if (actor?.world_id !== worldId) throw new AppError("not_found");
    }
    const isMember = this.db.prepare("SELECT 1 FROM members WHERE world_id = ? AND user_id = ?");
    for (const userId of controllerIds) if (!isMember.get(worldId, userId)) throw new AppError("not_found");
  }
}
