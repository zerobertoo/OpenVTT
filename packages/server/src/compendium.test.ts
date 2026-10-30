import { afterEach, expect, it } from "vitest";
import { parseSystemPackage } from "./systems.ts";
import { call, closeApps, newApp, signUp } from "./test-utils.ts";

afterEach(closeApps);

it("places a monster as a linked sheet and token, and an item as a token, for the game master only", async () => {
  const app = newApp();
  const gm = await signUp(app, "alice");
  const bob = await signUp(app, "bob");
  const world = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "SRD", systemId: "dnd5e-srd" })).json();
  const { code } = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/invites`)).json();
  await call(app, bob.cookie, "POST", `/api/invites/${code}/join`, { displayName: "Bob", color: "#112233" });
  const scene = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/scenes`, { name: "Road", width: 700, height: 500 })).json();

  expect((await call(app, bob.cookie, "GET", `/api/worlds/${world.id}/compendium`)).statusCode).toBe(403);
  const entries = (await call(app, gm.cookie, "GET", `/api/worlds/${world.id}/compendium`)).json();
  expect(entries.find((e: { id: string }) => e.id === "goblin")).toMatchObject({ kind: "monster", data: { ac: 15, hp_max: 7 } });

  const place = (entry: string, cookie = gm.cookie) =>
    call(app, cookie, "POST", `/api/worlds/${world.id}/compendium/${entry}/place`, { sceneId: scene.id, x: 140, y: 70 });
  expect((await place("goblin", bob.cookie)).statusCode).toBe(403);
  const goblin = (await place("goblin")).json();
  expect(goblin).toMatchObject({ name: "Goblin", x: 140, hp: 7, hpMax: 7 });
  expect(goblin.actorId).toBeTruthy();
  const torch = (await place("torch")).json();
  expect(torch).toMatchObject({ name: "Torch", actorId: null, size: 0.5 });
  expect((await place("no-such-thing")).statusCode).toBe(404);
});

it("refuses a system whose compendium monsters do not fit its npc sheet", () => {
  const files = {
    "system.json": JSON.stringify({
      id: "tiny",
      name: "Tiny",
      version: "1",
      author: "a",
      license: "MIT",
      minOpenVTT: "0.1.0",
      actorTypes: { npc: { template: "templates/npc.json" } },
      locales: ["en"],
    }),
    "locales/en.json": "{}",
    "templates/npc.json": JSON.stringify({ sections: [{ id: "s", label: "s", fields: [{ id: "hp", type: "number", label: "hp" }] }] }),
    "compendium.json": JSON.stringify([{ id: "x", name: "X", kind: "monster", data: { mana: 3 } }]),
  };
  expect(() => parseSystemPackage(files)).toThrow(/does not fit/);
});
