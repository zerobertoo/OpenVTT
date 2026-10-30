import { expect, test } from "@playwright/test";
import { createAndOpenWorld, expectNoAxeViolations, registerNewUser } from "./helpers";

test("the ruler offers its shapes and measures in metric unless told otherwise", async ({ page }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Ruler world");
  const worldId = page.url().split("/world/")[1]!.split(/[/?#]/)[0]!;
  await page.request.post(`/api/worlds/${worldId}/scenes`, { data: { name: "Arena", width: 700, height: 500 } });

  const options = page.getByRole("group", { name: "Ruler options" });
  await expect(options).toHaveCount(0);
  await page.keyboard.press("r");
  await expect(options).toBeVisible();
  await expect(options.getByLabel("Distances")).toHaveValue("metric");
  await expect(options.getByLabel("Shape")).toHaveValue("line");
  await expect(options.getByLabel("Diagonals")).toBeVisible();

  // Diagonal rules only matter for a line; other shapes hide them.
  await options.getByLabel("Shape").selectOption("cone");
  await expect(options.getByLabel("Diagonals")).toHaveCount(0);
  await expectNoAxeViolations(page);

  // The choice is remembered in this browser and the options go away with the tool.
  await page.reload();
  await expect(page.getByRole("tablist")).toBeVisible();
  await page.keyboard.press("r");
  await expect(options.getByLabel("Shape")).toHaveValue("cone");
  await page.keyboard.press("v");
  await expect(options).toHaveCount(0);
});
