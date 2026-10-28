import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { call, closeApps, fakeMp4, fakeWebm, newApp, PNG, signUp, upload } from "./test-utils.ts";

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
