import { expect, test } from "@playwright/test";
import { chooseOption, createAndOpenWorld, expectNoAxeViolations, registerNewUser, worldIdOf } from "./helpers";

test("the game master sets the time of day, weather and season over the map", async ({ page }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Weather world");
  await page.request.post(`/api/worlds/${worldIdOf(page)}/scenes`, { data: { name: "Field", width: 700, height: 500 } });

  // A clear day lays nothing over the map.
  const overlay = page.getByTestId("environment-overlay");
  await expect(overlay).toHaveCount(0);

  await page.getByRole("tab", { name: "World" }).click();
  const atmosphere = page.getByRole("region", { name: "Atmosphere" });
  await chooseOption(atmosphere, "Time of day", "Night");
  await chooseOption(atmosphere, "Weather", "Storm");
  await expect(overlay).toHaveCount(1);
  await expect(overlay).toHaveAttribute("aria-hidden", "true");
  await expectNoAxeViolations(page);

  await chooseOption(atmosphere, "Time of day", "Day");
  await chooseOption(atmosphere, "Weather", "Clear");
  await expect(overlay).toHaveCount(0);
});
