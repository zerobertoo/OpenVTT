import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocket } from "ws";
import type { ServerMessage, WorldStateDto } from "@openvtt/shared";
import { buildApp, SESSION_COOKIE } from "./app.ts";

const apps: ReturnType<typeof buildApp>[] = [];
const tmpDirs: string[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
  tmpDirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }));
});

const newApp = (dbPath = ":memory:") => {
  const app = buildApp({ dbPath });
  apps.push(app);
  return app;
};

type App = ReturnType<typeof newApp>;

/** Registers a user and returns the session cookie header value. */
async function signUp(app: App, username: string, password = "correct horse") {
  const res = await app.inject({ method: "POST", url: "/api/auth/register", payload: { username, password } });
  const cookie = `${SESSION_COOKIE}=${res.cookies.find((c) => c.name === SESSION_COOKIE)?.value}`;
  return { res, cookie, user: res.json() };
}

const call = (app: App, cookie: string, method: "GET" | "POST" | "PATCH", url: string, payload?: object) =>
  app.inject({ method, url, payload, headers: { cookie } });

describe("auth", () => {
  it("makes the first user admin and the rest regular users", async () => {
    const app = newApp();
    expect((await signUp(app, "alice")).user.role).toBe("admin");
    expect((await signUp(app, "bob")).user.role).toBe("user");
  });

  it("rejects duplicate usernames case-insensitively and weak input", async () => {
    const app = newApp();
    await signUp(app, "alice");
    expect((await signUp(app, "ALICE")).res.json()).toEqual({ error: "username_taken" });
    const short = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { username: "carol", password: "short" },
    });
    expect(short.statusCode).toBe(400);
  });

  it("never stores the password in clear text", async () => {
    const dir = mkdtempSync(join(tmpdir(), "openvtt-"));
    tmpDirs.push(dir);
    const app = newApp(join(dir, "t.db"));
    await signUp(app, "alice", "super secret pw");
    const { DatabaseSync } = await import("node:sqlite");
    const inspector = new DatabaseSync(join(dir, "t.db"));
    const row = inspector.prepare("SELECT password_hash FROM users").get() as { password_hash: string };
    inspector.close();
    await app.close();
    expect(row.password_hash).toMatch(/^\$argon2/);
  });

  it("logs in, authenticates and logs out", async () => {
    const app = newApp();
    await signUp(app, "alice", "correct horse");
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "alice", password: "correct horse" },
    });
    expect(login.statusCode).toBe(200);
    const cookie = `${SESSION_COOKIE}=${login.cookies[0]!.value}`;
    expect((await call(app, cookie, "GET", "/api/me")).json().username).toBe("alice");
    await call(app, cookie, "POST", "/api/auth/logout");
    expect((await call(app, cookie, "GET", "/api/me")).statusCode).toBe(401);
  });

  it("locks the account after repeated failures", async () => {
    const app = newApp();
    await signUp(app, "alice", "correct horse");
    const attempt = (password: string) =>
      app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "alice", password } });
    for (let i = 0; i < 5; i++) expect((await attempt("wrong password")).json().error).toBe("invalid_credentials");
    expect((await attempt("correct horse")).json().error).toBe("too_many_attempts");
  });

  it("lets only the admin reset passwords", async () => {
    const app = newApp();
    const admin = await signUp(app, "alice");
    const user = await signUp(app, "bob");
    const body = { username: "bob", newPassword: "brand new pass" };
    expect((await call(app, user.cookie, "POST", "/api/admin/reset-password", body)).statusCode).toBe(403);
    expect((await call(app, admin.cookie, "POST", "/api/admin/reset-password", body)).statusCode).toBe(200);
    expect((await call(app, user.cookie, "GET", "/api/me")).statusCode).toBe(401);
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "bob", password: "brand new pass" },
    });
    expect(login.statusCode).toBe(200);
  });
});

describe("worlds and permissions", () => {
  it("only the GM can invite; invited users join as players", async () => {
    const app = newApp();
    const gm = await signUp(app, "alice");
    const player = await signUp(app, "bob");
    const world = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "Campaign" })).json();
    expect(world.role).toBe("gm");

    expect((await call(app, player.cookie, "POST", `/api/worlds/${world.id}/invites`)).statusCode).toBe(403);
    const { code } = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/invites`)).json();
    const joined = await call(app, player.cookie, "POST", `/api/invites/${code}/join`, {
      displayName: "Bob",
      color: "#112233",
    });
    expect(joined.json()).toMatchObject({ id: world.id, role: "player" });
    expect((await call(app, player.cookie, "GET", "/api/worlds")).json()).toHaveLength(1);
  });

  it("rejects unknown invites and hides worlds from non-members", async () => {
    const app = newApp();
    const gm = await signUp(app, "alice");
    const stranger = await signUp(app, "eve");
    await call(app, gm.cookie, "POST", "/api/worlds", { name: "Secret" });
    const bad = await call(app, stranger.cookie, "POST", "/api/invites/nope/join", {
      displayName: "Eve",
      color: "#112233",
    });
    expect(bad.json()).toEqual({ error: "invite_invalid" });
    expect((await call(app, stranger.cookie, "GET", "/api/worlds")).json()).toEqual([]);
  });
});

describe("websocket sync", () => {
  const listen = async (app: App) => {
    await app.listen({ port: 0, host: "127.0.0.1" });
    return (app.server.address() as { port: number }).port;
  };

  /** Collects messages and lets tests await the next matching one. */
  function connect(port: number, worldId: string, cookie: string) {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?world=${worldId}`, { headers: { cookie } });
    const seen: ServerMessage[] = [];
    const waiters: (() => void)[] = [];
    ws.on("message", (raw) => {
      seen.push(JSON.parse(raw.toString()));
      waiters.splice(0).forEach((w) => w());
    });
    const until = async (pred: (s: WorldStateDto) => boolean) => {
      for (;;) {
        const hit = seen.find((m) => m.type === "world.state" && pred(m.state));
        if (hit && hit.type === "world.state") return hit.state;
        await new Promise<void>((resolve, reject) => {
          waiters.push(resolve);
          setTimeout(() => reject(new Error("timeout waiting for state")), 3000);
        });
      }
    };
    return { ws, until };
  }

  it("rejects unauthenticated and non-member connections", async () => {
    const app = newApp();
    const gm = await signUp(app, "alice");
    const stranger = await signUp(app, "eve");
    const world = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "W" })).json();
    const port = await listen(app);

    for (const cookie of ["", stranger.cookie]) {
      const { ws } = connect(port, world.id, cookie);
      await new Promise<void>((resolve) => ws.on("error", () => resolve()));
    }
  });

  it("broadcasts presence and new members to everyone in the world", async () => {
    const app = newApp();
    const gm = await signUp(app, "alice");
    const player = await signUp(app, "bob");
    const world = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "W" })).json();
    const port = await listen(app);

    const gmConn = connect(port, world.id, gm.cookie);
    const first = await gmConn.until(() => true);
    expect(first.yourRole).toBe("gm");
    expect(first.members.map((m) => [m.displayName, m.online])).toEqual([["alice", true]]);

    const { code } = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/invites`)).json();
    await call(app, player.cookie, "POST", `/api/invites/${code}/join`, { displayName: "Bob", color: "#112233" });
    const afterJoin = await gmConn.until((s) => s.members.length === 2);
    expect(afterJoin.members.find((m) => m.displayName === "Bob")?.online).toBe(false);

    const playerConn = connect(port, world.id, player.cookie);
    const playerState = await playerConn.until((s) => s.members.every((m) => m.online));
    expect(playerState.yourRole).toBe("player");
    await gmConn.until((s) => s.members.every((m) => m.online));

    playerConn.ws.close();
    await gmConn.until((s) => s.members.find((m) => m.displayName === "Bob")?.online === false);
    gmConn.ws.close();
  });
});

describe("persistence", () => {
  it("keeps accounts, sessions and worlds across a server restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "openvtt-"));
    tmpDirs.push(dir);
    const dbPath = join(dir, "restart.db");

    const first = buildApp({ dbPath });
    const gm = await signUp(first, "alice");
    await call(first, gm.cookie, "POST", "/api/worlds", { name: "Persistent" });
    await first.close();

    const second = newApp(dbPath);
    expect((await call(second, gm.cookie, "GET", "/api/me")).json().username).toBe("alice");
    expect((await call(second, gm.cookie, "GET", "/api/worlds")).json()[0].name).toBe("Persistent");
  });
});
