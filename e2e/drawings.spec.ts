import { expect, test } from "@playwright/test";
import { createAndOpenWorld, expectNoAxeViolations, registerNewUser, worldIdOf, worldState } from "./helpers";

test("the game master draws an arrow, pins a private note and erases the arrow", async ({ page }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Drawing world");
  const worldId = worldIdOf(page);
  await page.request.post(`/api/worlds/${worldId}/scenes`, { data: { name: "Arena", width: 700, height: 500 } });
  const drawings = async () => (await worldState(page, worldId)).scenes[0]?.drawings ?? [];

  await page.keyboard.press("p");
  await page.keyboard.press("b");
  const options = page.getByRole("group", { name: "Drawing options" });
  await expect(options).toBeVisible();
  await options.getByLabel("What to draw").selectOption("arrow");
  await expectNoAxeViolations(page);

  const box = (await page.getByRole("application").boundingBox())!;
  const at = (fx: number, fy: number) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });
  await page.mouse.move(at(0.4, 0.5).x, at(0.4, 0.5).y);
  await page.mouse.down();
  await page.mouse.move(at(0.6, 0.7).x, at(0.6, 0.7).y, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await drawings()).map((d) => d.kind)).toEqual(["arrow"]);

  await options.getByLabel("What to draw").selectOption("note");
  await options.getByLabel("Words to place").fill("Trap under the rug");
  await page.mouse.click(at(0.25, 0.55).x, at(0.25, 0.55).y);
  await expect
    .poll(async () => (await drawings()).find((d) => d.kind === "note"))
    .toMatchObject({ layer: "gm", text: "Trap under the rug" });

  await options.getByLabel("What to draw").selectOption("erase");
  await page.mouse.click(at(0.5, 0.6).x, at(0.5, 0.6).y);
  await expect.poll(async () => (await drawings()).map((d) => d.kind)).toEqual(["note"]);
});
