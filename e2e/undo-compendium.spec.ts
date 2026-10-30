import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, registerNewUser, worldState } from "./helpers";

test("the game master places compendium monsters and undoes or redoes changes from the keyboard", async ({ page, isMobile }) => {
  await registerNewUser(page);
  const world = await (await page.request.post("/api/worlds", { data: { name: "SRD world", systemId: "dnd5e-srd" } })).json();
  const scene = await (
    await page.request.post(`/api/worlds/${world.id}/scenes`, { data: { name: "Road", width: 700, height: 500 } })
  ).json();
  await page.request.post(`/api/worlds/${world.id}/tokens`, { data: { sceneId: scene.id, name: "Scout", x: 0, y: 0 } });
  await page.goto(`/world/${world.id}`);
  await expect(page.getByRole("tablist")).toBeVisible();
  const tokens = async () => (await worldState(page, world.id)).tokens;

  await page.getByRole("tab", { name: "Tokens" }).click();
  const compendium = page.getByRole("region", { name: "Compendium" });
  await compendium.getByLabel("Search the compendium").fill("gob");
  await compendium.getByRole("button", { name: "Place on map Goblin" }).click();
  await expect.poll(async () => (await tokens()).map((t) => t.name).sort()).toEqual(["Goblin", "Scout"]);
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: /Scout/ }).first().click();
  await page.getByRole("application").focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await tokens()).find((t) => t.name === "Scout")?.x).toBe(70);
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await tokens()).find((t) => t.name === "Scout")?.x).toBe(0);
  await page.keyboard.press("Control+Shift+z");
  await expect.poll(async () => (await tokens()).find((t) => t.name === "Scout")?.x).toBe(70);

  // Two more undos take back the move and then the goblin.
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await tokens()).map((t) => t.name)).toEqual(["Scout"]);

  // Dragging an entry onto the map places it there; touch screens have no drag and drop, they use the button.
  if (isMobile) return;
  await compendium.getByLabel("Search the compendium").fill("wolf");
  await compendium.getByRole("listitem").filter({ hasText: "Wolf" }).dragTo(page.getByRole("application"));
  await expect.poll(async () => (await tokens()).map((t) => t.name).sort()).toEqual(["Scout", "Wolf"]);
});
