import type { SceneDto, ServerMessage } from "@openvtt/shared";
import { afterEach, describe, expect, it } from "vitest";
import { call, closeApps, connect, listen, newApp, signUp } from "./test-utils.ts";

afterEach(closeApps);

type Ping = Extract<ServerMessage, { type: "map.ping" }>;
const isPing = (m: ServerMessage): m is Ping => m.type === "map.ping";

describe("map pings", () => {
  it("relays a ping to everyone, and only the game master can ask others to look", async () => {
    const app = newApp();
    const gm = await signUp(app, "alice");
    const bob = await signUp(app, "bob");
    const world = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "Table" })).json();
    const { code } = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/invites`)).json();
    await call(app, bob.cookie, "POST", `/api/invites/${code}/join`, { displayName: "Bob", color: "#112233" });
    const scene = (
      await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/scenes`, { name: "Crypt", width: 1000, height: 800 })
    ).json() as SceneDto;
    const port = await listen(app);

    const gmConn = connect(port, world.id, gm.cookie);
    const bobConn = connect(port, world.id, bob.cookie);
    await gmConn.waitFor((m) => m.type === "world.state");
    await bobConn.waitFor((m) => m.type === "world.state");

    // A player's focus request is downgraded to a plain ping; coordinates are clamped to the map.
    bobConn.ws.send(JSON.stringify({ type: "map.ping", x: 5000, y: -20, focus: true }));
    const fromBob = await gmConn.waitFor(isPing);
    expect(fromBob.ping).toEqual({ sceneId: scene.id, userId: bob.user.id, x: 1000, y: 0, focus: false });
    await bobConn.waitFor(isPing);

    // The game master may ask everyone to look; the rate limit is per connection, so Bob's ping did not use up theirs.
    gmConn.ws.send(JSON.stringify({ type: "map.ping", x: 10, y: 20, focus: true }));
    const fromGm = await bobConn.waitFor((m): m is Ping => isPing(m) && m.ping.userId === gm.user.id);
    expect(fromGm.ping).toMatchObject({ x: 10, y: 20, focus: true });

    gmConn.ws.close();
    bobConn.ws.close();
  });
});
