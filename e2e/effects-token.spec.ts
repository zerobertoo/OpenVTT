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

test("effects act on the tokens they land on: a strike takes hit points, an area leaves its condition", async ({ page }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Strike world");
  const worldId = worldIdOf(page);
  const scene = await (
    await page.request.post(`/api/worlds/${worldId}/scenes`, { data: { name: "Arena", width: 1400, height: 800 } })
  ).json();
  await page.request.post(`/api/worlds/${worldId}/tokens`, {
    data: { sceneId: scene.id, name: "Ogre", x: 665, y: 365, size: 1, hp: 20, hpMax: 20 },
  });
  await page.keyboard.press("p");

  await page.getByRole("radio", { name: "Effects" }).click();
  const options = page.getByRole("group", { name: "Effect options" });
  const map = (await page.getByRole("application").boundingBox())!;
  const middle = { x: map.x + map.width / 2, y: map.y + map.height / 2 };
  const ogre = async () => (await worldState(page, worldId)).tokens.find((token) => token.name === "Ogre");

  await chooseOption(options, "Effect", "Slash");
  await options.getByLabel("Damage").fill("7");
  await page.mouse.click(middle.x, middle.y);
  await expect.poll(async () => (await ogre())?.hp).toBe(13);

  await page.waitForTimeout(350);
  await chooseOption(options, "Effect", "Poison cloud");
  await page.mouse.click(middle.x, middle.y);
  await expect.poll(async () => (await ogre())?.conditions).toEqual(["poisoned"]);
  expect((await ogre())?.hp).toBe(6);

  // With the switch off, an effect is only a picture again.
  await page.waitForTimeout(350);
  await options.getByLabel("Affect tokens").uncheck();
  await page.mouse.click(middle.x, middle.y);
  await page.waitForTimeout(1200);
  expect((await ogre())?.hp).toBe(6);
});
