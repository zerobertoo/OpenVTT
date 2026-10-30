import { randomBytes, randomUUID } from "node:crypto";
import {
  type AmbientDto,
  type AuditEntryDto,
  type MemberDto,
  type TableRole,
  tableRole,
  type UserDto,
  type WorldRole,
  type WorldSummaryDto,
} from "@openvtt/shared";
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

  /** The role as the table sees it (assistants are game masters, observers players); null for non-members. */
  roleOf(worldId: string, userId: string): TableRole | null {
    const role = this.memberRoleOf(worldId, userId);
    return role ? tableRole(role) : null;
  }

  memberRoleOf(worldId: string, userId: string): WorldRole | null {
    const row = this.db.prepare("SELECT role FROM members WHERE world_id = ? AND user_id = ?").get(worldId, userId) as
      | { role: WorldRole }
      | undefined;
    return row?.role ?? null;
  }

  createInvite(
    user: UserDto,
    worldId: string,
    options: { expiresInHours: number | null; maxUses: number | null; role: WorldRole },
  ): string {
    if (this.memberRoleOf(worldId, user.id) !== "gm") throw new AppError("forbidden");
    const code = randomBytes(12).toString("base64url");
    const now = Date.now();
    this.db
      .prepare("INSERT INTO invites (code, world_id, created_at, expires_at, max_uses, role) VALUES (?, ?, ?, ?, ?, ?)")
      .run(code, worldId, now, options.expiresInHours ? now + options.expiresInHours * 3_600_000 : null, options.maxUses, options.role);
    return code;
  }

  /** Redeems an invite, making the user a player (idempotent for existing members). */
  join(user: UserDto, code: string, displayName: string, color: string): WorldSummaryDto {
    const invite = this.db
      .prepare(
        "SELECT i.world_id AS id, w.name, i.expires_at, i.max_uses, i.uses, i.role FROM invites i JOIN worlds w ON w.id = i.world_id WHERE i.code = ?",
      )
      .get(code) as
      | { id: string; name: string; expires_at: number | null; max_uses: number | null; uses: number; role: WorldRole }
      | undefined;
    if (!invite) throw new AppError("invite_invalid");
    const existing = this.memberRoleOf(invite.id, user.id);
    if (existing) return { id: invite.id, name: invite.name, role: existing };
    if ((invite.expires_at !== null && invite.expires_at < Date.now()) || (invite.max_uses !== null && invite.uses >= invite.max_uses))
      throw new AppError("invite_invalid");
    transaction(this.db, () => {
      this.db.prepare("UPDATE invites SET uses = uses + 1 WHERE code = ?").run(code);
      this.db
        .prepare("INSERT INTO members (world_id, user_id, display_name, color, role) VALUES (?, ?, ?, ?, ?)")
        .run(invite.id, user.id, displayName, color, invite.role);
    });
    return { id: invite.id, name: invite.name, role: invite.role };
  }

  info(worldId: string): { id: string; name: string; systemId: string } {
    const row = this.db.prepare("SELECT id, name, system_id FROM worlds WHERE id = ?").get(worldId) as
      | { id: string; name: string; system_id: string }
      | undefined;
    if (!row) throw new AppError("not_found");
    return { id: row.id, name: row.name, systemId: row.system_id };
  }

  ambient(worldId: string): AmbientDto | null {
    const row = this.db.prepare("SELECT ambient_asset_id, ambient_playing FROM worlds WHERE id = ?").get(worldId) as
      | { ambient_asset_id: string | null; ambient_playing: number }
      | undefined;
    return row?.ambient_asset_id ? { assetId: row.ambient_asset_id, playing: row.ambient_playing === 1 } : null;
  }

  setAmbient(worldId: string, assetId: string | null, playing: boolean): void {
    this.db
      .prepare("UPDATE worlds SET ambient_asset_id = ?, ambient_playing = ? WHERE id = ?")
      .run(assetId, assetId && playing ? 1 : 0, worldId);
  }

  rename(worldId: string, name: string): void {
    this.db.prepare("UPDATE worlds SET name = ? WHERE id = ?").run(name, worldId);
  }

  member(worldId: string, userId: string): { displayName: string; role: WorldRole; muted: boolean } | null {
    const row = this.db.prepare("SELECT display_name, role, muted FROM members WHERE world_id = ? AND user_id = ?").get(worldId, userId) as
      | { display_name: string; role: WorldRole; muted: number }
      | undefined;
    return row ? { displayName: row.display_name, role: row.role, muted: row.muted === 1 } : null;
  }

  /** The owner changes another member's role or mutes them; the owner themselves cannot be changed. */
  updateMember(worldId: string, userId: string, patch: { role?: WorldRole; muted?: boolean }) {
    const current = this.member(worldId, userId);
    if (!current) throw new AppError("not_found");
    if (current.role === "gm") throw new AppError("forbidden");
    this.db
      .prepare("UPDATE members SET role = ?, muted = ? WHERE world_id = ? AND user_id = ?")
      .run(patch.role ?? current.role, (patch.muted ?? current.muted) ? 1 : 0, worldId, userId);
  }

  /** Removes a member and every link to them: token control, sheet ownership and handout sharing. */
  kick(worldId: string, userId: string) {
    const current = this.member(worldId, userId);
    if (!current) throw new AppError("not_found");
    if (current.role === "gm") throw new AppError("forbidden");
    transaction(this.db, () => {
      this.db.prepare("DELETE FROM members WHERE world_id = ? AND user_id = ?").run(worldId, userId);
      this.db
        .prepare(
          "DELETE FROM token_controllers WHERE user_id = ? AND token_id IN (SELECT t.id FROM tokens t JOIN scenes s ON s.id = t.scene_id WHERE s.world_id = ?)",
        )
        .run(userId, worldId);
      this.db.prepare("UPDATE actors SET owner_id = NULL WHERE world_id = ? AND owner_id = ?").run(worldId, userId);
      this.db
        .prepare(
          "UPDATE handouts SET audience = (SELECT json_group_array(value) FROM json_each(handouts.audience) WHERE value <> ?) WHERE world_id = ?",
        )
        .run(userId, worldId);
    });
  }

  audit(worldId: string, userId: string, action: string, detail = "") {
    const actor = this.member(worldId, userId)?.displayName ?? "?";
    this.db
      .prepare("INSERT INTO audit_log (world_id, actor_name, action, detail, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(worldId, actor, action, detail, Date.now());
  }

  auditLog(worldId: string): AuditEntryDto[] {
    const rows = this.db
      .prepare("SELECT actor_name, action, detail, created_at FROM audit_log WHERE world_id = ? ORDER BY id DESC LIMIT 200")
      .all(worldId) as { actor_name: string; action: string; detail: string; created_at: number }[];
    return rows.map((r) => ({ actorName: r.actor_name, action: r.action, detail: r.detail, createdAt: r.created_at }));
  }

  members(worldId: string, onlineUserIds: ReadonlySet<string>): MemberDto[] {
    const rows = this.db
      .prepare("SELECT user_id, display_name, color, role, muted FROM members WHERE world_id = ? ORDER BY display_name")
      .all(worldId) as { user_id: string; display_name: string; color: string; role: WorldRole; muted: number }[];
    return rows.map((r) => ({
      userId: r.user_id,
      displayName: r.display_name,
      color: r.color,
      role: r.role,
      online: onlineUserIds.has(r.user_id),
      muted: r.muted === 1,
    }));
  }

  memberUserIds(worldId: string): string[] {
    return (this.db.prepare("SELECT user_id FROM members WHERE world_id = ?").all(worldId) as { user_id: string }[]).map((r) => r.user_id);
  }
}
