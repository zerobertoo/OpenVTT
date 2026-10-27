import { randomUUID } from "node:crypto";
import { type ActorType, actorTypeSchema, type SheetTemplate, sheetTemplateSchema, validateSheetData } from "@openvtt/sdk";
import type { ActorDto, createActorSchema, SystemInfoDto, updateActorSchema } from "@openvtt/shared";
import type { z } from "zod";
import type { Db } from "./db.ts";
import { AppError } from "./errors.ts";
import type { SystemRegistry } from "./systems.ts";
import type { Viewer } from "./tokens.ts";

interface ActorRow {
  id: string;
  world_id: string;
  type: ActorType;
  name: string;
  data: string;
  owner_id: string | null;
}

const toDto = (r: ActorRow): ActorDto => ({
  id: r.id,
  type: r.type,
  name: r.name,
  ownerId: r.owner_id,
  data: JSON.parse(r.data),
});

export class ActorService {
  constructor(
    private db: Db,
    private systems: SystemRegistry,
  ) {}

  private worldRow(worldId: string) {
    return this.db.prepare("SELECT system_id, template_overrides FROM worlds WHERE id = ?").get(worldId) as {
      system_id: string;
      template_overrides: string;
    };
  }

  systemInfo(worldId: string): SystemInfoDto {
    const world = this.worldRow(worldId);
    const system = this.systems.get(world.system_id)!;
    const overrides = JSON.parse(world.template_overrides) as Partial<Record<ActorType, SheetTemplate>>;
    return {
      manifest: system.manifest,
      templates: { ...system.templates, ...overrides },
      strings: system.strings,
      overridden: Object.keys(overrides) as ActorType[],
    };
  }

  templateFor(worldId: string, type: ActorType): SheetTemplate {
    const template = this.systemInfo(worldId).templates[type];
    if (!template) throw new AppError("template_invalid");
    return template;
  }

  /** The GM sees all actors; players only the ones they own, so NPC sheets never leak. */
  visibleTo(worldId: string, viewer: Viewer): ActorDto[] {
    const rows = this.db.prepare("SELECT * FROM actors WHERE world_id = ? ORDER BY created_at, id").all(worldId) as unknown as ActorRow[];
    return rows.filter((r) => viewer.role === "gm" || r.owner_id === viewer.userId).map(toDto);
  }

  find(actorId: string): (ActorDto & { worldId: string }) | null {
    const row = this.db.prepare("SELECT * FROM actors WHERE id = ?").get(actorId) as ActorRow | undefined;
    return row ? { ...toDto(row), worldId: row.world_id } : null;
  }

  create(worldId: string, input: z.infer<typeof createActorSchema>): ActorDto {
    this.templateFor(worldId, input.type);
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO actors (id, world_id, type, name, data, created_at) VALUES (?, ?, ?, ?, '{}', ?)")
      .run(id, worldId, input.type, input.name, Date.now());
    return this.find(id)!;
  }

  update(actorId: string, viewer: Viewer, patch: z.infer<typeof updateActorSchema>): ActorDto {
    const actor = this.find(actorId);
    if (!actor) throw new AppError("not_found");
    const isGm = viewer.role === "gm";
    if (!isGm && actor.ownerId !== viewer.userId) throw new AppError("forbidden");
    if (patch.ownerId !== undefined) {
      if (!isGm) throw new AppError("forbidden");
      const member =
        patch.ownerId === null ||
        this.db.prepare("SELECT 1 FROM members WHERE world_id = ? AND user_id = ?").get(actor.worldId, patch.ownerId);
      if (!member) throw new AppError("not_found");
    }
    let data = actor.data;
    if (patch.data !== undefined) {
      const template = this.templateFor(actor.worldId, actor.type);
      if (!validateSheetData(template, patch.data)) throw new AppError("invalid_input");
      data = { ...actor.data, ...patch.data };
    }
    this.db
      .prepare("UPDATE actors SET name = ?, owner_id = ?, data = ? WHERE id = ?")
      .run(patch.name ?? actor.name, patch.ownerId !== undefined ? patch.ownerId : actor.ownerId, JSON.stringify(data), actorId);
    return this.find(actorId)!;
  }

  remove(actorId: string): void {
    this.db.prepare("DELETE FROM actors WHERE id = ?").run(actorId);
  }

  /** Validates and stores GM-written replacement templates; `null` restores the system default. */
  setTemplateOverrides(worldId: string, overrides: Record<string, unknown>): void {
    const current = JSON.parse(this.worldRow(worldId).template_overrides) as Record<string, unknown>;
    for (const [type, value] of Object.entries(overrides)) {
      const key = actorTypeSchema.parse(type);
      if (value === null) delete current[key];
      else {
        const parsed = sheetTemplateSchema.safeParse(value);
        if (!parsed.success) throw new AppError("template_invalid");
        current[key] = parsed.data;
      }
    }
    this.db.prepare("UPDATE worlds SET template_overrides = ? WHERE id = ?").run(JSON.stringify(current), worldId);
  }
}
