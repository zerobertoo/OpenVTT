import type { ServerMessage, TokenDto } from "@openvtt/shared";
import { afterEach, describe, expect, it } from "vitest";
import { call, closeApps, connect, listen, newApp, signUp } from "./test-utils.ts";

afterEach(closeApps);

async function setup() {
  const app = newApp();
  const gm = await signUp(app, "alice");
  const bob = await signUp(app, "bob");
  const eve = await signUp(app, "eve");
  const world = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "Table" })).json();
  for (const player of [bob, eve]) {
    const { code } = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/invites`)).json();
    await call(app, player.cookie, "POST", `/api/invites/${code}/join`, { displayName: player.user.username, color: "#112233" });
  }
  const scene = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/scenes`, { name: "Arena", width: 1000, height: 800 })).json();
  const token = (
    await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/tokens`, {
      sceneId: scene.id,
      name: "Hero",
      x: 70,
      y: 70,
      hp: 18,
      hpMax: 30,
      conditions: ["prone"],
      showName: true,
      controllerIds: [bob.user.id],
    })
  ).json() as TokenDto;
  return { app, gm, bob, eve, world, token };
}

const ports = new WeakMap<object, number>();
const stateTokens = async (app: Parameters<typeof listen>[0], worldId: string, cookie: string) => {
  if (!ports.has(app)) ports.set(app, await listen(app));
  const conn = connect(ports.get(app)!, worldId, cookie);
  const msg = await conn.waitFor((m): m is Extract<ServerMessage, { type: "world.state" }> => m.type === "world.state");
  conn.ws.close();
  return msg.state.tokens;
};

describe("token health and conditions", () => {
  it("stores hit points, conditions and the name label", async () => {
    const { token } = await setup();
    expect(token).toMatchObject({ hp: 18, hpMax: 30, conditions: ["prone"], showName: true });
  });

  it("tells hit points only to the game master and the token's controller, but conditions to everyone", async () => {
    const { app, gm, bob, eve, world } = await setup();
    const asGm = (await stateTokens(app, world.id, gm.cookie))[0]!;
    const asController = (await stateTokens(app, world.id, bob.cookie))[0]!;
    const asOther = (await stateTokens(app, world.id, eve.cookie))[0]!;
    expect(asGm).toMatchObject({ hp: 18, hpMax: 30 });
    expect(asController).toMatchObject({ hp: 18, hpMax: 30 });
    expect(asOther).toMatchObject({ hp: null, hpMax: null, conditions: ["prone"], showName: true });
  });

  it("does not leak hit points through live updates either", async () => {
    const { app, gm, eve, world, token } = await setup();
    await stateTokens(app, world.id, eve.cookie);
    const eveConn = connect(ports.get(app)!, world.id, eve.cookie);
    await eveConn.waitFor((m) => m.type === "world.state");
    await call(app, gm.cookie, "PATCH", `/api/tokens/${token.id}`, { hp: 5 });
    const update = await eveConn.waitFor((m): m is Extract<ServerMessage, { type: "token.upsert" }> => m.type === "token.upsert");
    expect(update.token).toMatchObject({ hp: null, hpMax: null });
    eveConn.ws.close();
  });

  it("lets a controller change their own hit points and conditions, but not the maximum", async () => {
    const { app, bob, token } = await setup();
    const ok = await call(app, bob.cookie, "PATCH", `/api/tokens/${token.id}`, { hp: 7, conditions: ["poisoned", "prone"] });
    expect(ok.json()).toMatchObject({ hp: 7, conditions: ["poisoned", "prone"] });
    expect((await call(app, bob.cookie, "PATCH", `/api/tokens/${token.id}`, { hpMax: 99 })).statusCode).toBe(403);
    expect((await call(app, bob.cookie, "PATCH", `/api/tokens/${token.id}`, { showName: false })).statusCode).toBe(403);
  });

  it("refuses unknown conditions", async () => {
    const { app, gm, token } = await setup();
    expect((await call(app, gm.cookie, "PATCH", `/api/tokens/${token.id}`, { conditions: ["on-fire"] })).statusCode).toBe(400);
  });
});
