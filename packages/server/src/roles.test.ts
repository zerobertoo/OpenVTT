import type { ServerMessage } from "@openvtt/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { call, closeApps, connect, listen, newApp, signUp } from "./test-utils.ts";

afterEach(() => {
  vi.useRealTimers();
  return closeApps();
});

async function setup() {
  const app = newApp();
  const gm = await signUp(app, "alice");
  const world = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "Table" })).json();
  const join = async (name: string, invite: object = {}) => {
    const person = await signUp(app, name);
    const { code } = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/invites`, invite)).json();
    const res = await call(app, person.cookie, "POST", `/api/invites/${code}/join`, { displayName: name, color: "#112233" });
    return { ...person, joined: res };
  };
  const port = await listen(app);
  const stateOf = async (cookie: string) => {
    const conn = connect(port, world.id, cookie);
    const msg = await conn.waitFor((m): m is Extract<ServerMessage, { type: "world.state" }> => m.type === "world.state");
    conn.ws.close();
    return msg.state;
  };
  const scene = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/scenes`, { name: "Crypt", width: 700, height: 500 })).json();
  return { app, gm, world, join, stateOf, port, scene };
}

describe("roles", () => {
  it("lets an assistant run the table and see hidden things, but not manage members", async () => {
    const { app, gm, world, join, stateOf, scene } = await setup();
    const ann = await join("ann");
    const bob = await join("bob");
    expect((await call(app, gm.cookie, "PATCH", `/api/worlds/${world.id}/members/${ann.user.id}`, { role: "assistant" })).statusCode).toBe(
      200,
    );
    await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/tokens`, { sceneId: scene.id, name: "Lurker", x: 0, y: 0, hidden: true });

    const annState = await stateOf(ann.cookie);
    expect(annState.yourRole).toBe("assistant");
    expect(annState.tokens.map((t) => t.name)).toEqual(["Lurker"]);
    expect((await call(app, ann.cookie, "POST", `/api/worlds/${world.id}/handouts`, { title: "Ann's" })).statusCode).toBe(200);
    expect((await call(app, ann.cookie, "PATCH", `/api/worlds/${world.id}/members/${bob.user.id}`, { muted: true })).statusCode).toBe(403);
    expect((await call(app, ann.cookie, "POST", `/api/worlds/${world.id}/invites`)).statusCode).toBe(403);
    expect((await call(app, gm.cookie, "PATCH", `/api/worlds/${world.id}/members/${gm.user.id}`, { role: "player" })).statusCode).toBe(403);
    expect((await stateOf(bob.cookie)).tokens).toEqual([]);
  });

  it("keeps observers to watching what a player sees", async () => {
    const { app, world, join, stateOf, scene } = await setup();
    const olga = await join("olga", { role: "observer" });
    expect(olga.joined.json().role).toBe("observer");
    const state = await stateOf(olga.cookie);
    expect(state.yourRole).toBe("observer");
    expect(state.scenes[0]!.walls).toEqual([]);
    expect((await call(app, olga.cookie, "POST", `/api/worlds/${world.id}/messages`, { content: "hi" })).statusCode).toBe(403);
    const line = { kind: "line", points: [0, 0, 1, 1] };
    expect((await call(app, olga.cookie, "POST", `/api/scenes/${scene.id}/drawings`, line)).statusCode).toBe(403);
    expect((await call(app, olga.cookie, "GET", `/api/worlds/${world.id}/audit`)).statusCode).toBe(403);
  });
});

describe("moderation", () => {
  it("mutes a player's chat and kicks them out, closing their connection and freeing their tokens", async () => {
    const { app, gm, world, join, port, scene } = await setup();
    const bob = await join("bob");
    const token = (
      await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/tokens`, {
        sceneId: scene.id,
        name: "Hero",
        x: 0,
        y: 0,
        controllerIds: [bob.user.id],
      })
    ).json();
    await call(app, gm.cookie, "PATCH", `/api/worlds/${world.id}/members/${bob.user.id}`, { muted: true });
    expect((await call(app, bob.cookie, "POST", `/api/worlds/${world.id}/messages`, { content: "hey" })).statusCode).toBe(403);

    const conn = connect(port, world.id, bob.cookie);
    await conn.opened;
    const closed = new Promise((resolve) => conn.ws.on("close", resolve));
    expect((await call(app, gm.cookie, "DELETE", `/api/worlds/${world.id}/members/${bob.user.id}`)).statusCode).toBe(200);
    await closed;
    expect((await call(app, bob.cookie, "GET", `/api/worlds/${world.id}/log.md`)).statusCode).toBe(403);
    // The token stays editable now that its controller is gone.
    expect((await call(app, gm.cookie, "PATCH", `/api/tokens/${token.id}`, { name: "Hero 2" })).json().controllerIds).toEqual([]);

    const log = (await call(app, gm.cookie, "GET", `/api/worlds/${world.id}/audit`)).json();
    expect(log.map((e: { action: string }) => e.action)).toEqual(["member.kick", "member.mute", "invite.create", "scene.create"]);
    expect(log[0]).toMatchObject({ actorName: "alice", detail: "bob" });
  });

  it("refuses invites past their expiry or their number of uses", async () => {
    const { app, gm, world } = await setup();
    const once = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/invites`, { maxUses: 1 })).json().code;
    const first = await signUp(app, "first");
    const second = await signUp(app, "second");
    const body = { displayName: "X", color: "#112233" };
    expect((await call(app, first.cookie, "POST", `/api/invites/${once}/join`, body)).statusCode).toBe(200);
    // Joining again as a member is not another use.
    expect((await call(app, first.cookie, "POST", `/api/invites/${once}/join`, body)).statusCode).toBe(200);
    expect((await call(app, second.cookie, "POST", `/api/invites/${once}/join`, body)).json().error).toBe("invite_invalid");

    const brief = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/invites`, { expiresInHours: 1 })).json().code;
    vi.useFakeTimers({ now: Date.now() + 2 * 3_600_000, toFake: ["Date"] });
    expect((await call(app, second.cookie, "POST", `/api/invites/${brief}/join`, body)).json().error).toBe("invite_invalid");
  });
});
