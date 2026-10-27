import { randomBytes, randomUUID } from "node:crypto";
import type { MemberDto, UserDto, WorldRole, WorldStateDto, WorldSummaryDto } from "@openvtt/shared";
import { transaction, type Db } from "./db.ts";
import { AppError } from "./errors.ts";

const DEFAULT_COLORS = ["#e4572e", "#17bebb", "#ffc914", "#76b041", "#7768ae", "#f18f01"];

export class WorldService {
  constructor(private db: Db) {}

  /** Creator becomes GM of the new world. */
  create(user: UserDto, name: string): WorldSummaryDto {
    const id = randomUUID();
    transaction(this.db, () => {
      this.db.prepare("INSERT INTO worlds (id, name, created_at) VALUES (?, ?, ?)").run(id, name, Date.now());
      this.db
        .prepare("INSERT INTO members (world_id, user_id, display_name, color, role) VALUES (?, ?, ?, ?, 'gm')")
        .run(id, user.id, user.username, DEFAULT_COLORS[0]!);
    });
    return { id, name, role: "gm" };
  }

  listFor(user: UserDto): WorldSummaryDto[] {
    return this.db
      .prepare(
        `SELECT w.id, w.name, m.role FROM members m JOIN worlds w ON w.id = m.world_id
         WHERE m.user_id = ? ORDER BY w.created_at`,
      )
      .all(user.id) as unknown as WorldSummaryDto[];
  }

  roleOf(worldId: string, userId: string): WorldRole | null {
    const row = this.db
      .prepare("SELECT role FROM members WHERE world_id = ? AND user_id = ?")
      .get(worldId, userId) as { role: WorldRole } | undefined;
    return row?.role ?? null;
  }

  createInvite(user: UserDto, worldId: string): string {
    if (this.roleOf(worldId, user.id) !== "gm") throw new AppError("forbidden");
    const code = randomBytes(12).toString("base64url");
    this.db.prepare("INSERT INTO invites (code, world_id, created_at) VALUES (?, ?, ?)").run(code, worldId, Date.now());
    return code;
  }

  /** Redeems an invite, making the user a player (idempotent for existing members). */
  join(user: UserDto, code: string, displayName: string, color: string): WorldSummaryDto {
    const invite = this.db
      .prepare("SELECT i.world_id AS id, w.name FROM invites i JOIN worlds w ON w.id = i.world_id WHERE i.code = ?")
      .get(code) as { id: string; name: string } | undefined;
    if (!invite) throw new AppError("invite_invalid");
    const existing = this.roleOf(invite.id, user.id);
    if (existing) return { id: invite.id, name: invite.name, role: existing };
    this.db
      .prepare("INSERT INTO members (world_id, user_id, display_name, color, role) VALUES (?, ?, ?, ?, 'player')")
      .run(invite.id, user.id, displayName, color);
    return { id: invite.id, name: invite.name, role: "player" };
  }

  /** Builds the state a given member is allowed to see. */
  stateFor(worldId: string, userId: string, onlineUserIds: ReadonlySet<string>): WorldStateDto {
    const role = this.roleOf(worldId, userId);
    if (!role) throw new AppError("forbidden");
    const world = this.db.prepare("SELECT id, name FROM worlds WHERE id = ?").get(worldId) as {
      id: string;
      name: string;
    };
    const rows = this.db
      .prepare("SELECT user_id, display_name, color, role FROM members WHERE world_id = ? ORDER BY display_name")
      .all(worldId) as { user_id: string; display_name: string; color: string; role: WorldRole }[];
    const members: MemberDto[] = rows.map((r) => ({
      userId: r.user_id,
      displayName: r.display_name,
      color: r.color,
      role: r.role,
      online: onlineUserIds.has(r.user_id),
    }));
    return { id: world.id, name: world.name, yourRole: role, members };
  }

  memberUserIds(worldId: string): string[] {
    return (this.db.prepare("SELECT user_id FROM members WHERE world_id = ?").all(worldId) as { user_id: string }[]).map(
      (r) => r.user_id,
    );
  }
}
