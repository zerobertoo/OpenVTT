interface Recipient {
  userId: string;
  displayName: string;
}

export type WhisperCommand = { toUserId: string; content: string } | "unknown-recipient" | "empty" | null;

/**
 * Reads `/w Name message`. Names may contain spaces, so the longest matching name wins.
 * Returns null for text that is not a whisper command.
 */
export function parseWhisper(draft: string, recipients: Recipient[]): WhisperCommand {
  const command = /^\/(?:w|whisper)\s+(.*)$/is.exec(draft.trim());
  if (!command) return null;
  const rest = command[1]!;
  const match = [...recipients]
    .sort((a, b) => b.displayName.length - a.displayName.length)
    .find((r) => rest.toLowerCase().startsWith(r.displayName.toLowerCase()) && /^\s|^$/.test(rest.slice(r.displayName.length)));
  if (!match) return "unknown-recipient";
  const content = rest.slice(match.displayName.length).trim();
  return content ? { toUserId: match.userId, content } : "empty";
}

/** The dice part of `/r 1d20+3 adv`, without any advantage keyword; null when the draft is not a roll. */
export function rollBody(draft: string): string | null {
  const roll = /^\/(?:r|roll|gr|gmroll)\s+(.+)$/i.exec(draft.trim());
  return roll ? roll[1]!.replace(/\s*(adv|dis)\s*$/i, "").trim() : null;
}
