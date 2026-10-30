import { afterEach, expect, it } from "vitest";
import { call, closeApps, newApp, signUp } from "./test-utils.ts";

afterEach(closeApps);

it("stores hex grids in both orientations and goes back to square", async () => {
  const app = newApp();
  const gm = await signUp(app, "alice");
  const world = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "Hexes" })).json();
  const scene = (
    await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/scenes`, { name: "A", width: 100, height: 100, gridType: "hexFlat" })
  ).json();
  expect(scene.gridType).toBe("hexFlat");
  expect((await call(app, gm.cookie, "PATCH", `/api/scenes/${scene.id}`, { gridType: "hexPointy" })).json().gridType).toBe("hexPointy");
  expect((await call(app, gm.cookie, "PATCH", `/api/scenes/${scene.id}`, { gridType: "none" })).json().gridType).toBe("none");
  expect((await call(app, gm.cookie, "PATCH", `/api/scenes/${scene.id}`, { gridType: "square" })).json().gridType).toBe("square");
});
