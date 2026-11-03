import { expect, test } from "@playwright/test";
import { createAndOpenWorld, expectNoAxeViolations, registerNewUser, worldIdOf, worldState } from "./helpers";

test("the game master lights a dark scene: places a light, softens its edge, and undoes it", async ({ page }) => {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(error.message));
  // The 401 is the session check before signing in.
  page.on("console", (message) => message.type() === "error" && !message.text().includes("401") && problems.push(message.text()));

  await registerNewUser(page);
  await createAndOpenWorld(page, "Light world");
  const worldId = worldIdOf(page);
  const created = await page.request.post(`/api/worlds/${worldId}/scenes`, {
    data: { name: "Crypt", width: 1400, height: 800, ambientLight: 0.2 },
  });
  expect((await created.json()).ambientLight).toBe(0.2);
  const lightsOnFloor = async () => (await worldState(page, worldId)).scenes[0]!.floors[0]!.lights;

  // Close the drawer so the whole canvas is map (on a phone it covers most of it).
  await page.keyboard.press("p");
  await page.getByRole("radio", { name: "Lights" }).click();
  const options = page.getByRole("group", { name: "Light options" });
  await expect(options.getByText(/Click the map to place a light/)).toBeVisible();

  // A click on the empty map places a light with the default soft edge and selects it.
  const map = (await page.getByRole("application").boundingBox())!;
  await page.mouse.click(map.x + map.width * 0.5, map.y + map.height * 0.5);
  await expect.poll(async () => (await lightsOnFloor()).length).toBe(1);
  expect((await lightsOnFloor())[0]).toMatchObject({ radius: 4, feather: 0.4, shadows: true });

  // The feather slider saves once when released: keyboard steps on the thumb.
  const feather = options.getByRole("slider", { name: "Soft edge" });
  await feather.focus();
  await feather.press("End");
  await expect.poll(async () => (await lightsOnFloor())[0]?.feather).toBe(1);
  await expectNoAxeViolations(page);

  // Both edits can be undone, one step at a time (the shortcut ignores a focused form control).
  await feather.blur();
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await lightsOnFloor())[0]?.feather).toBe(0.4);
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await lightsOnFloor()).length).toBe(0);

  expect(problems).toEqual([]);
});
