import type { ServerMessage } from "@openvtt/shared";
import { afterEach, expect, it } from "vitest";
import { call, closeApps, connect, listen, newApp, PNG, signUp, upload } from "./test-utils.ts";

afterEach(closeApps);

const OGG = Buffer.concat([Buffer.from("OggS"), Buffer.alloc(4096, 1)]);
const MP3 = Buffer.concat([Buffer.from("ID3"), Buffer.alloc(4096, 2)]);

it("accepts mp3 and ogg uploads, plays one for the table and refuses audio as a map or token", async () => {
  const app = newApp();
  const gm = await signUp(app, "alice");
  const bob = await signUp(app, "bob");
  const world = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "Table" })).json();
  const { code } = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/invites`)).json();
  await call(app, bob.cookie, "POST", `/api/invites/${code}/join`, { displayName: "Bob", color: "#112233" });

  const ogg = (await upload(app, gm.cookie, world.id, OGG, "audio/ogg")).json();
  expect(ogg.mime).toBe("audio/ogg");
  expect((await upload(app, gm.cookie, world.id, MP3, "audio/mpeg")).json().mime).toBe("audio/mpeg");
  expect((await upload(app, gm.cookie, world.id, PNG, "audio/mpeg")).statusCode).toBe(400);

  const scene = await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/scenes`, { name: "A", width: 10, height: 10, assetId: ogg.id });
  expect(scene.statusCode).toBe(400);
  const image = (await upload(app, gm.cookie, world.id, PNG)).json();
  expect((await call(app, gm.cookie, "PUT", `/api/worlds/${world.id}/ambient`, { assetId: image.id, playing: true })).statusCode).toBe(400);
  // A refused request leaves nothing in the game master's log.
  const log = (await call(app, gm.cookie, "GET", `/api/worlds/${world.id}/audit`)).json() as { action: string }[];
  expect(log.filter((e) => e.action.startsWith("music."))).toEqual([]);
  expect((await call(app, bob.cookie, "PUT", `/api/worlds/${world.id}/ambient`, { assetId: ogg.id, playing: true })).statusCode).toBe(403);
  expect((await call(app, gm.cookie, "PUT", `/api/worlds/${world.id}/ambient`, { assetId: ogg.id, playing: true })).statusCode).toBe(200);

  expect((await call(app, bob.cookie, "PUT", `/api/worlds/${world.id}/ambient/volume`, { volume: 0.3 })).statusCode).toBe(403);
  expect((await call(app, gm.cookie, "PUT", `/api/worlds/${world.id}/ambient/volume`, { volume: 2 })).statusCode).toBe(400);
  expect((await call(app, gm.cookie, "PUT", `/api/worlds/${world.id}/ambient/volume`, { volume: 0.3 })).statusCode).toBe(200);

  const address = await listen(app);
  const conn = connect(address, world.id, bob.cookie);
  const msg = await conn.waitFor((m): m is Extract<ServerMessage, { type: "world.state" }> => m.type === "world.state");
  conn.ws.close();
  expect(msg.state.ambient).toEqual({ assetId: ogg.id, playing: true, volume: 0.3 });
  expect(msg.state.environment).toEqual({ time: "day", weather: "clear", season: "none" });

  const night = { time: "night", weather: "storm", season: "autumn" };
  expect((await call(app, bob.cookie, "PUT", `/api/worlds/${world.id}/environment`, night)).statusCode).toBe(403);
  expect((await call(app, gm.cookie, "PUT", `/api/worlds/${world.id}/environment`, { ...night, weather: "hail" })).statusCode).toBe(400);
  expect((await call(app, gm.cookie, "PUT", `/api/worlds/${world.id}/environment`, night)).statusCode).toBe(200);
  const conn2 = connect(address, world.id, bob.cookie);
  const msg2 = await conn2.waitFor((m): m is Extract<ServerMessage, { type: "world.state" }> => m.type === "world.state");
  conn2.ws.close();
  expect(msg2.state.environment).toEqual(night);
});
