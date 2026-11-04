import AxeBuilder from "@axe-core/playwright";
import type { WorldStateDto } from "@openvtt/shared";
import { expect, type Locator, type Page } from "@playwright/test";

const TEST_PASSWORD = "e2e-test-password";

/** Creates a fresh account through the UI and leaves the page on the world list. */
export async function registerNewUser(page: Page) {
  // The first-session tour would cover the table in every test; its own test turns it back on.
  await page.addInitScript(() => sessionStorage.getItem("e2e-tour") || localStorage.setItem("openvtt-tour-done", "1"));
  const username = `e2e_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await page.goto("/");
  await page.getByRole("button", { name: "No account yet? Create one" }).click();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Your worlds" })).toBeVisible();
  return username;
}

/** Creates a world from the list screen and opens its table. */
export async function createAndOpenWorld(page: Page, name: string) {
  await page.getByRole("button", { name: "New world" }).click();
  await page.getByLabel("World name").fill(name);
  await page.getByRole("button", { name: "Create world" }).click();
  await page.getByRole("button", { name: /^Open/ }).click();
  await expect(page.getByRole("tablist")).toBeVisible();
}

/** Fails the test on any axe violation, including color contrast (checked in a real browser). */
export async function expectNoAxeViolations(page: Page) {
  // Radix focus guards are invisible on purpose. `motion` still fades elements in under reduced motion; axe would measure a half-transparent background.
  await page.waitForFunction(() =>
    [...document.querySelectorAll<HTMLElement>("[style*='opacity']:not([data-radix-focus-guard])")].every(
      (el) => getComputedStyle(el).opacity === "1",
    ),
  );
  const results = await new AxeBuilder({ page }).analyze();
  const summary = results.violations
    .map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(" ")} ${JSON.stringify(n.any[0]?.data ?? {})}`).join(", ")}`)
    .join("\n");
  expect(summary).toBe("");
}

/** The first world snapshot the socket sends this page's user; tokens and drawings have no REST listing. */
export function worldState(page: Page, worldId: string) {
  return page.evaluate(
    (id) =>
      new Promise<WorldStateDto>((resolve) => {
        const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws?world=${id}`);
        socket.onmessage = (event) => {
          const message = JSON.parse(event.data);
          if (message.type !== "world.state") return;
          socket.close();
          resolve(message.state);
        };
      }),
    worldId,
  );
}

export const worldIdOf = (page: Page) => page.url().split("/world/")[1]!.split(/[/?#]/)[0]!;

/** Picks an option in one of our custom selects: opens the list under `scope`, then clicks the option by its visible name. */
export async function chooseOption(scope: Page | Locator, label: string, option: string | RegExp) {
  const page = "page" in scope && typeof scope.page === "function" ? scope.page() : (scope as Page);
  await scope.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: typeof option === "string" }).click();
}

/** Opens the "Add scene" menu on the Scenes tab and picks one of its entries. */
export async function chooseAddSceneOption(page: Page, option: "New scene" | "Import map") {
  await page.getByRole("button", { name: "Add scene" }).click();
  await page.getByRole("menuitem", { name: option }).click();
}

/** Opens the "New token" popover on the Tokens tab, where the name field and the add button are. */
export async function openNewTokenForm(page: Page) {
  await page.getByRole("button", { name: "New token" }).click();
}
