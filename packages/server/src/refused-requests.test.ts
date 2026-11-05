import { afterEach, describe, expect, it, vi } from "vitest";
import { type App, call, closeApps, newApp, signUp } from "./test-utils.ts";

afterEach(async () => {
  vi.restoreAllMocks();
  await closeApps();
});

async function setup() {
  const app = newApp();
  const gm = await signUp(app, "alice");
  const world = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "Table" })).json();
  const scene = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/scenes`, { name: "One", width: 100, height: 100 })).json();
  return { app, gm, world, scene };
}

it("leaves no audit entry when the last floor cannot be deleted", async () => {
  const { app, gm, world, scene } = await setup();
  expect((await call(app, gm.cookie, "DELETE", `/api/floors/${scene.floors[0].id}`)).statusCode).toBe(400);
  const log = (await call(app, gm.cookie, "GET", `/api/worlds/${world.id}/audit`)).json() as { action: string }[];
  expect(log.map((entry) => entry.action)).not.toContain("floor.delete");
});

describe("large map saves", () => {
  // A body that cannot be parsed tells whether the server read it: reading it first would answer 400.
  const unreadableBody = { payload: "{", headers: { "content-type": "application/json" } };
  const send = (app: App, cookie: string, method: "POST" | "PATCH", url: string) =>
    app.inject({ method, url, payload: unreadableBody.payload, headers: { ...unreadableBody.headers, cookie } });

  it("refuses anyone but the game master before reading the body", async () => {
    const { app, world, scene } = await setup();
    const stranger = await signUp(app, "mallory");
    const floorId = scene.floors[0].id;
    expect((await send(app, stranger.cookie, "PATCH", `/api/floors/${floorId}`)).statusCode).toBe(403);
    expect((await send(app, stranger.cookie, "PATCH", `/api/scenes/${scene.id}`)).statusCode).toBe(403);
    expect((await send(app, stranger.cookie, "POST", `/api/scenes/${scene.id}/floors`)).statusCode).toBe(403);
    expect((await send(app, stranger.cookie, "POST", `/api/worlds/${world.id}/scenes`)).statusCode).toBe(403);
    expect((await send(app, stranger.cookie, "PATCH", "/api/floors/nothing")).statusCode).toBe(404);
  });

  it("limits how many a client can send, since anyone can be the game master of a world of their own", async () => {
    const { app, gm, scene } = await setup();
    const url = `/api/floors/${scene.floors[0].id}`;
    for (let sent = 0; sent < 300; sent++) expect((await call(app, gm.cookie, "PATCH", url, { name: "Ground" })).statusCode).toBe(200);
    const res = await call(app, gm.cookie, "PATCH", url, { name: "Ground" });
    expect(res.statusCode).toBe(429);
    expect(res.json()).toEqual({ error: "too_many_attempts" });
  });
});

it("answers a body that is not valid JSON as bad input, without logging a server failure", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const { app, gm, world } = await setup();
  const res = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${world.id}`,
    payload: "{",
    headers: { cookie: gm.cookie, "content-type": "application/json" },
  });
  expect(res.statusCode).toBe(400);
  expect(res.json()).toEqual({ error: "invalid_input" });
  expect(log).not.toHaveBeenCalled();
});

it("answers a repeated floor parameter as bad input, not a server failure", async () => {
  const { app, gm, scene } = await setup();
  const clear = await call(app, gm.cookie, "DELETE", `/api/scenes/${scene.id}/drawings?floorId=a&floorId=b`);
  expect(clear.statusCode).toBe(400);
  const uvtt = await call(app, gm.cookie, "GET", `/api/scenes/${scene.id}/export.dd2vtt?floorId=a&floorId=b`);
  expect(uvtt.statusCode).toBe(400);
});
