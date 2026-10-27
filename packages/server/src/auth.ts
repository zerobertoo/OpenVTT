import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import type { Locale, UserDto } from "@openvtt/shared";
import { type Db, transaction } from "./db.ts";
import { AppError } from "./errors.ts";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: "admin" | "user";
  locale: Locale | null;
}

const toDto = (row: UserRow): UserDto => ({
  id: row.id,
  username: row.username,
  role: row.role,
  locale: row.locale,
});

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export class AuthService {
  // ponytail: in-memory counters reset on restart; persist them if lockouts must survive restarts
  private failures = new Map<string, { count: number; lockedUntil: number }>();

  constructor(
    private db: Db,
    private now: () => number = Date.now,
  ) {}

  /** The first account ever created becomes the installation admin. */
  async register(username: string, password: string): Promise<UserDto> {
    const passwordHash = await hash(password);
    return transaction(this.db, () => {
      const taken = this.db.prepare("SELECT 1 FROM users WHERE username = ?").get(username);
      if (taken) throw new AppError("username_taken");
      const { n } = this.db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
      const row: UserRow = {
        id: randomUUID(),
        username,
        password_hash: passwordHash,
        role: n === 0 ? "admin" : "user",
        locale: null,
      };
      this.db
        .prepare("INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(row.id, row.username, row.password_hash, row.role, this.now());
      return toDto(row);
    });
  }

  /** Verifies credentials, applying a per-username lockout after repeated failures. */
  async login(username: string, password: string): Promise<UserDto> {
    const key = username.toLowerCase();
    const state = this.failures.get(key);
    if (state && state.lockedUntil > this.now()) throw new AppError("too_many_attempts");

    const row = this.db.prepare("SELECT * FROM users WHERE username = ?").get(username) as UserRow | undefined;
    // Verify even for unknown users would need a dummy hash; the lockout already bounds enumeration speed.
    const ok = row ? await verify(row.password_hash, password) : false;
    if (!ok || !row) {
      const lockExpired = state !== undefined && state.lockedUntil > 0 && state.lockedUntil <= this.now();
      const count = (lockExpired ? 0 : (state?.count ?? 0)) + 1;
      this.failures.set(key, {
        count: count >= MAX_FAILED_ATTEMPTS ? 0 : count,
        lockedUntil: count >= MAX_FAILED_ATTEMPTS ? this.now() + LOCKOUT_MS : 0,
      });
      throw new AppError("invalid_credentials");
    }
    this.failures.delete(key);
    return toDto(row);
  }

  createSession(userId: string): string {
    const token = randomBytes(32).toString("base64url");
    this.db
      .prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
      .run(hashToken(token), userId, this.now() + SESSION_TTL_MS);
    return token;
  }

  userFromSession(token: string | undefined): UserDto | null {
    if (!token) return null;
    const row = this.db
      .prepare(
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ?`,
      )
      .get(hashToken(token), this.now()) as UserRow | undefined;
    return row ? toDto(row) : null;
  }

  destroySession(token: string): void {
    this.db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
  }

  setLocale(userId: string, locale: Locale): void {
    this.db.prepare("UPDATE users SET locale = ? WHERE id = ?").run(locale, userId);
  }

  /** Admin-only password reset (no email server required). */
  async resetPassword(actor: UserDto, targetUsername: string, newPassword: string): Promise<void> {
    if (actor.role !== "admin") throw new AppError("forbidden");
    const target = this.db.prepare("SELECT id FROM users WHERE username = ?").get(targetUsername) as { id: string } | undefined;
    if (!target) throw new AppError("not_found");
    this.db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(await hash(newPassword), target.id);
    this.db.prepare("DELETE FROM sessions WHERE user_id = ?").run(target.id);
  }
}
