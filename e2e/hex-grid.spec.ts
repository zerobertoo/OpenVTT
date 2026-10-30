import { expect, test } from "@playwright/test";
import { snapToHex } from "../packages/client/src/lib/hex";
import { createAndOpenWorld, expectNoAxeViolations, registerNewUser, worldIdOf, worldState } from "./helpers";

test("a scene switches to a hex grid and tokens moved by keyboard land on hex centers", async ({ page }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Hex world");
  const worldId = worldIdOf(page);
  const scene = await (
    await page.request.post(`/api/worlds/${worldId}/scenes`, { data: { name: "Plains", width: 700, height: 500 } })
  ).json();
  const token = await (
    await page.request.post(`/api/worlds/${worldId}/tokens`, { data: { sceneId: scene.id, name: "Scout", x: 0, y: 0 } })
  ).json();

  await page.getByRole("tab", { name: "Scenes" }).click();
  const form = page.getByRole("form", { name: "Scene settings" });
  await form.getByLabel("Grid").selectOption("hexPointy");
  await form.getByRole("button", { name: "Save" }).click();
  await expect.poll(async () => (await worldState(page, worldId)).scenes[0]?.gridType).toBe("hexPointy");
  await expectNoAxeViolations(page);

  // Select the token from its list, then step it right and down.
  await page.getByRole("tab", { name: "Tokens" }).click();
  await page.getByRole("button", { name: /Scout/ }).first().click();
  await page.getByRole("application").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const center = async () => {
    const moved = (await worldState(page, worldId)).tokens.find((t) => t.id === token.id)!;
    return { x: moved.x + 35, y: moved.y + 35 };
  };
  await expect.poll(async () => (await center()).y).toBeGreaterThan(70);
  const landed = await center();
  const snapped = snapToHex(landed, 70, "pointy");
  expect(Math.abs(snapped.x - landed.x) + Math.abs(snapped.y - landed.y)).toBeLessThan(0.01);
});
