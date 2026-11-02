import { DatabaseSync } from "node:sqlite";
import type { SceneDto, ServerMessage, TokenDto, WorldStateDto } from "@openvtt/shared";
import { afterEach, describe, expect, it } from "vitest";
import { MIGRATIONS } from "./db.ts";
import { call, closeApps, connect, listen, newApp, signUp } from "./test-utils.ts";

afterEach(closeApps);

type StateMessage = Extract<ServerMessage, { type: "world.state" }>;
const isState = (m: ServerMessage): m is StateMessage => m.type === "world.state";

const WALL = { x1: 300, y1: 0, x2: 300, y2: 800 };
const SECRET = "Hidden Vault";

/** A game master, a player (Bob) and a scene with three floors: cellar (table floor), ground, vault (secret). */
async function setup() {
  const app = newApp();
  const gm = await signUp(app, "alice");
  const bob = await signUp(app, "bob");
  const world = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "Table" })).json();
  const { code } = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/invites`)).json();
  await call(app, bob.cookie, "POST", `/api/invites/${code}/join`, { displayName: "Bob", color: "#112233" });
  const scene = (
    await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/scenes`, {
      name: "House",
      width: 1000,
      height: 800,
      floors: [
        { name: "Cellar", walls: [WALL], lights: [{ x: 50, y: 50, radius: 3 }] },
        { name: "Ground", walls: [] },
        { name: SECRET, walls: [{ x1: 10, y1: 10, x2: 20, y2: 20 }] },
      ],
    })
  ).json() as SceneDto;
  const [cellar, ground, vault] = scene.floors as [SceneDto["floors"][number], SceneDto["floors"][number], SceneDto["floors"][number]];
  const token = async (name: string, floorId: string, extra: object = {}) =>
    (
      await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/tokens`, { sceneId: scene.id, floorId, name, x: 100, y: 100, ...extra })
    ).json() as TokenDto;
  const port = await listen(app);
  const open = async (cookie: string) => {
    const conn = connect(port, world.id, cookie);
    const first = await conn.waitFor(isState);
    return { conn, state: first.state as WorldStateDto };
  };
  return { app, gm, bob, world, scene, cellar, ground, vault, token, open };
}

describe("floors", () => {
  it("creates a scene with its floors in order and makes the first one the table floor", async () => {
    const { scene, cellar, ground, vault } = await setup();
    expect(scene.floors.map((f) => f.name)).toEqual(["Cellar", "Ground", SECRET]);
    expect(scene.tableFloorId).toBe(cellar.id);
    expect(cellar.walls).toHaveLength(1);
    expect(cellar.lights).toHaveLength(1);
    expect(ground.walls).toHaveLength(0);
    expect(vault.walls).toHaveLength(1);
  });

  it("adds, renames, reorders and removes floors, and keeps at least one", async () => {
    const { app, gm, scene, cellar, ground } = await setup();
    const added = (await call(app, gm.cookie, "POST", `/api/scenes/${scene.id}/floors`, { name: "Roof" })).json() as SceneDto;
    expect(added.floors.map((f) => f.name)).toEqual(["Cellar", "Ground", SECRET, "Roof"]);
    const renamed = (await call(app, gm.cookie, "PATCH", `/api/floors/${ground.id}`, { name: "Lobby", position: 0 })).json() as SceneDto;
    expect(renamed.floors.map((f) => f.name)).toEqual(["Lobby", "Cellar", SECRET, "Roof"]);
    // Deleting the table floor hands the role to the first floor left.
    const removed = (await call(app, gm.cookie, "DELETE", `/api/floors/${cellar.id}`)).json() as SceneDto;
    expect(removed.floors.map((f) => f.name)).toEqual(["Lobby", SECRET, "Roof"]);
    expect(removed.tableFloorId).toBe(removed.floors[0]!.id);
    for (const floor of removed.floors.slice(1)) await call(app, gm.cookie, "DELETE", `/api/floors/${floor.id}`);
    const last = await call(app, gm.cookie, "DELETE", `/api/floors/${removed.floors[0]!.id}`);
    expect(last.statusCode).toBe(400);
  });

  it("deletes the tokens of a deleted floor and refuses floors of another scene for a token", async () => {
    const { app, gm, ground, token } = await setup();
    const goblin = await token("Goblin", ground.id);
    await call(app, gm.cookie, "DELETE", `/api/floors/${ground.id}`);
    const missing = await call(app, gm.cookie, "PATCH", `/api/tokens/${goblin.id}`, { name: "Gone" });
    expect(missing.statusCode).toBe(404);
  });

  it("only lets a token move to a floor of its own scene, and only the game master moves it", async () => {
    const { app, gm, bob, world, scene, ground, vault, token } = await setup();
    const other = (
      await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/scenes`, { name: "Elsewhere", width: 500, height: 500 })
    ).json() as SceneDto;
    const mine = await token("Bob", ground.id, { controllerIds: [bob.user.id] });
    const foreign = await call(app, gm.cookie, "PATCH", `/api/tokens/${mine.id}`, { floorId: other.floors[0]!.id });
    expect(foreign.statusCode).toBe(404);
    const byPlayer = await call(app, bob.cookie, "PATCH", `/api/tokens/${mine.id}`, { floorId: vault.id });
    expect(byPlayer.statusCode).toBe(403);
    const moved = (await call(app, gm.cookie, "PATCH", `/api/tokens/${mine.id}`, { floorId: vault.id })).json() as TokenDto;
    expect(moved.floorId).toBe(vault.id);
    expect(scene.floors.some((f) => f.id === moved.floorId)).toBe(true);
  });
});

describe("what each person receives", () => {
  it("gives the game master every floor", async () => {
    const { gm, open } = await setup();
    const { conn, state } = await open(gm.cookie);
    expect(state.scenes[0]!.floors).toHaveLength(3);
    expect(state.viewFloorId).toBeNull();
    conn.ws.close();
  });

  it("gives a player without a token only the table floor, with nothing about the other floors", async () => {
    const { bob, cellar, vault, open, token, ground } = await setup();
    await token("Orc", ground.id);
    const { conn, state } = await open(bob.cookie);
    const scene = state.scenes[0]!;
    expect(scene.floors.map((f) => f.id)).toEqual([cellar.id]);
    expect(scene.tableFloorId).toBe(cellar.id);
    expect(state.viewFloorId).toBe(cellar.id);
    // Walls and lights never leave the server for a player.
    expect(scene.floors[0]!.walls).toEqual([]);
    expect(scene.floors[0]!.lights).toEqual([]);
    // Nothing of the secret floor, nor of the tokens that stand on another floor, is anywhere in what was sent.
    const wire = JSON.stringify(conn.seen);
    expect(wire).not.toContain(SECRET);
    expect(wire).not.toContain(vault.id);
    expect(wire).not.toContain("Orc");
    conn.ws.close();
  });

  it("puts a player on the floor of their own token and shows only the tokens of that floor", async () => {
    const { bob, ground, cellar, vault, token, open } = await setup();
    await token("Hero", ground.id, { controllerIds: [bob.user.id] });
    await token("Rat", ground.id);
    await token("Bat", cellar.id);
    await token("Lich", vault.id);
    const { conn, state } = await open(bob.cookie);
    expect(state.viewFloorId).toBe(ground.id);
    expect(state.scenes[0]!.floors.map((f) => f.id)).toEqual([ground.id]);
    expect(state.tokens.map((t) => t.name).sort()).toEqual(["Hero", "Rat"]);
    const wire = JSON.stringify(conn.seen);
    for (const hidden of ["Bat", "Lich", SECRET, vault.id, cellar.id]) expect(wire).not.toContain(hidden);
    conn.ws.close();
  });

  it("resends a fresh state when a player's token changes floor, and never leaks the old floor's tokens afterwards", async () => {
    const { app, gm, bob, ground, cellar, token, open } = await setup();
    const hero = await token("Hero", ground.id, { controllerIds: [bob.user.id] });
    await token("Rat", ground.id);
    await token("Bat", cellar.id);
    const { conn } = await open(bob.cookie);
    await call(app, gm.cookie, "PATCH", `/api/tokens/${hero.id}`, { floorId: cellar.id });
    const next = await conn.waitFor((m): m is StateMessage => isState(m) && m.state.viewFloorId === cellar.id);
    expect(next.state.scenes[0]!.floors.map((f) => f.id)).toEqual([cellar.id]);
    expect(next.state.tokens.map((t) => t.name).sort()).toEqual(["Bat", "Hero"]);
    conn.ws.close();
  });

  it("does not send a player updates for tokens on other floors", async () => {
    const { app, gm, bob, ground, vault, token, open } = await setup();
    await token("Hero", ground.id, { controllerIds: [bob.user.id] });
    const lich = await token("Lich", vault.id);
    const { conn } = await open(bob.cookie);
    await call(app, gm.cookie, "PATCH", `/api/tokens/${lich.id}`, { x: 400 });
    await token("Imp", vault.id);
    await conn.settle();
    const updates = conn.seen.filter((m) => m.type === "token.upsert");
    expect(updates).toEqual([]);
    expect(JSON.stringify(conn.seen)).not.toContain("Lich");
    conn.ws.close();
  });

  it("keeps a floor's pings and drawings to the people on it", async () => {
    const { app, gm, bob, cellar, vault, scene, open } = await setup();
    const { conn: bobConn } = await open(bob.cookie);
    const { conn: gmConn } = await open(gm.cookie);
    // The game master pings and draws on the secret floor while Bob stands on the table floor.
    gmConn.ws.send(JSON.stringify({ type: "map.ping", x: 10, y: 10, floorId: vault.id }));
    const drawing = await call(app, gm.cookie, "POST", `/api/scenes/${scene.id}/drawings`, {
      kind: "arrow",
      floorId: vault.id,
      points: [0, 0, 5, 5],
    });
    expect(drawing.statusCode).toBe(200);
    await gmConn.waitFor((m) => m.type === "scene.drawings");
    await bobConn.settle();
    expect(bobConn.seen.filter((m) => m.type === "map.ping" || m.type === "scene.drawings")).toEqual([]);
    // On the table floor, both reach him (pings are rate limited per connection).
    await new Promise((resolve) => setTimeout(resolve, 350));
    gmConn.ws.send(JSON.stringify({ type: "map.ping", x: 20, y: 20, floorId: cellar.id }));
    await call(app, gm.cookie, "POST", `/api/scenes/${scene.id}/drawings`, { kind: "arrow", floorId: cellar.id, points: [0, 0, 5, 5] });
    await bobConn.waitFor((m) => m.type === "map.ping");
    const drawn = await bobConn.waitFor((m): m is Extract<ServerMessage, { type: "scene.drawings" }> => m.type === "scene.drawings");
    expect(drawn.floorId).toBe(cellar.id);
    bobConn.ws.close();
    gmConn.ws.close();
  });

  it("makes a player draw on their own floor, whatever floor they ask for", async () => {
    const { app, gm, bob, ground, vault, scene, token, open } = await setup();
    await token("Hero", ground.id, { controllerIds: [bob.user.id] });
    await call(app, bob.cookie, "POST", `/api/scenes/${scene.id}/drawings`, { kind: "arrow", floorId: vault.id, points: [0, 0, 5, 5] });
    const { conn, state } = await open(gm.cookie);
    conn.ws.close();
    const byFloor = Object.fromEntries(state.scenes[0]!.floors.map((f) => [f.name, f.drawings.length]));
    expect(byFloor).toEqual({ Cellar: 0, Ground: 1, [SECRET]: 0 });
  });
});

describe("movement and vision per floor", () => {
  it("blocks a player with the walls of the token's floor only", async () => {
    const { bob, cellar, ground, token, open } = await setup();
    const onCellar = await token("Down", cellar.id, { controllerIds: [bob.user.id] });
    const onGround = await token("Up", ground.id, { controllerIds: [bob.user.id] });
    const { conn } = await open(bob.cookie);
    // The cellar has a wall at x=300, the ground floor has none; Bob sees his first token's floor (cellar).
    conn.ws.send(JSON.stringify({ type: "token.move", tokenId: onCellar.id, x: 600, y: 100 }));
    const stayed = await conn.waitFor(
      (m): m is Extract<ServerMessage, { type: "token.upsert" }> => m.type === "token.upsert" && m.token.id === onCellar.id,
    );
    expect(stayed.token.x).toBe(100);
    conn.ws.close();
    expect(onGround.floorId).toBe(ground.id);
  });

  it("uses the walls and lights of the player's floor for vision", async () => {
    const { app, gm, bob, scene, cellar, ground, token, open } = await setup();
    await call(app, gm.cookie, "PATCH", `/api/scenes/${scene.id}`, { visionEnabled: true, tableFloorId: ground.id });
    await token("Hero", cellar.id, { controllerIds: [bob.user.id], x: 100 });
    await token("Behind wall", cellar.id, { x: 500 });
    await token("Same room", cellar.id, { x: 200 });
    await token("Other floor", ground.id, { x: 150 });
    const { conn, state } = await open(bob.cookie);
    expect(state.tokens.map((t) => t.name).sort()).toEqual(["Hero", "Same room"]);
    expect(state.vision?.polygons.length).toBeGreaterThan(0);
    conn.ws.close();
  });
});

describe("the migration to floors", () => {
  it("wraps every existing scene in one floor holding its background, walls, lights, drawings and tokens", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    for (const sql of MIGRATIONS.slice(0, -1)) db.exec(sql);
    db.exec(`
      INSERT INTO users (id, username, password_hash, role, created_at) VALUES ('u1', 'a', 'x', 'user', 1);
      INSERT INTO worlds (id, name, created_at) VALUES ('w1', 'World', 1);
      INSERT INTO scenes (id, world_id, name, width, height, grid_type, grid_size, grid_distance, distance_unit, created_at)
        VALUES ('s1', 'w1', 'Crypt', 500, 500, 'square', 50, 5, 'ft', 1);
      INSERT INTO walls (id, scene_id, x1, y1, x2, y2, kind) VALUES ('wall1', 's1', 0, 0, 10, 10, 'wall');
      INSERT INTO lights (id, scene_id, x, y, radius, intensity, color) VALUES ('light1', 's1', 5, 5, 2, 1, '#ffffff');
      INSERT INTO tokens (id, scene_id, name, x, y, size, color) VALUES ('t1', 's1', 'Hero', 0, 0, 1, '#112233');
    `);
    db.exec(MIGRATIONS.at(-1)!);
    const floor = db.prepare("SELECT * FROM floors").all() as { id: string; scene_id: string; name: string; position: number }[];
    expect(floor).toHaveLength(1);
    expect(floor[0]).toMatchObject({ id: "s1", scene_id: "s1", name: "Crypt", position: 0 });
    expect((db.prepare("SELECT table_floor_id FROM scenes").get() as { table_floor_id: string }).table_floor_id).toBe("s1");
    for (const table of ["walls", "lights", "tokens"]) {
      expect((db.prepare(`SELECT floor_id FROM ${table}`).get() as { floor_id: string }).floor_id).toBe("s1");
    }
  });
});
