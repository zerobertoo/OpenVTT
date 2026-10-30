import { expect, test } from "@playwright/test";
import { createAndOpenWorld, expectNoAxeViolations, registerNewUser } from "./helpers";

test("the chat offers the session log as a markdown download", async ({ page }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Log world");
  await page.request.post(`/api/worlds/${page.url().split("/world/")[1]!.split(/[/?#]/)[0]}/scenes`, {
    data: { name: "A", width: 700, height: 500 },
  });
  await page.getByLabel(/^Message, or/).fill("Hello table");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Hello table")).toBeVisible();

  const link = page.getByRole("link", { name: "Download the session log (Markdown)" });
  const download = page.waitForEvent("download");
  await link.click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("session-log.md");
  const text = await (await page.request.get((await link.getAttribute("href"))!)).text();
  expect(text).toContain("# Log world");
  expect(text).toContain("Hello table");
  await expectNoAxeViolations(page);
});
