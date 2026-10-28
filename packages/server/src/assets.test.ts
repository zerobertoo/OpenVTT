import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { ServerMessage } from "@openvtt/shared";
import { unzipSync, zipSync } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type App, call, closeApps, connect, fakeMp4, fakeWebm, listen, newApp, PNG, signUp, upload } from "./test-utils.ts";

afterEach(closeApps);

async function setup(options: { maxVideoBytes?: number } = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), "openvtt-assets-test-"));
  const app = newApp(":memory:", { ...options, dataDir });
  assetDirs.set(app, join(dataDir, "assets"));
  const gm = await signUp(app, "alice");
  const bob = await signUp(app, "bob");
  const world = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "Table" })).json();
  const { code } = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/invites`)).json();
  await call(app, bob.cookie, "POST", `/api/invites/${code}/join`, { displayName: "Bob", color: "#112233" });
  return { app, gm, bob, world };
}

/** Files left in the data directory's asset folder; `.part` files must never survive a failed upload. */
const importZip = (app: App, cookie: string, body: Buffer) =>
  app.inject({ method: "POST", url: "/api/worlds/import", payload: body, headers: { cookie, "content-type": "application/zip" } });

const assetDirs = new WeakMap<object, string>();
const assetFiles = (app: ReturnType<typeof newApp>) => readdirSync(assetDirs.get(app)!);

describe("video assets", () => {
  it("stores webm and mp4 uploads on disk and reports the detected type", async () => {
    const { app, gm, world } = await setup();
    const webm = await upload(app, gm.cookie, world.id, fakeWebm(), "video/webm");
    expect(webm.statusCode).toBe(200);
    expect(webm.json().mime).toBe("video/webm");
    const mp4 = await upload(app, gm.cookie, world.id, fakeMp4(), "video/mp4");
    expect(mp4.json().mime).toBe("video/mp4");
    // The bytes served back are exactly the bytes uploaded.
    const back = await call(app, gm.cookie, "GET", `/api/assets/${webm.json().id}`);
    expect(back.rawPayload.equals(fakeWebm())).toBe(true);
    expect(back.headers["content-type"]).toBe("video/webm");
  });

  it("decides the type from the bytes, not from the declared content type", async () => {
    const { app, gm, world } = await setup();
    const res = await upload(app, gm.cookie, world.id, fakeMp4(), "video/webm");
    expect(res.json().mime).toBe("video/mp4");
  });

  it("rejects a file whose bytes are not a video, whatever it claims to be", async () => {
    const { app, gm, world } = await setup();
    for (const body of [PNG, Buffer.from("just text, definitely not a video"), Buffer.alloc(0)]) {
      const res = await upload(app, gm.cookie, world.id, body, "video/webm");
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: "asset_invalid" });
    }
    // Matroska shares the EBML magic but is not WebM.
    const mkv = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x88]), Buffer.from("matroska"), Buffer.alloc(100)]);
    expect((await upload(app, gm.cookie, world.id, mkv, "video/webm")).statusCode).toBe(400);
    // An ISO box with an image brand (HEIC) is not an mp4 we accept.
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic"), Buffer.alloc(100)]);
    expect((await upload(app, gm.cookie, world.id, heic, "video/mp4")).statusCode).toBe(400);
    expect(assetFiles(app)).toEqual([]);
  });

  it("rejects videos over the configured limit and leaves no file behind", async () => {
    const { app, gm, world } = await setup({ maxVideoBytes: 10_000 });
    const res = await upload(app, gm.cookie, world.id, fakeWebm(20_000), "video/webm");
    expect(res.statusCode).toBe(413);
    expect(res.json()).toEqual({ error: "asset_too_large" });
    expect(assetFiles(app)).toEqual([]);
    // Exactly at the limit still works.
    const small = fakeWebm(10_000 - fakeWebm(0).length);
    expect(small.length).toBe(10_000);
    expect((await upload(app, gm.cookie, world.id, small, "video/webm")).statusCode).toBe(200);
  });

  it("enforces the limit while streaming, even when no content-length is declared", async () => {
    const { app, gm, world } = await setup({ maxVideoBytes: 10_000 });
    const chunks = Readable.from([fakeWebm(4000), Buffer.alloc(4000), Buffer.alloc(4000)]);
    const res = await app.inject({
      method: "POST",
      url: `/api/worlds/${world.id}/assets`,
      payload: chunks,
      headers: { cookie: gm.cookie, "content-type": "video/webm", "transfer-encoding": "chunked" },
    });
    expect(res.statusCode).toBe(413);
    expect(assetFiles(app)).toEqual([]);
  });

  it("cleans up when the stream breaks halfway", async () => {
    const { app, gm, world } = await setup();
    const broken = new Readable({
      read() {
        this.push(fakeWebm(8000));
        this.destroy(new Error("connection reset"));
      },
    });
    await app
      .inject({
        method: "POST",
        url: `/api/worlds/${world.id}/assets`,
        payload: broken,
        headers: { cookie: gm.cookie, "content-type": "video/webm" },
      })
      .catch(() => undefined);
    // The handler cleans up asynchronously after the client side has already failed.
    await vi.waitFor(() => expect(assetFiles(app)).toEqual([]));
  });

  it("serves ranges so the browser can seek and start playing early", async () => {
    const { app, gm, world } = await setup();
    const body = fakeWebm(1000);
    const id = (await upload(app, gm.cookie, world.id, body, "video/webm")).json().id;
    const get = (headers: Record<string, string> = {}) =>
      app.inject({ method: "GET", url: `/api/assets/${id}`, headers: { cookie: gm.cookie, ...headers } });

    const full = await get();
    expect(full.statusCode).toBe(200);
    expect(full.headers["accept-ranges"]).toBe("bytes");
    expect(full.headers["content-length"]).toBe(String(body.length));
    expect(full.headers["cache-control"]).toBe("private, max-age=31536000, immutable");

    const part = await get({ range: "bytes=10-19" });
    expect(part.statusCode).toBe(206);
    expect(part.headers["content-range"]).toBe(`bytes 10-19/${body.length}`);
    expect(part.rawPayload.equals(body.subarray(10, 20))).toBe(true);

    const open = await get({ range: "bytes=1000-" });
    expect(open.rawPayload.equals(body.subarray(1000))).toBe(true);
    const suffix = await get({ range: "bytes=-5" });
    expect(suffix.statusCode).toBe(206);
    expect(suffix.rawPayload.equals(body.subarray(body.length - 5))).toBe(true);
    // An end past the file is clamped.
    expect((await get({ range: "bytes=0-99999" })).headers["content-range"]).toBe(`bytes 0-${body.length - 1}/${body.length}`);

    const beyond = await get({ range: `bytes=${body.length}-` });
    expect(beyond.statusCode).toBe(416);
    expect(beyond.headers["content-range"]).toBe(`bytes */${body.length}`);
    // Malformed or multi-range requests fall back to the whole file.
    expect((await get({ range: "bytes=abc" })).statusCode).toBe(200);
    expect((await get({ range: "bytes=0-1,5-6" })).statusCode).toBe(200);
  });

  it("answers 304 when the browser already has the asset, and still hides other worlds' assets", async () => {
    const { app, gm, world } = await setup();
    const id = (await upload(app, gm.cookie, world.id, PNG)).json().id;
    const first = await call(app, gm.cookie, "GET", `/api/assets/${id}`);
    expect(first.headers.etag).toBe(`"${id}"`);
    const again = await app.inject({
      method: "GET",
      url: `/api/assets/${id}`,
      headers: { cookie: gm.cookie, "if-none-match": first.headers.etag as string },
    });
    expect(again.statusCode).toBe(304);
    expect(again.rawPayload.length).toBe(0);
    const eve = await signUp(app, "eve");
    const hidden = await app.inject({
      method: "GET",
      url: `/api/assets/${id}`,
      headers: { cookie: eve.cookie, "if-none-match": first.headers.etag as string },
    });
    expect(hidden.statusCode).toBe(404);
  });

  it("carries videos through export and import byte for byte", async () => {
    const { app, gm, world } = await setup();
    const video = fakeMp4(3 * 1024 * 1024);
    const asset = (await upload(app, gm.cookie, world.id, video, "video/mp4")).json();
    await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/scenes`, { name: "Moving", assetId: asset.id, width: 640, height: 360 });

    const exported = await call(app, gm.cookie, "GET", `/api/worlds/${world.id}/export`);
    expect(exported.statusCode).toBe(200);
    // The export is the real zip format: a standard reader finds the video untouched.
    expect(Buffer.from(unzipSync(exported.rawPayload)[`assets/${asset.id}.mp4`]!).equals(video)).toBe(true);

    const importer = await signUp(app, "dave");
    const imported = await importZip(app, importer.cookie, exported.rawPayload);
    expect(imported.statusCode).toBe(200);
    const port = await listen(app);
    const conn = connect(port, imported.json().id, importer.cookie);
    const state = await conn.waitFor((m): m is Extract<ServerMessage, { type: "world.state" }> => m.type === "world.state");
    const copy = state.state.scenes[0]!;
    expect(copy.assetId).not.toBe(asset.id);
    const back = await call(app, importer.cookie, "GET", `/api/assets/${copy.assetId}`);
    expect(back.headers["content-type"]).toBe("video/mp4");
    expect(back.rawPayload.equals(video)).toBe(true);
    conn.ws.close();
  });

  it("imports archives made by other zip writers, entries in any order", async () => {
    const { app } = await setup();
    const user = await signUp(app, "dave");
    const world = {
      format: "openvtt-world",
      version: 1,
      world: { name: "Old", systemId: "generic", templateOverrides: {}, activeSceneId: null },
      assets: [{ id: "a", file: "assets/clip.webm" }],
      scenes: [
        { id: "s", name: "S", assetId: "a", width: 10, height: 10, gridType: "none", gridSize: 70, gridDistance: 5, distanceUnit: "ft" },
      ],
      actors: [],
      tokens: [],
      messages: [],
    };
    // Assets first, world.json last, plain stored + deflated entries from the one-shot writer.
    const zip = Buffer.from(
      zipSync({ "assets/clip.webm": [fakeWebm(), { level: 0 }], "world.json": new TextEncoder().encode(JSON.stringify(world)) }),
    );
    expect((await importZip(app, user.cookie, zip)).statusCode).toBe(200);
  });

  it("stops a zip bomb at the size limit and cleans up after every failed import", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "openvtt-import-test-"));
    // A small video limit keeps the per-file cap at the 15 MB image limit, which the bomb below blows past.
    const app = newApp(":memory:", { dataDir, maxVideoBytes: 1_000_000 });
    const user = await signUp(app, "dave");
    const world = {
      format: "openvtt-world",
      version: 1,
      world: { name: "Bomb", systemId: "generic", templateOverrides: {}, activeSceneId: null },
      assets: [{ id: "a", file: "assets/big.png" }],
      scenes: [],
      actors: [],
      tokens: [],
      messages: [],
    };
    // 32 MB of zeros deflates to a few KB, far below what the archive claims once unpacked.
    const bomb = Buffer.from(
      zipSync({ "world.json": new TextEncoder().encode(JSON.stringify(world)), "assets/big.png": new Uint8Array(32 * 1024 * 1024) }),
    );
    expect(bomb.length).toBeLessThan(200_000);
    const res = await importZip(app, user.cookie, bomb);
    expect(res.statusCode).toBe(413);
    expect(res.json()).toEqual({ error: "asset_too_large" });

    // A video whose bytes are not a video is refused after unpacking, with its temp file removed.
    const fake = Buffer.from(
      zipSync({
        "world.json": new TextEncoder().encode(JSON.stringify({ ...world, assets: [{ id: "a", file: "assets/x.webm" }] })),
        "assets/x.webm": new TextEncoder().encode("this is not a video"),
      }),
    );
    expect((await importZip(app, user.cookie, fake)).statusCode).toBe(400);
    expect((await call(app, user.cookie, "GET", "/api/worlds")).json()).toEqual([]);
    expect(readdirSync(dataDir).filter((f) => f.startsWith("import-"))).toEqual([]);
    expect(readdirSync(join(dataDir, "assets"))).toEqual([]);
  });

  it("ignores archive entries with hostile names", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "openvtt-import-test-"));
    const app = newApp(":memory:", { dataDir });
    const user = await signUp(app, "dave");
    const world = {
      format: "openvtt-world",
      version: 1,
      world: { name: "Sneaky", systemId: "generic", templateOverrides: {}, activeSceneId: null },
      assets: [],
      scenes: [],
      actors: [],
      tokens: [],
      messages: [],
    };
    const zip = Buffer.from(
      zipSync({
        "world.json": new TextEncoder().encode(JSON.stringify(world)),
        "../evil.txt": new TextEncoder().encode("x"),
        "assets/../../evil.png": PNG,
        "/etc/passwd": new TextEncoder().encode("x"),
      }),
    );
    expect((await importZip(app, user.cookie, zip)).statusCode).toBe(200);
    expect(readdirSync(dataDir).filter((f) => f !== "assets" && f !== "systems")).toEqual([]);
    expect(readdirSync(join(dataDir, "assets"))).toEqual([]);
  });

  it("only lets the game master upload", async () => {
    const { app, bob, world } = await setup();
    expect((await upload(app, bob.cookie, world.id, fakeWebm(), "video/webm")).statusCode).toBe(403);
  });

  it("does not accept a video as a token image", async () => {
    const { app, gm, world } = await setup();
    const video = (await upload(app, gm.cookie, world.id, fakeWebm(), "video/webm")).json();
    const scene = (
      await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/scenes`, { name: "Moving", assetId: video.id, width: 640, height: 360 })
    ).json();
    expect(scene.assetId).toBe(video.id);
    const token = await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/tokens`, {
      sceneId: scene.id,
      name: "T",
      x: 0,
      y: 0,
      assetId: video.id,
    });
    expect(token.json()).toEqual({ error: "asset_invalid" });
  });
});
