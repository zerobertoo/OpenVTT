import { expect, test } from "@playwright/test";
import { createAndOpenWorld, expectNoAxeViolations, registerNewUser } from "./helpers";

test("the game master runs the initiative and a player sees it without the hidden token", async ({ page, browser }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Initiative world");
  const worldId = page.url().split("/world/")[1]!.split(/[/?#]/)[0]!;
  const post = async (url: string, data: object) => (await page.request.post(url, { data })).json();
  const put = async (url: string, data: object) => page.request.put(url, { data });

  const { code } = await post(`/api/worlds/${worldId}/invites`, {});
  const player = await browser.newContext();
  const playerPage = await player.newPage();
  await registerNewUser(playerPage);
  await playerPage.goto(`/join/${code}`);
  await playerPage.getByLabel("Display name").fill("Pat");
  await playerPage.getByRole("button", { name: "Join", exact: true }).click();
  await expect(playerPage.getByRole("tablist")).toBeVisible();

  const scene = await post(`/api/worlds/${worldId}/scenes`, { name: "Arena", width: 700, height: 500 });
  const hero = await post(`/api/worlds/${worldId}/tokens`, { sceneId: scene.id, name: "Hero", x: 70, y: 70 });
  const ambusher = await post(`/api/worlds/${worldId}/tokens`, { sceneId: scene.id, name: "Ambusher", x: 210, y: 70, hidden: true });
  await put(`/api/worlds/${worldId}/combat/combatants`, { tokenId: hero.id, score: 12 });
  await put(`/api/worlds/${worldId}/combat/combatants`, { tokenId: ambusher.id, score: 20 });

  await page.getByRole("tab", { name: "Tokens" }).click();
  const gmOrder = page.getByRole("list", { name: "Initiative order" });
  await expect(gmOrder.getByRole("listitem")).toHaveText([/20\s*Ambusher/, /12\s*Hero/]);
  await page.getByRole("button", { name: "Next turn" }).click();
  await expect(gmOrder.getByRole("listitem").first()).toHaveAttribute("aria-current", "true");
  await expectNoAxeViolations(page);

  await playerPage.getByRole("tab", { name: "Tokens" }).click();
  const playerOrder = playerPage.getByRole("list", { name: "Initiative order" });
  await expect(playerOrder.getByRole("listitem")).toHaveCount(1);
  await expect(playerOrder.getByText("Hero")).toBeVisible();
  await expect(playerPage.getByText("Ambusher")).toHaveCount(0);
  await expect(playerPage.getByRole("button", { name: "Next turn" })).toHaveCount(0);

  await page.getByRole("button", { name: "Next turn" }).click();
  await expect(playerOrder.getByRole("listitem")).toHaveAttribute("aria-current", "true");
  await expect(playerPage.getByText("Round 1")).toBeVisible();
  await player.close();
});
