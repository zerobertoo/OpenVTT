import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import fastifyCookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  createActorSchema,
  createSceneSchema,
  createTokenSchema,
  createWorldSchema,
  credentialsSchema,
  DEFAULT_MAX_VIDEO_BYTES,
  type ErrorCode,
  joinWorldSchema,
  MAX_UPLOAD_BYTES,
  PLAYER_EDITABLE_TOKEN_FIELDS,
  passwordSchema,
  sendMessageSchema,
  type UserDto,
  updateActorSchema,
  updateProfileSchema,
  updateSceneSchema,
  setCombatantSchema,
  updateTokenSchema,
  updateWorldSchema,
  usernameSchema,
} from "@openvtt/shared";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { ZodError, z } from "zod";
import { parseRange } from "./assets.ts";
import { SESSION_TTL_MS } from "./auth.ts";
import { openDatabase } from "./db.ts";
import { AppError } from "./errors.ts";
import { Hub } from "./hub.ts";
import { registerPortabilityRoutes } from "./portability.ts";
import { createServices } from "./services.ts";
import type { Viewer } from "./tokens.ts";

export const SESSION_COOKIE = "openvtt_session";

/** Upload cap for an installable rule-system package (the unpacked limit is much lower). */
const MAX_SYSTEM_ZIP_BYTES = 8 * 1024 * 1024;

export interface AppOptions {
  dbPath: string;
  /** Where uploaded assets and installed systems live; defaults to the database's directory. */
  dataDir?: string;
  /** Directory with the systems shipped with the app. */
  systemsDir?: string;
  /** Directory with the built client; served when it exists. */
  clientDir?: string;
  secureCookies?: boolean;
  /** Largest accepted map video in bytes; defaults to `DEFAULT_MAX_VIDEO_BYTES`. */
  maxVideoBytes?: number;
}

export function buildApp(options: AppOptions) {
  const db = openDatabase(options.dbPath);
  const dataDir =
    options.dataDir ?? (options.dbPath === ":memory:" ? mkdtempSync(join(tmpdir(), "openvtt-data-")) : dirname(resolve(options.dbPath)));
  const maxVideoBytes = options.maxVideoBytes ?? DEFAULT_MAX_VIDEO_BYTES;
  const s = createServices(db, dataDir, options.systemsDir ?? resolve(import.meta.dirname, "../../../systems"), { maxVideoBytes });
  const hub = new Hub(s, SESSION_COOKIE);
  const app = Fastify({ logger: false });

  app.register(fastifyCookie);
  hub.attach(app.server);
  app.addHook("onClose", async () => {
    hub.closeAll();
    db.close();
  });

  app.addContentTypeParser([...ALLOWED_IMAGE_TYPES], { parseAs: "buffer", bodyLimit: MAX_UPLOAD_BYTES }, (_req, body, done) =>
    done(null, body),
  );
  // Videos are never buffered: the route receives the raw request stream and writes it to disk.
  app.addContentTypeParser([...ALLOWED_VIDEO_TYPES], (_req, payload, done) => done(null, payload));

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError) return reply.status(error.status).send({ error: error.code });
    if (error instanceof ZodError || (error as { validation?: unknown }).validation)
      return reply.status(400).send({ error: "invalid_input" satisfies ErrorCode });
    if ((error as { statusCode?: number }).statusCode === 413)
      return reply.status(413).send({ error: "asset_invalid" satisfies ErrorCode });
    if ((error as { statusCode?: number }).statusCode === 415)
      return reply.status(415).send({ error: "asset_invalid" satisfies ErrorCode });
    app.log.error(error);
    return reply.status(500).send({ error: "internal_error" satisfies ErrorCode });
  });

  const requireUser = (req: FastifyRequest): UserDto => {
    const user = s.auth.userFromSession(req.cookies[SESSION_COOKIE]);
    if (!user) throw new AppError("unauthenticated");
    return user;
  };

  /** Authenticated member of the world; non-members get `forbidden` (never confirming the world exists). */
  const requireMember = (req: FastifyRequest, worldId: string) => {
    const user = requireUser(req);
    const role = s.worlds.roleOf(worldId, user.id);
    if (!role) throw new AppError("forbidden");
    const viewer: Viewer = { userId: user.id, role };
    return { user, viewer };
  };
  const requireGm = (req: FastifyRequest, worldId: string) => {
    const ctx = requireMember(req, worldId);
    if (ctx.viewer.role !== "gm") throw new AppError("forbidden");
    return ctx;
  };

  const startSession = (reply: FastifyReply, user: UserDto) => {
    reply.setCookie(SESSION_COOKIE, s.auth.createSession(user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: options.secureCookies ?? false,
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
    });
    return user;
  };

  app.get("/healthz", async () => ({ ok: true }));

  // ---- accounts -----------------------------------------------------------------------------

  app.post("/api/auth/register", async (req, reply) => {
    const { username, password } = credentialsSchema.parse(req.body);
    return startSession(reply, await s.auth.register(username, password));
  });

  app.post("/api/auth/login", async (req, reply) => {
    const { username, password } = credentialsSchema.parse(req.body);
    return startSession(reply, await s.auth.login(username, password));
  });

  app.post("/api/auth/logout", async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) s.auth.destroySession(token);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/api/me", async (req) => requireUser(req));

  app.patch("/api/me", async (req) => {
    const user = requireUser(req);
    const { locale } = updateProfileSchema.parse(req.body);
    s.auth.setLocale(user.id, locale);
    return { ...user, locale };
  });

  app.post("/api/admin/reset-password", async (req) => {
    const actor = requireUser(req);
    const body = z.object({ username: usernameSchema, newPassword: passwordSchema }).parse(req.body);
    await s.auth.resetPassword(actor, body.username, body.newPassword);
    return { ok: true };
  });

  app.post("/api/admin/systems", async (req) => {
    if (requireUser(req).role !== "admin") throw new AppError("forbidden");
    if (!(req.body instanceof Readable)) throw new AppError("import_invalid");
    // System packages are a few text files; zip bodies arrive as streams, so collect this small one.
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req.body) {
      size += (chunk as Buffer).length;
      if (size > MAX_SYSTEM_ZIP_BYTES) throw new AppError("asset_too_large");
      chunks.push(chunk as Buffer);
    }
    return s.systems.installZip(Buffer.concat(chunks));
  });

  app.get("/api/systems", async (req) => {
    requireUser(req);
    return s.systems.list();
  });

  // ---- worlds -------------------------------------------------------------------------------

  app.get("/api/worlds", async (req) => s.worlds.listFor(requireUser(req)));

  app.post("/api/worlds", async (req) => {
    const { name, systemId } = createWorldSchema.parse(req.body);
    if (!s.systems.get(systemId)) throw new AppError("not_found");
    return s.worlds.create(requireUser(req), name, systemId);
  });

  app.patch<{ Params: { id: string } }>("/api/worlds/:id", async (req) => {
    const worldId = req.params.id;
    requireGm(req, worldId);
    const patch = updateWorldSchema.parse(req.body);
    if (patch.name) s.worlds.rename(worldId, patch.name);
    if (patch.activeSceneId !== undefined) s.scenes.setActive(worldId, patch.activeSceneId);
    if (patch.templateOverrides) s.actors.setTemplateOverrides(worldId, patch.templateOverrides);
    hub.broadcastState(worldId);
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>("/api/worlds/:id/system", async (req) => {
    requireMember(req, req.params.id);
    return s.actors.systemInfo(req.params.id);
  });

  app.post<{ Params: { id: string } }>("/api/worlds/:id/invites", async (req) => {
    return { code: s.worlds.createInvite(requireUser(req), req.params.id) };
  });

  app.post<{ Params: { code: string } }>("/api/invites/:code/join", async (req) => {
    const { displayName, color } = joinWorldSchema.parse(req.body);
    const user = requireUser(req);
    const world = s.worlds.join(user, req.params.code, displayName, color);
    hub.broadcastState(world.id);
    return world;
  });

  // ---- assets -------------------------------------------------------------------------------

  app.post<{ Params: { id: string } }>("/api/worlds/:id/assets", async (req, reply) => {
    requireGm(req, req.params.id);
    if (Buffer.isBuffer(req.body)) {
      const asset = s.assets.save(req.params.id, req.body);
      return { id: asset.id, mime: asset.mime };
    }
    if (!(req.body instanceof Readable)) throw new AppError("asset_invalid");
    // Refuse early when the declared size is already too big, without reading the body.
    if (Number(req.headers["content-length"] ?? 0) > maxVideoBytes) {
      reply.header("connection", "close");
      throw new AppError("asset_too_large");
    }
    const asset = await s.assets.saveVideoStream(req.params.id, req.body);
    return { id: asset.id, mime: asset.mime };
  });

  app.get<{ Params: { id: string } }>("/api/assets/:id", async (req, reply) => {
    const asset = s.assets.find(req.params.id);
    // Same answer for missing assets and assets of other worlds.
    if (!asset || !s.worlds.roleOf(asset.worldId, requireUser(req).id)) throw new AppError("not_found");
    // The id never changes what it points to, so it doubles as the validator.
    const etag = `"${asset.id}"`;
    reply
      .header("cache-control", "private, max-age=31536000, immutable")
      .header("x-content-type-options", "nosniff")
      .header("accept-ranges", "bytes")
      .header("etag", etag)
      .type(asset.mime);
    const sent = String(req.headers["if-none-match"] ?? "");
    if (sent.split(",").some((tag) => tag.trim().replace(/^W\//, "") === etag || tag.trim() === "*")) return reply.status(304).send();
    const range = parseRange(req.headers.range, asset.size);
    if (range === "unsatisfiable") return reply.status(416).header("content-range", `bytes */${asset.size}`).send();
    if (range) {
      return reply
        .status(206)
        .header("content-range", `bytes ${range.start}-${range.end}/${asset.size}`)
        .header("content-length", range.end - range.start + 1)
        .send(s.assets.open(asset, range));
    }
    return reply.header("content-length", asset.size).send(s.assets.open(asset));
  });

  // ---- scenes -------------------------------------------------------------------------------

  app.post<{ Params: { id: string } }>("/api/worlds/:id/scenes", async (req) => {
    requireGm(req, req.params.id);
    const scene = s.scenes.create(req.params.id, createSceneSchema.parse(req.body));
    hub.broadcastState(req.params.id);
    return scene;
  });

  app.patch<{ Params: { id: string } }>("/api/scenes/:id", async (req) => {
    const worldId = s.scenes.worldIdOf(req.params.id);
    if (!worldId) throw new AppError("not_found");
    requireGm(req, worldId);
    const scene = s.scenes.update(req.params.id, worldId, updateSceneSchema.parse(req.body));
    hub.broadcastState(worldId);
    return scene;
  });

  app.post<{ Params: { id: string; wallId: string } }>("/api/scenes/:id/doors/:wallId", async (req) => {
    const worldId = s.scenes.worldIdOf(req.params.id);
    if (!worldId) throw new AppError("not_found");
    requireGm(req, worldId);
    const { open } = z.object({ open: z.boolean() }).parse(req.body);
    if (!s.scenes.setDoorOpen(req.params.id, req.params.wallId, open)) throw new AppError("not_found");
    hub.broadcastState(worldId);
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/api/scenes/:id", async (req) => {
    const worldId = s.scenes.worldIdOf(req.params.id);
    if (!worldId) throw new AppError("not_found");
    requireGm(req, worldId);
    s.scenes.remove(req.params.id, worldId);
    hub.broadcastState(worldId);
    return { ok: true };
  });

  // ---- tokens -------------------------------------------------------------------------------

  app.post<{ Params: { id: string } }>("/api/worlds/:id/tokens", async (req) => {
    requireGm(req, req.params.id);
    const token = s.tokens.create(req.params.id, createTokenSchema.parse(req.body));
    hub.publishToken(req.params.id, null, token);
    return token;
  });

  app.patch<{ Params: { id: string } }>("/api/tokens/:id", async (req) => {
    const found = s.tokens.find(req.params.id);
    if (!found) throw new AppError("not_found");
    const { viewer } = requireMember(req, found.worldId);
    const patch = updateTokenSchema.parse(req.body);
    if (!s.tokens.canSee(found.token, viewer, s.scenes.activeSceneId(found.worldId))) throw new AppError("not_found");
    if (!s.tokens.canControl(found.token, viewer)) throw new AppError("forbidden");
    if (viewer.role !== "gm" && Object.keys(patch).some((k) => !(PLAYER_EDITABLE_TOKEN_FIELDS as readonly string[]).includes(k)))
      throw new AppError("forbidden");
    const after = s.tokens.update(found.token.id, found.worldId, patch);
    hub.publishToken(found.worldId, found.token, after);
    // A name or visibility change alters what the initiative list may show; other tokens must not cause traffic.
    if (s.combat.isCombatant(found.token.id)) hub.publishCombat(found.worldId);
    return after;
  });

  app.delete<{ Params: { id: string } }>("/api/tokens/:id", async (req) => {
    const found = s.tokens.find(req.params.id);
    if (!found) throw new AppError("not_found");
    requireGm(req, found.worldId);
    const wasCombatant = s.combat.isCombatant(found.token.id);
    s.tokens.remove(found.token.id);
    hub.publishTokenRemoved(found.worldId, found.token);
    if (wasCombatant) hub.publishCombat(found.worldId);
    return { ok: true };
  });

  // ---- initiative ---------------------------------------------------------------------------

  app.put<{ Params: { id: string } }>("/api/worlds/:id/combat/combatants", async (req) => {
    requireGm(req, req.params.id);
    const { tokenId, score } = setCombatantSchema.parse(req.body);
    s.combat.setCombatant(req.params.id, tokenId, score);
    hub.publishCombat(req.params.id);
    return { ok: true };
  });

  app.delete<{ Params: { id: string; tokenId: string } }>("/api/worlds/:id/combat/combatants/:tokenId", async (req) => {
    requireGm(req, req.params.id);
    s.combat.removeCombatant(req.params.id, req.params.tokenId);
    hub.publishCombat(req.params.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/api/worlds/:id/combat/next", async (req) => {
    requireGm(req, req.params.id);
    s.combat.nextTurn(req.params.id);
    hub.publishCombat(req.params.id);
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/api/worlds/:id/combat", async (req) => {
    requireGm(req, req.params.id);
    s.combat.end(req.params.id);
    hub.publishCombat(req.params.id);
    return { ok: true };
  });

  // ---- chat ---------------------------------------------------------------------------------

  app.post<{ Params: { id: string } }>("/api/worlds/:id/messages", async (req) => {
    const worldId = req.params.id;
    const { user, viewer } = requireMember(req, worldId);
    const input = sendMessageSchema.parse(req.body);
    const member = s.worlds.member(worldId, user.id)!;
    const message = s.chat.send(worldId, { userId: user.id, displayName: member.displayName, role: viewer.role }, input);
    hub.publishMessage(worldId, message);
    return message;
  });

  // ---- actors (sheets) ----------------------------------------------------------------------

  app.post<{ Params: { id: string } }>("/api/worlds/:id/actors", async (req) => {
    requireGm(req, req.params.id);
    const actor = s.actors.create(req.params.id, createActorSchema.parse(req.body));
    hub.broadcastState(req.params.id);
    return actor;
  });

  app.patch<{ Params: { id: string } }>("/api/actors/:id", async (req) => {
    const actor = s.actors.find(req.params.id);
    if (!actor) throw new AppError("not_found");
    const { viewer } = requireMember(req, actor.worldId);
    const updated = s.actors.update(actor.id, viewer, updateActorSchema.parse(req.body));
    hub.broadcastState(actor.worldId);
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/api/actors/:id", async (req) => {
    const actor = s.actors.find(req.params.id);
    if (!actor) throw new AppError("not_found");
    requireGm(req, actor.worldId);
    s.actors.remove(actor.id);
    hub.broadcastState(actor.worldId);
    return { ok: true };
  });

  registerPortabilityRoutes(app, s, { requireUser, requireGm, broadcastState: (id) => hub.broadcastState(id) });

  if (options.clientDir && existsSync(options.clientDir)) {
    app.register(fastifyStatic, { root: options.clientDir });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/api/") ? reply.status(404).send({ error: "not_found" }) : reply.sendFile("index.html"),
    );
  }

  return app;
}
