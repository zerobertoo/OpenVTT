import type { SceneDto, ServerMessage } from "@openvtt/shared";
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
  const scene = (
    await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/scenes`, { name: "Crypt", width: 1000, height: 800 })
  ).json() as SceneDto;
  const port = await listen(app);
  const stateOf = async (cookie: string) => {
    const conn = connect(port, world.id, cookie);
    const msg = await conn.waitFor((m): m is Extract<ServerMessage, { type: "world.state" }> => m.type === "world.state");
    conn.ws.close();
    return msg.state;
  };
  return { app, gm, bob, world, scene, stateOf };
}

const SECRET_NOTE = { kind: "note", points: [100, 100], text: "The lich hides behind the altar" };

describe("drawings and note pins", () => {
  it("shares drawings with everybody but keeps note pins and the gm layer with the game master", async () => {
    const { app, gm, bob, scene, stateOf, world } = await setup();
    await call(app, gm.cookie, "POST", `/api/scenes/${scene.id}/drawings`, { kind: "arrow", points: [0, 0, 50, 50] });
    await call(app, gm.cookie, "POST", `/api/scenes/${scene.id}/drawings`, SECRET_NOTE);
    await call(app, gm.cookie, "POST", `/api/scenes/${scene.id}/drawings`, {
      kind: "rect",
      layer: "gm",
      points: [0, 0, 9, 9],
      color: "#abcdef",
    });

    const gmScene = (await stateOf(gm.cookie)).scenes[0]!;
    expect(gmScene.drawings.map((d) => d.layer)).toEqual(["objects", "gm", "gm"]);
    const bobState = await stateOf(bob.cookie);
    expect(bobState.scenes[0]!.drawings.map((d) => d.kind)).toEqual(["arrow"]);
    expect(JSON.stringify(bobState)).not.toContain("lich");
    expect(JSON.stringify(bobState)).not.toContain("abcdef");
    // Export is the game master's; players get nothing out of it.
    expect((await call(app, bob.cookie, "GET", `/api/worlds/${world.id}/export`)).statusCode).toBe(403);
  });

  it("lets players draw on the objects layer only and erase only their own marks", async () => {
    const { app, gm, bob, scene, stateOf } = await setup();
    expect((await call(app, bob.cookie, "POST", `/api/scenes/${scene.id}/drawings`, SECRET_NOTE)).statusCode).toBe(403);
    const gmLayer = { kind: "line", layer: "gm", points: [0, 0, 1, 1] };
    expect((await call(app, bob.cookie, "POST", `/api/scenes/${scene.id}/drawings`, gmLayer)).statusCode).toBe(403);
    const own = (
      await call(app, bob.cookie, "POST", `/api/scenes/${scene.id}/drawings`, { kind: "free", points: [1, 1, 2, 2, 3, 3] })
    ).json();
    const gmArrow = (
      await call(app, gm.cookie, "POST", `/api/scenes/${scene.id}/drawings`, { kind: "arrow", points: [0, 0, 5, 5] })
    ).json();
    const gmNote = (await call(app, gm.cookie, "POST", `/api/scenes/${scene.id}/drawings`, SECRET_NOTE)).json();

    expect((await call(app, bob.cookie, "DELETE", `/api/drawings/${gmArrow.id}`)).statusCode).toBe(403);
    // A hidden note answers as if it did not exist.
    expect((await call(app, bob.cookie, "DELETE", `/api/drawings/${gmNote.id}`)).statusCode).toBe(404);
    expect((await call(app, bob.cookie, "DELETE", `/api/drawings/${own.id}`)).statusCode).toBe(200);
    // Clearing as a player removes only that player's marks.
    await call(app, bob.cookie, "POST", `/api/scenes/${scene.id}/drawings`, { kind: "line", points: [0, 0, 9, 9] });
    await call(app, bob.cookie, "DELETE", `/api/scenes/${scene.id}/drawings`);
    expect((await stateOf(gm.cookie)).scenes[0]!.drawings).toHaveLength(2);
    await call(app, gm.cookie, "DELETE", `/api/scenes/${scene.id}/drawings`);
    expect((await stateOf(gm.cookie)).scenes[0]!.drawings).toHaveLength(0);
  });

  it("hides scenes that are not active from players who try to draw on them", async () => {
    const { app, gm, bob, world } = await setup();
    const other = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/scenes`, { name: "Vault", width: 100, height: 100 })).json();
    expect(
      (await call(app, bob.cookie, "POST", `/api/scenes/${other.id}/drawings`, { kind: "line", points: [0, 0, 1, 1] })).statusCode,
    ).toBe(404);
  });

  it("travels in the world file without authors", async () => {
    const { app, gm, scene, world } = await setup();
    await call(app, gm.cookie, "POST", `/api/scenes/${scene.id}/drawings`, SECRET_NOTE);
    const zip = await call(app, gm.cookie, "GET", `/api/worlds/${world.id}/export`);
    const imported = await app.inject({
      method: "POST",
      url: "/api/worlds/import",
      payload: zip.rawPayload,
      headers: { cookie: gm.cookie, "content-type": "application/zip" },
    });
    expect(imported.statusCode).toBe(200);
    const port = (app.server.address() as { port: number }).port;
    const conn = connect(port, imported.json().id, gm.cookie);
    const msg = await conn.waitFor((m): m is Extract<ServerMessage, { type: "world.state" }> => m.type === "world.state");
    conn.ws.close();
    expect(msg.state.scenes[0]!.drawings[0]).toMatchObject({ kind: "note", layer: "gm", text: SECRET_NOTE.text, authorId: null });
  });
});
