import type { ServerMessage, WorldStateDto } from "@openvtt/shared";
import { unzipSync, zipSync } from "fflate";
import { afterEach, describe, expect, it } from "vitest";
import { assertFitsImportLimits } from "./portability.ts";
import { type App, call, closeApps, connect, listen, newApp, signUp, upload } from "./test-utils.ts";

afterEach(closeApps);

describe("export size limits", () => {
  it("refuses a world that the import would reject, and accepts one right at the limits", () => {
    const MiB = 1024 * 1024;
    expect(() => assertFitsImportLimits(256 * MiB, 700 * MiB)).not.toThrow();
    expect(() => assertFitsImportLimits(256 * MiB + 1, 0)).toThrow(expect.objectContaining({ code: "asset_too_large" }));
    expect(() => assertFitsImportLimits(10 * MiB, 1024 * MiB)).toThrow(expect.objectContaining({ code: "asset_too_large" }));
  });
});

const OGG = Buffer.concat([Buffer.from("OggS"), Buffer.alloc(4096, 1)]);

async function setup(options: Parameters<typeof newApp>[1] = {}) {
  const app = newApp(":memory:", options);
  const gm = await signUp(app, "alice");
  const world = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "Table" })).json();
  return { app, gm, world };
}

const importZip = (app: App, cookie: string, payload: Buffer | Uint8Array) =>
  app.inject({
    method: "POST",
    url: "/api/worlds/import",
    payload: Buffer.from(payload),
    headers: { cookie, "content-type": "application/zip" },
  });

async function stateOf(app: App, worldId: string, cookie: string): Promise<WorldStateDto> {
  const conn = connect(await listen(app), worldId, cookie);
  const msg = await conn.waitFor((m): m is Extract<ServerMessage, { type: "world.state" }> => m.type === "world.state");
  conn.ws.close();
  return msg.state;
}

const worldJsonOf = (zip: Uint8Array) => JSON.parse(new TextDecoder().decode(unzipSync(zip)["world.json"]));

describe("exporting and importing a world", () => {
  it("brings back token rotation, the atmosphere and the music", async () => {
    const { app, gm, world } = await setup();
    const scene = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/scenes`, { name: "Crypt", width: 100, height: 100 })).json();
    const token = (
      await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/tokens`, { sceneId: scene.id, name: "Hero", x: 1, y: 1 })
    ).json();
    await call(app, gm.cookie, "PATCH", `/api/tokens/${token.id}`, { rotation: 90 });
    const night = { time: "night", weather: "storm", season: "autumn" };
    await call(app, gm.cookie, "PUT", `/api/worlds/${world.id}/environment`, night);
    const song = (await upload(app, gm.cookie, world.id, OGG, "audio/ogg")).json();
    await call(app, gm.cookie, "PUT", `/api/worlds/${world.id}/ambient`, { assetId: song.id, playing: true });
    await call(app, gm.cookie, "PUT", `/api/worlds/${world.id}/ambient/volume`, { volume: 0.3 });

    const zip = (await call(app, gm.cookie, "GET", `/api/worlds/${world.id}/export`)).rawPayload;
    const imported = (await importZip(app, gm.cookie, zip)).json();
    const state = await stateOf(app, imported.id, gm.cookie);

    expect(state.tokens[0]).toMatchObject({ name: "Hero", rotation: 90 });
    expect(state.environment).toEqual(night);
    expect(state.ambient).toMatchObject({ playing: true, volume: 0.3 });
    expect(state.ambient?.assetId).not.toBe(song.id);
  });

  it("keeps the whole public chat, not only what the table shows, and no private messages", async () => {
    const { app, gm, world } = await setup({ chatMessagesPerMinute: 1000 });
    for (let i = 0; i < 130; i++) await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/messages`, { content: `line ${i}` });
    await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/messages`, { content: "secret", gmOnly: true });

    const { messages } = worldJsonOf((await call(app, gm.cookie, "GET", `/api/worlds/${world.id}/export`)).rawPayload);
    expect(messages).toHaveLength(130);
    expect(messages[0].content).toBe("line 0");
    expect(messages[129].content).toBe("line 129");
  });

  it("imports back a world whose file is larger than 16 MiB", async () => {
    const { app, gm, world } = await setup();
    const page = { body: "x".repeat(50000), audience: [] };
    for (let i = 0; i < 340; i++) await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/handouts`, { ...page, title: `Page ${i}` });

    const zip = (await call(app, gm.cookie, "GET", `/api/worlds/${world.id}/export`)).rawPayload;
    expect(unzipSync(zip)["world.json"]!.length).toBeGreaterThan(16 * 1024 * 1024);
    const imported = await importZip(app, gm.cookie, zip);
    expect(imported.statusCode).toBe(200);
    expect((await stateOf(app, imported.json().id, gm.cookie)).handouts).toHaveLength(340);
  }, 30_000);

  it("still stops a world file above the limit", async () => {
    const { app, gm } = await setup();
    const res = await importZip(app, gm.cookie, zipSync({ "world.json": new Uint8Array(257 * 1024 * 1024) }));
    expect(res.statusCode).toBe(413);
    expect(res.json()).toEqual({ error: "asset_too_large" });
  }, 30_000);

  it("imports files written before the atmosphere and music were exported", async () => {
    const { app, gm, world } = await setup();
    const file = worldJsonOf((await call(app, gm.cookie, "GET", `/api/worlds/${world.id}/export`)).rawPayload);
    delete file.world.environment;
    delete file.world.ambient;
    const imported = await importZip(app, gm.cookie, zipSync({ "world.json": new TextEncoder().encode(JSON.stringify(file)) }));
    expect(imported.statusCode).toBe(200);
    expect((await stateOf(app, imported.json().id, gm.cookie)).environment).toEqual({ time: "day", weather: "clear", season: "none" });
  });

  it("refuses music that points at something other than an audio file of the world", async () => {
    const { app, gm, world } = await setup();
    const file = worldJsonOf((await call(app, gm.cookie, "GET", `/api/worlds/${world.id}/export`)).rawPayload);
    file.world.ambient = { assetId: "missing", playing: true, volume: 1 };
    const res = await importZip(app, gm.cookie, zipSync({ "world.json": new TextEncoder().encode(JSON.stringify(file)) }));
    expect(res.json()).toEqual({ error: "import_invalid" });
  });
});
