import type { ServerMessage } from "@openvtt/shared";
import { afterEach, describe, expect, it } from "vitest";
import { call, closeApps, connect, listen, newApp, signUp } from "./test-utils.ts";

afterEach(closeApps);

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
