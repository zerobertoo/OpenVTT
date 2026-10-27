import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { zipSync } from "fflate";
import type { MessageDto, ServerMessage, TokenDto } from "@openvtt/shared";
import { call, closeApps, connect, listen, newApp, PNG, signUp, upload, type App } from "./test-utils.ts";

afterEach(closeApps);

/** A world with a GM (alice), a player (bob) with one controlled token, and a second player (carol). */
async function setup() {
  const app = newApp();
  const gm = await signUp(app, "alice");
  const bob = await signUp(app, "bob");
  const carol = await signUp(app, "carol");
  const world = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "Table" })).json();
  const { code } = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/invites`)).json();
  for (const [p, name] of [[bob, "Bob"], [carol, "Carol"]] as const)
    await call(app, p.cookie, "POST", `/api/invites/${code}/join`, { displayName: name, color: "#112233" });

  const asset = (await upload(app, gm.cookie, world.id, PNG)).json();
  const scene = (
    await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/scenes`, { name: "Cave", assetId: asset.id, width: 1000, height: 800 })
  ).json();
  const makeToken = async (name: string, extra: object = {}) =>
    (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/tokens`, { sceneId: scene.id, name, x: 70, y: 70, ...extra })).json() as TokenDto;
  const bobToken = await makeToken("Hero", { controllerIds: [bob.user.id] });
  const hiddenToken = await makeToken("Ambusher", { hidden: true });
  return { app, gm, bob, carol, world, scene, asset, bobToken, hiddenToken, makeToken };
}

describe("assets", () => {
  it("accepts only real images uploaded by the GM and serves them to members only", async () => {
    const { app, gm, bob, world, asset } = await setup();
    expect((await upload(app, gm.cookie, world.id, Buffer.from("not an image"))).json()).toEqual({ error: "asset_invalid" });
    expect((await upload(app, gm.cookie, world.id, Buffer.from("<svg/>"), "image/png")).statusCode).toBe(400);
    expect((await upload(app, bob.cookie, world.id, PNG)).statusCode).toBe(403);
    expect((await call(app, bob.cookie, "GET", `/api/assets/${asset.id}`)).headers["content-type"]).toBe("image/png");

    const eve = await signUp(app, "eve");
    expect((await call(app, eve.cookie, "GET", `/api/assets/${asset.id}`)).statusCode).toBe(404);
  });

  it("rejects scenes and tokens that reference assets from another world", async () => {
    const { app, gm, asset } = await setup();
    const other = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "Other" })).json();
    const res = await call(app, gm.cookie, "POST", `/api/worlds/${other.id}/scenes`, { name: "x", assetId: asset.id, width: 10, height: 10 });
    expect(res.json()).toEqual({ error: "asset_invalid" });
  });
});

describe("scenes", () => {
  it("only the GM manages scenes; players only receive the active one", async () => {
    const { app, gm, bob, world, scene } = await setup();
    expect((await call(app, bob.cookie, "POST", `/api/worlds/${world.id}/scenes`, { name: "x", width: 10, height: 10 })).statusCode).toBe(403);
    expect((await call(app, bob.cookie, "PATCH", `/api/scenes/${scene.id}`, { name: "x" })).statusCode).toBe(403);

    const second = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/scenes`, { name: "Dungeon", width: 500, height: 500 })).json();
    const port = await listen(app);
    const player = connect(port, world.id, bob.cookie);
    const initial = await player.waitFor((m): m is Extract<ServerMessage, { type: "world.state" }> => m.type === "world.state");
    expect(initial.state.scenes.map((s) => s.id)).toEqual([scene.id]);

    await call(app, gm.cookie, "PATCH", `/api/worlds/${world.id}`, { activeSceneId: second.id });
    const next = await player.waitFor((m) => m.type === "world.state" && m.state.activeSceneId === second.id);
    expect(next.type === "world.state" && next.state.scenes.map((s) => s.id)).toEqual([second.id]);
    expect(next.type === "world.state" && next.state.tokens).toEqual([]);
    player.ws.close();
  });
});

describe("tokens", () => {
  it("lets controllers change position/rotation only, GM everything", async () => {
    const { app, gm, bob, carol, bobToken } = await setup();
    const patch = (cookie: string, body: object) => call(app, cookie, "PATCH", `/api/tokens/${bobToken.id}`, body);
    expect((await patch(bob.cookie, { x: 140, rotation: 90 })).statusCode).toBe(200);
    expect((await patch(bob.cookie, { name: "Renamed" })).statusCode).toBe(403);
    expect((await patch(bob.cookie, { hidden: true })).statusCode).toBe(403);
    expect((await patch(carol.cookie, { x: 1 })).statusCode).toBe(403);
    expect((await patch(gm.cookie, { name: "Renamed", size: 2 })).json()).toMatchObject({ name: "Renamed", size: 2, x: 140 });
    expect((await call(app, bob.cookie, "DELETE", `/api/tokens/${bobToken.id}`)).statusCode).toBe(403);
  });

  it("never reveals hidden tokens to players, including their ids and movement", async () => {
    const { app, gm, bob, world, hiddenToken, bobToken } = await setup();
    expect((await call(app, bob.cookie, "PATCH", `/api/tokens/${hiddenToken.id}`, { x: 5 })).statusCode).toBe(404);

    const port = await listen(app);
    const player = connect(port, world.id, bob.cookie);
    const gmConn = connect(port, world.id, gm.cookie);
    await player.waitFor((m) => m.type === "world.state");
    await gmConn.waitFor((m) => m.type === "world.state" && m.state.tokens.length === 2);

    const initial = player.seen.find((m) => m.type === "world.state");
    expect(initial?.type === "world.state" && initial.state.tokens.map((t) => t.name)).toEqual(["Hero"]);

    // Moving a hidden token produces no traffic for the player.
    const before = player.seen.length;
    await call(app, gm.cookie, "PATCH", `/api/tokens/${hiddenToken.id}`, { x: 300 });
    await player.settle();
    expect(player.seen.length).toBe(before);
    expect(JSON.stringify(player.seen)).not.toContain(hiddenToken.id);

    // Revealing it sends an upsert; hiding it again sends a removal.
    await call(app, gm.cookie, "PATCH", `/api/tokens/${hiddenToken.id}`, { hidden: false });
    await player.waitFor((m) => m.type === "token.upsert" && m.token.id === hiddenToken.id);
    await call(app, gm.cookie, "PATCH", `/api/tokens/${hiddenToken.id}`, { hidden: true });
    await player.waitFor((m) => m.type === "token.remove" && m.tokenId === hiddenToken.id);

    // A visible token's changes still reach the player.
    await call(app, gm.cookie, "PATCH", `/api/tokens/${bobToken.id}`, { x: 400 });
    await player.waitFor((m) => m.type === "token.upsert" && m.token.id === bobToken.id && m.token.x === 400);
    player.ws.close();
    gmConn.ws.close();
  });

  it("applies websocket moves only from controllers, clamps to the map and broadcasts them", async () => {
    const { app, gm, bob, carol, world, bobToken } = await setup();
    const port = await listen(app);
    const bobConn = connect(port, world.id, bob.cookie);
    const carolConn = connect(port, world.id, carol.cookie);
    const gmConn = connect(port, world.id, gm.cookie);
    await Promise.all([bobConn.opened, carolConn.opened, gmConn.opened]);
    await carolConn.waitFor((m) => m.type === "world.state");

    bobConn.ws.send(JSON.stringify({ type: "token.move", tokenId: bobToken.id, x: 9999, y: 200 }));
    const moved = await gmConn.waitFor((m) => m.type === "token.upsert" && m.token.id === bobToken.id && m.token.y === 200);
    expect(moved.type === "token.upsert" && moved.token.x).toBe(1000);
    await carolConn.waitFor((m) => m.type === "token.upsert" && m.token.id === bobToken.id);

    carolConn.ws.send(JSON.stringify({ type: "token.move", tokenId: bobToken.id, x: 1, y: 1 }));
    await carolConn.waitFor((m) => m.type === "error" && m.code === "forbidden");
    carolConn.ws.send("not json");
    await carolConn.waitFor((m) => m.type === "error" && m.code === "invalid_input");

    const stored = (await call(app, gm.cookie, "PATCH", `/api/tokens/${bobToken.id}`, {})).json();
    expect(stored).toMatchObject({ x: 1000, y: 200 });
    [bobConn, carolConn, gmConn].forEach((c) => c.ws.close());
  });

  it("rejects controllers who are not members of the world", async () => {
    const { app, gm, world, scene } = await setup();
    const eve = await signUp(app, "eve");
    const res = await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/tokens`, {
      sceneId: scene.id, name: "x", x: 0, y: 0, controllerIds: [eve.user.id],
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("chat and dice", () => {
  const send = (app: App, cookie: string, worldId: string, body: object) =>
    call(app, cookie, "POST", `/api/worlds/${worldId}/messages`, body);

  it("rolls dice on the server for /r commands and rejects bad notation", async () => {
    const { app, bob, world } = await setup();
    const msg = (await send(app, bob.cookie, world.id, { content: "/r 2d6+3" })).json() as MessageDto;
    expect(msg.kind).toBe("roll");
    expect(msg.roll!.total).toBeGreaterThanOrEqual(5);
    expect(msg.roll!.total).toBeLessThanOrEqual(15);
    expect((await send(app, bob.cookie, world.id, { content: "/r banana" })).json()).toEqual({ error: "roll_invalid" });
  });

  it("delivers whispers and GM-only rolls only to those allowed, live and in history", async () => {
    const { app, gm, bob, carol, world } = await setup();
    const port = await listen(app);
    const [gmConn, bobConn, carolConn] = [gm, bob, carol].map((u) => connect(port, world.id, u.cookie));
    await Promise.all([gmConn!.opened, bobConn!.opened, carolConn!.opened]);

    await send(app, gm.cookie, world.id, { content: "secret for bob", toUserId: bob.user.id });
    await send(app, bob.cookie, world.id, { content: "/r 1d20", gmOnly: true });
    await send(app, carol.cookie, world.id, { content: "hello all" });

    await carolConn!.waitFor((m) => m.type === "chat.message" && m.message.content === "hello all");
    const contents = (conn: typeof gmConn) =>
      conn!.seen.flatMap((m) => (m.type === "chat.message" ? [m.message.content] : []));
    expect(contents(gmConn)).toEqual(["secret for bob", "/r 1d20", "hello all"].filter(Boolean));
    expect(contents(bobConn)).toContain("secret for bob");
    expect(contents(bobConn)).toContain("/r 1d20");
    expect(contents(carolConn)).toEqual(["hello all"]);

    // Late joiners get the same filtering from the history snapshot.
    const late = connect(port, world.id, carol.cookie);
    const state = await late.waitFor((m) => m.type === "world.state");
    expect(state.type === "world.state" && state.state.messages.map((m) => m.content)).toEqual(["hello all"]);
    [gmConn, bobConn, carolConn, late].forEach((c) => c!.ws.close());
  });

  it("limits whispers to GM ↔ player conversations", async () => {
    const { app, gm, bob, carol, world } = await setup();
    expect((await send(app, bob.cookie, world.id, { content: "psst", toUserId: carol.user.id })).statusCode).toBe(403);
    expect((await send(app, bob.cookie, world.id, { content: "psst", toUserId: gm.user.id })).statusCode).toBe(200);
  });

  it("does not let non-members read or write chat", async () => {
    const { app, world } = await setup();
    const eve = await signUp(app, "eve");
    expect((await send(app, eve.cookie, world.id, { content: "hi" })).statusCode).toBe(403);
  });
});

describe("sheets", () => {
  it("shows players only their own actors and validates edits against the template", async () => {
    const { app, gm, bob, carol, world } = await setup();
    const hero = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/actors`, { name: "Hero", type: "character" })).json();
    const monster = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/actors`, { name: "Dragon", type: "npc" })).json();
    expect((await call(app, bob.cookie, "POST", `/api/worlds/${world.id}/actors`, { name: "x", type: "npc" })).statusCode).toBe(403);
    await call(app, gm.cookie, "PATCH", `/api/actors/${hero.id}`, { ownerId: bob.user.id });

    const edit = (cookie: string, id: string, body: object) => call(app, cookie, "PATCH", `/api/actors/${id}`, body);
    expect((await edit(bob.cookie, hero.id, { data: { strength: 16 } })).json().data).toEqual({ strength: 16 });
    expect((await edit(bob.cookie, hero.id, { data: { strength_mod: 9 } })).statusCode).toBe(400);
    expect((await edit(bob.cookie, hero.id, { data: { strength: "lots" } })).statusCode).toBe(400);
    expect((await edit(bob.cookie, hero.id, { ownerId: carol.user.id })).statusCode).toBe(403);
    expect((await edit(carol.cookie, hero.id, { data: { strength: 1 } })).statusCode).toBe(403);
    expect((await edit(bob.cookie, monster.id, { data: { hp: 1 } })).statusCode).toBe(403);

    const port = await listen(app);
    const player = connect(port, world.id, bob.cookie);
    const state = await player.waitFor((m) => m.type === "world.state");
    expect(state.type === "world.state" && state.state.actors.map((a) => a.name)).toEqual(["Hero"]);
    expect(JSON.stringify(player.seen)).not.toContain("Dragon");
    player.ws.close();
  });

  it("lets the GM replace a template with validated JSON and revert it", async () => {
    const { app, gm, bob, world } = await setup();
    const custom = { sections: [{ id: "main", fields: [{ id: "luck", type: "number" }, { id: "luck_x2", type: "computed", formula: "@luck * 2" }] }] };
    const set = (cookie: string, templateOverrides: object) => call(app, cookie, "PATCH", `/api/worlds/${world.id}`, { templateOverrides });
    expect((await set(bob.cookie, { character: custom })).statusCode).toBe(403);
    expect((await set(gm.cookie, { character: { sections: [{ id: "s", fields: [{ id: "a", type: "computed", formula: "@nope" }] }] } })).json()).toEqual({ error: "template_invalid" });
    expect((await set(gm.cookie, { character: custom })).statusCode).toBe(200);

    const info = (await call(app, bob.cookie, "GET", `/api/worlds/${world.id}/system`)).json();
    expect(info.overridden).toEqual(["character"]);
    expect(info.templates.character.sections[0].fields[0].id).toBe("luck");
    await set(gm.cookie, { character: null });
    expect((await call(app, bob.cookie, "GET", `/api/worlds/${world.id}/system`)).json().overridden).toEqual([]);
  });
});

describe("system packages", () => {
  const goodPackage = () => ({
    "system.json": JSON.stringify({
      id: "mini", name: "Mini", version: "1.0.0", author: "t", license: "CC-BY-4.0", attribution: "Credit",
      minOpenVTT: "0.1.0", actorTypes: { character: { template: "templates/character.json" } }, locales: ["en"],
    }),
    "templates/character.json": JSON.stringify({ sections: [{ id: "s", fields: [{ id: "level", type: "number" }] }] }),
    "locales/en.json": "{}",
  });
  const zip = (files: Record<string, string>) => Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, new TextEncoder().encode(v)]))));
  const install = (app: App, cookie: string, body: Buffer) =>
    app.inject({ method: "POST", url: "/api/admin/systems", payload: body, headers: { cookie, "content-type": "application/zip" } });

  it("lets only the admin install valid packages, which can then be chosen for new worlds", async () => {
    const { app, gm, bob } = await setup();
    expect((await install(app, bob.cookie, zip(goodPackage()))).statusCode).toBe(403);
    expect((await install(app, gm.cookie, zip(goodPackage()))).json()).toMatchObject({ id: "mini" });
    expect((await call(app, gm.cookie, "GET", "/api/systems")).json().map((s: { id: string }) => s.id)).toEqual(expect.arrayContaining(["generic", "mini"]));
    expect((await call(app, bob.cookie, "POST", "/api/worlds", { name: "W", systemId: "mini" })).json().id).toBeTruthy();
    expect((await call(app, bob.cookie, "POST", "/api/worlds", { name: "W", systemId: "nope" })).statusCode).toBe(404);
  });

  it("rejects malformed packages, unsafe paths and duplicates", async () => {
    const { app, gm } = await setup();
    expect((await install(app, gm.cookie, zip({ ...goodPackage(), "../evil.json": "{}" }))).json()).toEqual({ error: "import_invalid" });
    expect((await install(app, gm.cookie, zip({ ...goodPackage(), "templates/character.json": "{\"sections\":[{\"id\":\"s\",\"fields\":[{\"id\":\"a\",\"type\":\"computed\",\"formula\":\"@x\"}]}]}" }))).statusCode).toBe(400);
    expect((await install(app, gm.cookie, Buffer.from("junk"))).statusCode).toBe(400);
    expect((await install(app, gm.cookie, zip(goodPackage()))).statusCode).toBe(200);
    expect((await install(app, gm.cookie, zip(goodPackage()))).statusCode).toBe(400);
  });
});

describe("export and import", () => {
  it("round-trips a world into a new one owned by the importer, dropping private data", async () => {
    const { app, gm, bob, world, scene, bobToken } = await setup();
    const hero = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/actors`, { name: "Hero", type: "character" })).json();
    await call(app, gm.cookie, "PATCH", `/api/actors/${hero.id}`, { data: { strength: 18 } });
    await call(app, gm.cookie, "PATCH", `/api/tokens/${bobToken.id}`, { actorId: hero.id });
    await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/messages`, { content: "public line" });
    await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/messages`, { content: "private line", toUserId: bob.user.id });

    expect((await call(app, bob.cookie, "GET", `/api/worlds/${world.id}/export`)).statusCode).toBe(403);
    const exported = await call(app, gm.cookie, "GET", `/api/worlds/${world.id}/export`);
    expect(exported.headers["content-type"]).toBe("application/zip");

    const importer = await signUp(app, "dave");
    const imported = await app.inject({
      method: "POST", url: "/api/worlds/import", payload: exported.rawPayload,
      headers: { cookie: importer.cookie, "content-type": "application/zip" },
    });
    expect(imported.statusCode).toBe(200);
    const copy = imported.json();
    expect(copy).toMatchObject({ name: "Table", role: "gm" });
    expect(copy.id).not.toBe(world.id);

    const port = await listen(app);
    const conn = connect(port, copy.id, importer.cookie);
    const state = await conn.waitFor((m): m is Extract<ServerMessage, { type: "world.state" }> => m.type === "world.state");
    const s = state.state;
    expect(s.scenes.map((x) => x.name)).toEqual(["Cave"]);
    expect(s.scenes[0]!.id).not.toBe(scene.id);
    expect(s.tokens.map((t) => t.name).sort()).toEqual(["Ambusher", "Hero"]);
    expect(s.tokens.every((t) => t.controllerIds.length === 0)).toBe(true);
    expect(s.actors[0]).toMatchObject({ name: "Hero", ownerId: null, data: { strength: 18 } });
    expect(s.tokens.find((t) => t.name === "Hero")!.actorId).toBe(s.actors[0]!.id);
    expect(s.messages.map((m) => m.content)).toEqual(["public line"]);
    expect(s.activeSceneId).toBe(s.scenes[0]!.id);
    expect((await call(app, importer.cookie, "GET", `/api/assets/${s.scenes[0]!.assetId}`)).statusCode).toBe(200);
    conn.ws.close();
  });

  it("rejects corrupt, unsafe or inconsistent files without leaving a world behind", async () => {
    const { app } = await setup();
    const user = await signUp(app, "dave");
    const post = (body: Buffer) =>
      app.inject({ method: "POST", url: "/api/worlds/import", payload: body, headers: { cookie: user.cookie, "content-type": "application/zip" } });
    const file = (worldJson: object, extra: Record<string, Uint8Array> = {}) =>
      Buffer.from(zipSync({ "world.json": new TextEncoder().encode(JSON.stringify(worldJson)), ...extra }));
    const base = { format: "openvtt-world", version: 1, world: { name: "W", systemId: "generic", templateOverrides: {}, activeSceneId: null }, assets: [], scenes: [], actors: [], tokens: [], messages: [] };

    expect((await post(Buffer.from("junk"))).json()).toEqual({ error: "import_invalid" });
    expect((await post(file({ ...base, world: { ...base.world, systemId: "unknown" } }))).statusCode).toBe(400);
    expect((await post(file({ ...base, assets: [{ id: "a", file: "assets/missing.png" }] }))).statusCode).toBe(400);
    expect((await post(file({ ...base, assets: [{ id: "a", file: "assets/fake.png" }] }, { "assets/fake.png": new TextEncoder().encode("not an image") }))).statusCode).toBe(400);
    expect((await post(file({ ...base, actors: [{ id: "x", type: "npc", name: "N", data: { hp: "bad" } }] }))).statusCode).toBe(400);
    expect((await call(app, user.cookie, "GET", "/api/worlds")).json()).toEqual([]);
    expect((await post(file(base))).statusCode).toBe(200);
  });
});
