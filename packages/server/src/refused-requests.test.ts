import { afterEach, expect, it } from "vitest";
import { call, closeApps, newApp, signUp } from "./test-utils.ts";

afterEach(closeApps);

async function setup() {
  const app = newApp();
  const gm = await signUp(app, "alice");
  const world = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "Table" })).json();
  const scene = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/scenes`, { name: "One", width: 100, height: 100 })).json();
  return { app, gm, world, scene };
}

it("leaves no audit entry when the last floor cannot be deleted", async () => {
  const { app, gm, world, scene } = await setup();
  expect((await call(app, gm.cookie, "DELETE", `/api/floors/${scene.floors[0].id}`)).statusCode).toBe(400);
  const log = (await call(app, gm.cookie, "GET", `/api/worlds/${world.id}/audit`)).json() as { action: string }[];
  expect(log.map((entry) => entry.action)).not.toContain("floor.delete");
});

it("answers a repeated floor parameter as bad input, not a server failure", async () => {
  const { app, gm, scene } = await setup();
  const clear = await call(app, gm.cookie, "DELETE", `/api/scenes/${scene.id}/drawings?floorId=a&floorId=b`);
  expect(clear.statusCode).toBe(400);
  const uvtt = await call(app, gm.cookie, "GET", `/api/scenes/${scene.id}/export.dd2vtt?floorId=a&floorId=b`);
  expect(uvtt.statusCode).toBe(400);
});
