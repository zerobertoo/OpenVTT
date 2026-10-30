import { expect, test } from "@playwright/test";
import { createAndOpenWorld, registerNewUser, worldIdOf } from "./helpers";

test("a long chat history keeps only the visible messages in the page and opens at the newest", async ({ page }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Chatty world");
  const worldId = worldIdOf(page);
  for (let i = 1; i <= 80; i++) await page.request.post(`/api/worlds/${worldId}/messages`, { data: { content: `Line ${i}` } });
  await page.reload();

  await expect(page.getByText("Line 80", { exact: true })).toBeVisible();
  const rendered = await page.locator(".chat-log > li.msg").count();
  expect(rendered).toBeGreaterThan(0);
  expect(rendered).toBeLessThan(40);
});
