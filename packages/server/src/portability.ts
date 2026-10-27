import { randomUUID } from "node:crypto";
import { actorTypeSchema, type SheetData, sheetTemplateSchema, validateSheetData } from "@openvtt/sdk";
import { MAX_UPLOAD_BYTES, type UserDto } from "@openvtt/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { unzipSync, zipSync } from "fflate";
import { z } from "zod";
import { transaction } from "./db.ts";
import { AppError } from "./errors.ts";
import type { Services } from "./services.ts";

const FORMAT = "openvtt-world";
const FORMAT_VERSION = 1;
const MAX_IMPORT_BYTES = 256 * 1024 * 1024;
const MAX_FILE_BYTES = MAX_UPLOAD_BYTES;

const id = z.string().min(1).max(64);
const worldFileSchema = z.object({
  format: z.literal(FORMAT),
  version: z.literal(FORMAT_VERSION),
  world: z.object({
    name: z.string().min(1).max(80),
    systemId: z.string().max(40),
    templateOverrides: z.record(actorTypeSchema, sheetTemplateSchema).default({}),
    activeSceneId: id.nullable(),
  }),
  assets: z.array(z.object({ id, file: z.string().regex(/^assets\/[A-Za-z0-9_.-]+$/) })).max(2000),
  scenes: z
    .array(
      z.object({
        id,
        name: z.string().max(80),
        assetId: id.nullable(),
        width: z.number().int().min(1).max(16384),
        height: z.number().int().min(1).max(16384),
        gridType: z.enum(["square", "none"]),
        gridSize: z.number().int().min(10).max(500),
        gridDistance: z.number().positive().max(1000),
        distanceUnit: z.string().max(10),
      }),
    )
    .max(500),
  actors: z.array(z.object({ id, type: actorTypeSchema, name: z.string().max(80), data: z.record(z.unknown()) })).max(5000),
  tokens: z
    .array(
      z.object({
        id,
        sceneId: id,
        name: z.string().max(60),
        x: z.number().finite(),
        y: z.number().finite(),
        size: z.number().min(0.25).max(20),
        rotation: z.number().finite(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        assetId: id.nullable(),
        hidden: z.boolean(),
        actorId: id.nullable(),
      }),
    )
    .max(20000),
  messages: z
    .array(
      z.object({
        senderName: z.string().max(60),
        kind: z.enum(["chat", "roll"]),
        content: z.string().max(2000),
        roll: z.unknown().nullable(),
        createdAt: z.number(),
      }),
    )
    .max(10000),
});

interface Guards {
  requireUser: (req: FastifyRequest) => UserDto;
  requireGm: (req: FastifyRequest, worldId: string) => unknown;
  broadcastState: (worldId: string) => void;
}

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

/**
 * World export/import as a single zip: `world.json` plus `assets/*`.
 * Accounts are not part of the file: member links (token controllers, actor owners) and
 * private messages are dropped, and the importer becomes the GM of the new world.
 */
export function registerPortabilityRoutes(app: FastifyInstance, s: Services, guards: Guards) {
  app.get<{ Params: { id: string } }>("/api/worlds/:id/export", async (req, reply) => {
    const worldId = req.params.id;
    guards.requireGm(req, worldId);
    const world = s.db.prepare("SELECT name, system_id, template_overrides, active_scene_id FROM worlds WHERE id = ?").get(worldId) as {
      name: string;
      system_id: string;
      template_overrides: string;
      active_scene_id: string | null;
    };
    const assetRows = s.db.prepare("SELECT id FROM assets WHERE world_id = ?").all(worldId) as { id: string }[];
    const files: Record<string, Uint8Array> = {};
    const assets = assetRows.map(({ id: assetId }) => {
      const record = s.assets.find(assetId)!;
      const file = `assets/${record.fileName}`;
      files[file] = new Uint8Array(s.assets.read(record));
      return { id: assetId, file };
    });
    const scenes = s.scenes.list(worldId);
    const sceneIds = new Set(scenes.map((sc) => sc.id));
    const gmView = { userId: "", role: "gm" as const };
    const tokens = s.tokens
      .visibleTo(worldId, gmView, null)
      .filter((t) => sceneIds.has(t.sceneId))
      .map(({ controllerIds: _controllers, ...t }) => t);
    const actors = s.actors.visibleTo(worldId, gmView).map(({ ownerId: _owner, ...a }) => a);
    const messages = s.chat
      .historyFor(worldId, gmView)
      .filter((m) => (m.kind === "chat" || m.kind === "roll") && m.toUserId === null && !m.gmOnly)
      .map((m) => ({
        senderName: m.senderName,
        kind: m.kind as "chat" | "roll",
        content: m.content,
        roll: m.roll,
        createdAt: m.createdAt,
      }));

    const worldFile = {
      format: FORMAT,
      version: FORMAT_VERSION,
      world: {
        name: world.name,
        systemId: world.system_id,
        templateOverrides: JSON.parse(world.template_overrides),
        activeSceneId: world.active_scene_id,
      },
      assets,
      scenes,
      actors,
      tokens,
      messages,
    };
    files["world.json"] = encode(worldFile);
    const slug =
      world.name
        .replace(/[^A-Za-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase() || "world";
    return reply
      .header("content-type", "application/zip")
      .header("content-disposition", `attachment; filename="${slug}.openvtt.zip"`)
      .send(Buffer.from(zipSync(files)));
  });

  app.post("/api/worlds/import", { bodyLimit: MAX_IMPORT_BYTES }, async (req) => {
    const user = guards.requireUser(req);
    if (!Buffer.isBuffer(req.body)) throw new AppError("import_invalid");

    let entries: Record<string, Uint8Array>;
    let total = 0;
    try {
      entries = unzipSync(new Uint8Array(req.body), {
        filter: (f) => {
          total += f.originalSize;
          if (f.originalSize > MAX_FILE_BYTES || total > MAX_IMPORT_BYTES) throw new Error("too large");
          return true;
        },
      });
    } catch {
      throw new AppError("import_invalid");
    }
    const parsed = worldFileSchema.safeParse(JSON.parse(new TextDecoder().decode(entries["world.json"] ?? new Uint8Array())));
    if (!parsed.success) throw new AppError("import_invalid");
    const file = parsed.data;
    const system = s.systems.get(file.world.systemId);
    if (!system) throw new AppError("import_invalid");

    // Validate every reference before writing anything.
    const assetIds = new Set(file.assets.map((a) => a.id));
    const sceneIds = new Set(file.scenes.map((sc) => sc.id));
    const actorIds = new Set(file.actors.map((a) => a.id));
    const refsOk =
      file.scenes.every((sc) => sc.assetId === null || assetIds.has(sc.assetId)) &&
      file.tokens.every(
        (t) =>
          sceneIds.has(t.sceneId) && (t.assetId === null || assetIds.has(t.assetId)) && (t.actorId === null || actorIds.has(t.actorId)),
      ) &&
      file.assets.every((a) => entries[a.file] !== undefined);
    if (!refsOk) throw new AppError("import_invalid");

    const idMap = new Map<string, string>();
    let worldId = "";
    try {
      transaction(s.db, () => {
        worldId = s.worlds.create(user, file.world.name, file.world.systemId).id;
        for (const a of file.assets) idMap.set(a.id, s.assets.save(worldId, Buffer.from(entries[a.file]!)).id);
        for (const sc of file.scenes) {
          const created = s.scenes.create(worldId, { ...sc, assetId: sc.assetId ? idMap.get(sc.assetId)! : null });
          idMap.set(sc.id, created.id);
        }
        for (const a of file.actors) {
          const template = s.actors.templateFor(worldId, a.type);
          if (!validateSheetData(template, a.data)) throw new AppError("import_invalid");
          const created = s.actors.create(worldId, { name: a.name, type: a.type });
          s.db.prepare("UPDATE actors SET data = ? WHERE id = ?").run(JSON.stringify(a.data as SheetData), created.id);
          idMap.set(a.id, created.id);
        }
        for (const t of file.tokens)
          s.tokens.create(worldId, {
            ...t,
            sceneId: idMap.get(t.sceneId)!,
            assetId: t.assetId ? idMap.get(t.assetId)! : null,
            actorId: t.actorId ? idMap.get(t.actorId)! : null,
            controllerIds: [],
          });
        s.db
          .prepare("UPDATE worlds SET template_overrides = ?, active_scene_id = ? WHERE id = ?")
          .run(
            JSON.stringify(file.world.templateOverrides),
            file.world.activeSceneId ? (idMap.get(file.world.activeSceneId) ?? null) : null,
            worldId,
          );
        const insertMessage = s.db.prepare(
          `INSERT INTO messages (id, world_id, user_id, sender_name, kind, to_user_id, gm_only, content, roll, created_at)
           VALUES (?, ?, ?, ?, ?, NULL, 0, ?, ?, ?)`,
        );
        for (const m of file.messages)
          insertMessage.run(
            randomUUID(),
            worldId,
            user.id,
            m.senderName,
            m.kind,
            m.content,
            m.roll ? JSON.stringify(m.roll) : null,
            m.createdAt,
          );
      });
    } catch (error) {
      throw error instanceof AppError ? error : new AppError("import_invalid");
    }
    guards.broadcastState(worldId);
    return { id: worldId, name: file.world.name, role: "gm" };
  });

  app.addContentTypeParser("application/zip", { parseAs: "buffer", bodyLimit: MAX_IMPORT_BYTES }, (_req, body, done) => done(null, body));
}
