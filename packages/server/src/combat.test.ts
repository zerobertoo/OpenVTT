import type { ServerMessage, SceneDto, TokenDto } from "@openvtt/shared";
import { afterEach, describe, expect, it } from "vitest";
import { call, closeApps, connect, listen, newApp, signUp } from "./test-utils.ts";

afterEach(closeApps);

async function setup() {
  const app = newApp();
  const gm = await signUp(app, "alice");
  const bob = await signUp(app, "bob");
  const world = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "Table" })).json();
  const { code } = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/invites`)).json();
  await call(app, bob.cookie, "POST", `/api/invites/${code}/join`, { displayName: "Bob", color: "#112233" });
  const scene = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/scenes`, { name: "Arena", width: 500, height: 500 })).json() as SceneDto;
  const token = async (name: string, hidden = false) =>
    (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/tokens`, { sceneId: scene.id, name, x: 10, y: 10, hidden })).json() as TokenDto;
  const initiative = (tokenId: string, score: number) =>
    call(app, gm.cookie, "PUT", `/api/worlds/${world.id}/combat/combatants`, { tokenId, score });
  return { app, gm, bob, world, token, initiative };
}

const ports = new WeakMap<object, number>();
const stateOf = async (app: Parameters<typeof listen>[0], worldId: string, cookie: string) => {
  if (!ports.has(app)) ports.set(app, await listen(app));
  const conn = connect(ports.get(app)!, worldId, cookie);
  const msg = await conn.waitFor((m): m is Extract<ServerMessage, { type: "world.state" }> => m.type === "world.state");
  conn.ws.close();
  return msg.state;
};

describe("initiative", () => {
  it("orders by score, advances turns and rounds, and ends", async () => {
    const { app, gm, world, token, initiative } = await setup();
    const [a, b, c] = [await token("Aria"), await token("Brom"), await token("Cat")];
    await initiative(a.id, 12);
    await initiative(b.id, 18);
    await initiative(c.id, 12);
    let combat = (await stateOf(app, world.id, gm.cookie)).combat!;
    expect(combat.combatants.map((x) => x.name)).toEqual(["Brom", "Aria", "Cat"]);
    expect(combat.turnTokenId).toBeNull();

    const next = () => call(app, gm.cookie, "POST", `/api/worlds/${world.id}/combat/next`);
    await next();
    expect((await stateOf(app, world.id, gm.cookie)).combat).toMatchObject({ round: 1, turnTokenId: b.id });
    await next();
    await next();
    await next();
    combat = (await stateOf(app, world.id, gm.cookie)).combat!;
    expect(combat).toMatchObject({ round: 2, turnTokenId: b.id });

    await call(app, gm.cookie, "DELETE", `/api/worlds/${world.id}/combat`);
    expect((await stateOf(app, world.id, gm.cookie)).combat).toBeNull();
  });

  it("does not leak hidden tokens to players, and only the game master changes it", async () => {
    const { app, gm, bob, world, token, initiative } = await setup();
    const visible = await token("Knight");
    const ambusher = await token("Secret ambusher", true);
    await initiative(visible.id, 10);
    await initiative(ambusher.id, 20);
    await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/combat/next`);

    const seen = (await stateOf(app, world.id, bob.cookie)).combat!;
    expect(seen.combatants.map((x) => x.name)).toEqual(["Knight"]);
    expect(seen.turnTokenId).toBeNull();
    expect(JSON.stringify(seen)).not.toContain("ambusher");

    expect((await call(app, bob.cookie, "PUT", `/api/worlds/${world.id}/combat/combatants`, { tokenId: visible.id, score: 99 })).statusCode).toBe(403);
    expect((await call(app, bob.cookie, "POST", `/api/worlds/${world.id}/combat/next`)).statusCode).toBe(403);
    expect((await call(app, bob.cookie, "DELETE", `/api/worlds/${world.id}/combat`)).statusCode).toBe(403);
  });

  it("drops a deleted token from the order and rejects tokens of other worlds", async () => {
    const { app, gm, world, token, initiative } = await setup();
    const a = await token("Aria");
    await initiative(a.id, 5);
    expect((await initiative("nope", 5)).statusCode).toBe(404);
    await call(app, gm.cookie, "DELETE", `/api/tokens/${a.id}`);
    expect((await stateOf(app, world.id, gm.cookie)).combat?.combatants).toEqual([]);
  });
});
