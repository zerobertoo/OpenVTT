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
      line_of_sight: [
        [
          { x: 0, y: 1 },
          { x: 2, y: 1 },
        ],
      ],
      portals: [
        {
          position: { x: 3, y: 1 },
          bounds: [
            { x: 2, y: 1 },
            { x: 4, y: 1 },
          ],
          rotation: 0,
          closed: true,
          freestanding: false,
        },
      ],
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

  const dialog = page.getByRole("dialog", { name: "Import maps" });
  await dialog.getByLabel("Map files").setInputFiles([UVTT, VIDEO]);
  await expect(dialog.getByText(/128×96 px, 1 lights/)).toBeVisible();
  await expect(dialog.getByText(/2 walls and doors/)).toBeVisible();
  await expect(dialog.getByText(/no walls or doors/)).toHaveCount(0);
  await expect(dialog.getByLabel(/Cell size/)).toHaveValue("32");
  await expectNoAxeViolations(page);

  await dialog.getByRole("button", { name: "Create scene" }).click();
  await expect(page.getByRole("list", { name: "Scenes" }).getByText("Little Crypt")).toBeVisible();
  // The game master chooses what is drawn from the Layers menu on the map.
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Walls" })).toBeChecked();
  await expect(page.getByRole("switch", { name: "Light range" })).not.toBeChecked();
  await page.getByRole("switch", { name: "Walls" }).uncheck();
  await expect(page.getByRole("switch", { name: "Walls" })).not.toBeChecked();
});

test("a file that is not a map is explained", async ({ page }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Bad import world");
  await page.getByRole("tab", { name: "Scenes" }).click();
  await page.getByRole("button", { name: "Import map" }).click();
  await page
    .getByRole("dialog", { name: "Import maps" })
    .getByLabel("Map files")
    .setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hi") });
  await expect(page.getByRole("alert").filter({ hasText: "Use a .dd2vtt" })).toBeVisible();
});

test("the grid can be lined up by eye and applied to the scene", async ({ page }) => {
  await registerNewUser(page);
  await createAndOpenWorld(page, "Grid world");
  await page.getByRole("tab", { name: "Scenes" }).click();
  await page.getByRole("button", { name: "Import map" }).click();
  await page.getByRole("dialog", { name: "Import maps" }).getByLabel("Map files").setInputFiles([UVTT, VIDEO]);
  await page.getByRole("dialog", { name: "Import maps" }).getByRole("button", { name: "Create scene" }).click();
  await page.getByRole("button", { name: "Adjust grid on the map" }).click();

  const dialog = page.getByRole("dialog", { name: "Adjust the grid" });
  await dialog.getByLabel("Cell size", { exact: true }).fill("64");
  await expectNoAxeViolations(page);
  await dialog.getByRole("button", { name: "Use this grid" }).click();
  await expect(page.getByRole("form", { name: "Scene settings" }).getByLabel(/Cell size/)).toHaveValue("64");
});
