import { expect, test } from "@playwright/test";
import { createAndOpenWorld, expectNoAxeViolations, registerNewUser, worldIdOf } from "./helpers";

test("a first visit shows the table tour once, and the look can change contrast, text size and accent", async ({ page }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Tour world");
  await page.request.post(`/api/worlds/${worldIdOf(page)}/scenes`, { data: { name: "Hall", width: 700, height: 500 } });
  await page.evaluate(() => {
    sessionStorage.setItem("e2e-tour", "1");
    localStorage.removeItem("openvtt-tour-done");
  });
  await page.reload();

  const tour = page.getByRole("dialog", { name: /Welcome to the table \(1 of 6\)/ });
  await expect(tour).toBeVisible();
  await expectNoAxeViolations(page);
  await tour.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("dialog", { name: /\(2 of 6\)/ })).toBeVisible();
  await page.getByRole("button", { name: "Skip the tour" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("tablist")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("tab", { name: "World" }).click();
  await page.getByLabel("Contrast").selectOption("high");
  await page.getByLabel("Text size").selectOption("1.3");
  await page.getByLabel("Accent color").selectOption("violet");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-contrast", "high");
  await expect(html).toHaveAttribute("data-accent", "violet");
  await expectNoAxeViolations(page);
  await page.reload();
  await expect(html).toHaveAttribute("data-accent", "violet");
});
