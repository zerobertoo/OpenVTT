import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { createAndOpenWorld, expectNoAxeViolations, registerNewUser } from "./helpers";

// The clip is 128x96; the Universal VTT file describes the same map as 4x3 cells of 32 px.
const VIDEO = {
  name: "Little Crypt.webm",
  mimeType: "video/webm",
  buffer: readFileSync(resolve(import.meta.dirname, "fixtures/map-loop.webm")),
};
const UVTT = {
  name: "Little Crypt.dd2vtt",
  mimeType: "application/octet-stream",
  buffer: Buffer.from(
    JSON.stringify({
      format: 0.2,
      resolution: { map_origin: { x: 0, y: 0 }, map_size: { x: 4, y: 3 }, pixels_per_grid: 32 },
      line_of_sight: [],
      portals: [],
      lights: [{ position: { x: 1, y: 1 }, range: 5, intensity: 2, color: "ffFFE5BF", shadows: true }],
      environment: { baked_lighting: true, ambient_light: "ffffffff" },
      image: "",
    }),
  ),
};

test("a Universal VTT file and its video become a scene with the grid from the file", async ({ page }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Import world");
  await page.getByRole("tab", { name: "Scenes" }).click();
  await page.getByRole("button", { name: "Import map" }).click();

  const dialog = page.getByRole("dialog", { name: "Import a map" });
  await dialog.getByLabel("Map files").setInputFiles([UVTT, VIDEO]);
  await expect(dialog.getByText(/128×96 px, 1 lights/)).toBeVisible();
  await expect(dialog.getByText(/no walls or doors/)).toBeVisible();
  await expect(dialog.getByLabel(/Cell size/)).toHaveValue("32");
  await expectNoAxeViolations(page);

  await dialog.getByRole("button", { name: "Create scene" }).click();
  await expect(page.getByRole("list", { name: "Scenes" }).getByText("Little Crypt")).toBeVisible();
});

test("a file that is not a map is explained", async ({ page }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Bad import world");
  await page.getByRole("tab", { name: "Scenes" }).click();
  await page.getByRole("button", { name: "Import map" }).click();
  await page
    .getByRole("dialog", { name: "Import a map" })
    .getByLabel("Map files")
    .setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hi") });
  await expect(page.getByRole("alert").filter({ hasText: "Use a .dd2vtt" })).toBeVisible();
});
