import type { SceneDto, ServerMessage } from "@openvtt/shared";
import { afterEach, describe, expect, it } from "vitest";
import { call, closeApps, connect, listen, newApp, signUp } from "./test-utils.ts";

afterEach(closeApps);

const WALLS = [
  { x1: 0, y1: 0, x2: 500, y2: 0 },
  { x1: 500, y1: 0, x2: 500, y2: 300, kind: "door", open: false },
];
const LIGHTS = [{ x: 100, y: 100, radius: 4, intensity: 2, color: "#ffe5bf" }];

async function setup() {
  const app = newApp();
  const gm = await signUp(app, "alice");
  const bob = await signUp(app, "bob");
  const world = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "Table" })).json();
  const { code } = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/invites`)).json();
  await call(app, bob.cookie, "POST", `/api/invites/${code}/join`, { displayName: "Bob", color: "#112233" });
  const scene = (
    await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/scenes`, {
      name: "Crypt",
      width: 1000,
      height: 800,
      walls: WALLS,
      lights: LIGHTS,
      bakedLighting: true,
    })
  ).json() as SceneDto;
  return { app, gm, bob, world, scene };
}

const ports = new WeakMap<object, number>();
const stateOf = async (app: Parameters<typeof listen>[0], worldId: string, cookie: string) => {
  if (!ports.has(app)) ports.set(app, await listen(app));
  const conn = connect(ports.get(app)!, worldId, cookie);
  const msg = await conn.waitFor((m): m is Extract<ServerMessage, { type: "world.state" }> => m.type === "world.state");
  conn.ws.close();
  return msg.state;
};

describe("walls, doors and lights", () => {
  it("stores them with the scene and lets the game master read them back", async () => {
    const { app, gm, world, scene } = await setup();
    expect(scene.walls).toHaveLength(2);
    expect(scene.walls[1]).toMatchObject({ kind: "door", open: false });
    expect(scene.lights[0]).toMatchObject({ radius: 4, color: "#ffe5bf", shadows: true });
    expect(scene.bakedLighting).toBe(true);
    const state = await stateOf(app, world.id, gm.cookie);
    expect(state.scenes[0]!.walls).toHaveLength(2);
  });

  it("never sends walls, doors or lights to players", async () => {
    const { app, bob, world } = await setup();
    const state = await stateOf(app, world.id, bob.cookie);
    expect(state.scenes).toHaveLength(1);
    expect(state.scenes[0]!.walls).toEqual([]);
    expect(state.scenes[0]!.lights).toEqual([]);
    expect(JSON.stringify(state)).not.toContain("ffe5bf");
  });

  it("keeps the map data when an update does not mention it, and replaces it when it does", async () => {
    const { app, gm, scene } = await setup();
    const renamed = (await call(app, gm.cookie, "PATCH", `/api/scenes/${scene.id}`, { name: "Crypt 2" })).json();
    expect(renamed.walls).toHaveLength(2);
    const replaced = (await call(app, gm.cookie, "PATCH", `/api/scenes/${scene.id}`, { walls: [WALLS[0]] })).json();
    expect(replaced.walls).toHaveLength(1);
    expect(replaced.lights).toHaveLength(1);
  });

  it("opens a door for the game master only, and only doors", async () => {
    const { app, gm, bob, world, scene } = await setup();
    const [wall, door] = scene.walls;
    const url = (id: string) => `/api/scenes/${scene.id}/doors/${id}`;
    expect((await call(app, bob.cookie, "POST", url(door!.id), { open: true })).statusCode).toBe(403);
    expect((await call(app, gm.cookie, "POST", url(wall!.id), { open: true })).statusCode).toBe(404);
    expect((await call(app, gm.cookie, "POST", url(door!.id), { open: true })).statusCode).toBe(200);
    expect((await stateOf(app, world.id, gm.cookie)).scenes[0]!.walls[1]!.open).toBe(true);
  });

  it("rejects coordinates outside the map limits and too many walls", async () => {
    const { app, gm, world } = await setup();
    const bad = (walls: unknown[]) =>
      call(app, gm.cookie, "POST", `/api/worlds/${world.id}/scenes`, { name: "x", width: 10, height: 10, walls });
    expect((await bad([{ x1: -5, y1: 0, x2: 1, y2: 1 }])).statusCode).toBe(400);
    expect((await bad([{ x1: 0, y1: 0, x2: 1e9, y2: 1 }])).statusCode).toBe(400);
    expect((await bad(Array.from({ length: 20001 }, () => WALLS[0]))).statusCode).toBe(400);
  });

  it("survives export and import, and old files without map data still import", async () => {
    const { app, gm, world } = await setup();
    const exported = await call(app, gm.cookie, "GET", `/api/worlds/${world.id}/export`);
    const importer = await signUp(app, "dave");
    const imported = await app.inject({
      method: "POST",
      url: "/api/worlds/import",
      payload: exported.rawPayload,
      headers: { cookie: importer.cookie, "content-type": "application/zip" },
    });
    expect(imported.statusCode).toBe(200);
    const scene = (await stateOf(app, imported.json().id, importer.cookie)).scenes[0]!;
    expect(scene.walls.map((w) => w.kind)).toEqual(["wall", "door"]);
    expect(scene.lights).toHaveLength(1);
    expect(scene.bakedLighting).toBe(true);
  });
});

describe("movement and walls", () => {
  it("stops players at walls and closed doors, but not the game master or an open door", async () => {
    const { app, gm, bob, world } = await setup();
    const scene = (
      await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/scenes`, {
        name: "Halls",
        width: 1000,
        height: 800,
        gridSize: 70,
        walls: [
          { x1: 300, y1: 0, x2: 300, y2: 800 },
          { x1: 600, y1: 0, x2: 600, y2: 800, kind: "door", open: false },
        ],
      })
    ).json() as SceneDto;
    await call(app, gm.cookie, "PATCH", `/api/worlds/${world.id}`, { activeSceneId: scene.id });
    const token = (
      await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/tokens`, {
        sceneId: scene.id,
        name: "Hero",
        x: 100,
        y: 100,
        controllerIds: [bob.user.id],
      })
    ).json();
    const conn = connect(await listen(app), world.id, bob.cookie);
    await conn.opened;
    await conn.waitFor((m) => m.type === "world.state");
    const positionAfter = async (x: number) => {
      conn.ws.send(JSON.stringify({ type: "token.move", tokenId: token.id, x, y: 100 }));
      await conn.settle();
      return (await call(app, gm.cookie, "PATCH", `/api/tokens/${token.id}`, {})).json().x as number;
    };

    expect(await positionAfter(400)).toBe(100);
    expect(await positionAfter(200)).toBe(200);
    await call(app, gm.cookie, "PATCH", `/api/tokens/${token.id}`, { x: 400 });
    expect(await positionAfter(700)).toBe(400);
    await call(app, gm.cookie, "POST", `/api/scenes/${scene.id}/doors/${scene.walls[1]!.id}`, { open: true });
    expect(await positionAfter(700)).toBe(700);
    conn.ws.close();
  });
});

describe("scene export as Universal VTT", () => {
  it("lets only the game master download a scene that reads back with its walls and lights", async () => {
    const { app, gm, bob, scene } = await setup();
    const url = `/api/scenes/${scene.id}/export.dd2vtt`;
    expect((await call(app, bob.cookie, "GET", url)).statusCode).toBe(403);
    const res = await call(app, gm.cookie, "GET", url);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-disposition"]).toContain("crypt.dd2vtt");
    const file = res.json();
    expect(file.line_of_sight).toHaveLength(1);
    expect(file.portals).toHaveLength(1);
    expect(file.lights[0].color).toBe("ffffe5bf");
    expect(file.environment.baked_lighting).toBe(true);
  });
});

describe("vision", () => {
  async function visionSetup() {
    const { app, gm, bob, world } = await setup();
    const scene = (
      await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/scenes`, {
        name: "Fogged",
        width: 1400,
        height: 800,
        gridSize: 70,
        visionEnabled: true,
        visionRadius: 12,
        walls: [{ x1: 600, y1: 0, x2: 600, y2: 800, kind: "door", open: false }],
      })
    ).json() as SceneDto;
    await call(app, gm.cookie, "PATCH", `/api/worlds/${world.id}`, { activeSceneId: scene.id });
    const token = async (name: string, x: number, extra: object = {}) =>
      (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/tokens`, { sceneId: scene.id, name, x, y: 100, ...extra })).json();
    const hero = await token("Hero", 100, { controllerIds: [bob.user.id] });
    const rat = await token("Rat", 300);
    const ghoul = await token("Ghoul", 800);
    return { app, gm, bob, world, scene, hero, rat, ghoul, token };
  }

  it("tells a player only about tokens their own tokens can see, and sends polygons instead of walls", async () => {
    const { app, gm, bob, world } = await visionSetup();
    const bobState = await stateOf(app, world.id, bob.cookie);
    expect(bobState.tokens.map((t) => t.name).sort()).toEqual(["Hero", "Rat"]);
    expect(bobState.vision?.polygons.length).toBeGreaterThan(0);
    expect(bobState.scenes[0]!.walls).toEqual([]);
    const gmState = await stateOf(app, world.id, gm.cookie);
    expect(gmState.tokens).toHaveLength(3);
    expect(gmState.vision).toBeNull();
  });

  it("reveals what is behind a door once it opens, and hides it again when it closes", async () => {
    const { app, gm, bob, world, scene } = await visionSetup();
    const door = scene.walls[0]!.id;
    await call(app, gm.cookie, "POST", `/api/scenes/${scene.id}/doors/${door}`, { open: true });
    expect((await stateOf(app, world.id, bob.cookie)).tokens.map((t) => t.name)).toContain("Ghoul");
    await call(app, gm.cookie, "POST", `/api/scenes/${scene.id}/doors/${door}`, { open: false });
    expect((await stateOf(app, world.id, bob.cookie)).tokens.map((t) => t.name)).not.toContain("Ghoul");
  });

  it("pushes tokens in and out of view as they move, and never leaks a hidden one", async () => {
    const { app, gm, bob, world, rat, ghoul, token } = await visionSetup();
    const conn = connect(await listen(app), world.id, bob.cookie);
    await conn.waitFor((m) => m.type === "world.state");

    // The rat walks behind the closed door: Bob is told it is gone.
    await call(app, gm.cookie, "PATCH", `/api/tokens/${rat.id}`, { x: 900 });
    await conn.waitFor((m) => m.type === "token.remove" && m.tokenId === rat.id);
    // The ghoul steps into view.
    await call(app, gm.cookie, "PATCH", `/api/tokens/${ghoul.id}`, { x: 400 });
    await conn.waitFor((m) => m.type === "token.upsert" && m.token.id === ghoul.id);
    expect(conn.seen.some((m) => m.type === "vision.update")).toBe(true);

    // A token the GM hides stays out of sight even in the open.
    const lurker = await token("Lurker", 200, { hidden: true });
    await conn.settle();
    expect(conn.seen.some((m) => m.type === "token.upsert" && m.token.id === lurker.id)).toBe(false);
    conn.ws.close();
  });
});
