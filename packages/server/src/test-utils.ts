import type { ServerMessage } from "@openvtt/shared";
import { WebSocket } from "ws";
import { buildApp, SESSION_COOKIE } from "./app.ts";

export type App = ReturnType<typeof buildApp>;

export const apps: App[] = [];

export function newApp(dbPath = ":memory:"): App {
  const app = buildApp({ dbPath });
  apps.push(app);
  return app;
}

export async function closeApps() {
  await Promise.all(apps.splice(0).map((a) => a.close()));
}

/** Registers a user and returns the session cookie header value. */
export async function signUp(app: App, username: string, password = "correct horse") {
  const res = await app.inject({ method: "POST", url: "/api/auth/register", payload: { username, password } });
  const cookie = `${SESSION_COOKIE}=${res.cookies.find((c) => c.name === SESSION_COOKIE)?.value}`;
  return { res, cookie, user: res.json() };
}

export const call = (app: App, cookie: string, method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: object) =>
  app.inject({ method, url, payload, headers: { cookie } });

export const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

export const upload = (app: App, cookie: string, worldId: string, body: Buffer, type = "image/png") =>
  app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/assets`,
    payload: body,
    headers: { cookie, "content-type": type },
  });

export async function listen(app: App) {
  await app.listen({ port: 0, host: "127.0.0.1" });
  return (app.server.address() as { port: number }).port;
}

/** WebSocket client that records every message and lets tests await a matching one. */
export function connect(port: number, worldId: string, cookie: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?world=${worldId}`, { headers: { cookie } });
  const seen: ServerMessage[] = [];
  const waiters: (() => void)[] = [];
  ws.on("message", (raw) => {
    seen.push(JSON.parse(raw.toString()));
    waiters.splice(0).forEach((w) => w());
  });
  const opened = new Promise<void>((resolve, reject) => {
    ws.on("open", () => resolve());
    ws.on("error", reject);
  });
  async function waitFor<T extends ServerMessage>(pred: (m: ServerMessage) => m is T): Promise<T>;
  async function waitFor(pred: (m: ServerMessage) => boolean): Promise<ServerMessage>;
  async function waitFor(pred: (m: ServerMessage) => boolean) {
    for (;;) {
      const hit = seen.find(pred);
      if (hit) return hit;
      await new Promise<void>((resolve, reject) => {
        waiters.push(resolve);
        setTimeout(() => reject(new Error("timeout waiting for message")), 3000);
      });
    }
  }
  /** Resolves after a short quiet period; use to assert that nothing arrives. */
  const settle = () => new Promise((r) => setTimeout(r, 150));
  return { ws, seen, opened, waitFor, settle };
}
