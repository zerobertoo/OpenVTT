import { expect, test } from "@playwright/test";
import { createAndOpenWorld, registerNewUser, worldIdOf, worldState } from "./helpers";

test("the game master undoes a deleted handout and a handout that was just made", async ({ page }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Undo panels");
  const worldId = worldIdOf(page);
  await page.request.post(`/api/worlds/${worldId}/scenes`, { data: { name: "Town", width: 700, height: 500 } });
  const handouts = async () => (await worldState(page, worldId)).handouts.map((h) => h.title);

  await page.getByRole("tab", { name: "Journal" }).click();
  await page.getByRole("button", { name: "New handout" }).click();
  const form = page.getByRole("form", { name: "Edit handout" });
  await form.getByLabel("Title").fill("Rumors");
  await form.getByRole("button", { name: "Save" }).click();
  await expect.poll(handouts).toEqual(["Rumors"]);

  await page.getByRole("article", { name: "Rumors" }).getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect.poll(handouts).toEqual([]);

  await page.getByRole("application").focus();
  await page.keyboard.press("Control+z");
  await expect.poll(handouts).toEqual(["Rumors"]);
  await page.keyboard.press("Control+Shift+z");
  await expect.poll(handouts).toEqual([]);
  await page.keyboard.press("Control+z");
  await expect.poll(handouts).toEqual(["Rumors"]);
});
