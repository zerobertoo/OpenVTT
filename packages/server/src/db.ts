import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type Db = DatabaseSync;

/** Ordered migrations; the index + 1 is stored in `PRAGMA user_version`. Never edit a released entry. */
const MIGRATIONS: string[] = [
  `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  locale TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS worlds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS members (
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  color TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('gm', 'player')),
  PRIMARY KEY (world_id, user_id)
);
CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
`,
  `
ALTER TABLE worlds ADD COLUMN system_id TEXT NOT NULL DEFAULT 'generic';
ALTER TABLE worlds ADD COLUMN active_scene_id TEXT;
ALTER TABLE worlds ADD COLUMN template_overrides TEXT NOT NULL DEFAULT '{}';
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE scenes (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  grid_type TEXT NOT NULL CHECK (grid_type IN ('square', 'none')),
  grid_size INTEGER NOT NULL,
  grid_distance REAL NOT NULL,
  distance_unit TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE actors (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('character', 'npc')),
  name TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE tokens (
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  size REAL NOT NULL,
  rotation REAL NOT NULL DEFAULT 0,
  color TEXT NOT NULL,
  asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
  hidden INTEGER NOT NULL DEFAULT 0,
  actor_id TEXT REFERENCES actors(id) ON DELETE SET NULL
);
CREATE TABLE token_controllers (
  token_id TEXT NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (token_id, user_id)
);
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('chat', 'roll', 'whisper')),
  to_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  gm_only INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  roll TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX messages_world ON messages (world_id, created_at);
`,
  `
ALTER TABLE scenes ADD COLUMN baked_lighting INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scenes ADD COLUMN floor_group TEXT;
ALTER TABLE scenes ADD COLUMN floor INTEGER NOT NULL DEFAULT 0;
CREATE TABLE walls (
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  x1 REAL NOT NULL,
  y1 REAL NOT NULL,
  x2 REAL NOT NULL,
  y2 REAL NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('wall', 'door')),
  open INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX walls_scene ON walls (scene_id);
CREATE TABLE lights (
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  x REAL NOT NULL,
  y REAL NOT NULL,
  radius REAL NOT NULL,
  intensity REAL NOT NULL,
  color TEXT NOT NULL,
  shadows INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX lights_scene ON lights (scene_id);
`,
];

/** Opens (and creates/migrates if needed) the SQLite database. Use ":memory:" for tests. */
export function openDatabase(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const { user_version: current } = db.prepare("PRAGMA user_version").get() as { user_version: number };
  MIGRATIONS.slice(current).forEach((sql, i) => {
    transaction(db, () => {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${current + i + 1}`);
    });
  });
  return db;
}

/** Runs `fn` inside a transaction, rolling back if it throws. Nested calls join the outer transaction. */
export function transaction<T>(db: Db, fn: () => T): T {
  if (db.isTransaction) return fn();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
