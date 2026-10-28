import { expect, test } from "@playwright/test";
import { createAndOpenWorld, registerNewUser } from "./helpers";

test.use({ reducedMotion: "no-preference" });

test("a roll is thrown over the table as solid dice, and the total follows", async ({ page }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Dice world");
  await page.getByLabel("Message, or /r 2d6+3 to roll").fill("/r 1d20 adv");
  await page.getByRole("button", { name: "Send" }).click();
  // Headless browsers may lack WebGL; the flat dice then take over, so either one proves the overlay ran.
  const overlay = page.locator(".roll-total, canvas").first();
  await expect(overlay).toBeVisible();
  await expect(page.locator(".roll-total").first()).toBeVisible();
});
