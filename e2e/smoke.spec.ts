import { expect, test } from "@playwright/test";
import { createAndOpenWorld, expectNoAxeViolations, registerNewUser } from "./helpers";

test("sign-in screen has no accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  await expectNoAxeViolations(page);
});

test("registering validates the fields before calling the server", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "No account yet? Create one" }).click();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("This field is required.")).toHaveCount(2);

  await page.getByLabel("Username").fill("a!");
  await page.getByLabel("Password").fill("short");
  await page.getByLabel("Username").blur();
  await page.getByLabel("Password").blur();
  await expect(page.getByText("Use 3 to 32 letters, numbers, dots, dashes or underscores.")).toBeVisible();
  await expect(page.getByText("Use at least 8 characters.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Username")).toHaveAttribute("aria-invalid", "true");
  await expectNoAxeViolations(page);
});

test("signed-out visitors see the sign-in form at the invite URL and land there after signing in", async ({ page }) => {
  await page.goto("/join/some-code");
  await page.getByRole("button", { name: "No account yet? Create one" }).click();
  await page.getByLabel("Username").fill(`e2e_${Date.now().toString(36)}`);
  await page.getByLabel("Password").fill("e2e-test-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/join\/some-code$/);
  await expect(page.getByRole("heading", { name: "Join a world" })).toBeVisible();
});

test("register, create a world, open the table and roll dice in the chat", async ({ page }) => {
  await registerNewUser(page);
  await expectNoAxeViolations(page);

  await createAndOpenWorld(page, "Smoke test world");
  await expect(page).toHaveURL(/\/world\/[\w-]+$/);
  await expect(page.locator("header").getByText("Smoke test world")).toBeVisible();
  // A fresh table has no scene yet: the game master is guided through the first steps.
  await expect(page.getByRole("heading", { name: "Your table is ready for its first scene" })).toBeVisible();
  await page.getByRole("button", { name: "How a table works" }).click();
  await expect(page.getByRole("button", { name: "Open Tokens" }).last()).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByLabel("Message, or /r 2d6+3 to roll").fill("/r 1d20");
  await page.getByRole("button", { name: "Send" }).click();
  // The roll is announced to screen readers as "<notation>: total <n>".
  await expect(
    page
      .getByRole("log")
      .or(page.locator("[aria-live=polite]"))
      .getByText(/1d20: total \d+/),
  ).toBeAttached();
  await expectNoAxeViolations(page);
});

test("a game master can set up a scene, a token, a sheet and an invite, with no accessibility violations", async ({ page }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Tour world");

  await page.getByRole("tab", { name: "Scenes" }).click();
  await page.getByRole("form", { name: "New scene" }).getByLabel("Name").fill("Tavern");
  await page.getByRole("button", { name: "Create scene" }).click();
  await expect(page.getByRole("list", { name: "Scenes" }).getByText("Tavern")).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("tab", { name: "Tokens" }).click();
  await page.getByLabel("Name").first().fill("Goblin");
  await page.getByRole("button", { name: "Add token" }).click();
  await page
    .getByRole("list", { name: "Tokens in this scene" })
    .getByRole("button", { name: /Goblin/ })
    .click();
  await expect(page.getByRole("region", { name: "Edit token" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Goblin moved to column 3, row 2")).toBeAttached();
  await expectNoAxeViolations(page);

  await page.getByRole("tab", { name: "Sheets" }).click();
  await page.getByLabel("Name").first().fill("Ada");
  await page.getByRole("button", { name: "Create sheet" }).click();
  await expect(page.getByRole("list", { name: "Sheets" }).getByText("Ada")).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("tab", { name: "World" }).click();
  await page.getByRole("button", { name: "Create invite link" }).click();
  await expect(page.getByLabel("Invite link")).toHaveValue(/\/join\//);
  await expectNoAxeViolations(page);
});

test("the back button on the table returns to the world list", async ({ page }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Back button world");
  await page.getByRole("button", { name: /back/i }).click();
  await expect(page.getByRole("heading", { name: "Your worlds" })).toBeVisible();
});

test("an unknown address and a world the person is not in explain themselves", async ({ page }) => {
  await registerNewUser(page);

  await page.goto("/no/such/page");
  await expect(page.getByRole("heading", { name: "There is nothing at this address" })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.goto("/world/00000000-0000-0000-0000-000000000000");
  await expect(page.getByRole("heading", { name: "This world is not available to you" })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Back to worlds" }).click();
  await expect(page.getByRole("heading", { name: "Your worlds" })).toBeVisible();
});
