import { expect, test } from "@playwright/test";
import { createAndOpenWorld, expectNoAxeViolations, registerNewUser, worldIdOf } from "./helpers";

test("the game master invites an observer, promotes and mutes them, and reads the action log", async ({ page, browser }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Members world");
  const worldId = worldIdOf(page);
  await page.request.post(`/api/worlds/${worldId}/scenes`, { data: { name: "Hall", width: 700, height: 500 } });

  await page.getByRole("tab", { name: "World" }).click();
  await page.getByLabel("Joins as").selectOption("observer");
  await page.getByLabel("Uses").selectOption("1");
  await page.getByRole("button", { name: "Create invite link" }).click();
  const link = await page.getByLabel("Invite link").inputValue();
  await expectNoAxeViolations(page);

  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await registerNewUser(guestPage);
  await guestPage.goto(new URL(link).pathname);
  await guestPage.getByLabel("Display name").fill("Olga");
  await guestPage.getByRole("button", { name: "Join", exact: true }).click();
  await expect(guestPage.getByText("Observers read the chat but cannot write in it.")).toBeVisible();

  await page.getByLabel("Role of Olga").selectOption("player");
  await expect(guestPage.getByLabel(/^Message, or/)).toBeVisible();
  await page.getByRole("button", { name: "Mute Olga" }).click();
  await expect(guestPage.getByText("The game master muted you in this world.")).toBeVisible();

  await page.getByText("Game master action log").click();
  await expect(page.getByText(/muted: Olga/)).toBeVisible();
  await expect(page.getByText(/changed a role: Olga: player/)).toBeVisible();
  await expectNoAxeViolations(page);
  await guest.close();
});
