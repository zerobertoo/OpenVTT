import type { ServerMessage } from "@openvtt/shared";
import { afterEach, expect, it } from "vitest";
import { call, closeApps, connect, listen, newApp, PNG, signUp, upload } from "./test-utils.ts";

afterEach(closeApps);

async function setup() {
  const app = newApp();
  const gm = await signUp(app, "alice");
  const bob = await signUp(app, "bob");
  const carol = await signUp(app, "carol");
  const world = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "Table" })).json();
  const { code } = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/invites`)).json();
  await call(app, bob.cookie, "POST", `/api/invites/${code}/join`, { displayName: "Bob", color: "#112233" });
  await call(app, carol.cookie, "POST", `/api/invites/${code}/join`, { displayName: "Carol", color: "#112233" });
  const port = await listen(app);
  const stateOf = async (cookie: string) => {
    const conn = connect(port, world.id, cookie);
    const msg = await conn.waitFor((m): m is Extract<ServerMessage, { type: "world.state" }> => m.type === "world.state");
    conn.ws.close();
    return msg.state;
  };
  return { app, gm, bob, carol, world, stateOf };
}

it("shows each handout only to the people it is shared with, without the audience", async () => {
  const { app, gm, bob, carol, world, stateOf } = await setup();
  const post = (body: object) => call(app, gm.cookie, "POST", `/api/worlds/${world.id}/handouts`, body);
  await post({ title: "Secret plan", body: "The duke is the cult leader" });
  await post({ title: "Letter for Bob", body: "Meet me at dawn", audience: [bob.user.id] });
  await post({ title: "Town map", body: "# Welcome", audience: ["*"] });

  expect((await stateOf(gm.cookie)).handouts.map((h) => h.title)).toEqual(["Secret plan", "Letter for Bob", "Town map"]);
  const bobState = await stateOf(bob.cookie);
  expect(bobState.handouts.map((h) => h.title)).toEqual(["Letter for Bob", "Town map"]);
  expect(bobState.handouts.every((h) => h.audience.length === 0)).toBe(true);
  const carolState = JSON.stringify(await stateOf(carol.cookie));
  expect(carolState).not.toContain("duke");
  expect(carolState).not.toContain("dawn");
  expect(carolState).toContain("Town map");
});

it("keeps writing, the asset library and the export with the game master", async () => {
  const { app, gm, bob, world, stateOf } = await setup();
  expect((await call(app, bob.cookie, "POST", `/api/worlds/${world.id}/handouts`, { title: "Mine" })).statusCode).toBe(403);
  const { id } = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/handouts`, { title: "Notes", body: "keep me" })).json();
  await call(app, gm.cookie, "PATCH", `/api/handouts/${id}`, { audience: [bob.user.id] });
  expect((await stateOf(bob.cookie)).handouts[0]).toMatchObject({ title: "Notes", body: "keep me" });
  expect((await call(app, bob.cookie, "PATCH", `/api/handouts/${id}`, { audience: ["*"] })).statusCode).toBe(403);
  expect((await call(app, bob.cookie, "DELETE", `/api/handouts/${id}`)).statusCode).toBe(403);
  // Sharing with someone outside the world is refused.
  expect((await call(app, gm.cookie, "PATCH", `/api/handouts/${id}`, { audience: [crypto.randomUUID()] })).statusCode).toBe(404);

  await upload(app, gm.cookie, world.id, PNG);
  expect((await call(app, bob.cookie, "GET", `/api/worlds/${world.id}/assets`)).statusCode).toBe(403);
  const library = (await call(app, gm.cookie, "GET", `/api/worlds/${world.id}/assets`)).json();
  expect(library).toHaveLength(1);
  expect(library[0]).toMatchObject({ mime: "image/png" });
});

it("exports handouts and brings shared ones back shared with everybody", async () => {
  const { app, gm, bob, world, stateOf } = await setup();
  const picture = (await upload(app, gm.cookie, world.id, PNG)).json();
  await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/handouts`, {
    title: "Public",
    body: `![](asset:${picture.id})`,
    audience: ["*"],
  });
  await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/handouts`, { title: "For Bob", audience: [bob.user.id] });
  const zip = await call(app, gm.cookie, "GET", `/api/worlds/${world.id}/export`);
  const imported = await app.inject({
    method: "POST",
    url: "/api/worlds/import",
    payload: zip.rawPayload,
    headers: { cookie: gm.cookie, "content-type": "application/zip" },
  });
  const port = (app.server.address() as { port: number }).port;
  const conn = connect(port, imported.json().id, gm.cookie);
  const msg = await conn.waitFor((m): m is Extract<ServerMessage, { type: "world.state" }> => m.type === "world.state");
  conn.ws.close();
  expect(msg.state.handouts.map((h) => [h.title, h.audience])).toEqual([
    ["Public", ["*"]],
    ["For Bob", []],
  ]);
  expect((await stateOf(gm.cookie)).handouts).toHaveLength(2);
  const newPicture = (await call(app, gm.cookie, "GET", `/api/worlds/${imported.json().id}/assets`)).json()[0].id;
  expect(msg.state.handouts[0]!.body).toBe(`![](asset:${newPicture})`);
});
