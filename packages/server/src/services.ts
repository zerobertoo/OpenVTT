import { join } from "node:path";
import { ActorService } from "./actors.ts";
import { type AssetLimits, AssetService } from "./assets.ts";
import { AuthService } from "./auth.ts";
import { ChatService } from "./chat.ts";
import type { Db } from "./db.ts";
import { SceneService } from "./scenes.ts";
import { SystemRegistry } from "./systems.ts";
import { TokenService } from "./tokens.ts";
import { WorldService } from "./worlds.ts";

export interface Services {
  db: Db;
  dataDir: string;
  auth: AuthService;
  worlds: WorldService;
  assets: AssetService;
  scenes: SceneService;
  tokens: TokenService;
  actors: ActorService;
  chat: ChatService;
  systems: SystemRegistry;
}

export function createServices(db: Db, dataDir: string, builtInSystemsDir: string, assetLimits?: AssetLimits): Services {
  const systems = new SystemRegistry(builtInSystemsDir, join(dataDir, "systems"));
  const assets = new AssetService(db, join(dataDir, "assets"), assetLimits);
  return {
    db,
    dataDir,
    auth: new AuthService(db),
    worlds: new WorldService(db),
    assets,
    scenes: new SceneService(db, assets),
    tokens: new TokenService(db, assets),
    actors: new ActorService(db, systems),
    chat: new ChatService(db),
    systems,
  };
}
