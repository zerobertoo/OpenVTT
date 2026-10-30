import { expect, test } from "@playwright/test";
import { createAndOpenWorld, registerNewUser } from "./helpers";

test("the overview map shows with a scene and can be hidden with M", async ({ page, isMobile }) => {
  test.skip(isMobile, "The overview map is hidden on small screens");
  await registerNewUser(page);
  await createAndOpenWorld(page, "Minimap world");
  const worldId = page.url().split("/world/")[1]!.split(/[/?#]/)[0]!;
  const minimap = page.locator("canvas.minimap");
  await expect(minimap).toHaveCount(0);

  await page.request.post(`/api/worlds/${worldId}/scenes`, { data: { name: "Arena", width: 1400, height: 700 } });
  await expect(minimap).toBeVisible();
  // The scene is twice as wide as tall, and so is the overview.
  const box = (await minimap.boundingBox())!;
  expect(Math.round(box.width / box.height)).toBe(2);

  await page.keyboard.press("m");
  await expect(minimap).toHaveCount(0);
  await page.keyboard.press("m");
  await expect(minimap).toBeVisible();
});
