import type { IncomingMessage, Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { WS_PATH, type ClientMessage, type ServerMessage } from "@openvtt/shared";
import type { AuthService } from "./auth.ts";
import type { WorldService } from "./worlds.ts";

interface Connection {
  socket: WebSocket;
  userId: string;
  worldId: string;
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/** Authoritative WebSocket hub: one connection = one user inside one world (`/ws?world=<id>`). */
export class Hub {
  private connections = new Set<Connection>();

  constructor(
    private auth: AuthService,
    private worlds: WorldService,
    private cookieName: string,
  ) {}

  /** Detaches all sockets without broadcasting; used on shutdown before the DB closes. */
  closeAll() {
    for (const c of this.connections) c.socket.removeAllListeners("close");
    for (const c of this.connections) c.socket.terminate();
    this.connections.clear();
  }

  attach(server: Server): WebSocketServer {
    const wss = new WebSocketServer({ noServer: true });
    server.on("upgrade", (req, socket, head) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname !== WS_PATH) return socket.destroy();
      const conn = this.authorize(req, url);
      if (!conn) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        return socket.destroy();
      }
      wss.handleUpgrade(req, socket, head, (ws) => this.open(ws, conn.userId, conn.worldId));
    });
    return wss;
  }

  private authorize(req: IncomingMessage, url: URL) {
    const user = this.auth.userFromSession(parseCookies(req.headers.cookie)[this.cookieName]);
    const worldId = url.searchParams.get("world");
    if (!user || !worldId || !this.worlds.roleOf(worldId, user.id)) return null;
    return { userId: user.id, worldId };
  }

  private open(socket: WebSocket, userId: string, worldId: string) {
    const conn: Connection = { socket, userId, worldId };
    this.connections.add(conn);
    this.broadcastState(worldId);
    socket.on("message", (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return this.send(conn, { type: "error", code: "invalid_input" });
      }
      if (msg.type === "world.resync") this.sendState(conn);
      else this.send(conn, { type: "error", code: "invalid_input" });
    });
    socket.on("close", () => {
      this.connections.delete(conn);
      this.broadcastState(worldId);
    });
  }

  private onlineIn(worldId: string): Set<string> {
    const ids = new Set<string>();
    for (const c of this.connections) if (c.worldId === worldId) ids.add(c.userId);
    return ids;
  }

  private send(conn: Connection, msg: ServerMessage) {
    if (conn.socket.readyState === conn.socket.OPEN) conn.socket.send(JSON.stringify(msg));
  }

  private sendState(conn: Connection) {
    const state = this.worlds.stateFor(conn.worldId, conn.userId, this.onlineIn(conn.worldId));
    this.send(conn, { type: "world.state", state });
  }

  /** State is rebuilt per recipient so role-based filtering stays on the server. */
  broadcastState(worldId: string) {
    for (const c of this.connections) if (c.worldId === worldId) this.sendState(c);
  }
}
