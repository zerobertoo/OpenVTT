import { expect, type Locator, test } from "@playwright/test";
import { chooseOption, createAndOpenWorld, expectNoAxeViolations, registerNewUser } from "./helpers";

async function settledPicture(map: Locator): Promise<Buffer> {
  let picture = await map.screenshot();
  await expect
    .poll(async () => {
      const next = await map.screenshot();
      const settled = next.equals(picture);
      picture = next;
      return settled;
    })
    .toBe(true);
  return picture;
}

test("a measurement stays on the map when something else changes on the table", async ({ page }) => {
  const tokenUpdates: string[] = [];
  page.on("websocket", (socket) =>
    socket.on("framereceived", ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.type === "token.upsert") tokenUpdates.push(message.token.name);
    }),
  );
  await registerNewUser(page);
  await createAndOpenWorld(page, "Steady ruler world");
  const worldId = page.url().split("/world/")[1]!.split(/[/?#]/)[0]!;
  const scene = await (await page.request.post(`/api/worlds/${worldId}/scenes`, { data: { name: "Arena", width: 700, height: 500 } })).json();
  const token = await (
    await page.request.post(`/api/worlds/${worldId}/tokens`, { data: { sceneId: scene.id, name: "Hero", x: 70, y: 70 } })
  ).json();

  const map = page.getByRole("application");
  const box = (await map.boundingBox())!;
  await page.keyboard.press("r");
  const beforeMeasuring = await settledPicture(map);
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 4 });
  await page.mouse.up();
  const measured = await settledPicture(map);
  expect(measured.equals(beforeMeasuring)).toBe(false);

  // The first two letters are all the map draws of a name, so any difference in the picture is the measurement going away.
  await page.request.patch(`/api/tokens/${token.id}`, { data: { name: "Hero the Brave" } });
  await expect.poll(() => tokenUpdates.includes("Hero the Brave")).toBe(true);
  await page.waitForTimeout(300);
  await expect.poll(async () => (await map.screenshot()).equals(measured)).toBe(true);
});

test("the ruler offers its shapes and measures in metric unless told otherwise", async ({ page }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Ruler world");
  const worldId = page.url().split("/world/")[1]!.split(/[/?#]/)[0]!;
  await page.request.post(`/api/worlds/${worldId}/scenes`, { data: { name: "Arena", width: 700, height: 500 } });

  const options = page.getByRole("group", { name: "Ruler options" });
  await expect(options).toHaveCount(0);
  await page.keyboard.press("r");
  await expect(options).toBeVisible();
  await expect(options.getByRole("combobox", { name: "Distances" })).toHaveText("Metric (m, km)");
  await expect(options.getByRole("combobox", { name: "Shape" })).toHaveText("Line");
  await expect(options.getByLabel("Diagonals")).toBeVisible();

  // Diagonal rules only matter for a line; other shapes hide them.
  await chooseOption(options, "Shape", "Cone");
  await expect(options.getByLabel("Diagonals")).toHaveCount(0);
  await expectNoAxeViolations(page);

  // The choice is remembered in this browser and the options go away with the tool.
  await page.reload();
  await expect(page.getByRole("tablist")).toBeVisible();
  await page.keyboard.press("r");
  await expect(options.getByRole("combobox", { name: "Shape" })).toHaveText("Cone");
  await page.keyboard.press("v");
  await expect(options).toHaveCount(0);
});
