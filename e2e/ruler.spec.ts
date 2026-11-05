import { expect, type Page, test } from "@playwright/test";
import { chooseOption, createAndOpenWorld, expectNoAxeViolations, registerNewUser } from "./helpers";

type Area = { x: number; y: number; width: number; height: number };

async function settledPicture(page: Page, clip: Area): Promise<Buffer> {
  let picture = await page.screenshot({ clip });
  await expect
    .poll(async () => {
      const next = await page.screenshot({ clip });
      const settled = next.equals(picture);
      picture = next;
      return settled;
    })
    .toBe(true);
  return picture;
}

test("a measurement stays on the map when something else changes on the table", async ({ page }) => {
  const framesReceived: string[] = [];
  page.on("websocket", (socket) => socket.on("framereceived", ({ payload }) => framesReceived.push(String(payload))));
  await registerNewUser(page);
  await createAndOpenWorld(page, "Steady ruler world");
  const worldId = page.url().split("/world/")[1]!.split(/[/?#]/)[0]!;
  const scene = await (
    await page.request.post(`/api/worlds/${worldId}/scenes`, { data: { name: "Arena", width: 700, height: 500 } })
  ).json();
  const token = await (
    await page.request.post(`/api/worlds/${worldId}/tokens`, { data: { sceneId: scene.id, name: "Hero", x: 70, y: 70 } })
  ).json();

  // Close the drawer so the whole canvas is map (on a phone it covers most of it).
  await page.keyboard.press("p");
  await expect(page.getByRole("complementary", { name: "Table panels" })).toBeHidden();
  const map = page.getByRole("application");
  const box = (await map.boundingBox())!;
  // Only the stretch the ruler crosses: on a phone the bars over the map flicker by a few pixels.
  const rulerStretch = { x: box.x + box.width * 0.3, y: box.y + box.height * 0.35, width: box.width * 0.4, height: box.height * 0.12 };
  await page.keyboard.press("r");
  const beforeMeasuring = await settledPicture(page, rulerStretch);
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 4 });
  await page.mouse.up();
  const measured = await settledPicture(page, rulerStretch);
  expect(measured.equals(beforeMeasuring)).toBe(false);

  // Neither name is drawn in this stretch, so any difference in the picture is the measurement going away.
  // Renaming the floor is what makes the map rebuild; token changes alone leave it untouched.
  await page.request.patch(`/api/tokens/${token.id}`, { data: { name: "Hero the Brave" } });
  await page.request.patch(`/api/floors/${scene.floors[0].id}`, { data: { name: "Renamed floor" } });
  await expect.poll(() => framesReceived.some((frame) => frame.includes("Hero the Brave"))).toBe(true);
  await expect.poll(() => framesReceived.some((frame) => frame.includes("Renamed floor"))).toBe(true);
  await page.waitForTimeout(300);
  await expect.poll(async () => (await page.screenshot({ clip: rulerStretch })).equals(measured)).toBe(true);
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
