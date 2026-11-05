import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createSceneSchema, createTokenSchema, handoutInputSchema } from "@openvtt/shared";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "./db.ts";
import { createServices } from "./services.ts";
import { PNG } from "./test-utils.ts";

const GRACE_MS = 7 * 24 * 3_600_000;
const open: { close(): void }[] = [];
afterEach(() => {
  for (const db of open.splice(0)) db.close();
});

async function setup() {
  const dir = mkdtempSync(join(tmpdir(), "openvtt-orphans-"));
  const db = openDatabase(":memory:");
  open.push(db);
  const s = createServices(db, dir, resolve(import.meta.dirname, "../../../systems"));
  const user = await s.auth.register("alice", "correct horse");
  const world = s.worlds.create(user, "Table");
  /** An unreferenced image; every call writes a distinct file. */
  const newAsset = () => s.assets.save(world.id, PNG);
  const exists = (asset: { id: string; fileName: string }) =>
    existsSync(s.assets.path({ ...asset, worldId: world.id, mime: "image/png", size: 0 })) && s.assets.find(asset.id) !== null;
  /** Long enough after creation for every asset to be past its grace period. */
  const later = Date.now() + 2 * GRACE_MS;
  return { s, world, newAsset, exists, later };
}

describe("deleting orphaned assets", () => {
  it("removes an unreferenced asset together with its file once it is past the grace period", async () => {
    const { s, newAsset, later } = await setup();
    const orphan = newAsset();
    expect(s.assets.deleteOrphans(GRACE_MS, later)).toBe(1);
    expect(s.assets.find(orphan.id)).toBeNull();
    expect(existsSync(s.assets.path(orphan))).toBe(false);
  });

  it("keeps an unreferenced asset that is still inside the grace period", async () => {
    const { s, newAsset, exists } = await setup();
    const fresh = newAsset();
    expect(s.assets.deleteOrphans(GRACE_MS)).toBe(0);
    expect(exists(fresh)).toBe(true);
  });

  it("never removes an asset used as a floor background, token image, table music or handout image", async () => {
    const { s, world, newAsset, exists, later } = await setup();
    const background = newAsset();
    const tokenImage = newAsset();
    const music = newAsset();
    const handoutImage = newAsset();
    const orphan = newAsset();
    const scene = s.scenes.create(world.id, createSceneSchema.parse({ name: "Cave", width: 1000, height: 1000, assetId: background.id }));
    s.tokens.create(world.id, createTokenSchema.parse({ sceneId: scene.id, name: "Goblin", x: 10, y: 10, assetId: tokenImage.id }));
    s.worlds.setAmbient(world.id, music.id, true);
    s.handouts.create(world.id, handoutInputSchema.parse({ title: "Map", body: `A sketch\n\n![](asset:${handoutImage.id})` }));

    expect(s.assets.deleteOrphans(GRACE_MS, later)).toBe(1);
    expect([background, tokenImage, music, handoutImage].map(exists)).toEqual([true, true, true, true]);
    expect(exists(orphan)).toBe(false);
  });

  it("frees an asset once the floor that used it is gone", async () => {
    const { s, world, newAsset, exists, later } = await setup();
    const background = newAsset();
    const scene = s.scenes.create(world.id, createSceneSchema.parse({ name: "Cave", width: 1000, height: 1000, assetId: background.id }));
    expect(s.assets.deleteOrphans(GRACE_MS, later)).toBe(0);
    s.db.prepare("UPDATE floors SET asset_id = NULL WHERE scene_id = ?").run(scene.id);
    expect(s.assets.deleteOrphans(GRACE_MS, later)).toBe(1);
    expect(exists(background)).toBe(false);
  });
});

describe("a file that cannot be removed", () => {
  it("is skipped and kept registered, and the rest of the sweep still runs", async () => {
    const { s, newAsset, later } = await setup();
    const stuck = newAsset();
    const other = newAsset();
    // A directory where the file should be makes the removal throw, like a file another process holds open on Windows.
    rmSync(s.assets.path(stuck));
    mkdirSync(s.assets.path(stuck));
    mkdirSync(join(s.assets.path(stuck), "inside"));

    expect(s.assets.deleteOrphans(GRACE_MS, later)).toBe(1);
    expect(s.assets.find(other.id)).toBeNull();
    // Still registered, so a later sweep tries it again instead of leaving it on disk unaccounted for.
    expect(s.assets.find(stuck.id)).not.toBeNull();
  });
});
