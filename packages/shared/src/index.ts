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
  "internal_error",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export type InstallationRole = "admin" | "user";
export type WorldRole = "gm" | "player";

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
export const createWorldSchema = z.object({ name: z.string().trim().min(1).max(80) });
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
}

/** Table state sent to a client, already filtered by role on the server. */
export interface WorldStateDto {
  id: string;
  name: string;
  yourRole: WorldRole;
  members: MemberDto[];
}

/** Server → client messages. */
export type ServerMessage =
  | { type: "world.state"; state: WorldStateDto }
  | { type: "error"; code: ErrorCode };

/** Client → server messages. */
export type ClientMessage = { type: "world.resync" };

export const WS_PATH = "/ws";
