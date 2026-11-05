import { expect, test } from "@playwright/test";
import { chooseOption, createAndOpenWorld, registerNewUser, worldIdOf } from "./helpers";

test("the game master fires effects on the map and everyone on the floor receives them", async ({ page }) => {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(error.message));
  const effects: { kind: string; x: number; y: number; toX?: number; toY?: number; value?: number }[] = [];
  page.on("websocket", (socket) =>
    socket.on("framereceived", ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.type === "map.effect") effects.push(message.effect);
    }),
  );

  await registerNewUser(page);
  await createAndOpenWorld(page, "Effects world");
  await page.request.post(`/api/worlds/${worldIdOf(page)}/scenes`, { data: { name: "Arena", width: 1400, height: 800 } });
  await page.keyboard.press("p");

  await page.getByRole("radio", { name: "Effects" }).click();
  const options = page.getByRole("group", { name: "Effect options" });
  await expect(options.getByText("Click the map to play the effect for everyone.")).toBeVisible();

  const map = (await page.getByRole("application").boundingBox())!;
  const at = (fx: number, fy: number) => ({ x: map.x + map.width * fx, y: map.y + map.height * fy });

  // Damage carries its number.
  await page.mouse.click(at(0.4, 0.4).x, at(0.4, 0.4).y);
  await expect.poll(() => effects.length).toBe(1);
  expect(effects[0]).toMatchObject({ kind: "damage", value: 5 });

  // A projectile takes two clicks: the start, then the landing spot.
  await chooseOption(options, "Effect", "Projectile");
  await expect(options.getByText("Click where the shot starts.")).toBeVisible();
  await page.mouse.click(at(0.3, 0.5).x, at(0.3, 0.5).y);
  await expect(options.getByText("Now click where it lands.")).toBeVisible();
  await page.waitForTimeout(350);
  await page.mouse.click(at(0.7, 0.5).x, at(0.7, 0.5).y);
  await expect.poll(() => effects.length).toBe(2);
  expect(effects[1]).toMatchObject({ kind: "projectile" });
  expect(effects[1]!.toX).toBeGreaterThan(effects[1]!.x);

  expect(problems).toEqual([]);
});
