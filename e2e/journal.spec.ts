import { expect, test } from "@playwright/test";
import { createAndOpenWorld, expectNoAxeViolations, registerNewUser, worldIdOf, worldState } from "./helpers";

test("the game master writes a markdown handout and shares it with everyone", async ({ page }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Journal world");
  const worldId = worldIdOf(page);
  await page.request.post(`/api/worlds/${worldId}/scenes`, { data: { name: "Town", width: 700, height: 500 } });

  await page.getByRole("tab", { name: "Journal" }).click();
  await page.getByRole("button", { name: "New handout" }).click();
  const form = page.getByRole("form", { name: "Edit handout" });
  await form.getByLabel("Title").fill("Rumors");
  await form.getByLabel("Text").fill("# The old mill\nSomeone saw **lights** there.\n\n- ask the miller");
  await form.getByLabel("Everyone").check();
  await expectNoAxeViolations(page);
  await form.getByRole("button", { name: "Save" }).click();

  const handout = page.getByRole("article", { name: "Rumors" });
  await expect(handout.getByRole("heading", { name: "The old mill" })).toBeVisible();
  await expect(handout.getByText("Shared with everyone")).toBeVisible();
  await expect(handout.getByRole("listitem")).toHaveText("ask the miller");
  await expect.poll(async () => (await worldState(page, worldId)).handouts[0]?.audience).toEqual(["*"]);

  await page.getByText("Library").click();
  await expect(page.getByText("Nothing uploaded in this world yet.")).toBeVisible();
  await expectNoAxeViolations(page);
});
