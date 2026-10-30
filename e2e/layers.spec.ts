import { expect, test } from "@playwright/test";
import { createAndOpenWorld, expectNoAxeViolations, registerNewUser, worldIdOf, worldState } from "./helpers";

test("the game master locks a map layer and drawing on it is refused until it is unlocked", async ({ page }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Layer world");
  const worldId = worldIdOf(page);
  await page.request.post(`/api/worlds/${worldId}/scenes`, { data: { name: "Arena", width: 700, height: 500 } });
  const locked = async () => (await worldState(page, worldId)).scenes[0]?.lockedLayers;

  await page.getByRole("button", { name: "Layers" }).click();
  await expect(page.getByRole("switch", { name: "Show Tokens" })).toBeChecked();
  await page.getByRole("switch", { name: "Lock Objects" }).click();
  await expect.poll(locked).toEqual(["objects"]);
  await expectNoAxeViolations(page);
  await page.keyboard.press("Escape");

  await page.keyboard.press("b");
  await expect(page.getByRole("group", { name: "Drawing options" }).getByText("This layer is locked")).toBeVisible();

  await page.getByRole("button", { name: "Layers" }).click();
  await page.getByRole("switch", { name: "Lock Objects" }).click();
  await expect.poll(locked).toEqual([]);
});
