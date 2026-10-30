import { type ActorType, actorTypeSchema, type RollResult, type SheetData, type SheetTemplate, type SystemManifest } from "@openvtt/sdk";
import { z } from "zod";

/** Supported UI locales; the first one is the fallback. */
export const SUPPORTED_LOCALES = ["en", "pt-br"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Error codes returned by the server; the client translates them (key `errors.<code>`). */
export const ERROR_CODES = [
  "invalid_input",
  "invalid_credentials",
  "username_taken",
  "too_many_attempts",
  "unauthenticated",
  "forbidden",
  "not_found",
  "invite_invalid",
  "asset_invalid",
  "asset_too_large",
  "roll_invalid",
  "template_invalid",
  "import_invalid",
  "internal_error",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export type InstallationRole = "admin" | "user";
/** `gm` owns the world; an `assistant` runs the table like the game master but cannot manage members; an `observer` only watches. */
export type WorldRole = "gm" | "assistant" | "player" | "observer";
/** What a role may see and do at the table: assistants count as game masters there, observers as players. */
export type TableRole = "gm" | "player";
export const tableRole = (role: WorldRole): TableRole => (role === "gm" || role === "assistant" ? "gm" : "player");

export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9_.-]+$/);
export const passwordSchema = z.string().min(8).max(128);

export const credentialsSchema = z.object({ username: usernameSchema, password: passwordSchema });
export const localeSchema = z.enum(SUPPORTED_LOCALES);
export const updateProfileSchema = z.object({ locale: localeSchema });
export const createWorldSchema = z.object({
  name: z.string().trim().min(1).max(80),
  systemId: z.string().max(40).default("generic"),
});
export const joinWorldSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export interface UserDto {
  id: string;
  username: string;
  role: InstallationRole;
  locale: Locale | null;
}

export interface WorldSummaryDto {
  id: string;
  name: string;
  role: WorldRole;
}

export interface MemberDto {
  userId: string;
  displayName: string;
  color: string;
  role: WorldRole;
  online: boolean;
  /** A muted member cannot write in the chat. */
  muted: boolean;
}

export const createInviteSchema = z.object({
  expiresInHours: z
    .number()
    .int()
    .min(1)
    .max(24 * 30)
    .nullable()
    .default(null),
  maxUses: z.number().int().min(1).max(100).nullable().default(null),
  role: z.enum(["player", "observer"]).default("player"),
});

export const updateMemberSchema = z.object({
  role: z.enum(["assistant", "player", "observer"]).optional(),
  muted: z.boolean().optional(),
});

/** One thing the game master or an assistant did, for the world's action log. */
export interface AuditEntryDto {
  actorName: string;
  action: string;
  detail: string;
  createdAt: number;
}

export const GRID_TYPES = ["square", "hexPointy", "hexFlat", "none"] as const;
/** Hex grids use the cell size as the distance between neighboring hex centers. */
export type GridType = (typeof GRID_TYPES)[number];

export type WallKind = "wall" | "door";

/** A line segment that blocks movement and sight; a door can be opened. Coordinates are map pixels. */
export interface WallDto {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: WallKind;
  /** Only meaningful for doors. */
  open: boolean;
}

export interface LightDto {
  id: string;
  x: number;
  y: number;
  /** Radius in grid cells. */
  radius: number;
  intensity: number;
  /** `#rrggbb`. */
  color: string;
  shadows: boolean;
}

export const DRAWING_KINDS = ["free", "line", "arrow", "rect", "circle", "text", "note"] as const;
export type DrawingKind = (typeof DRAWING_KINDS)[number];
/** `gm` drawings (and every note pin) are never sent to players. */
export const DRAWING_LAYERS = ["background", "objects", "gm"] as const;
export type DrawingLayer = (typeof DRAWING_LAYERS)[number];
/** Everything on a map sits on one of these; a locked layer cannot be changed from the map until it is unlocked. */
export const MAP_LAYERS = ["background", "objects", "tokens", "gm"] as const;
export type MapLayer = (typeof MAP_LAYERS)[number];

/** A mark on the map. `points` is flat `[x1, y1, x2, y2, ...]` in map pixels; shapes use the first two points. */
export interface DrawingDto {
  id: string;
  authorId: string | null;
  kind: DrawingKind;
  layer: DrawingLayer;
  points: number[];
  color: string;
  /** Words of a text or a note pin; empty for shapes. */
  text: string;
}

export const MAX_SCENE_DRAWINGS = 2000;
export const createDrawingSchema = z
  .object({
    kind: z.enum(DRAWING_KINDS),
    layer: z.enum(DRAWING_LAYERS).default("objects"),
    points: z
      .array(z.number().finite().min(-16384).max(16384))
      .min(2)
      .max(4000)
      .refine((p) => p.length % 2 === 0),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default("#ffc914"),
    text: z.string().trim().max(500).default(""),
  })
  .refine((d) => (d.kind === "text" || d.kind === "note" ? d.text.length > 0 : true));

export interface SceneDto {
  id: string;
  name: string;
  assetId: string | null;
  /** What the background asset is, so the client picks a loader without asking the server. */
  assetKind: "image" | "video" | null;
  /** Map size in pixels. */
  width: number;
  height: number;
  gridType: GridType;
  /** Pixels per grid cell. */
  gridSize: number;
  /** Real-world distance of one cell, used by the ruler. */
  gridDistance: number;
  distanceUnit: string;
  /** Walls, doors and lights are game master only until per-player vision exists; players get empty lists. */
  walls: WallDto[];
  lights: LightDto[];
  /** True when the picture already has its lighting drawn in (imported "render lights in image"). */
  bakedLighting: boolean;
  /** Scenes imported together as floors of one map share a group; `floor` orders them (0 = ground). */
  floorGroup: string | null;
  floor: number;
  /** When on, players only see what their own tokens can see (walls, closed doors and light shape it). */
  visionEnabled: boolean;
  /** How far a token sees, in grid cells, before light or walls are considered. */
  visionRadius: number;
  /** Players never receive the `gm` layer. */
  drawings: DrawingDto[];
  lockedLayers: MapLayer[];
}

export interface TokenDto {
  id: string;
  sceneId: string;
  name: string;
  /** Top-left corner in map pixels. */
  x: number;
  y: number;
  /** Side length in grid cells. */
  size: number;
  rotation: number;
  color: string;
  assetId: string | null;
  hidden: boolean;
  actorId: string | null;
  controllerIds: string[];
  /** Current and maximum hit points; both null when the token has no health bar. Only the game master and the token's controllers receive them. */
  hp: number | null;
  hpMax: number | null;
  /** Ids from `TOKEN_CONDITIONS`, visible to everyone who sees the token. */
  conditions: string[];
  /** Whether the name is written under the token on the map. */
  showName: boolean;
}

/** Status effects a token can carry; the interface translates and draws them. */
export const TOKEN_CONDITIONS = [
  "blinded",
  "charmed",
  "deafened",
  "frightened",
  "grappled",
  "incapacitated",
  "invisible",
  "paralyzed",
  "poisoned",
  "prone",
  "restrained",
  "stunned",
  "unconscious",
  "concentrating",
  "dead",
] as const;

export type MessageKind = "chat" | "roll" | "whisper";

export interface MessageDto {
  id: string;
  userId: string;
  senderName: string;
  kind: MessageKind;
  toUserId: string | null;
  gmOnly: boolean;
  content: string;
  roll: RollResult | null;
  createdAt: number;
}

export interface ActorDto {
  id: string;
  type: ActorType;
  name: string;
  ownerId: string | null;
  /** Raw stored values; computed fields are derived on the client with the SDK. */
  data: SheetData;
}

/** Table state sent to a client, already filtered by role on the server. */
/** The area a player can see, as polygons of flat `[x1, y1, x2, y2, ...]` map-pixel coordinates. Walls are never sent. */
export interface VisionDto {
  sceneId: string;
  polygons: number[][];
}

/** Initiative order of a world. Hidden tokens are left out for players, and so is a turn that belongs to one of them. */
export interface CombatDto {
  round: number;
  /** Token whose turn it is; null before the first turn starts. */
  turnTokenId: string | null;
  /** Highest score first; ties keep the order they were added in. */
  combatants: { tokenId: string; name: string; score: number }[];
}

export const setCombatantSchema = z.object({ tokenId: z.string().min(1), score: z.number().finite().min(-1000).max(1000) });

/** A journal entry or handout in markdown. `audience` is `["*"]` for everyone, user ids, or empty for the game master alone. */
export interface HandoutDto {
  id: string;
  title: string;
  body: string;
  audience: string[];
}

const handoutFields = {
  title: z.string().trim().min(1).max(120),
  body: z.string().max(50000),
  audience: z.array(z.union([z.literal("*"), z.string().uuid()])).max(50),
};
export const handoutInputSchema = z.object({
  ...handoutFields,
  body: handoutFields.body.default(""),
  audience: handoutFields.audience.default([]),
});
/** No defaults, so a partial update never wipes what is stored. */
export const updateHandoutSchema = z.object(handoutFields).partial();

export interface AssetSummaryDto {
  id: string;
  mime: string;
  size: number;
  createdAt: number;
}

export const placeCompendiumSchema = z.object({
  sceneId: z.string().uuid(),
  x: z.number().finite().min(-16384).max(16384),
  y: z.number().finite().min(-16384).max(16384),
});

export interface WorldStateDto {
  id: string;
  name: string;
  systemId: string;
  yourRole: WorldRole;
  activeSceneId: string | null;
  members: MemberDto[];
  /** Players only receive the active scene; the GM receives all of them. */
  scenes: SceneDto[];
  tokens: TokenDto[];
  actors: ActorDto[];
  /** Most recent messages the recipient is allowed to read. */
  messages: MessageDto[];
  /** What the recipient can see when the active scene uses vision; null for the game master and for scenes without it. */
  vision: VisionDto | null;
  /** Null while no combat is running. */
  combat: CombatDto | null;
  handouts: HandoutDto[];
  /** What the game master plays for the whole table; null when nothing was picked. */
  ambient: AmbientDto | null;
}

export interface AmbientDto {
  assetId: string;
  playing: boolean;
}

export const setAmbientSchema = z.object({ assetId: z.string().uuid().nullable(), playing: z.boolean() });

/** Server → client messages. */
export type ServerMessage =
  | { type: "world.state"; state: WorldStateDto }
  | { type: "token.upsert"; token: TokenDto }
  | { type: "token.remove"; tokenId: string }
  | { type: "chat.message"; message: MessageDto }
  | { type: "vision.update"; vision: VisionDto | null }
  | { type: "combat.update"; combat: CombatDto | null }
  /** A short-lived marker on the map; `focus` also asks everyone to look at it (game master only). */
  | { type: "map.ping"; ping: PingDto }
  | { type: "error"; code: ErrorCode };

export interface PingDto {
  sceneId: string;
  userId: string;
  /** Scene pixels. */
  x: number;
  y: number;
  focus: boolean;
}

/** Client → server messages. */
export type ClientMessage =
  | { type: "world.resync" }
  | { type: "token.move"; tokenId: string; x: number; y: number }
  /** Marks a spot on the active scene for everybody; `focus` is for the game master. */
  | { type: "map.ping"; x: number; y: number; focus?: boolean }
  /** Game master only: see the table the way this player does (their tokens' sight); null goes back to seeing everything. */
  | { type: "world.viewAs"; userId: string | null };

export const WS_PATH = "/ws";

export const MAX_MAP_DIMENSION = 16384;
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const ALLOWED_VIDEO_TYPES = ["video/webm", "video/mp4"] as const;
/** Table music and ambience; uploaded like videos and capped by the same limit. */
export const ALLOWED_AUDIO_TYPES = ["audio/mpeg", "audio/ogg"] as const;
/** Default cap for animated map videos; the server reads `OPENVTT_MAX_VIDEO_BYTES` to override it. */
export const DEFAULT_MAX_VIDEO_BYTES = 100 * 1024 * 1024;

const mapCoordinate = z.number().finite().min(0).max(MAX_MAP_DIMENSION);
export const wallInputSchema = z.object({
  x1: mapCoordinate,
  y1: mapCoordinate,
  x2: mapCoordinate,
  y2: mapCoordinate,
  kind: z.enum(["wall", "door"]).default("wall"),
  open: z.boolean().default(false),
});
export const lightInputSchema = z.object({
  x: mapCoordinate,
  y: mapCoordinate,
  radius: z.number().finite().min(0).max(200),
  intensity: z.number().finite().min(0).max(10).default(1),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#ffffff"),
  shadows: z.boolean().default(true),
});
export const MAX_SCENE_WALLS = 20000;
export const MAX_SCENE_LIGHTS = 1000;

const sceneFields = {
  name: z.string().trim().min(1).max(80),
  assetId: z.string().uuid().nullable(),
  width: z.number().int().min(1).max(MAX_MAP_DIMENSION),
  height: z.number().int().min(1).max(MAX_MAP_DIMENSION),
  gridType: z.enum(GRID_TYPES),
  gridSize: z.number().int().min(10).max(500),
  gridDistance: z.number().positive().max(1000),
  distanceUnit: z.string().trim().max(10),
  /** Replacing the lists is all-or-nothing; leave them out on update to keep what is stored. */
  walls: z.array(wallInputSchema).max(MAX_SCENE_WALLS),
  lights: z.array(lightInputSchema).max(MAX_SCENE_LIGHTS),
  bakedLighting: z.boolean(),
  floorGroup: z.string().uuid().nullable(),
  floor: z.number().int().min(-20).max(50),
  visionEnabled: z.boolean(),
  visionRadius: z.number().finite().min(1).max(200),
  lockedLayers: z.array(z.enum(MAP_LAYERS)).max(MAP_LAYERS.length),
};
// Defaults live only on creation: Zod 4 would also apply them to a partial update and wipe what is stored.
export const createSceneSchema = z.object({
  ...sceneFields,
  assetId: sceneFields.assetId.default(null),
  gridType: sceneFields.gridType.default("square"),
  gridSize: sceneFields.gridSize.default(70),
  gridDistance: sceneFields.gridDistance.default(5),
  distanceUnit: sceneFields.distanceUnit.default("ft"),
  walls: sceneFields.walls.default([]),
  lights: sceneFields.lights.default([]),
  bakedLighting: sceneFields.bakedLighting.default(false),
  floorGroup: sceneFields.floorGroup.default(null),
  floor: sceneFields.floor.default(0),
  visionEnabled: sceneFields.visionEnabled.default(false),
  visionRadius: sceneFields.visionRadius.default(12),
  lockedLayers: sceneFields.lockedLayers.default([]),
});
export const updateSceneSchema = z.object(sceneFields).partial();

const tokenFields = {
  name: z.string().trim().min(1).max(60),
  x: z.number().finite().min(-MAX_MAP_DIMENSION).max(MAX_MAP_DIMENSION),
  y: z.number().finite().min(-MAX_MAP_DIMENSION).max(MAX_MAP_DIMENSION),
  size: z.number().min(0.25).max(20),
  rotation: z.number().finite().min(-360).max(360),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  assetId: z.string().uuid().nullable(),
  hidden: z.boolean(),
  actorId: z.string().uuid().nullable(),
  controllerIds: z.array(z.string().uuid()).max(20),
  hp: z.number().int().min(-9999).max(99999).nullable(),
  hpMax: z.number().int().min(1).max(99999).nullable(),
  conditions: z.array(z.enum(TOKEN_CONDITIONS)).max(TOKEN_CONDITIONS.length),
  showName: z.boolean(),
};
export const createTokenSchema = z.object({
  sceneId: z.string().uuid(),
  name: tokenFields.name,
  x: tokenFields.x,
  y: tokenFields.y,
  size: tokenFields.size.default(1),
  color: tokenFields.color.default("#3d6fd8"),
  hidden: tokenFields.hidden.default(false),
  actorId: tokenFields.actorId.default(null),
  assetId: tokenFields.assetId.default(null),
  controllerIds: tokenFields.controllerIds.default([]),
  hp: tokenFields.hp.default(null),
  hpMax: tokenFields.hpMax.default(null),
  conditions: tokenFields.conditions.default([]),
  showName: tokenFields.showName.default(false),
});
export const updateTokenSchema = z.object(tokenFields).partial();
/** Fields a non-GM controller may change on their own tokens. */
export const PLAYER_EDITABLE_TOKEN_FIELDS = ["x", "y", "rotation", "hp", "conditions"] as const;

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  toUserId: z.string().uuid().nullable().default(null),
  gmOnly: z.boolean().default(false),
});

export const createActorSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: actorTypeSchema,
});
export const updateActorSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  ownerId: z.string().uuid().nullable().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const updateWorldSchema = z.object({
  activeSceneId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(80).optional(),
  /** Per actor type, a replacement sheet template written by the GM. */
  templateOverrides: z.partialRecord(actorTypeSchema, z.unknown()).optional(),
});

/** What the client needs to render sheets of a world: manifest, templates and label strings. */
export interface SystemInfoDto {
  manifest: SystemManifest;
  templates: Partial<Record<ActorType, SheetTemplate>>;
  strings: Record<string, Record<string, string>>;
  /** Whether the template of the type is a GM override rather than the system default. */
  overridden: ActorType[];
}
export * from "./foundry.ts";
export * from "./geometry.ts";
export * from "./uvtt.ts";
export * from "./vision.ts";
