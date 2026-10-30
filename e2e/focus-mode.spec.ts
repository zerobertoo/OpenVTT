import { expect, test } from "@playwright/test";
import { createAndOpenWorld, expectNoAxeViolations, registerNewUser, worldIdOf } from "./helpers";

test("panels resize from the keyboard, focus mode keeps only the map and the TV view hides the way back", async ({ page, isMobile }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Focus world");
  await page.request.post(`/api/worlds/${worldIdOf(page)}/scenes`, { data: { name: "Hall", width: 700, height: 500 } });

  if (!isMobile) {
    const resizer = page.getByRole("separator", { name: "Panel width" });
    await resizer.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(resizer).toHaveAttribute("aria-valuenow", "448");
  }

  await page.getByRole("application").focus();
  await page.keyboard.press("f");
  await expect(page.getByRole("tablist")).toHaveCount(0);
  await expect(page.getByRole("toolbar", { name: "Map tools" })).toHaveCount(0);
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Show the panels again (F)" }).click();
  await expect(page.getByRole("tablist")).toBeVisible();

  await page.goto(`${page.url().split("?")[0]}?tv`);
  await expect(page.getByRole("application")).toBeVisible();
  await expect(page.getByRole("tablist")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show the panels again (F)" })).toHaveCount(0);
});
