import { randomUUID } from "node:crypto";
import { createWriteStream, mkdirSync, rmSync, statSync, type WriteStream } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { actorTypeSchema, type SheetData, sheetTemplateSchema, validateSheetData } from "@openvtt/sdk";
import { lightInputSchema, MAX_SCENE_LIGHTS, MAX_SCENE_WALLS, MAX_UPLOAD_BYTES, type UserDto, wallInputSchema } from "@openvtt/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { Unzip, UnzipInflate, UnzipPassThrough, Zip, ZipDeflate, ZipPassThrough } from "fflate";
import { z } from "zod";
import type { AssetRecord } from "./assets.ts";
import { transaction } from "./db.ts";
import { AppError } from "./errors.ts";
import type { Services } from "./services.ts";

const FORMAT = "openvtt-world";
const FORMAT_VERSION = 1;
/** Total decompressed size of an imported archive. */
const MAX_IMPORT_BYTES = 1024 * 1024 * 1024;
const MAX_WORLD_JSON_BYTES = 16 * 1024 * 1024;

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
        // Absent in files written before walls and lights existed.
        walls: z.array(wallInputSchema).max(MAX_SCENE_WALLS).default([]),
        lights: z.array(lightInputSchema).max(MAX_SCENE_LIGHTS).default([]),
        bakedLighting: z.boolean().default(false),
        floorGroup: z.string().uuid().nullable().default(null),
        floor: z.number().int().min(-20).max(50).default(0),
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
    const records = assetRows.map(({ id: assetId }) => s.assets.find(assetId)!);
    // Fails with a normal error response (before any byte is sent) if a file went missing from disk.
    for (const record of records) statSync(s.assets.path(record));
    const assets = records.map((record) => ({ id: record.id, file: `assets/${record.fileName}` }));
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
    const slug =
      world.name
        .replace(/[^A-Za-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase() || "world";
    return reply
      .header("content-type", "application/zip")
      .header("content-disposition", `attachment; filename="${slug}.openvtt.zip"`)
      .send(
        Readable.from(
          zipChunks(
            encode(worldFile),
            records.map((r) => ({ name: `assets/${r.fileName}`, open: () => s.assets.open(r) })),
          ),
        ),
      );
  });

  app.post("/api/worlds/import", async (req) => {
    const user = guards.requireUser(req);
    if (!(req.body instanceof Readable)) throw new AppError("import_invalid");

    const tempDir = join(s.dataDir, `import-${randomUUID()}`);
    try {
      return await importArchive(req.body, tempDir, user);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  /** Reads the archive as a stream (nothing but `world.json` is held in memory) and creates the world. */
  async function importArchive(body: Readable, tempDir: string, user: UserDto) {
    const entries = await extractArchive(body, tempDir, Math.max(MAX_UPLOAD_BYTES, s.assets.maxBytesFor("video/mp4")));
    let worldJson: unknown;
    try {
      worldJson = JSON.parse(new TextDecoder().decode(entries.get("world.json")?.bytes ?? new Uint8Array()));
    } catch {
      throw new AppError("import_invalid");
    }
    const parsed = worldFileSchema.safeParse(worldJson);
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
      file.assets.every((a) => entries.get(a.file)?.path !== undefined);
    if (!refsOk) throw new AppError("import_invalid");

    const idMap = new Map<string, string>();
    const adopted: AssetRecord[] = [];
    let worldId = "";
    try {
      transaction(s.db, () => {
        worldId = s.worlds.create(user, file.world.name, file.world.systemId).id;
        for (const a of file.assets) {
          const record = s.assets.adoptFile(worldId, entries.get(a.file)!.path!);
          adopted.push(record);
          idMap.set(a.id, record.id);
        }
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
      // The rolled-back rows are gone; the files already moved into the asset directory must go too.
      for (const record of adopted) rmSync(s.assets.path(record), { force: true });
      throw error instanceof AppError ? error : new AppError("import_invalid");
    }
    guards.broadcastState(worldId);
    return { id: worldId, name: file.world.name, role: "gm" };
  }

  // Zip bodies reach the routes as raw streams; routes that want the bytes in memory collect them themselves.
  app.addContentTypeParser("application/zip", (_req, payload, done) => done(null, payload));

  /** What was found in an archive: `world.json` in memory, everything else as a temp file. */
  interface ArchiveEntry {
    bytes?: Uint8Array;
    path?: string;
  }

  /**
   * Streams a zip into `tempDir`. Sizes are counted on the bytes actually produced, never on what the
   * archive declares, so a zip bomb stops at the limits. Entry names only pick the entry's role;
   * temp files are named by us, so a hostile path can never leave `tempDir`.
   */
  async function extractArchive(body: Readable, tempDir: string, maxAssetBytes: number): Promise<Map<string, ArchiveEntry>> {
    mkdirSync(tempDir, { recursive: true });
    const found = new Map<string, ArchiveEntry>();
    const writers: WriteStream[] = [];
    let total = 0;
    let failure = null as Error | null;
    let waitForDrain: Promise<unknown> | null = null;
    const fail = (error: Error) => {
      failure ??= error;
    };

    const unzip = new Unzip((entry) => {
      if (entry.name.endsWith("/")) return;
      const isWorld = entry.name === "world.json";
      const isAsset = /^assets\/[A-Za-z0-9_.-]+$/.test(entry.name);
      const chunks: Uint8Array[] = [];
      let size = 0;
      let writer: WriteStream | null = null;
      if (isAsset) {
        const path = join(tempDir, randomUUID());
        writer = createWriteStream(path);
        writer.on("error", fail);
        writers.push(writer);
        found.set(entry.name, {});
        entry.ondata = (error, data, final) => {
          if (error) return fail(error);
          size += data.length;
          total += data.length;
          if (size > maxAssetBytes || total > MAX_IMPORT_BYTES) return fail(new AppError("asset_too_large"));
          // A writer that ends right after a full write never emits "drain", so "close" also releases the wait.
          if (!writer!.write(data))
            waitForDrain = new Promise((resolve) => {
              writer!.once("drain", () => resolve(null));
              writer!.once("close", () => resolve(null));
            });
          if (final) {
            writer!.end();
            found.get(entry.name)!.path = path;
          }
        };
      } else {
        entry.ondata = (error, data, final) => {
          if (error) return fail(error);
          size += data.length;
          total += data.length;
          if (size > MAX_WORLD_JSON_BYTES || total > MAX_IMPORT_BYTES) return fail(new AppError("asset_too_large"));
          if (isWorld) chunks.push(data);
          if (final && isWorld) found.set(entry.name, { bytes: concatBytes(chunks) });
        };
      }
      entry.start();
    });
    unzip.register(UnzipInflate);
    unzip.register(UnzipPassThrough);

    try {
      for await (const chunk of body) {
        unzip.push(chunk as Uint8Array);
        if (failure) break;
        if (waitForDrain) await waitForDrain;
        waitForDrain = null;
      }
      if (!failure) unzip.push(new Uint8Array(0), true);
    } catch (error) {
      fail(error as Error);
    }
    // Make sure every file is flushed (or abandoned) before the caller reads or deletes them.
    await Promise.all(writers.map((w) => new Promise<void>((resolve) => (w.closed ? resolve() : w.end(() => resolve())))));
    if (failure) throw failure instanceof AppError ? failure : new AppError("import_invalid");
    return found;
  }
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/**
 * Builds the export zip lazily: `world.json` deflated first, then every asset stored as-is (they are
 * already compressed) read in chunks, so memory use does not depend on the size of the world.
 */
async function* zipChunks(
  worldJson: Uint8Array,
  assets: { name: string; open: () => AsyncIterable<Uint8Array> }[],
): AsyncGenerator<Uint8Array> {
  const pending: Uint8Array[] = [];
  let failure: Error | null = null;
  const zip = new Zip((error, chunk) => {
    if (error) failure = error;
    else pending.push(chunk);
  });
  function* flush() {
    if (failure) throw failure;
    while (pending.length) yield pending.shift()!;
  }
  const json = new ZipDeflate("world.json", { level: 6 });
  zip.add(json);
  json.push(worldJson, true);
  yield* flush();
  for (const asset of assets) {
    const entry = new ZipPassThrough(asset.name);
    zip.add(entry);
    for await (const chunk of asset.open()) {
      entry.push(chunk, false);
      yield* flush();
    }
    entry.push(new Uint8Array(0), true);
    yield* flush();
  }
  zip.end();
  yield* flush();
}
