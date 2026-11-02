import { expect, test } from "@playwright/test";
import { createAndOpenWorld, registerNewUser, worldIdOf, worldState } from "./helpers";

test("a scene with floors: the game master switches floors, and a player only gets the floor their token is on", async ({
  page,
  browser,
}) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "House");
  const worldId = worldIdOf(page);
  const post = async (url: string, data: object) => (await page.request.post(url, { data })).json();

  const { code } = await post(`/api/worlds/${worldId}/invites`, {});
  const playerContext = await browser.newContext();
  const player = await playerContext.newPage();
  await registerNewUser(player);
  await player.goto(`/join/${code}`);
  await player.getByLabel("Display name").fill("Pat");
  await player.getByRole("button", { name: "Join", exact: true }).click();
  await expect(player.getByRole("tablist")).toBeVisible();
  const me = await (await player.request.get("/api/me")).json();

  const scene = await post(`/api/worlds/${worldId}/scenes`, {
    name: "House",
    width: 1400,
    height: 800,
    floors: [{ name: "Cellar", walls: [{ x1: 600, y1: 0, x2: 600, y2: 800 }] }, { name: "Attic Vault" }],
  });
  const [cellar, vault] = scene.floors;
  const hero = await post(`/api/worlds/${worldId}/tokens`, {
    sceneId: scene.id,
    floorId: cellar.id,
    name: "Hero",
    x: 100,
    y: 100,
    controllerIds: [me.id],
  });
  await post(`/api/worlds/${worldId}/tokens`, { sceneId: scene.id, floorId: vault.id, name: "Lich", x: 300, y: 100 });
  await post(`/api/worlds/${worldId}/tokens`, { sceneId: scene.id, floorId: cellar.id, name: "Rat", x: 300, y: 300 });

  // The game master gets a switcher; PageDown and PageUp move between floors, and the choice is announced.
  const switcher = page.getByRole("navigation", { name: "Floors" });
  await expect(switcher).toBeVisible();
  await page.reload();
  await expect(page.getByRole("navigation", { name: "Floors" })).toBeVisible();
  const cellarButton = page.getByRole("button", { name: /^Cellar/ });
  const vaultButton = page.getByRole("button", { name: /^Attic Vault/ });
  await expect(cellarButton).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("PageUp");
  await expect(vaultButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status").filter({ hasText: "Showing Attic Vault" })).toHaveCount(1);
  await cellarButton.click();
  await expect(cellarButton).toHaveAttribute("aria-pressed", "true");

  // The player stands on the cellar: the other floor, its name and its tokens never reach their browser.
  await player.getByRole("tab", { name: "Tokens" }).click();
  const list = player.getByRole("list", { name: "Tokens in this scene" });
  await expect(list.getByText("Rat")).toBeVisible();
  await expect(list.getByText("Lich")).toHaveCount(0);
  const before = await worldState(player, worldId);
  expect(before.scenes[0]?.floors.map((f) => f.name)).toEqual(["Cellar"]);
  expect(JSON.stringify(before)).not.toContain("Attic Vault");
  expect(JSON.stringify(before)).not.toContain("Lich");
  expect(before.scenes[0]?.floors[0]?.walls).toEqual([]);

  // Moving the player's token upstairs swaps what they get, with nothing left over from the cellar.
  await page.request.patch(`/api/tokens/${hero.id}`, { data: { floorId: vault.id } });
  await expect(list.getByText("Lich")).toBeVisible();
  await expect(list.getByText("Rat")).toHaveCount(0);
  const after = await worldState(player, worldId);
  expect(after.scenes[0]?.floors.map((f) => f.name)).toEqual(["Attic Vault"]);
  expect(JSON.stringify(after)).not.toContain('"Rat"');
  await playerContext.close();
});
