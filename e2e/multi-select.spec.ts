import { expect, test } from "@playwright/test";
import { createAndOpenWorld, expectNoAxeViolations, registerNewUser } from "./helpers";

test("a box selects several tokens, which then turn and are deleted together", async ({ page }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Selection world");
  const worldId = page.url().split("/world/")[1]!.split(/[/?#]/)[0]!;
  const post = async (url: string, data: object) => (await page.request.post(url, { data })).json();

  const scene = await post(`/api/worlds/${worldId}/scenes`, { name: "Arena", width: 700, height: 500 });
  const first = await post(`/api/worlds/${worldId}/tokens`, { sceneId: scene.id, name: "Hero", x: 70, y: 70 });
  const second = await post(`/api/worlds/${worldId}/tokens`, { sceneId: scene.id, name: "Rogue", x: 210, y: 70 });
  // Tokens are not served over REST; the first world snapshot on the socket lists them.
  const tokens = () =>
    page.evaluate(
      (id) =>
        new Promise<{ id: string; rotation: number }[]>((resolve) => {
          const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws?world=${id}`);
          socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type !== "world.state") return;
            socket.close();
            resolve(message.state.tokens);
          };
        }),
      worldId,
    );
  const tokenRotation = async (id: string) => (await tokens()).find((t) => t.id === id)?.rotation;

  // Close the drawer so the whole canvas is map, then drag a box from a corner of the stage over both tokens.
  await page.keyboard.press("p");
  const map = page.getByRole("application");
  await expect(map).toBeVisible();
  const box = (await map.boundingBox())!;
  await page.keyboard.down("Shift");
  await page.mouse.move(box.x + 3, box.y + 3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 3, box.y + box.height - 3, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up("Shift");

  const bar = page.getByRole("toolbar", { name: "Selected tokens" });
  await expect(bar.getByText("2 tokens selected")).toBeVisible();
  await expectNoAxeViolations(page);

  await page.keyboard.press("]");
  await expect.poll(() => tokenRotation(first.id)).toBe(45);
  await expect.poll(() => tokenRotation(second.id)).toBe(45);

  await bar.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(bar).toHaveCount(0);
  await expect.poll(async () => (await tokens()).length).toBe(0);
});
