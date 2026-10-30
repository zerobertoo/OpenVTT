import { expect, test } from "@playwright/test";
import { createAndOpenWorld, expectNoAxeViolations, registerNewUser, worldIdOf, worldState } from "./helpers";

test("a player is told it is their turn and hears the music the game master plays", async ({ page, browser }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Sound world");
  const worldId = worldIdOf(page);
  const post = async (url: string, data: object) => (await page.request.post(url, { data })).json();

  const { code } = await post(`/api/worlds/${worldId}/invites`, {});
  const player = await browser.newContext();
  const playerPage = await player.newPage();
  await registerNewUser(playerPage);
  await playerPage.goto(`/join/${code}`);
  await playerPage.getByLabel("Display name").fill("Pat");
  await playerPage.getByRole("button", { name: "Join", exact: true }).click();
  await expect(playerPage.getByRole("tablist")).toBeVisible();
  const playerId = (await (await playerPage.request.get("/api/me")).json()).id;

  const scene = await post(`/api/worlds/${worldId}/scenes`, { name: "Arena", width: 700, height: 500 });
  const hero = await post(`/api/worlds/${worldId}/tokens`, { sceneId: scene.id, name: "Hero", x: 70, y: 70, controllerIds: [playerId] });
  await page.request.put(`/api/worlds/${worldId}/combat/combatants`, { data: { tokenId: hero.id, score: 12 } });
  await post(`/api/worlds/${worldId}/combat/next`, {});
  await expect(playerPage.getByText("Your turn!")).toBeVisible();

  await page.getByRole("tab", { name: "World" }).click();
  const music = page.getByRole("region", { name: "Table music" });
  await music.locator("input[type=file]").setInputFiles({
    name: "rain.ogg",
    mimeType: "audio/ogg",
    buffer: Buffer.concat([Buffer.from("OggS"), Buffer.alloc(4096, 1)]),
  });
  await expect(music.getByLabel("Track")).not.toHaveValue("");
  await music.getByRole("button", { name: "Play for everyone" }).click();
  await expect(music.getByRole("button", { name: "Stop the music" })).toBeVisible();
  await expect.poll(async () => (await worldState(page, worldId)).ambient?.playing).toBe(true);
  await expectNoAxeViolations(page);
  await expect(playerPage.locator("audio")).toHaveCount(1);
  await player.close();
});
