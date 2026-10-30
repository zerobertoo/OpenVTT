import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "./db.ts";

const PREFIX = "openvtt-";

/**
 * Writes a consistent copy of the database into `dir` (safe while the server runs) and keeps only the newest `keep`.
 * Assets are not copied: they are immutable files next to the database, so copying that folder is enough.
 */
export function backupDatabase(db: Db, dir: string, keep: number, now = new Date()): string {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${PREFIX}${now.toISOString().replace(/[:.]/g, "-")}.db`);
  db.prepare("VACUUM INTO ?").run(file);
  // ISO timestamps sort by time, so the oldest come first.
  const backups = readdirSync(dir)
    .filter((name) => name.startsWith(PREFIX) && name.endsWith(".db"))
    .sort();
  for (const old of backups.slice(0, Math.max(0, backups.length - keep))) rmSync(join(dir, old), { force: true });
  return file;
}
