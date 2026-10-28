import { expect, test } from "@playwright/test";
import { createAndOpenWorld, registerNewUser } from "./helpers";

test("with fog of war a player only gets the tokens their token can see, and a door changes that", async ({ page, browser }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Fog world");
  const worldId = page.url().split("/world/")[1]!.split(/[/?#]/)[0]!;
  const post = async (url: string, data: object) => (await page.request.post(url, { data })).json();

  const { code } = await post(`/api/worlds/${worldId}/invites`, {});
  const player = await browser.newContext();
  const playerPage = await player.newPage();
  await registerNewUser(playerPage);
  await playerPage.goto(`/join/${code}`);
  await playerPage.getByLabel("Display name").fill("Pat");
  await playerPage.getByRole("button", { name: "Join", exact: true }).click();
  await expect(playerPage.getByRole("tablist")).toBeVisible();

  // The player's id is needed to hand them a token; the world state lists members by user id.
  const me = await (await playerPage.request.get("/api/me")).json();
  const scene = await post(`/api/worlds/${worldId}/scenes`, {
    name: "Crypt",
    width: 1400,
    height: 800,
    gridSize: 70,
    visionEnabled: true,
    walls: [{ x1: 600, y1: 0, x2: 600, y2: 800, kind: "door", open: false }],
  });
  await post(`/api/worlds/${worldId}/tokens`, { sceneId: scene.id, name: "Hero", x: 100, y: 100, controllerIds: [me.id] });
  await post(`/api/worlds/${worldId}/tokens`, { sceneId: scene.id, name: "Rat", x: 300, y: 100 });
  await post(`/api/worlds/${worldId}/tokens`, { sceneId: scene.id, name: "Ghoul", x: 800, y: 100 });

  await playerPage.getByRole("tab", { name: "Tokens" }).click();
  const list = playerPage.getByRole("list", { name: "Tokens in this scene" });
  await expect(list.getByText("Rat")).toBeVisible();
  await expect(list.getByText("Hero")).toBeVisible();
  await expect(list.getByText("Ghoul")).toHaveCount(0);

  await post(`/api/scenes/${scene.id}/doors/${scene.walls[0].id}`, { open: true });
  await expect(list.getByText("Ghoul")).toBeVisible();
  await player.close();
});
