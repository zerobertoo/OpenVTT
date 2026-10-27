import { existsSync } from "node:fs";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import { z, ZodError } from "zod";
import {
  createWorldSchema,
  credentialsSchema,
  joinWorldSchema,
  passwordSchema,
  updateProfileSchema,
  usernameSchema,
  type ErrorCode,
  type UserDto,
} from "@openvtt/shared";
import { AuthService, SESSION_TTL_MS } from "./auth.ts";
import { openDatabase } from "./db.ts";
import { AppError } from "./errors.ts";
import { Hub } from "./hub.ts";
import { WorldService } from "./worlds.ts";

export const SESSION_COOKIE = "openvtt_session";

export interface AppOptions {
  dbPath: string;
  /** Directory with the built client; served when it exists. */
  clientDir?: string;
  secureCookies?: boolean;
}

export function buildApp(options: AppOptions) {
  const db = openDatabase(options.dbPath);
  const auth = new AuthService(db);
  const worlds = new WorldService(db);
  const hub = new Hub(auth, worlds, SESSION_COOKIE);
  const app = Fastify({ logger: false });

  app.register(fastifyCookie);
  hub.attach(app.server);
  app.addHook("onClose", async () => {
    hub.closeAll();
    db.close();
  });

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError) return reply.status(error.status).send({ error: error.code });
    if (error instanceof ZodError || (error as { validation?: unknown }).validation)
      return reply.status(400).send({ error: "invalid_input" satisfies ErrorCode });
    app.log.error(error);
    return reply.status(500).send({ error: "internal_error" satisfies ErrorCode });
  });

  const requireUser = (req: FastifyRequest): UserDto => {
    const user = auth.userFromSession(req.cookies[SESSION_COOKIE]);
    if (!user) throw new AppError("unauthenticated");
    return user;
  };

  const startSession = (reply: FastifyReply, user: UserDto) => {
    reply.setCookie(SESSION_COOKIE, auth.createSession(user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: options.secureCookies ?? false,
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
    });
    return user;
  };

  app.post("/api/auth/register", async (req, reply) => {
    const { username, password } = credentialsSchema.parse(req.body);
    return startSession(reply, await auth.register(username, password));
  });

  app.post("/api/auth/login", async (req, reply) => {
    const { username, password } = credentialsSchema.parse(req.body);
    return startSession(reply, await auth.login(username, password));
  });

  app.post("/api/auth/logout", async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) auth.destroySession(token);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/api/me", async (req) => requireUser(req));

  app.patch("/api/me", async (req) => {
    const user = requireUser(req);
    const { locale } = updateProfileSchema.parse(req.body);
    auth.setLocale(user.id, locale);
    return { ...user, locale };
  });

  app.post("/api/admin/reset-password", async (req) => {
    const actor = requireUser(req);
    const body = z.object({ username: usernameSchema, newPassword: passwordSchema }).parse(req.body);
    await auth.resetPassword(actor, body.username, body.newPassword);
    return { ok: true };
  });

  app.get("/api/worlds", async (req) => worlds.listFor(requireUser(req)));

  app.post("/api/worlds", async (req) => {
    const { name } = createWorldSchema.parse(req.body);
    return worlds.create(requireUser(req), name);
  });

  app.post<{ Params: { id: string } }>("/api/worlds/:id/invites", async (req) => {
    return { code: worlds.createInvite(requireUser(req), req.params.id) };
  });

  app.post<{ Params: { code: string } }>("/api/invites/:code/join", async (req) => {
    const { displayName, color } = joinWorldSchema.parse(req.body);
    const user = requireUser(req);
    const world = worlds.join(user, req.params.code, displayName, color);
    hub.broadcastState(world.id);
    return world;
  });

  if (options.clientDir && existsSync(options.clientDir)) {
    app.register(fastifyStatic, { root: options.clientDir });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/api/") ? reply.status(404).send({ error: "not_found" }) : reply.sendFile("index.html"),
    );
  }

  return app;
}
