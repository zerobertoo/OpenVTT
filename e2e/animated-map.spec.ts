import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { createAndOpenWorld, expectNoAxeViolations, registerNewUser } from "./helpers";

// A 2-second, 128x96 VP9 clip. The test browser has no H.264, so WebM is what the browser tests use.
const VIDEO = resolve(import.meta.dirname, "fixtures/map-loop.webm");

async function createSceneFrom(page: Page, name: string, file: string | { name: string; mimeType: string; buffer: Buffer }) {
  await page.getByRole("tab", { name: "Scenes" }).click();
  const form = page.getByRole("form", { name: "New scene" });
  await form.getByLabel("Name").fill(name);
  await form.getByLabel(/Map image or video/).setInputFiles(file);
  await page.getByRole("button", { name: "Create scene" }).click();
}

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("a video map starts paused and plays on request", async ({ page }) => {
    await registerNewUser(page);
    await createAndOpenWorld(page, "Reduced motion world");
    await createSceneFrom(page, "Waterfall", VIDEO);
    await expect(page.getByRole("list", { name: "Scenes" }).getByText("Waterfall")).toBeVisible();

    const play = page.getByRole("button", { name: "Play map animation" });
    await expect(play).toBeVisible();
    await play.click();
    await expect(page.getByRole("button", { name: "Pause map animation" })).toBeVisible();
    await expectNoAxeViolations(page);
    await page.getByRole("button", { name: "Pause map animation" }).click();
    await expect(page.getByRole("button", { name: "Play map animation" })).toBeVisible();
  });
});

test.describe("without a motion preference", () => {
  test.use({ reducedMotion: "no-preference" });

  test("a video map plays by itself and can be paused", async ({ page }) => {
    await registerNewUser(page);
    await createAndOpenWorld(page, "Moving world");
    await createSceneFrom(page, "Waterfall", VIDEO);
    await expect(page.getByRole("button", { name: "Pause map animation" })).toBeVisible();
    await page.getByRole("button", { name: "Pause map animation" }).click();
    await expect(page.getByRole("button", { name: "Play map animation" })).toBeVisible();
  });
});

test("a file the browser cannot decode is refused before anything is uploaded", async ({ page }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Broken video world");
  await createSceneFrom(page, "Broken", { name: "broken.webm", mimeType: "video/webm", buffer: Buffer.from("this is not a video") });
  await expect(page.getByRole("alert").filter({ hasText: "cannot play that video" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Scenes" })).toHaveCount(0);
});
