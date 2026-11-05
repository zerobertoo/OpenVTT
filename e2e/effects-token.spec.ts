import { expect, test } from "@playwright/test";
import { chooseOption, createAndOpenWorld, registerNewUser, worldIdOf, worldState } from "./helpers";

test("dropping a vanish effect on a token hides it, and an arrive effect brings it back", async ({ page }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Vanish world");
  const worldId = worldIdOf(page);
  const scene = await (
    await page.request.post(`/api/worlds/${worldId}/scenes`, { data: { name: "Arena", width: 1400, height: 800 } })
  ).json();
  // The middle of the scene is the middle of the map on screen, so a click there lands on this token.
  await page.request.post(`/api/worlds/${worldId}/tokens`, { data: { sceneId: scene.id, name: "Ghost", x: 665, y: 365, size: 1 } });
  await page.keyboard.press("p");

  await page.getByRole("radio", { name: "Effects" }).click();
  const options = page.getByRole("group", { name: "Effect options" });
  const map = (await page.getByRole("application").boundingBox())!;
  const middle = { x: map.x + map.width / 2, y: map.y + map.height / 2 };
  const isHidden = async () => (await worldState(page, worldId)).tokens.find((token) => token.name === "Ghost")?.hidden;

  expect(await isHidden()).toBe(false);
  await chooseOption(options, "Effect", "Vanish");
  await page.mouse.click(middle.x, middle.y);
  await expect.poll(isHidden).toBe(true);

  await page.waitForTimeout(350);
  await chooseOption(options, "Effect", "Arrival");
  await page.mouse.click(middle.x, middle.y);
  await expect.poll(isHidden).toBe(false);
});
