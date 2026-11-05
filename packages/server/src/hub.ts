import type { IncomingMessage, Server } from "node:http";
import {
  EFFECT_KINDS,
  type ErrorCode,
  floorOf,
  type MessageDto,
  type ServerMessage,
  type TokenDto,
  tableRole,
  type VisionDto,
  type WorldStateDto,
  WS_PATH,
} from "@openvtt/shared";
import { type WebSocket, WebSocketServer } from "ws";
import { z } from "zod";
import { canReadMessage } from "./chat.ts";
import { AppError } from "./errors.ts";
import { sceneForViewer, withoutHiddenFloorData } from "./scenes.ts";
import type { Services } from "./services.ts";
import { resolveTokenMove, type Viewer } from "./tokens.ts";
import { flattenLights, flattenPolygons, visionRegion } from "./vision.ts";

interface Connection {
  socket: WebSocket;
  viewer: Viewer;
  worldId: string;
  sessionToken: string;
  /** Tokens this connection was last told about while its scene uses vision. */
  seenTokenIds: Set<string>;
  /** Player whose sight the game master is previewing; null shows everything. */
  viewAs: string | null;
  lastPingAt: number;
  /** Effects have their own budget, so a ping never costs the game master an effect or the other way around. */
  lastEffectAt: number;
  /** Re-read with the role on every state sent, so moves and pings need no query of their own. */
  observer: boolean;
  /** Floor of the active scene this connection was last sent (players only); a change means a full state is due. */
  floorId: string | null;
}

const MAX_WS_PAYLOAD = 16 * 1024;

const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("world.resync") }),
  z.object({ type: z.literal("world.viewAs"), userId: z.string().min(1).max(64).nullable() }),
  z.object({
    type: z.literal("token.move"),
    tokenId: z.string().uuid(),
    x: z.number().finite(),
    y: z.number().finite(),
  }),
  z.object({
    type: z.literal("map.ping"),
    x: z.number().finite(),
    y: z.number().finite(),
    focus: z.boolean().optional(),
    floorId: z.string().uuid().optional(),
  }),
  z.object({
    type: z.literal("map.effect"),
    kind: z.enum(EFFECT_KINDS),
    x: z.number().finite(),
    y: z.number().finite(),
    toX: z.number().finite().optional(),
    toY: z.number().finite().optional(),
    value: z.number().int().min(-9999).max(9999).optional(),
    floorId: z.string().uuid().optional(),
  }),
]);

/** Pings are relayed, never stored; this keeps one connection from flooding the table. */
const PING_MIN_INTERVAL_MS = 300;

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeCookieValue(part.slice(i + 1).trim());
  }
  return out;
}

// A value that is not valid percent-encoding is kept as sent: it belongs to some other cookie and must not reject the request.
function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** The code a client gets for a failed message. Bad input is the client's fault; anything else is a server bug and gets logged. */
export function errorCodeForClient(error: unknown): ErrorCode {
  if (error instanceof AppError) return error.code;
  if (error instanceof z.ZodError || error instanceof SyntaxError) return "invalid_input";
  console.error("Unexpected error handling a WebSocket message", error);
  return "internal_error";
}

/**
 * Authoritative WebSocket hub: one connection = one user inside one world (`/ws?world=<id>`).
 * Every outgoing message is built per recipient so hidden data never reaches unauthorized clients.
 */
export class Hub {
  private connections = new Set<Connection>();

  constructor(
    private s: Services,
    private cookieName: string,
  ) {}

  closeSession(sessionToken: string) {
    for (const c of this.connections) if (c.sessionToken === sessionToken) c.socket.close();
  }

  closeUserConnections(userId: string) {
    for (const c of this.connections) if (c.viewer.userId === userId) c.socket.close();
  }

  /** Detaches all sockets without broadcasting; used on shutdown before the DB closes. */
  closeAll() {
    for (const c of this.connections) c.socket.removeAllListeners("close");
    for (const c of this.connections) c.socket.terminate();
    this.connections.clear();
  }

  attach(server: Server): WebSocketServer {
    const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_WS_PAYLOAD });
    server.on("upgrade", (req, socket, head) => {
      // Nothing else catches a throw here: it would end the process, and this runs before any authentication.
      try {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (url.pathname !== WS_PATH) return socket.destroy();
        const identity = this.authorize(req, url);
        if (!identity) {
          socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
          return socket.destroy();
        }
        wss.handleUpgrade(req, socket, head, (ws) => this.open(ws, identity.viewer, identity.worldId, identity.sessionToken));
      } catch {
        socket.destroy();
      }
    });
    return wss;
  }

  private authorize(req: IncomingMessage, url: URL) {
    const sessionToken = parseCookies(req.headers.cookie)[this.cookieName];
    const user = this.s.auth.userFromSession(sessionToken);
    const worldId = url.searchParams.get("world");
    const role = user && worldId ? this.s.worlds.roleOf(worldId, user.id) : null;
    return user && sessionToken && worldId && role ? { viewer: { userId: user.id, role }, worldId, sessionToken } : null;
  }

  private open(socket: WebSocket, viewer: Viewer, worldId: string, sessionToken: string) {
    const conn: Connection = {
      socket,
      viewer,
      worldId,
      sessionToken,
      seenTokenIds: new Set(),
      viewAs: null,
      lastPingAt: 0,
      lastEffectAt: 0,
      observer: true,
      floorId: null,
    };
    this.connections.add(conn);
    this.broadcastState(worldId);
    // Oversized or invalid frames surface here; without a listener the error would end the process.
    socket.on("error", () => socket.terminate());
    socket.on("message", (raw) => {
      try {
        this.handle(conn, clientMessageSchema.parse(JSON.parse(raw.toString())));
      } catch (error) {
        this.send(conn, { type: "error", code: errorCodeForClient(error) });
      }
    });
    socket.on("close", () => {
      this.connections.delete(conn);
      this.broadcastState(worldId);
    });
  }

  private handle(conn: Connection, msg: z.infer<typeof clientMessageSchema>) {
    if (msg.type === "world.resync") return this.sendState(conn);
    if (msg.type === "world.viewAs") return this.previewAs(conn, msg.userId);
    if (msg.type === "map.ping") return this.ping(conn, msg);
    if (msg.type === "map.effect") return this.effect(conn, msg);

    // token.move: validate against the live DB, never trust the client's view of permissions.
    const found = this.s.tokens.find(msg.tokenId);
    if (!found || found.worldId !== conn.worldId) throw new AppError("not_found");
    const activeSceneId = this.s.scenes.activeSceneId(conn.worldId);
    const { token } = found;
    if (!this.s.tokens.canSee(token, conn.viewer, activeSceneId, this.floorIdOf(conn.viewer, activeSceneId)))
      throw new AppError("not_found");
    if (!this.s.tokens.canControl(token, conn.viewer)) throw new AppError("forbidden");
    if (conn.observer) throw new AppError("forbidden");
    const scene = this.s.scenes.get(token.sceneId)!;
    if (scene.lockedLayers.includes("tokens")) return this.publishToken(conn.worldId, token, token);
    const destination = resolveTokenMove(token, scene, msg, conn.viewer.role);
    // A refused move is dropped and everyone is told the token stayed.
    if (!destination) return this.publishToken(conn.worldId, token, token);
    const after = this.s.tokens.update(token.id, conn.worldId, destination);
    this.publishToken(conn.worldId, token, after);
  }

  /** Relays a ping on the active scene to everyone; only the game master can ask the others to look at it. */
  private ping(conn: Connection, msg: { x: number; y: number; focus?: boolean; floorId?: string }) {
    if (conn.observer) return;
    this.relayOnFloor(conn, msg.floorId, (scene, floorId) => ({
      type: "map.ping",
      ping: {
        sceneId: scene.id,
        floorId,
        userId: conn.viewer.userId,
        x: Math.min(Math.max(msg.x, 0), scene.width),
        y: Math.min(Math.max(msg.y, 0), scene.height),
        focus: conn.viewer.role === "gm" && msg.focus === true,
      },
    }));
  }

  /** Relays a visual effect on the active scene to everyone; only the game master can start one. */
  private effect(conn: Connection, msg: Extract<z.infer<typeof clientMessageSchema>, { type: "map.effect" }>) {
    if (conn.viewer.role !== "gm") return;
    const inside = (n: number, max: number) => Math.min(Math.max(n, 0), max);
    // Only what the kind uses is relayed: a landing spot for a projectile, a number for damage, healing and blasts.
    const lands = msg.kind === "projectile" && msg.toX !== undefined && msg.toY !== undefined;
    if (msg.kind === "projectile" && !lands) return;
    const hasNumber = (msg.kind === "damage" || msg.kind === "heal" || msg.kind === "blast") && msg.value !== undefined;
    this.relayOnFloor(
      conn,
      msg.floorId,
      (scene, floorId) => ({
        type: "map.effect",
        effect: {
          sceneId: scene.id,
          floorId,
          kind: msg.kind,
          x: inside(msg.x, scene.width),
          y: inside(msg.y, scene.height),
          ...(lands && { toX: inside(msg.toX!, scene.width), toY: inside(msg.toY!, scene.height) }),
          // A blast's number is its radius in cells; the others show the size of the hit.
          ...(hasNumber && { value: msg.kind === "blast" ? Math.min(Math.max(msg.value!, 1), 10) : Math.abs(msg.value!) }),
        },
      }),
      "lastEffectAt",
    );
  }

  /**
   * Sends a short-lived message about the active scene to everyone who can see the floor it happened on. Rate limited,
   * and never stored.
   */
  private relayOnFloor(
    conn: Connection,
    requestedFloorId: string | undefined,
    build: (scene: { id: string; width: number; height: number }, floorId: string) => ServerMessage,
    budget: "lastPingAt" | "lastEffectAt" = "lastPingAt",
  ) {
    const now = Date.now();
    if (now - conn[budget] < PING_MIN_INTERVAL_MS) return;
    conn[budget] = now;
    const sceneId = this.s.scenes.activeSceneId(conn.worldId);
    const scene = sceneId ? this.s.scenes.get(sceneId) : null;
    if (!scene) return;
    // It belongs to the floor of the person who made it; the game master's floor is the one on screen, so they
    // name it through `floorId` (the table floor when they do not).
    const floorId =
      conn.viewer.role === "gm"
        ? requestedFloorId && this.s.scenes.hasFloor(scene.id, requestedFloorId)
          ? requestedFloorId
          : scene.tableFloorId
        : this.floorIdOf(conn.viewer, scene.id)!;
    const message = build(scene, floorId);
    for (const c of this.connections) {
      if (c.worldId !== conn.worldId) continue;
      // The game master sees every floor's messages; the others only the ones on their own floor.
      if (c.viewer.role === "gm" || this.floorIdOf(c.viewer, scene.id) === floorId) this.send(c, message);
    }
  }

  /**
   * The floor of a scene a viewer is looking at: a player follows their first own token, or the table floor when they
   * have none. The game master is not restricted, so they get null. Never reads the whole scene.
   */
  private floorIdOf(viewer: Viewer, sceneId: string | null): string | null {
    if (viewer.role === "gm" || !sceneId) return null;
    return this.s.tokens.playerFloorId(sceneId, viewer.userId);
  }

  /** The game master previews a player's sight; anyone who is not a player of this world is ignored. */
  private previewAs(conn: Connection, userId: string | null) {
    if (conn.viewer.role !== "gm") throw new AppError("forbidden");
    const target = userId && this.s.worlds.memberRoleOf(conn.worldId, userId) === "player" ? userId : null;
    if (target === conn.viewAs) return;
    conn.viewAs = target;
    this.sendState(conn);
  }

  private onlineIn(worldId: string): Set<string> {
    const ids = new Set<string>();
    for (const c of this.connections) if (c.worldId === worldId) ids.add(c.viewer.userId);
    return ids;
  }

  private send(conn: Connection, msg: ServerMessage) {
    if (conn.socket.readyState === conn.socket.OPEN) conn.socket.send(JSON.stringify(msg));
  }

  /** The person whose eyes a connection sees through: a player themselves, or the player a game master previews. */
  private subjectOf(viewer: Viewer, viewAs: string | null): Viewer | null {
    if (viewer.role !== "gm") return viewer;
    return viewAs ? { userId: viewAs, role: "player" } : null;
  }

  /**
   * What a player sees through their tokens when the active scene uses vision; null means no restriction (the game
   * master, or a scene without vision). `tokens` are the ones this viewer may be told about. A game master who is
   * previewing a player (`viewAs`) gets exactly what that player would get. Only the player's own floor counts.
   */
  private sightOf(worldId: string, viewer: Viewer, viewAs: string | null = null): { vision: VisionDto; tokens: TokenDto[] } | null {
    const subject = this.subjectOf(viewer, viewAs);
    if (!subject) return null;
    const activeSceneId = this.s.scenes.activeSceneId(worldId);
    const scene = activeSceneId ? this.s.scenes.get(activeSceneId) : null;
    if (!scene?.visionEnabled) return null;
    const floorId = this.floorIdOf(subject, scene.id)!;
    const floor = floorOf(scene, floorId);
    const everything = this.s.tokens.visibleTo(worldId, { userId: "", role: "gm" }, scene.id, null);
    const own = everything.filter((t) => t.floorId === floor.id && t.controllerIds.includes(subject.userId));
    const region = visionRegion(scene, floor, own);
    const tokens = this.s.tokens.visibleTo(worldId, subject, scene.id, floor.id).filter((t) => {
      const half = (t.size * scene.gridSize) / 2;
      return t.controllerIds.includes(subject.userId) || region.contains({ x: t.x + half, y: t.y + half });
    });
    return {
      vision: { sceneId: scene.id, polygons: flattenPolygons(region.polygons), lights: flattenLights(region, scene.gridSize) },
      tokens,
    };
  }

  /** Brings one player's view in line with what their tokens see now: newly seen tokens appear, others vanish. */
  private refreshSight(conn: Connection, sight: { vision: VisionDto; tokens: TokenDto[] }, changedTokenId: string | null) {
    const next = new Set(sight.tokens.map((t) => t.id));
    for (const token of sight.tokens)
      if (!conn.seenTokenIds.has(token.id) || token.id === changedTokenId)
        this.send(conn, { type: "token.upsert", token: this.s.tokens.forViewer(token, conn.viewer) });
    for (const id of conn.seenTokenIds) if (!next.has(id)) this.send(conn, { type: "token.remove", tokenId: id });
    conn.seenTokenIds = next;
    this.send(conn, { type: "vision.update", vision: sight.vision });
  }

  /** Floor of the active scene a connection is looking at, as far as it is restricted to one; null for a free game master. */
  private viewFloorIdOf(conn: Pick<Connection, "viewer" | "viewAs">, activeSceneId: string | null): string | null {
    const subject = this.subjectOf(conn.viewer, conn.viewAs);
    return subject ? this.floorIdOf(subject, activeSceneId) : null;
  }

  /** Builds the complete state a viewer is allowed to see. */
  buildState(worldId: string, viewer: Viewer, online: ReadonlySet<string>, viewAs: string | null = null): WorldStateDto {
    const world = this.s.worlds.info(worldId);
    const activeSceneId = this.s.scenes.activeSceneId(worldId);
    const allScenes = this.s.scenes.list(worldId);
    const sight = this.sightOf(worldId, viewer, viewAs);
    const viewFloorId = this.viewFloorIdOf({ viewer, viewAs }, activeSceneId);
    return {
      id: world.id,
      name: world.name,
      systemId: world.systemId,
      yourRole: this.s.worlds.memberRoleOf(worldId, viewer.userId) ?? viewer.role,
      activeSceneId,
      members: this.s.worlds.members(worldId, online),
      scenes:
        viewer.role === "gm"
          ? allScenes
          : allScenes.filter((sc) => sc.id === activeSceneId).map((sc) => sceneForViewer(sc, false, viewFloorId ?? sc.tableFloorId)),
      viewFloorId,
      tokens: sight ? sight.tokens : this.s.tokens.visibleTo(worldId, viewer, activeSceneId, viewFloorId),
      actors: this.s.actors.visibleTo(worldId, viewer),
      messages: this.s.chat.historyFor(worldId, viewer),
      vision: sight?.vision ?? null,
      combat: this.s.combat.stateFor(worldId, viewer, activeSceneId, this.floorIdOf(viewer, activeSceneId)),
      handouts: this.s.handouts.visibleTo(worldId, viewer),
      ambient: this.s.worlds.ambient(worldId),
      environment: this.s.worlds.environment(worldId),
    };
  }

  private sendState(conn: Connection) {
    // Role is re-read so a role change can never keep stale privileges on an open socket.
    const memberRole = this.s.worlds.memberRoleOf(conn.worldId, conn.viewer.userId);
    if (!memberRole) return conn.socket.close();
    const role = tableRole(memberRole);
    conn.viewer.role = role;
    conn.observer = memberRole === "observer";
    if (role !== "gm") conn.viewAs = null;
    const state = this.buildState(conn.worldId, conn.viewer, this.onlineIn(conn.worldId), conn.viewAs);
    conn.seenTokenIds = new Set(state.tokens.map((t) => t.id));
    conn.floorId = state.viewFloorId;
    this.send(conn, { type: "world.state", state });
  }

  /** Players get one floor's drawings without the game master's layer, only when they are on that floor of the active scene. */
  publishDrawings(worldId: string, sceneId: string, floorId: string) {
    const scene = this.s.scenes.get(sceneId);
    const floor = scene?.floors.find((f) => f.id === floorId);
    if (!scene || !floor) return;
    const activeSceneId = this.s.scenes.activeSceneId(worldId);
    const forPlayers = withoutHiddenFloorData(floor).drawings;
    for (const c of this.connections) {
      if (c.worldId !== worldId) continue;
      if (c.viewer.role === "gm") this.send(c, { type: "scene.drawings", sceneId, floorId, drawings: floor.drawings });
      else if (sceneId === activeSceneId && this.floorIdOf(c.viewer, sceneId) === floorId)
        this.send(c, { type: "scene.drawings", sceneId, floorId, drawings: forPlayers });
    }
  }

  broadcastState(worldId: string) {
    for (const c of this.connections) if (c.worldId === worldId) this.sendState(c);
  }

  /** `before` is the token prior to the change (null when created); it decides who must be told to drop it. */
  publishToken(worldId: string, before: TokenDto | null, after: TokenDto) {
    const activeSceneId = this.s.scenes.activeSceneId(worldId);
    for (const c of this.connections) {
      if (c.worldId !== worldId) continue;
      // A token created, moved to another floor or taken away can change the floor a player is on: send everything again.
      const floorId = this.viewFloorIdOf(c, activeSceneId);
      if (floorId !== c.floorId) {
        this.sendState(c);
        continue;
      }
      const sight = this.sightOf(worldId, c.viewer, c.viewAs);
      if (sight) {
        this.refreshSight(c, sight, after.id);
        continue;
      }
      if (this.s.tokens.canSee(after, c.viewer, activeSceneId, floorId))
        this.send(c, { type: "token.upsert", token: this.s.tokens.forViewer(after, c.viewer) });
      else if (before && this.s.tokens.canSee(before, c.viewer, activeSceneId, floorId))
        this.send(c, { type: "token.remove", tokenId: after.id });
    }
  }

  publishTokenRemoved(worldId: string, token: TokenDto) {
    const activeSceneId = this.s.scenes.activeSceneId(worldId);
    for (const c of this.connections) {
      if (c.worldId !== worldId) continue;
      const floorId = this.viewFloorIdOf(c, activeSceneId);
      if (floorId !== c.floorId) {
        this.sendState(c);
        continue;
      }
      const sight = this.sightOf(worldId, c.viewer, c.viewAs);
      if (sight) this.refreshSight(c, sight, null);
      else if (this.s.tokens.canSee(token, c.viewer, activeSceneId, floorId)) this.send(c, { type: "token.remove", tokenId: token.id });
    }
  }

  /** Sends each person the initiative order they may see. */
  publishCombat(worldId: string) {
    const activeSceneId = this.s.scenes.activeSceneId(worldId);
    for (const c of this.connections)
      if (c.worldId === worldId)
        this.send(c, {
          type: "combat.update",
          combat: this.s.combat.stateFor(worldId, c.viewer, activeSceneId, this.floorIdOf(c.viewer, activeSceneId)),
        });
  }

  publishMessage(worldId: string, message: MessageDto) {
    for (const c of this.connections)
      if (c.worldId === worldId && canReadMessage(message, c.viewer)) this.send(c, { type: "chat.message", message });
  }
}
