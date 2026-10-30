import type { MemberDto, TokenDto, WorldRole } from "@openvtt/shared";

export interface Permissions {
  /** Game masters run the table: scenes, sheets, every token, invites and settings. */
  isGm: boolean;
  /** The world's owner: invites, roles, muting and kicking. Assistants run the table but cannot do these. */
  isOwner: boolean;
  /** Observers watch the table and change nothing. */
  isObserver: boolean;
  /** Game masters move anything; players move the tokens they were given. */
  canControlToken: (token: Pick<TokenDto, "controllerIds">) => boolean;
  /** Players may only whisper to the game master (the server enforces it too). */
  canWhisperTo: (member: Pick<MemberDto, "userId" | "role">) => boolean;
}

/** What a person may do at the table, from their role and id. The server checks again; this only shapes the interface. */
export function permissionsFor(role: WorldRole | undefined, userId: string): Permissions {
  const isGm = role === "gm" || role === "assistant";
  return {
    isGm,
    isOwner: role === "gm",
    isObserver: role === "observer",
    canControlToken: (token) => isGm || token.controllerIds.includes(userId),
    canWhisperTo: (member) => member.userId !== userId && (isGm || member.role === "gm" || member.role === "assistant"),
  };
}
