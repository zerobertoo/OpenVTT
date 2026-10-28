import { expect, test } from "@playwright/test";
import { createAndOpenWorld, expectNoAxeViolations, registerNewUser } from "./helpers";

// Reduced motion skips the animation on purpose; the dice need real motion to be thrown.
test.use({ reducedMotion: "no-preference" });

test("dice picked in the tray are rolled by the server and thrown across the screen", async ({ page }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Dice world");

  await page.getByRole("button", { name: "Dice", exact: true }).click();
  const tray = page.getByRole("group", { name: "Dice", exact: true });
  await expect(tray).toBeVisible();
  await tray.getByRole("button", { name: /Add a d20/ }).click();
  await tray.getByRole("button", { name: /Add a d20/ }).click();
  await tray.getByRole("button", { name: /Add a d6/ }).click();
  await tray.getByLabel("Modifier").fill("2");
  await expect(tray.getByText("1d6+2d20+2")).toBeVisible();
  await expectNoAxeViolations(page);

  await tray.getByRole("button", { name: "Roll", exact: true }).click();
  // The roll is the server's: it comes back in the chat. Headless browsers may lack WebGL; then the flat dice show.
  await expect(page.locator("[aria-live=polite]").getByText(/1d6\+2d20\+2: total \d+/)).toBeAttached();
  await expect(page.locator("canvas, .roll-dice").first()).toBeVisible();
  await expect(page.locator(".roll-total").first()).toBeVisible();

  await tray.getByRole("button", { name: "Close" }).click();
  await expect(tray).toBeHidden();
});
