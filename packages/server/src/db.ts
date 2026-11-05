import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type Db = DatabaseSync;

/** Ordered migrations; the index + 1 is stored in `PRAGMA user_version`. Never edit a released entry. */
export const MIGRATIONS: string[] = [
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
  `
ALTER TABLE scenes ADD COLUMN vision_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scenes ADD COLUMN vision_radius REAL NOT NULL DEFAULT 12;
`,
  `
CREATE TABLE IF NOT EXISTS combats (
  world_id TEXT PRIMARY KEY REFERENCES worlds(id) ON DELETE CASCADE,
  round INTEGER NOT NULL DEFAULT 1,
  turn_token_id TEXT REFERENCES tokens(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS combatants (
  token_id TEXT PRIMARY KEY REFERENCES tokens(id) ON DELETE CASCADE,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  score REAL NOT NULL
);
`,
  `
ALTER TABLE tokens ADD COLUMN hp INTEGER;
ALTER TABLE tokens ADD COLUMN hp_max INTEGER;
ALTER TABLE tokens ADD COLUMN conditions TEXT NOT NULL DEFAULT '[]';
ALTER TABLE tokens ADD COLUMN show_name INTEGER NOT NULL DEFAULT 0;
`,
  `
CREATE TABLE drawings (
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  layer TEXT NOT NULL,
  points TEXT NOT NULL,
  color TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT ''
);
CREATE INDEX drawings_scene ON drawings (scene_id);
`,
  `
ALTER TABLE scenes ADD COLUMN locked_layers TEXT NOT NULL DEFAULT '[]';
`,
  // grid_type keeps its original CHECK; a hex grid is stored as 'square' plus its orientation here.
  `
ALTER TABLE scenes ADD COLUMN grid_hex TEXT;
`,
  `
CREATE TABLE handouts (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);
CREATE INDEX handouts_world ON handouts (world_id);
`,
  `
ALTER TABLE worlds ADD COLUMN ambient_asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL;
ALTER TABLE worlds ADD COLUMN ambient_playing INTEGER NOT NULL DEFAULT 0;
`,
  // Nothing references members, so the table can be rebuilt to widen its role CHECK.
  `
CREATE TABLE members_new (
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  color TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('gm', 'assistant', 'player', 'observer')),
  muted INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (world_id, user_id)
);
INSERT INTO members_new (world_id, user_id, display_name, color, role) SELECT world_id, user_id, display_name, color, role FROM members;
DROP TABLE members;
ALTER TABLE members_new RENAME TO members;
ALTER TABLE invites ADD COLUMN expires_at INTEGER;
ALTER TABLE invites ADD COLUMN max_uses INTEGER;
ALTER TABLE invites ADD COLUMN uses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invites ADD COLUMN role TEXT NOT NULL DEFAULT 'player';
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX audit_log_world ON audit_log (world_id, created_at);
`,
  // Floors: a scene's background, walls, lights, drawings and tokens now belong to one of its floors. Every existing
  // scene becomes a scene with a single floor that reuses the scene's id. `scenes.asset_id`, `floor_group` and
  // `floor` stay as unused columns (SQLite cannot drop a column that carries a foreign key).
  `
CREATE TABLE floors (
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL
);
CREATE INDEX floors_scene ON floors (scene_id, position);
INSERT INTO floors (id, scene_id, name, position, asset_id) SELECT id, id, name, 0, asset_id FROM scenes;
ALTER TABLE scenes ADD COLUMN table_floor_id TEXT NOT NULL DEFAULT '';
UPDATE scenes SET table_floor_id = id;
ALTER TABLE walls ADD COLUMN floor_id TEXT REFERENCES floors(id) ON DELETE CASCADE;
UPDATE walls SET floor_id = scene_id;
ALTER TABLE lights ADD COLUMN floor_id TEXT REFERENCES floors(id) ON DELETE CASCADE;
UPDATE lights SET floor_id = scene_id;
ALTER TABLE drawings ADD COLUMN floor_id TEXT REFERENCES floors(id) ON DELETE CASCADE;
UPDATE drawings SET floor_id = scene_id;
ALTER TABLE tokens ADD COLUMN floor_id TEXT REFERENCES floors(id) ON DELETE CASCADE;
UPDATE tokens SET floor_id = scene_id;
CREATE INDEX walls_floor ON walls (floor_id);
CREATE INDEX lights_floor ON lights (floor_id);
CREATE INDEX drawings_floor ON drawings (floor_id);
CREATE INDEX tokens_floor ON tokens (floor_id);
`,
  // When the game master last moved a token to another floor: a player looks at the floor of the token moved most recently.
  `ALTER TABLE tokens ADD COLUMN floor_changed_at INTEGER NOT NULL DEFAULT 0;`,
  // Lighting: how dark a scene is (1 = fully lit, today's look) and how softly each light fades out at its edge.
  `ALTER TABLE scenes ADD COLUMN ambient_light REAL NOT NULL DEFAULT 1;
ALTER TABLE lights ADD COLUMN feather REAL NOT NULL DEFAULT 0.4;`,
  // Table music volume set by the game master for everyone.
  `ALTER TABLE worlds ADD COLUMN ambient_volume REAL NOT NULL DEFAULT 1;`,
  // Time of day, weather and season laid over the map for everyone.
  `ALTER TABLE worlds ADD COLUMN env_time TEXT NOT NULL DEFAULT 'day';
ALTER TABLE worlds ADD COLUMN env_weather TEXT NOT NULL DEFAULT 'clear';
ALTER TABLE worlds ADD COLUMN env_season TEXT NOT NULL DEFAULT 'none';`,
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
