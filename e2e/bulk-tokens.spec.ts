import { expect, test } from "@playwright/test";
import { createAndOpenWorld, expectNoAxeViolations, registerNewUser } from "./helpers";

// A 1x1 PNG.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("several images become several tokens named after their files", async ({ page }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Bulk world");
  const worldId = page.url().split("/world/")[1]!.split(/[/?#]/)[0]!;
  await page.request.post(`/api/worlds/${worldId}/scenes`, { data: { name: "Arena", width: 700, height: 500 } });

  await page.getByRole("tab", { name: "Tokens" }).click();
  await page.locator("input[type=file][multiple]").setInputFiles([
    { name: "goblin_archer.png", mimeType: "image/png", buffer: PNG },
    { name: "orc-brute.png", mimeType: "image/png", buffer: PNG },
  ]);

  await expect(page.getByRole("button", { name: /goblin archer/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /orc brute/ })).toBeVisible();
  await expectNoAxeViolations(page);
});
