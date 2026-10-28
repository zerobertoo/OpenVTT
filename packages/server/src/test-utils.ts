import type { ServerMessage } from "@openvtt/shared";
import { WebSocket } from "ws";
import { type AppOptions, buildApp, SESSION_COOKIE } from "./app.ts";

export type App = ReturnType<typeof buildApp>;

export const apps: App[] = [];

export function newApp(dbPath = ":memory:", options: Partial<AppOptions> = {}): App {
  const app = buildApp({ dbPath, ...options });
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

export const call = (app: App, cookie: string, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, payload?: object) =>
  app.inject({ method, url, payload, headers: { cookie } });

export const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

/** Minimal buffers that carry just the container signature, padded to `size` bytes. */
export const fakeWebm = (size = 8192) =>
  Buffer.concat([
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x84]),
    Buffer.from("webm"),
    Buffer.alloc(size, 7),
  ]);
export const fakeMp4 = (size = 8192) =>
  Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(size, 9)]);

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
