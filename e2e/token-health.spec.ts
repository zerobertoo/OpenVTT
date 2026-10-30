import { expect, test } from "@playwright/test";
import { createAndOpenWorld, expectNoAxeViolations, registerNewUser } from "./helpers";

test("the game master gives a token hit points, a condition and a visible name", async ({ page }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Health world");
  const worldId = page.url().split("/world/")[1]!.split(/[/?#]/)[0]!;
  const scene = await (await page.request.post(`/api/worlds/${worldId}/scenes`, { data: { name: "Arena", width: 700, height: 500 } })).json();
  const token = await (
    await page.request.post(`/api/worlds/${worldId}/tokens`, { data: { sceneId: scene.id, name: "Ogre", x: 70, y: 70 } })
  ).json();

  // Tokens are not served over REST; the first world snapshot on the socket lists them.
  const savedToken = () =>
    page.evaluate(
      (id) =>
        new Promise<Record<string, unknown> | undefined>((resolve) => {
          const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws?world=${id}`);
          socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type !== "world.state") return;
            socket.close();
            resolve(message.state.tokens[0]);
          };
        }),
      worldId,
    );

  await page.getByRole("tab", { name: "Tokens" }).click();
  await page.getByRole("button", { name: /Ogre/ }).first().click();

  await page.getByLabel("Maximum hit points").fill("30");
  await page.getByLabel("Maximum hit points").blur();
  await expect.poll(async () => (await savedToken())?.hpMax).toBe(30);
  // Setting a maximum on a token with no health yet starts it at full.
  expect((await savedToken())?.hp).toBe(30);

  await page.getByLabel("Hit points", { exact: true }).fill("12");
  await page.getByLabel("Hit points", { exact: true }).blur();
  await page.getByLabel("Prone").check();
  await page.getByLabel("Show the name on the map").check();
  await expect.poll(async () => savedToken()).toMatchObject({ hp: 12, hpMax: 30, conditions: ["prone"], showName: true });
  await expectNoAxeViolations(page);
  expect(token.id).toBeTruthy();
});
