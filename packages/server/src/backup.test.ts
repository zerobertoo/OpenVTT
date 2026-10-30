import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { buildApp } from "./app.ts";
import { backupDatabase } from "./backup.ts";
import { openDatabase } from "./db.ts";

it("writes a readable copy of the database and keeps only the newest ones", () => {
  const dir = mkdtempSync(join(tmpdir(), "openvtt-backup-"));
  const db = openDatabase(join(dir, "live.db"));
  db.prepare("INSERT INTO worlds (id, name, created_at) VALUES ('w1', 'Saved', 0)").run();
  const backups = join(dir, "backups");
  for (let day = 1; day <= 4; day++) backupDatabase(db, backups, 2, new Date(Date.UTC(2026, 0, day)));

  const kept = readdirSync(backups).sort();
  expect(kept).toEqual(["openvtt-2026-01-03T00-00-00-000Z.db", "openvtt-2026-01-04T00-00-00-000Z.db"]);
  const copy = openDatabase(join(backups, kept[1]!));
  expect(copy.prepare("SELECT name FROM worlds").get()).toEqual({ name: "Saved" });
  copy.close();
  db.close();
});

it("runs on a timer inside the server when asked to", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const dir = mkdtempSync(join(tmpdir(), "openvtt-backup-"));
  const app = buildApp({ dbPath: join(dir, "live.db"), backupIntervalHours: 1, backupKeep: 3 });
  vi.advanceTimersByTime(2 * 3_600_000);
  expect(readdirSync(join(dir, "backups")).length).toBeGreaterThanOrEqual(1);
  await app.close();
  vi.useRealTimers();
});
