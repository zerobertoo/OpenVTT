import { expect, test } from "@playwright/test";
import { createAndOpenWorld, registerNewUser } from "./helpers";

// Visual regression on the screens people see first. Opt-in (`pnpm test:visual`, see playwright.config.ts) because the
// baselines are rendered on Linux CI; fonts differ per OS, so snapshots from other platforms are git-ignored.
const options = { maxDiffPixelRatio: 0.01, animations: "disabled" as const };

test("sign-in screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  await expect(page).toHaveScreenshot("sign-in.png", options);
});

test("empty world list and the new-world dialog", async ({ page }) => {
  await registerNewUser(page);
  await expect(page).toHaveScreenshot("world-list-empty.png", options);
  await page.getByRole("button", { name: "New world" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveScreenshot("new-world-dialog.png", options);
});

test("fresh table guides the game master", async ({ page }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Visual world");
  await expect(page.getByRole("heading", { name: "Your table is ready for its first scene" })).toBeVisible();
  await expect(page).toHaveScreenshot("table-empty.png", options);
});

test("not found screen", async ({ page }) => {
  await registerNewUser(page);
  await page.goto("/nowhere");
  await expect(page.getByRole("heading", { name: "There is nothing at this address" })).toBeVisible();
  await expect(page).toHaveScreenshot("not-found.png", options);
});
