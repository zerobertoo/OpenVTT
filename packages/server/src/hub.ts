import type { IncomingMessage, Server } from "node:http";
import {
  type MessageDto,
  pathIsBlocked,
  type ServerMessage,
  type TokenDto,
  type VisionDto,
  type WorldRole,
  type WorldStateDto,
  WS_PATH,
} from "@openvtt/shared";
import { type WebSocket, WebSocketServer } from "ws";
import { z } from "zod";
import { canReadMessage } from "./chat.ts";
import { AppError } from "./errors.ts";
import { withoutHiddenMapData } from "./scenes.ts";
import type { Services } from "./services.ts";
import type { Viewer } from "./tokens.ts";
import { flattenPolygons, visionRegion } from "./vision.ts";

interface Connection {
  socket: WebSocket;
  viewer: Viewer;
  worldId: string;
  /** Tokens this connection was last told about while its scene uses vision. */
  seenTokenIds: Set<string>;
}

const MAX_WS_PAYLOAD = 16 * 1024;

const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("world.resync") }),
  z.object({
    type: z.literal("token.move"),
    tokenId: z.string().uuid(),
    x: z.number().finite(),
    y: z.number().finite(),
  }),
]);

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
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

  /** Detaches all sockets without broadcasting; used on shutdown before the DB closes. */
  closeAll() {
    for (const c of this.connections) c.socket.removeAllListeners("close");
    for (const c of this.connections) c.socket.terminate();
    this.connections.clear();
  }

  attach(server: Server): WebSocketServer {
    const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_WS_PAYLOAD });
    server.on("upgrade", (req, socket, head) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname !== WS_PATH) return socket.destroy();
      const identity = this.authorize(req, url);
      if (!identity) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        return socket.destroy();
      }
      wss.handleUpgrade(req, socket, head, (ws) => this.open(ws, identity.viewer, identity.worldId));
    });
    return wss;
  }

  private authorize(req: IncomingMessage, url: URL) {
    const user = this.s.auth.userFromSession(parseCookies(req.headers.cookie)[this.cookieName]);
    const worldId = url.searchParams.get("world");
    const role = user && worldId ? this.s.worlds.roleOf(worldId, user.id) : null;
    return user && worldId && role ? { viewer: { userId: user.id, role }, worldId } : null;
  }

  private open(socket: WebSocket, viewer: Viewer, worldId: string) {
    const conn: Connection = { socket, viewer, worldId, seenTokenIds: new Set() };
    this.connections.add(conn);
    this.broadcastState(worldId);
    socket.on("message", (raw) => {
      try {
        this.handle(conn, clientMessageSchema.parse(JSON.parse(raw.toString())));
      } catch (error) {
        this.send(conn, { type: "error", code: error instanceof AppError ? error.code : "invalid_input" });
      }
    });
    socket.on("close", () => {
      this.connections.delete(conn);
      this.broadcastState(worldId);
    });
  }

  private handle(conn: Connection, msg: z.infer<typeof clientMessageSchema>) {
    if (msg.type === "world.resync") return this.sendState(conn);

    // token.move: validate against the live DB, never trust the client's view of permissions.
    const found = this.s.tokens.find(msg.tokenId);
    if (!found || found.worldId !== conn.worldId) throw new AppError("not_found");
    const activeSceneId = this.s.scenes.activeSceneId(conn.worldId);
    const { token } = found;
    if (!this.s.tokens.canSee(token, conn.viewer, activeSceneId)) throw new AppError("not_found");
    if (!this.s.tokens.canControl(token, conn.viewer)) throw new AppError("forbidden");
    const scene = this.s.scenes.get(token.sceneId)!;
    const x = Math.min(Math.max(msg.x, 0), scene.width);
    const y = Math.min(Math.max(msg.y, 0), scene.height);
    // Players cannot walk through walls or closed doors; the move is dropped and everyone is told the token stayed.
    if (conn.viewer.role !== "gm") {
      const half = (token.size * scene.gridSize) / 2;
      const blockers = scene.walls.filter((w) => w.kind === "wall" || !w.open);
      if (pathIsBlocked({ x: token.x + half, y: token.y + half }, { x: x + half, y: y + half }, blockers)) {
        return this.publishToken(conn.worldId, token, token);
      }
    }
    const after = this.s.tokens.update(token.id, conn.worldId, { x, y });
    this.publishToken(conn.worldId, token, after);
  }

  private onlineIn(worldId: string): Set<string> {
    const ids = new Set<string>();
    for (const c of this.connections) if (c.worldId === worldId) ids.add(c.viewer.userId);
    return ids;
  }

  private send(conn: Connection, msg: ServerMessage) {
    if (conn.socket.readyState === conn.socket.OPEN) conn.socket.send(JSON.stringify(msg));
  }

  /** Builds the complete state a viewer is allowed to see. */
  /**
   * What a player sees through their tokens when the active scene uses vision; null means no restriction (the game
   * master, or a scene without vision). `tokens` are the ones this viewer may be told about.
   */
  private sightOf(worldId: string, viewer: Viewer): { vision: VisionDto; tokens: TokenDto[] } | null {
    if (viewer.role === "gm") return null;
    const activeSceneId = this.s.scenes.activeSceneId(worldId);
    const scene = activeSceneId ? this.s.scenes.get(activeSceneId) : null;
    if (!scene?.visionEnabled) return null;
    const everything = this.s.tokens.visibleTo(worldId, { userId: "", role: "gm" }, scene.id);
    const own = everything.filter((t) => t.controllerIds.includes(viewer.userId));
    const region = visionRegion(scene, own);
    const tokens = this.s.tokens.visibleTo(worldId, viewer, scene.id).filter((t) => {
      const half = (t.size * scene.gridSize) / 2;
      return t.controllerIds.includes(viewer.userId) || region.contains({ x: t.x + half, y: t.y + half });
    });
    return { vision: { sceneId: scene.id, polygons: flattenPolygons(region.polygons) }, tokens };
  }

  /** Brings one player's view in line with what their tokens see now: newly seen tokens appear, others vanish. */
  private refreshSight(conn: Connection, sight: { vision: VisionDto; tokens: TokenDto[] }, changedTokenId: string | null) {
    const next = new Set(sight.tokens.map((t) => t.id));
    for (const token of sight.tokens)
      if (!conn.seenTokenIds.has(token.id) || token.id === changedTokenId) this.send(conn, { type: "token.upsert", token });
    for (const id of conn.seenTokenIds) if (!next.has(id)) this.send(conn, { type: "token.remove", tokenId: id });
    conn.seenTokenIds = next;
    this.send(conn, { type: "vision.update", vision: sight.vision });
  }

  buildState(worldId: string, viewer: Viewer, online: ReadonlySet<string>): WorldStateDto {
    const world = this.s.worlds.info(worldId);
    const activeSceneId = this.s.scenes.activeSceneId(worldId);
    const allScenes = this.s.scenes.list(worldId);
    const sight = this.sightOf(worldId, viewer);
    return {
      id: world.id,
      name: world.name,
      systemId: world.systemId,
      yourRole: viewer.role,
      activeSceneId,
      members: this.s.worlds.members(worldId, online),
      scenes: viewer.role === "gm" ? allScenes : allScenes.filter((sc) => sc.id === activeSceneId).map(withoutHiddenMapData),
      tokens: sight ? sight.tokens : this.s.tokens.visibleTo(worldId, viewer, activeSceneId),
      actors: this.s.actors.visibleTo(worldId, viewer),
      messages: this.s.chat.historyFor(worldId, viewer),
      vision: sight?.vision ?? null,
    };
  }

  private sendState(conn: Connection) {
    // Role is re-read so a role change can never keep stale privileges on an open socket.
    const role: WorldRole | null = this.s.worlds.roleOf(conn.worldId, conn.viewer.userId);
    if (!role) return conn.socket.close();
    conn.viewer.role = role;
    const state = this.buildState(conn.worldId, conn.viewer, this.onlineIn(conn.worldId));
    conn.seenTokenIds = new Set(state.tokens.map((t) => t.id));
    this.send(conn, { type: "world.state", state });
  }

  broadcastState(worldId: string) {
    for (const c of this.connections) if (c.worldId === worldId) this.sendState(c);
  }

  /** `before` is the token prior to the change (null when created); it decides who must be told to drop it. */
  publishToken(worldId: string, before: TokenDto | null, after: TokenDto) {
    const activeSceneId = this.s.scenes.activeSceneId(worldId);
    for (const c of this.connections) {
      if (c.worldId !== worldId) continue;
      const sight = this.sightOf(worldId, c.viewer);
      if (sight) {
        this.refreshSight(c, sight, after.id);
        continue;
      }
      if (this.s.tokens.canSee(after, c.viewer, activeSceneId)) this.send(c, { type: "token.upsert", token: after });
      else if (before && this.s.tokens.canSee(before, c.viewer, activeSceneId)) this.send(c, { type: "token.remove", tokenId: after.id });
    }
  }

  publishTokenRemoved(worldId: string, token: TokenDto) {
    const activeSceneId = this.s.scenes.activeSceneId(worldId);
    for (const c of this.connections) {
      if (c.worldId !== worldId) continue;
      const sight = this.sightOf(worldId, c.viewer);
      if (sight) this.refreshSight(c, sight, null);
      else if (this.s.tokens.canSee(token, c.viewer, activeSceneId)) this.send(c, { type: "token.remove", tokenId: token.id });
    }
  }

  publishMessage(worldId: string, message: MessageDto) {
    for (const c of this.connections)
      if (c.worldId === worldId && canReadMessage(message, c.viewer)) this.send(c, { type: "chat.message", message });
  }
}
