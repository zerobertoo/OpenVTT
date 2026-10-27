import { randomBytes, randomUUID } from "node:crypto";
import type { MemberDto, UserDto, WorldRole, WorldSummaryDto } from "@openvtt/shared";
import { type Db, transaction } from "./db.ts";
import { AppError } from "./errors.ts";

const DEFAULT_COLORS = ["#e4572e", "#17bebb", "#ffc914", "#76b041", "#7768ae", "#f18f01"];

export class WorldService {
  constructor(private db: Db) {}

  /** Creator becomes GM of the new world. */
  create(user: UserDto, name: string, systemId = "generic"): WorldSummaryDto {
    const id = randomUUID();
    transaction(this.db, () => {
      this.db.prepare("INSERT INTO worlds (id, name, system_id, created_at) VALUES (?, ?, ?, ?)").run(id, name, systemId, Date.now());
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
    const row = this.db.prepare("SELECT role FROM members WHERE world_id = ? AND user_id = ?").get(worldId, userId) as
      | { role: WorldRole }
      | undefined;
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

  info(worldId: string): { id: string; name: string; systemId: string } {
    const row = this.db.prepare("SELECT id, name, system_id FROM worlds WHERE id = ?").get(worldId) as
      | { id: string; name: string; system_id: string }
      | undefined;
    if (!row) throw new AppError("not_found");
    return { id: row.id, name: row.name, systemId: row.system_id };
  }

  rename(worldId: string, name: string): void {
    this.db.prepare("UPDATE worlds SET name = ? WHERE id = ?").run(name, worldId);
  }

  member(worldId: string, userId: string): { displayName: string; role: WorldRole } | null {
    const row = this.db.prepare("SELECT display_name, role FROM members WHERE world_id = ? AND user_id = ?").get(worldId, userId) as
      | { display_name: string; role: WorldRole }
      | undefined;
    return row ? { displayName: row.display_name, role: row.role } : null;
  }

  members(worldId: string, onlineUserIds: ReadonlySet<string>): MemberDto[] {
    const rows = this.db
      .prepare("SELECT user_id, display_name, color, role FROM members WHERE world_id = ? ORDER BY display_name")
      .all(worldId) as { user_id: string; display_name: string; color: string; role: WorldRole }[];
    return rows.map((r) => ({
      userId: r.user_id,
      displayName: r.display_name,
      color: r.color,
      role: r.role,
      online: onlineUserIds.has(r.user_id),
    }));
  }

  memberUserIds(worldId: string): string[] {
    return (this.db.prepare("SELECT user_id FROM members WHERE world_id = ?").all(worldId) as { user_id: string }[]).map((r) => r.user_id);
  }
}
