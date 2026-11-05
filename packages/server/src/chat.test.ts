import type { ServerMessage } from "@openvtt/shared";
import { afterEach, describe, expect, it } from "vitest";
import { call, closeApps, connect, listen, newApp, signUp } from "./test-utils.ts";

afterEach(closeApps);

describe("chat history in the world state", () => {
  it("gives each person the latest 100 messages they may read, oldest first", async () => {
    const app = newApp();
    const gm = await signUp(app, "alice");
    const bob = await signUp(app, "bob");
    const eve = await signUp(app, "eve");
    const world = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "Table" })).json();
    for (const player of [bob, eve]) {
      const { code } = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/invites`)).json();
      await call(app, player.cookie, "POST", `/api/invites/${code}/join`, { displayName: player.user.username, color: "#112233" });
    }
    const say = (cookie: string, body: object) => call(app, cookie, "POST", `/api/worlds/${world.id}/messages`, body);
    await say(gm.cookie, { content: "oldest public" });
    for (let i = 0; i < 99; i++) await say(gm.cookie, { content: `public ${i}` });
    await say(bob.cookie, { content: "bob to gm", toUserId: gm.user.id });
    await say(gm.cookie, { content: "gm to bob", toUserId: bob.user.id });
    await say(bob.cookie, { content: "bob only for gm", gmOnly: true });
    await say(gm.cookie, { content: "gm note", gmOnly: true });
    // Newer messages Eve cannot read must not push her own out of the limit.
    for (let i = 0; i < 20; i++) await say(gm.cookie, { content: `secret ${i}`, gmOnly: true });

    const port = await listen(app);
    const history = async (cookie: string) => {
      const conn = connect(port, world.id, cookie);
      const msg = await conn.waitFor((m): m is Extract<ServerMessage, { type: "world.state" }> => m.type === "world.state");
      conn.ws.close();
      return msg.state.messages.map((m) => m.content);
    };

    const eveSees = await history(eve.cookie);
    expect(eveSees).toHaveLength(100);
    expect(eveSees[0]).toBe("oldest public");
    expect(eveSees.at(-1)).toBe("public 98");

    const bobSees = await history(bob.cookie);
    expect(bobSees).toHaveLength(100);
    expect(bobSees).toContain("bob only for gm");
    expect(bobSees).toContain("gm to bob");
    expect(bobSees).not.toContain("gm note");

    const gmSees = await history(gm.cookie);
    expect(gmSees).toHaveLength(100);
    expect(gmSees.at(-1)).toBe("secret 19");
  });
});

describe("/gr private rolls", () => {
  it("rolls for the roller and the game master only", async () => {
    const app = newApp();
    const gm = await signUp(app, "alice");
    const bob = await signUp(app, "bob");
    const eve = await signUp(app, "eve");
    const world = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "Table" })).json();
    for (const player of [bob, eve]) {
      const { code } = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/invites`)).json();
      await call(app, player.cookie, "POST", `/api/invites/${code}/join`, { displayName: player.user.username, color: "#112233" });
    }
    const port = await listen(app);

    const sent = await call(app, bob.cookie, "POST", `/api/worlds/${world.id}/messages`, {
      content: "/gr 1d20",
      toUserId: null,
      gmOnly: false,
    });
    expect(sent.json()).toMatchObject({ kind: "roll", gmOnly: true });

    const history = async (cookie: string) => {
      const conn = connect(port, world.id, cookie);
      const msg = await conn.waitFor((m): m is Extract<ServerMessage, { type: "world.state" }> => m.type === "world.state");
      conn.ws.close();
      return msg.state.messages;
    };
    expect(await history(gm.cookie)).toHaveLength(1);
    expect(await history(bob.cookie)).toHaveLength(1);
    expect(await history(eve.cookie)).toHaveLength(0);
  });
});
